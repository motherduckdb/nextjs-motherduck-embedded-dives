import postgres, { type Sql } from "postgres";
import { randomUUID } from "crypto";

let _pg: Sql | null = null;

export function getPg(): Sql {
  if (_pg) return _pg;
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required. Set it to a local or hosted Postgres database.");
  }
  _pg = postgres(process.env.POSTGRES_URL!);
  return _pg;
}

export type EditSessionKind = "anonymous" | "shared" | "personal";

export interface EditSessionRow {
  id: string;
  session_kind: EditSessionKind;
  secret_hash: string | null;
  motherduck_username: string;
  dive_ids_json: string | null;
  source_dive_ids_json: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface AppUserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AppUserMotherDuckTokenRow {
  app_user_id: string;
  token_ciphertext: string;
  token_iv: string;
  token_auth_tag: string;
  token_preview: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

const EDIT_SESSION_COLUMNS =
  "id, session_kind, secret_hash, motherduck_username, dive_ids_json, source_dive_ids_json, created_at, expires_at";

export async function insertAnonymousEditSession(session: {
  id: string;
  secret_hash: string;
  motherduck_username: string;
  dive_ids_json?: string | null;
  source_dive_ids_json?: string | null;
  expires_at?: Date | null;
}): Promise<void> {
  const pg = getPg();
  await pg`
    INSERT INTO edit_sessions (
      id, session_kind, secret_hash, motherduck_username,
      dive_ids_json, source_dive_ids_json, expires_at
    )
    VALUES (
      ${session.id},
      'anonymous',
      ${session.secret_hash},
      ${session.motherduck_username},
      ${session.dive_ids_json ?? null},
      ${session.source_dive_ids_json ?? null},
      ${session.expires_at ?? null}
    )`;
}

export async function findAnonymousEditSessionBySecretHash(
  secretHash: string
): Promise<EditSessionRow | undefined> {
  const pg = getPg();
  const rows = await pg<EditSessionRow[]>`
    SELECT ${pg.unsafe(EDIT_SESSION_COLUMNS)}
    FROM edit_sessions
    WHERE session_kind = 'anonymous'
      AND secret_hash = ${secretHash}
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1`;
  return rows[0];
}

export async function upsertSharedEditSession(session: {
  id: string;
  motherduck_username: string;
}): Promise<EditSessionRow> {
  const pg = getPg();
  const rows = await pg<EditSessionRow[]>`
    INSERT INTO edit_sessions (
      id, session_kind, secret_hash, motherduck_username,
      dive_ids_json, source_dive_ids_json, expires_at
    )
    VALUES (
      ${session.id},
      'shared',
      NULL,
      ${session.motherduck_username},
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      motherduck_username = EXCLUDED.motherduck_username,
      expires_at = NULL
    RETURNING ${pg.unsafe(EDIT_SESSION_COLUMNS)}`;
  return rows[0];
}

export async function findEditSessionById(
  id: string
): Promise<EditSessionRow | undefined> {
  const pg = getPg();
  const rows = await pg<EditSessionRow[]>`
    SELECT ${pg.unsafe(EDIT_SESSION_COLUMNS)}
    FROM edit_sessions
    WHERE id = ${id}
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1`;
  return rows[0];
}

export async function upsertPersonalEditSession(session: {
  id: string;
  motherduck_username: string;
}): Promise<EditSessionRow> {
  const pg = getPg();
  const rows = await pg<EditSessionRow[]>`
    INSERT INTO edit_sessions (
      id, session_kind, secret_hash, motherduck_username,
      dive_ids_json, source_dive_ids_json, expires_at
    )
    VALUES (
      ${session.id},
      'personal',
      NULL,
      ${session.motherduck_username},
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      motherduck_username = EXCLUDED.motherduck_username,
      expires_at = NULL
    RETURNING ${pg.unsafe(EDIT_SESSION_COLUMNS)}`;
  return rows[0];
}

export async function getAppSetting(key: string): Promise<string | null> {
  const pg = getPg();
  const rows = await pg<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`;
  return rows[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const pg = getPg();
  await pg`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

export async function findAppUserByEmail(email: string): Promise<AppUserRow | undefined> {
  const pg = getPg();
  const rows = await pg<AppUserRow[]>`
    SELECT id, email, password_hash, created_at, updated_at
    FROM app_users
    WHERE lower(email) = lower(${email})
    LIMIT 1`;
  return rows[0];
}

export async function createAppUser(email: string, passwordHash: string): Promise<AppUserRow> {
  const pg = getPg();
  const rows = await pg<AppUserRow[]>`
    INSERT INTO app_users (id, email, password_hash)
    VALUES (${randomUUID()}, ${email.toLowerCase()}, ${passwordHash})
    RETURNING id, email, password_hash, created_at, updated_at`;
  return rows[0];
}

export async function findAppUserMotherDuckToken(
  appUserId: string
): Promise<AppUserMotherDuckTokenRow | undefined> {
  const pg = getPg();
  const rows = await pg<AppUserMotherDuckTokenRow[]>`
    SELECT app_user_id, token_ciphertext, token_iv, token_auth_tag, token_preview, created_at, updated_at, verified_at
    FROM app_user_motherduck_tokens
    WHERE app_user_id = ${appUserId}
    LIMIT 1`;
  return rows[0];
}

export async function upsertAppUserMotherDuckToken(token: {
  app_user_id: string;
  token_ciphertext: string;
  token_iv: string;
  token_auth_tag: string;
  token_preview: string | null;
}): Promise<AppUserMotherDuckTokenRow> {
  const pg = getPg();
  const rows = await pg<AppUserMotherDuckTokenRow[]>`
    INSERT INTO app_user_motherduck_tokens (
      app_user_id, token_ciphertext, token_iv, token_auth_tag, token_preview, verified_at
    )
    VALUES (
      ${token.app_user_id},
      ${token.token_ciphertext},
      ${token.token_iv},
      ${token.token_auth_tag},
      ${token.token_preview},
      now()
    )
    ON CONFLICT (app_user_id) DO UPDATE SET
      token_ciphertext = EXCLUDED.token_ciphertext,
      token_iv = EXCLUDED.token_iv,
      token_auth_tag = EXCLUDED.token_auth_tag,
      token_preview = EXCLUDED.token_preview,
      updated_at = now(),
      verified_at = now()
    RETURNING app_user_id, token_ciphertext, token_iv, token_auth_tag, token_preview, created_at, updated_at, verified_at`;
  return rows[0];
}

// ---------------------------------------------------------------------------
// Chat sessions & messages
// ---------------------------------------------------------------------------

export interface ChatSessionRow {
  id: string;
  edit_session_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  parts_json: string | null;
  created_at: string;
}

export async function listChatSessionsForEditSession(
  editSessionId: string
): Promise<ChatSessionRow[]> {
  const pg = getPg();
  return await pg<ChatSessionRow[]>`
    SELECT id, edit_session_id, title, created_at, updated_at
    FROM chat_sessions WHERE edit_session_id = ${editSessionId}
    ORDER BY updated_at DESC`;
}

export async function createChatSessionForEditSession(
  id: string,
  editSessionId: string,
  title: string
): Promise<ChatSessionRow> {
  const pg = getPg();
  const rows = await pg<ChatSessionRow[]>`
    INSERT INTO chat_sessions (id, edit_session_id, title)
    VALUES (${id}, ${editSessionId}, ${title})
    RETURNING id, edit_session_id, title, created_at, updated_at`;
  return rows[0];
}

/** Update a session's title and updated_at. */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  const pg = getPg();
  await pg`
    UPDATE chat_sessions SET title = ${title}, updated_at = now()
    WHERE id = ${sessionId}`;
}

/** Touch a session's updated_at timestamp. */
export async function touchChatSession(sessionId: string): Promise<void> {
  const pg = getPg();
  await pg`UPDATE chat_sessions SET updated_at = now() WHERE id = ${sessionId}`;
}

/** Insert a chat message. */
export async function insertChatMessage(msg: {
  id: string;
  session_id: string;
  role: string;
  content: string;
  parts_json: string | null;
}): Promise<void> {
  const pg = getPg();
  await pg`
    INSERT INTO chat_messages (id, session_id, role, content, parts_json)
    VALUES (${msg.id}, ${msg.session_id}, ${msg.role}, ${msg.content}, ${msg.parts_json})`;
}

/** Load all messages for a session, oldest first. */
export async function listChatMessages(
  sessionId: string
): Promise<ChatMessageRow[]> {
  const pg = getPg();
  return await pg<ChatMessageRow[]>`
    SELECT id, session_id, role, content, parts_json, created_at
    FROM chat_messages WHERE session_id = ${sessionId}
    ORDER BY created_at ASC`;
}

export async function findChatSessionForEditSession(
  sessionId: string,
  editSessionId: string
): Promise<ChatSessionRow | undefined> {
  const pg = getPg();
  const rows = await pg<ChatSessionRow[]>`
    SELECT id, edit_session_id, title, created_at, updated_at
    FROM chat_sessions WHERE id = ${sessionId} AND edit_session_id = ${editSessionId} LIMIT 1`;
  return rows[0];
}
