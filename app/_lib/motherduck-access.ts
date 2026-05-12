import { createDiveEmbedSession } from "@/lib/motherduck/embed-session";
import { getMcpClient as getReusableMcpClient } from "@/lib/motherduck/mcp";
import {
  getMotherduckPg as getReusableMotherduckPg,
  type MotherDuckTokenCredentials,
} from "@/lib/motherduck/pg";
import { getCachedMotherDuckServiceAccountToken } from "@/lib/motherduck/service-account-token-cache";

export type AppMotherDuckAccess =
  | {
      kind: "service-account";
      username: string;
    }
  | {
      kind: "personal-token";
      token: string;
      cacheKey: string;
      tokenGeneration: number;
    };

export function serviceAccountAccess(username: string): AppMotherDuckAccess {
  return { kind: "service-account", username };
}

export function personalTokenAccess(options: {
  token: string;
  cacheKey: string;
  tokenGeneration: number;
}): AppMotherDuckAccess {
  return {
    kind: "personal-token",
    token: options.token,
    cacheKey: options.cacheKey,
    tokenGeneration: options.tokenGeneration,
  };
}

export function getAppMotherDuckAccessCacheKey(
  access: AppMotherDuckAccess
): string {
  return access.kind === "service-account"
    ? `service-account:${access.username}`
    : `personal-token:${access.cacheKey}`;
}

async function getTokenCredentials(
  access: AppMotherDuckAccess
): Promise<MotherDuckTokenCredentials> {
  if (access.kind === "personal-token") {
    return {
      token: access.token,
      cacheKey: getAppMotherDuckAccessCacheKey(access),
      tokenGeneration: access.tokenGeneration,
    };
  }

  return getCachedMotherDuckServiceAccountToken(access.username);
}

export async function getMotherduckPg(access: AppMotherDuckAccess) {
  const credentials = await getTokenCredentials(access);
  return getReusableMotherduckPg(credentials);
}

export async function getMcpClient(access: AppMotherDuckAccess) {
  const credentials = await getTokenCredentials(access);
  return getReusableMcpClient(credentials);
}

export async function createDiveEmbedSessionForAccess(
  diveId: string,
  access: AppMotherDuckAccess
): Promise<string> {
  if (access.kind === "service-account") {
    return createDiveEmbedSession({ diveId, username: access.username });
  }

  return createDiveEmbedSession({ diveId, token: access.token });
}
