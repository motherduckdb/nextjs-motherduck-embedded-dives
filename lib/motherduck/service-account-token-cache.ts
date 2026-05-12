import { createMotherDuckToken } from "./api";
import type { MotherDuckTokenCredentials } from "./pg";

const CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes (under 1h token TTL)

interface CachedToken {
  token: string;
  generation: number;
  expiresAt: number;
}

let nextGeneration = 1;
const cache = new Map<string, CachedToken>();

/**
 * Mint and cache a short-lived MotherDuck token for a (shared or isolated) service account.
 *
 * Can be called with service-account usernames only, since admins can 
 * only mint tokens for service accounts:
 * https://motherduck.com/docs/sql-reference/rest-api/users-create-token/)
 * 
 */
export async function getCachedMotherDuckServiceAccountToken(
  username: string
): Promise<MotherDuckTokenCredentials> {
  const cacheKey = `service-account:${username}`;
  const existing = cache.get(cacheKey);
  if (existing && Date.now() < existing.expiresAt) {
    return {
      token: existing.token,
      cacheKey,
      tokenGeneration: existing.generation,
    };
  }

  const { token } = await createMotherDuckToken(
    username,
    `session_${Date.now()}`,
    3600
  );

  const generation = nextGeneration++;
  cache.set(cacheKey, {
    token,
    generation,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { token, cacheKey, tokenGeneration: generation };
}
