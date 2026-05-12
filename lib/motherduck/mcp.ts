import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MotherDuckTokenCredentials } from "./pg";

const MCP_URL = process.env.MOTHERDUCK_MCP_URL || "https://api.motherduck.com/mcp";

interface CachedEntry {
  client: MCPClient;
  tokenGeneration: string | number;
}

const cache = new Map<string, CachedEntry>();

/**
 * Get or create a cached MCP client from explicit token credentials.
 * Recreates the client when tokenGeneration changes.
 */
export async function getMcpClient(
  credentials: MotherDuckTokenCredentials
): Promise<MCPClient> {
  const existing = cache.get(credentials.cacheKey);
  if (existing && existing.tokenGeneration === credentials.tokenGeneration) {
    return existing.client;
  }

  if (existing) {
    existing.client.close().catch(() => {});
    cache.delete(credentials.cacheKey);
  }

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${credentials.token}` },
    },
  });

  const client = await createMCPClient({ transport });

  cache.set(credentials.cacheKey, {
    client,
    tokenGeneration: credentials.tokenGeneration,
  });

  return client;
}
