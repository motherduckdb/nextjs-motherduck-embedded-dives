-- Initial Postgres schema for the embedded dives template.

CREATE TABLE IF NOT EXISTS edit_sessions (
  id                   TEXT PRIMARY KEY,
  session_kind         TEXT NOT NULL
    CHECK (session_kind IN ('anonymous', 'shared', 'personal')),
  secret_hash          TEXT,
  motherduck_username  TEXT NOT NULL UNIQUE,
  dive_ids_json        TEXT,
  source_dive_ids_json TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  expires_at           TIMESTAMPTZ,
  -- secret_hash is the sha256 of the bearer token for anonymous sessions; for
  -- shared/personal sessions auth is via the signed-in app user, so no hash.
  CONSTRAINT edit_sessions_secret_hash_matches_kind
    CHECK ((session_kind = 'anonymous') = (secret_hash IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edit_sessions_secret_hash
  ON edit_sessions (secret_hash)
  WHERE session_kind = 'anonymous';

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user_motherduck_tokens (
  app_user_id      TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  token_ciphertext TEXT NOT NULL,
  token_iv         TEXT NOT NULL,
  token_auth_tag   TEXT NOT NULL,
  token_preview    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  verified_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id              TEXT PRIMARY KEY,
  edit_session_id TEXT REFERENCES edit_sessions(id),
  title           TEXT NOT NULL DEFAULT 'New Chat',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_edit_session_id
  ON chat_sessions (edit_session_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  parts_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages (session_id);
