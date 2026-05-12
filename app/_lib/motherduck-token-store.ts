import {
  findAppUserMotherDuckToken,
  upsertAppUserMotherDuckToken,
} from "./db";
import { decryptSecret, encryptSecret } from "./secret-crypto";
import {
  personalTokenAccess,
  type AppMotherDuckAccess,
} from "@/app/_lib/motherduck-access";
import { getMotherDuckPatPrincipal } from "./personal-token";

const PERSONAL_PAT_SUBJECT_PREFIX = "app_user:";
const PRINCIPAL_CACHE_TTL_MS = 5 * 60 * 1000;

const principalCache = new Map<string, { value: string; expiresAt: number }>();

export function getPersonalPatSubjectForAppUser(appUserId: string): string {
  return `${PERSONAL_PAT_SUBJECT_PREFIX}${appUserId}`;
}

export function getAppUserIdFromPersonalPatSubject(
  subject: string
): string | null {
  return subject.startsWith(PERSONAL_PAT_SUBJECT_PREFIX)
    ? subject.slice(PERSONAL_PAT_SUBJECT_PREFIX.length)
    : null;
}

export async function getStoredMotherDuckPat(appUserId: string): Promise<{
  token: string;
  generation: number;
  preview: string | null;
} | null> {
  const row = await findAppUserMotherDuckToken(appUserId);
  if (!row) return null;

  return {
    token: decryptSecret({
      ciphertext: row.token_ciphertext,
      iv: row.token_iv,
      authTag: row.token_auth_tag,
    }),
    generation: new Date(row.updated_at).getTime(),
    preview: row.token_preview,
  };
}

export async function storeMotherDuckPat(
  appUserId: string,
  token: string
): Promise<void> {
  const encrypted = encryptSecret(token);
  await upsertAppUserMotherDuckToken({
    app_user_id: appUserId,
    token_ciphertext: encrypted.ciphertext,
    token_iv: encrypted.iv,
    token_auth_tag: encrypted.authTag,
    token_preview: token.length > 4 ? token.slice(-4) : null,
  });
  principalCache.delete(appUserId);
}

export async function getPersonalMotherDuckAccessForAppUser(
  appUserId: string
): Promise<AppMotherDuckAccess | null> {
  const stored = await getStoredMotherDuckPat(appUserId);
  if (!stored) return null;

  return personalTokenAccess({
    token: stored.token,
    cacheKey: appUserId,
    tokenGeneration: stored.generation,
  });
}

export async function getStoredMotherDuckPatPrincipal(
  appUserId: string
): Promise<string | null> {
  const cached = principalCache.get(appUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const stored = await getStoredMotherDuckPat(appUserId);
  if (!stored) return null;

  const value = await getMotherDuckPatPrincipal(stored.token);
  if (value) {
    principalCache.set(appUserId, {
      value,
      expiresAt: Date.now() + PRINCIPAL_CACHE_TTL_MS,
    });
  }

  return value;
}
