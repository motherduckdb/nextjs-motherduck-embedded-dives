import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import {
  canAccessEditSessionDive,
  getEditSession,
  getEditSessionMotherDuckAccess,
} from "@/app/_lib/auth";
import { assertSameOrigin } from "@/app/_lib/csrf";
import {
  insertChatMessage,
  touchChatSession,
  updateChatSessionTitle,
  findChatSessionForEditSession,
  createChatSessionForEditSession,
} from "@/app/_lib/db";
import { getMcpClient } from "@/app/_lib/motherduck-access";
import { adaptMotherDuckToolsForChat } from "@/app/_lib/chat/motherduck-tools";
import { getModel } from "@/app/_lib/chat/ai-provider";
import {
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MESSAGE_WORDS,
  MAX_CHAT_STEPS,
  MAX_CHAT_TURNS,
} from "@/app/_lib/chat/limits";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildSystemPrompt } from "@/app/_lib/chat/system-prompt";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getExhaustionMessage(finishReason: string | undefined) {
  if (finishReason === "length") {
    return "Failed because response hit length limit. Try a smaller change.";
  }

  if (finishReason === "tool-calls") {
    return "Failed after too many tool attempts. Try a smaller change.";
  }

  return null;
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const editSession = await getEditSession(req);
  if (!editSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    messages,
    provider,
    sessionId,
    activeDiveId,
  }: { messages: UIMessage[]; provider?: string; sessionId?: string; activeDiveId?: string } =
    await req.json();

  const userTurns = messages.filter((msg) => msg.role === "user").length;
  if (userTurns > MAX_CHAT_TURNS) {
    return NextResponse.json(
      { error: `Chat turn limit reached (${MAX_CHAT_TURNS}).` },
      { status: 429 }
    );
  }

  for (const message of messages) {
    if (message.role !== "user") continue;

    const textContent = getMessageText(message);
    if (
      textContent.length > MAX_CHAT_MESSAGE_CHARS ||
      countWords(textContent) > MAX_CHAT_MESSAGE_WORDS
    ) {
      return NextResponse.json(
        { error: `Message limit exceeded (${MAX_CHAT_MESSAGE_WORDS} words / ${MAX_CHAT_MESSAGE_CHARS} chars).` },
        { status: 400 }
      );
    }
  }

  let model;
  try {
    model = getModel(provider);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  // Persist the latest user message if we have a session
  if (sessionId) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") {
      const textContent = getMessageText(lastMsg);

      // Ensure session exists (auto-create if needed)
      let session = await findChatSessionForEditSession(sessionId, editSession.id);
      if (!session) {
        const title = textContent.slice(0, 100) || "New Chat";
        session = await createChatSessionForEditSession(
          sessionId,
          editSession.id,
          title
        );
      }

      await insertChatMessage({
        id: lastMsg.id || randomUUID(),
        session_id: sessionId,
        role: "user",
        content: textContent,
        parts_json: JSON.stringify(lastMsg.parts),
      });

      // Auto-title session from first user message
      if (session.title === "New Chat" && textContent) {
        await updateChatSessionTitle(
          sessionId,
          textContent.slice(0, 100)
        );
      }

      await touchChatSession(sessionId);
    }
  }

  if (!activeDiveId) {
    return NextResponse.json(
      { error: "activeDiveId is required" },
      { status: 400 }
    );
  }
  if (!(await canAccessEditSessionDive(editSession, activeDiveId))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const diveId = activeDiveId;

  const mcpClient = await getMcpClient(
    await getEditSessionMotherDuckAccess(editSession)
  );
  const tools = adaptMotherDuckToolsForChat(await mcpClient.tools());

  const result = streamText({
    model,
    system: buildSystemPrompt(diveId),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(MAX_CHAT_STEPS),
    async onFinish({ response, usage, providerMetadata }) {
      if (!sessionId) return;
      // Persist all assistant messages from this response
      for (const msg of response.messages) {
        if (msg.role !== "assistant") continue;
        const text =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter(
                    (c): c is { type: "text"; text: string } =>
                      typeof c === "object" && c.type === "text"
                  )
                  .map((p) => p.text)
                  .join("")
              : "";
        await insertChatMessage({
          id: randomUUID(),
          session_id: sessionId,
          role: "assistant",
          content: text,
          parts_json: null, // parts are reconstructed from content on load
        });
      }

      await touchChatSession(sessionId);

      // Cache observability logging (dev only)
      if (process.env.NODE_ENV === "development") {
        const cacheRead = usage?.inputTokenDetails?.cacheReadTokens ?? 0;
        const cacheWrite = usage?.inputTokenDetails?.cacheWriteTokens ?? 0;
        const totalInput = usage?.inputTokens ?? 0;
        const cacheHitRatio =
          totalInput > 0 ? ((cacheRead / totalInput) * 100).toFixed(1) : "0.0";
        console.log(
          `[chat] session=${sessionId} provider=${provider ?? "default"} ` +
            `inputTokens=${totalInput} cacheRead=${cacheRead} cacheWrite=${cacheWrite} ` +
            `cacheHitRatio=${cacheHitRatio}%` +
            (providerMetadata?.anthropic?.cacheCreationInputTokens != null
              ? ` anthropicCacheCreation=${providerMetadata.anthropic.cacheCreationInputTokens}`
              : "")
        );
      }
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata({ part }) {
      if (part.type !== "finish") return undefined;

      const exhaustionMessage = getExhaustionMessage(part.finishReason);
      if (!exhaustionMessage) return { finishReason: part.finishReason };

      return {
        exhausted: true,
        finishReason: part.finishReason,
        exhaustionMessage,
      };
    },
  });
}
