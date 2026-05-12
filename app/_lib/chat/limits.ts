/**
 * MCP tool names that modify a dive. Used to detect when a chat session
 * should be associated with a dive and when the embed should refresh.
 */
export const DIVE_MODIFY_TOOLS = new Set([
  "edit_dive_content",
]);

export const MAX_CHAT_TURNS = 5;
export const MAX_CHAT_STEPS = 5;
export const MAX_CHAT_MESSAGE_WORDS = 100;
export const MAX_CHAT_MESSAGE_CHARS = 1000;

/** Remote MotherDuck MCP tools removed from the embedded chat harness. */
export const DISABLED_CHAT_TOOLS = new Set([
  "save_dive",
  "delete_dive",
  "get_dive_guide",
  "share_dive_data",
  "query_rw",
  "update_dive",
]);
