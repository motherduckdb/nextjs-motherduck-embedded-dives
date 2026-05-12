"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DIVE_MODIFY_TOOLS,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MESSAGE_WORDS,
  MAX_CHAT_TURNS,
} from "@/app/_lib/chat/limits";
import {
  EDIT_SESSION_DIVE_ID_KEY,
  EDIT_SESSION_DIVE_IDS_KEY,
  EDIT_SESSION_MODE_KEY,
  getStoredSessionSecret,
  EDIT_SESSION_STARTER_KEY,
} from "@/app/_lib/edit-session-client";
import AccountMenu from "@/app/account-menu";
import { AppHeader, RepoLink } from "@/app/_components/header";
import { BrutalistButton } from "@/app/_components/brutalist-button";
import {
  CheckIcon,
  SparklesIcon,
  XIcon,
} from "@/app/_components/icons";

const CUSTOMIZE_SUGGESTIONS: Record<string, string[]> = {
  "presentation-dive": [
    "Add a slide summarizing the key takeaway",
    "Make the title slide more visual",
    "Add a closing slide with next steps",
  ],
  "dashboard-dive": [
    "Add a filter for date range",
    "Add buttons to sort the table by columns",
    "Support light mode",
  ],
  "game-dive": [
    "Change the number of rounds to 5",
    "Add a score streak bonus",
    "Make the result feedback more dramatic",
  ],
};

const DEFAULT_CUSTOMIZE_SUGGESTIONS = [
  "Add a filter for date range",
  "Add a section summarizing the key takeaway",
  "Support light mode",
];

type DiveMeta = {
  title: string;
  description: string;
};

function ToolCallDetails({ part }: { part: { input?: unknown; output?: unknown; state: string } }) {
  const [open, setOpen] = useState(false);

  const payload: Record<string, unknown> = {};
  if (part.input !== undefined) payload.input = part.input;
  if (part.state === "output-available" && part.output !== undefined) payload.output = part.output;

  if (Object.keys(payload).length === 0) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-1"
    >
      <summary className="cursor-pointer text-[11px] text-ink-muted select-none hover:text-ink-primary">
        {open ? "Hide" : "Show"} details
      </summary>
      <pre className="mt-1 p-2 rounded-[2px] bg-surface-0 border border-divider text-[11px] leading-relaxed overflow-x-auto max-h-60 overflow-y-auto text-ink-muted">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  );
}

function generateId() {
  return crypto.randomUUID();
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isErrorToolOutput(output: unknown) {
  return Boolean(
    output &&
      typeof output === "object" &&
      "isError" in output &&
      (output as { isError?: unknown }).isError === true
  );
}

function getExhaustionMessage(metadata: unknown) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("exhausted" in metadata) ||
    (metadata as { exhausted?: unknown }).exhausted !== true
  ) {
    return null;
  }

  const message = (metadata as { exhaustionMessage?: unknown }).exhaustionMessage;
  return typeof message === "string" ? message : "Failed after too many tries.";
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function EditClient() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [embedSession, setEmbedSession] = useState<string | null>(null);
  const [embedKey, setEmbedKey] = useState(0);
  const [activeDiveId, setActiveDiveId] = useState<string | null>(null);
  const [activeStarterKey, setActiveStarterKey] = useState("presentation-dive");
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const [diveLoading, setDiveLoading] = useState(true);
  const diveError = null;
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [diveMeta, setDiveMeta] = useState<DiveMeta | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshedToolCallIds = useRef<Set<string>>(new Set());

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState<number | null>(null);
  const [reverting, setReverting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState("initial-chat-session");

  const containerRef = useRef<HTMLDivElement>(null);
  const sessionSecretRef = useRef<string | null>(null);
  const activeDiveIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);

  sessionSecretRef.current = sessionSecret;
  activeDiveIdRef.current = activeDiveId;
  activeSessionIdRef.current = activeSessionId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: (): Record<string, string> => {
          const currentSessionSecret = sessionSecretRef.current;
          return currentSessionSecret ? { Authorization: `Bearer ${currentSessionSecret}` } : {};
        },
        body: () => ({
          sessionId: activeSessionIdRef.current,
          activeDiveId: activeDiveIdRef.current,
        }),
      }),
    []
  );

  const { messages, sendMessage, stop, status, setMessages } = useChat({
    transport,
    id: activeSessionId,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const chatTurnCount = messages.filter((msg) => msg.role === "user").length;
  const turnLimitReached = chatTurnCount >= MAX_CHAT_TURNS;
  const inputWordCount = countWords(input);
  const messageLimitReached =
    input.length > MAX_CHAT_MESSAGE_CHARS || inputWordCount > MAX_CHAT_MESSAGE_WORDS;

  const fetchEmbedSession = useCallback(async (diveId: string, sessionSecret?: string | null) => {
    try {
      const res = await fetch(`/api/dives/${diveId}/embed`, {
        headers: sessionSecret ? { Authorization: `Bearer ${sessionSecret}` } : {},
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setEmbedError("Failed to load embed session.");
        return;
      }
      const data = await res.json();
      if (data.session) {
        setEmbedSession(data.session);
        setEmbedError(null);
      }
    } catch (err) {
      console.error("Failed to fetch embed session:", err);
      setEmbedError("Could not connect to the embed service.");
    }
  }, [router]);

  const loadSnapshotVersion = useCallback(async (diveId: string, sessionSecret?: string | null) => {
    try {
      const res = await fetch(`/api/dives/${diveId}/version`, {
        headers: sessionSecret ? { Authorization: `Bearer ${sessionSecret}` } : {},
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSnapshotVersion(data.version);
      }
    } catch {
      // proceed without snapshot
    }
  }, [router]);

  const loadDiveMeta = useCallback(async (diveId: string, sessionSecret?: string | null) => {
    try {
      const res = await fetch("/api/gallery", {
        cache: "no-store",
        headers: sessionSecret ? { Authorization: `Bearer ${sessionSecret}` } : {},
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        dives?: Array<{ diveId: string; key: string; title: string; description: string }>;
      };
      const dive = data.dives?.find((item) => item.diveId === diveId || item.key === diveId);
      if (dive) {
        setDiveMeta({ title: dive.title, description: dive.description });
      }
    } catch {
      // Metadata is optional chrome; embed still loads independently.
    }
  }, []);

  useEffect(() => {
    const storedSessionSecret = getStoredSessionSecret();
    const storedDiveId = sessionStorage.getItem(EDIT_SESSION_DIVE_ID_KEY);
    if (!storedDiveId) {
      router.replace("/");
      return;
    }

    const storedStarter = sessionStorage.getItem(EDIT_SESSION_STARTER_KEY);
    const starterKey = storedStarter || storedDiveId;
    const parsedDiveIds = parseStoredDiveIds(
      sessionStorage.getItem(EDIT_SESSION_DIVE_IDS_KEY),
      storedDiveId,
      starterKey
    );
    const diveId = parsedDiveIds[starterKey] ?? storedDiveId;

    setActiveStarterKey(starterKey);
    setSessionSecret(storedSessionSecret);
    setActiveDiveId(diveId);
    loadDiveMeta(diveId, storedSessionSecret);
    const mode = sessionStorage.getItem(EDIT_SESSION_MODE_KEY);
    if (mode !== "viewing") {
      setEditing(true);
      setActiveSessionId(generateId());
      loadSnapshotVersion(diveId, storedSessionSecret);
    }
    fetchEmbedSession(diveId, storedSessionSecret).finally(() => {
      setDiveLoading(false);
      setSessionReady(true);
    });
  }, [fetchEmbedSession, loadDiveMeta, loadSnapshotVersion, router]);

  function parseStoredDiveIds(
    rawDiveIds: string | null,
    fallbackDiveId: string,
    fallbackStarterKey: string
  ): Record<string, string> {
    if (rawDiveIds) {
      try {
        const parsed = JSON.parse(rawDiveIds) as Record<string, unknown>;
        const entries = Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        );
        if (entries.length > 0) return Object.fromEntries(entries);
      } catch {
        // Fall through to legacy single-dive session.
      }
    }
    return { [fallbackStarterKey]: fallbackDiveId };
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (
          isToolUIPart(part) &&
          DIVE_MODIFY_TOOLS.has(getToolName(part)) &&
          part.state === "output-available" &&
          !refreshedToolCallIds.current.has(part.toolCallId)
        ) {
          refreshedToolCallIds.current.add(part.toolCallId);
          const diveId = activeDiveId;
          if (diveId) {
            setTimeout(() => {
              setEmbedKey((k) => k + 1);
              fetchEmbedSession(diveId, sessionSecret);
            }, 1500);
          }
        }
      }
    }
  }, [messages, activeDiveId, fetchEmbedSession, sessionSecret]);

  const enterEditMode = useCallback(async () => {
    if (!activeDiveId) return;
    sessionStorage.setItem(EDIT_SESSION_MODE_KEY, "editing");
    await loadSnapshotVersion(activeDiveId, sessionSecret);
    const newSessionId = generateId();
    setActiveSessionId(newSessionId);
    setMessages([]);
    refreshedToolCallIds.current.clear();
    setEditing(true);
  }, [activeDiveId, sessionSecret, loadSnapshotVersion, setMessages]);

  const saveAndExit = useCallback(() => {
    if (isLoading) stop();
    sessionStorage.setItem(EDIT_SESSION_MODE_KEY, "viewing");
    setEditing(false);
    setSnapshotVersion(null);
    router.push(`/dives/${encodeURIComponent(activeDiveId ?? activeStarterKey)}`);
  }, [activeDiveId, activeStarterKey, isLoading, router, stop]);

  const cancelAndExit = useCallback(async () => {
    if (isLoading) stop();
    if (activeDiveId && snapshotVersion != null) {
      setReverting(true);
      try {
        await fetch(`/api/dives/${activeDiveId}/revert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionSecret ? { Authorization: `Bearer ${sessionSecret}` } : {}),
          },
          body: JSON.stringify({ version: snapshotVersion }),
        });
        setEmbedKey((k) => k + 1);
        fetchEmbedSession(activeDiveId, sessionSecret);
      } catch (err) {
        console.error("Failed to revert dive:", err);
      } finally {
        setReverting(false);
      }
    }
    sessionStorage.setItem(EDIT_SESSION_MODE_KEY, "viewing");
    setEditing(false);
    setSnapshotVersion(null);
    router.push(`/dives/${encodeURIComponent(activeDiveId ?? activeStarterKey)}`);
  }, [
    activeDiveId,
    activeStarterKey,
    fetchEmbedSession,
    sessionSecret,
    snapshotVersion,
    isLoading,
    router,
    stop,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitPrompt(input);
  }

  function submitPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (
      !trimmedPrompt ||
      isLoading ||
      turnLimitReached ||
      prompt.length > MAX_CHAT_MESSAGE_CHARS ||
      countWords(prompt) > MAX_CHAT_MESSAGE_WORDS ||
      !activeDiveId
    ) return;
    sendMessage({ text: trimmedPrompt });
    setInput("");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-1">
      <AppHeader
        meta={
          diveMeta
            ? { title: diveMeta.title, description: diveMeta.description }
            : { title: "Dive" }
        }
        right={
          <>
            <nav className="mr-2 hidden items-center gap-3 sm:flex">
              <RepoLink />
            </nav>
            {sessionReady && editing ? (
              <>
                <BrutalistButton
                  tone="neutral"
                  shadow="md"
                  className="px-4 py-1.5 gap-1.5"
                  onClick={cancelAndExit}
                  disabled={reverting}
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {reverting ? "Reverting..." : "Cancel"}
                </BrutalistButton>
                <BrutalistButton
                  tone="success"
                  shadow="md"
                  className="px-4 py-1.5 gap-1.5"
                  onClick={saveAndExit}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Save
                </BrutalistButton>
              </>
            ) : sessionReady && activeDiveId && !diveLoading ? (
              <BrutalistButton tone="primary" shadow="lg" onClick={enterEditMode}>
                <SparklesIcon className="h-4 w-4" />
                Remix
              </BrutalistButton>
            ) : null}
            <AccountMenu />
          </>
        }
      />

      {/* Main content */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
        {/* Dive embed */}
        <div className="relative flex-1 overflow-hidden bg-surface-1">
          {embedSession ? (
            // `allow-scripts allow-same-origin` together only sandbox a *cross-origin* src
            // (embed-motherduck.com). If you fork this and point the iframe at a same-origin
            // URL, the combination silently disables the sandbox — keep the src third-party.
            <iframe
              key={embedKey}
              src={`https://embed-motherduck.com/sandbox/#session=${embedSession}`}
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full border-0"
            />
          ) : diveLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-ink-muted animate-pulse">Loading your dashboard...</p>
            </div>
          ) : diveError || embedError ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-semibold text-accent-red">{diveError || embedError}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-semibold text-ink-muted">No dashboard yet</p>
              <p className="text-xs text-ink-dim">Your dashboard will be created automatically.</p>
            </div>
          )}
        </div>

        {/* Chat side panel — MotherDuck styled */}
        {editing && (
          <div className="w-[340px] shrink-0 flex flex-col border-l-2 border-divider bg-surface-3">
            <div className="flex items-center gap-2 h-11 px-4 shrink-0 border-b-2 border-divider">
              <SparklesIcon className="h-3.5 w-3.5 text-accent-blue" />
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
                Remix Dive
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex h-full flex-col justify-center gap-3">
                  <p className="text-xs text-center leading-relaxed px-3 text-ink-dim">
                    Pick a small change or describe your own.
                  </p>
                  <div className="space-y-2">
                    {(CUSTOMIZE_SUGGESTIONS[activeStarterKey] ?? DEFAULT_CUSTOMIZE_SUGGESTIONS).map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => submitPrompt(suggestion)}
                          disabled={isLoading || turnLimitReached || !activeDiveId}
                          className="w-full rounded-[2px] border-2 border-divider bg-surface-0 px-3 py-2 text-left text-xs font-semibold text-ink-primary shadow-brutal-sm transition-transform hover:translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0 disabled:opacity-40"
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-[2px] border-2 border-divider px-3 py-2 text-xs ${
                        isUser
                          ? "bg-user-msg-bg text-accent-blue shadow-brutal-user"
                          : "bg-surface-4 text-ink-primary"
                      }`}
                    >
                      {msg.parts.map((part, i) => {
                        if (part.type === "text") {
                          return <MarkdownText key={i} text={part.text} />;
                        }
                        if (isToolUIPart(part)) {
                          const name = getToolName(part);
                          const hasError =
                            part.state === "output-available" && isErrorToolOutput(part.output);
                          return (
                            <div
                              key={i}
                              className={`my-1 rounded-[2px] border px-2 py-1 text-[10px] font-mono ${
                                hasError
                                  ? "border-accent-red bg-danger-bg-dim text-danger-text-soft"
                                  : "border-divider bg-surface-0 text-ink-muted"
                              }`}
                            >
                              {(part.state === "input-streaming" ||
                                part.state === "input-available") && (
                                <span className="animate-pulse">Running {name}...</span>
                              )}
                              {part.state === "output-available" && hasError && (
                                <span className="inline-flex items-center gap-1.5 text-accent-red">
                                  <XIcon className="h-3 w-3" />
                                  {name} failed
                                </span>
                              )}
                              {part.state === "output-available" && !hasError && (
                                <span className="text-accent-teal">&#10003; {name}</span>
                              )}
                              <ToolCallDetails
                                part={
                                  part as { input?: unknown; output?: unknown; state: string }
                                }
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                      {msg.role === "assistant" && getExhaustionMessage(msg.metadata) && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-[2px] border border-accent-red bg-danger-bg-dim px-2 py-1.5 text-[10px] font-mono text-danger-text-soft">
                          <XIcon className="mt-0.5 h-3 w-3 shrink-0 text-accent-red" />
                          <span>{getExhaustionMessage(msg.metadata)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-[2px] border-2 border-divider bg-surface-4 px-3 py-2 text-xs text-ink-muted">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 flex flex-col gap-2 border-t-2 border-divider"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={MAX_CHAT_MESSAGE_CHARS + 1}
                  placeholder={turnLimitReached ? "Turn limit reached" : "Ask about the data..."}
                  disabled={isLoading || turnLimitReached || !activeDiveId}
                  className="flex-1 h-10 rounded-[2px] border-2 border-divider bg-surface-0 px-3 text-xs text-ink-primary placeholder:text-ink-muted transition-colors focus:border-accent-blue focus:outline-none disabled:opacity-50"
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="h-10 rounded-[2px] border-2 border-divider bg-accent-red px-3 text-xs font-bold uppercase tracking-wider text-ink-primary"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      !input.trim() || turnLimitReached || messageLimitReached || !activeDiveId
                    }
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-[2px] border-2 border-divider bg-accent-blue shadow-brutal-md transition-transform hover:translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0 disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      className="h-4 w-4 text-ink-dark"
                    >
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </button>
                )}
              </div>
              <div
                className={`flex justify-between text-[10px] ${
                  messageLimitReached ? "text-accent-red" : "text-ink-dim"
                }`}
              >
                <span>
                  {inputWordCount}/{MAX_CHAT_MESSAGE_WORDS} words
                </span>
                <span>
                  {input.length}/{MAX_CHAT_MESSAGE_CHARS} chars
                </span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
