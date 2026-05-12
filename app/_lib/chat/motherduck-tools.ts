import type { ToolSet } from "ai";
import { asSchema, jsonSchema } from "@ai-sdk/provider-utils";
import { DISABLED_CHAT_TOOLS } from "./limits";

/**
 * Adapt MotherDuck remote MCP server tools for this embedded dive edit flow.
 *
 * The remote server exposes general-purpose tools, including write/admin tools
 * and tool-result instructions for MotherDuck's hosted Dive UI. This app needs a
 * narrower flow: the user edits an already-embedded Dive, and the app refreshes
 * the embed itself. Keep these harness-level changes outside MotherDuck client
 * helpers so remote MCP behavior stays explicit and isolated from route logic.
 */
function sanitizeEditDiveContentOutput(output: unknown): unknown {
  if (Array.isArray(output)) {
    return output.map(sanitizeEditDiveContentOutput);
  }

  if (!output || typeof output !== "object") {
    return output;
  }

  const record = output as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === "next_steps") continue;

    if (key === "text" && typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        sanitized[key] = JSON.stringify(sanitizeEditDiveContentOutput(parsed));
      } catch {
        sanitized[key] = value;
      }
      continue;
    }

    sanitized[key] = sanitizeEditDiveContentOutput(value);
  }

  return sanitized;
}

function omitJsonSchemaProperty(inputSchema: unknown, propertyName: string) {
  return jsonSchema(async () => {
    const sourceSchema = await asSchema(inputSchema as Parameters<typeof asSchema>[0]).jsonSchema;
    const properties =
      sourceSchema.properties &&
      typeof sourceSchema.properties === "object" &&
      !Array.isArray(sourceSchema.properties)
        ? { ...sourceSchema.properties }
        : undefined;

    if (properties) {
      delete properties[propertyName];
    }

    return {
      ...sourceSchema,
      ...(properties ? { properties } : {}),
      ...(Array.isArray(sourceSchema.required)
        ? { required: sourceSchema.required.filter((field) => field !== propertyName) }
        : {}),
    };
  });
}

export function adaptMotherDuckToolsForChat(tools: ToolSet): ToolSet {
  const chatTools = Object.fromEntries(
    Object.entries(tools).filter(([name]) => !DISABLED_CHAT_TOOLS.has(name))
  ) as ToolSet;

  const readDiveTool = chatTools.read_dive;
  const readDiveExecute = readDiveTool?.execute;
  const editDiveTool = chatTools.edit_dive_content;
  const editDiveExecute = editDiveTool?.execute;
  if (!readDiveExecute && !editDiveExecute) {
    return chatTools;
  }

  return {
    ...chatTools,
    ...(readDiveTool && readDiveExecute
      ? {
          read_dive: {
            ...readDiveTool,
            inputSchema: omitJsonSchemaProperty(readDiveTool.inputSchema, "version"),
            async execute(input, options) {
              const latestInput = { ...(input as Record<string, unknown>) };
              // Chat edits should always start from live Dive; models may
              // otherwise pass version: 1 and accidentally edit stale content.
              delete latestInput.version;
              return readDiveExecute(latestInput, options);
            },
          },
        }
      : {}),
    ...(editDiveTool && editDiveExecute
      ? {
          edit_dive_content: {
            ...editDiveTool,
            async execute(input, options) {
              const output = await editDiveExecute(input, options);
              return sanitizeEditDiveContentOutput(output);
            },
          },
        }
      : {}),
  };
}
