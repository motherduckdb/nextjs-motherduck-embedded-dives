import { createMotherduckPg } from "@/lib/motherduck/pg";

/**
 * App helpers for user-supplied MotherDuck personal access tokens.
 *
 * This file handles this demo's token-request UX and validation policy. The
 * actual Postgres connection primitive stays in reusable `lib/motherduck/pg`.
 */
export function getMotherDuckTokenAppName(): string {
  return process.env.MOTHERDUCK_TOKEN_APP_NAME || "motherduck-dives";
}

export function getMotherDuckTokenRequestUrl(): string {
  const url = new URL("https://app.motherduck.com/token-request");
  url.searchParams.set("appName", getMotherDuckTokenAppName());
  return url.toString();
}

export async function verifyMotherDuckPat(token: string): Promise<void> {
  const sql = createMotherduckPg(token);
  try {
    await sql`SELECT 1`;
  } finally {
    await sql.end();
  }
}

export async function getMotherDuckPatPrincipal(
  token: string
): Promise<string | null> {
  const sql = createMotherduckPg(token);

  try {
    const rows = await sql<{ username: string | null }[]>`
      SELECT current_user AS username
    `;
    return rows[0]?.username?.trim() || null;
  } finally {
    await sql.end();
  }
}
