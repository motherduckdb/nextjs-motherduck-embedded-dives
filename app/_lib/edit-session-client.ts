export const SESSION_SECRET_KEY = "md_dive_session_secret";
export const EDIT_SESSION_SECRET_KEY = "md_dive_edit_secret";
export const EDIT_SESSION_DIVE_ID_KEY = "md_dive_id";
export const EDIT_SESSION_DIVE_IDS_KEY = "md_dive_ids";
export const EDIT_SESSION_MODE_KEY = "md_dive_edit_mode";
export const EDIT_SESSION_STARTER_KEY = "md_dive_starter";
export const DEMO_SESSION_ID_KEY = "md_demo_session_id";

export type StoredEditSession = {
  sessionSecret?: string;
  secret?: string;
  diveId: string;
  diveIds?: Record<string, string>;
  starterKey: string;
  mode: "editing" | "viewing";
};

export function getDemoSessionId(): string {
  const existing = sessionStorage.getItem(DEMO_SESSION_ID_KEY);
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  sessionStorage.setItem(DEMO_SESSION_ID_KEY, sessionId);
  return sessionId;
}

export function getStoredSessionSecret(): string | null {
  return (
    sessionStorage.getItem(SESSION_SECRET_KEY) ??
    sessionStorage.getItem(EDIT_SESSION_SECRET_KEY)
  );
}

export function getAuthHeaders(): Record<string, string> {
  const sessionSecret = getStoredSessionSecret();
  return sessionSecret ? { Authorization: `Bearer ${sessionSecret}` } : {};
}

export function storeEditSession(session: StoredEditSession): void {
  const sessionSecret = session.sessionSecret ?? session.secret;
  if (sessionSecret) {
    sessionStorage.setItem(SESSION_SECRET_KEY, sessionSecret);
    sessionStorage.removeItem(EDIT_SESSION_SECRET_KEY);
  } else {
    sessionStorage.removeItem(SESSION_SECRET_KEY);
    sessionStorage.removeItem(EDIT_SESSION_SECRET_KEY);
  }
  sessionStorage.setItem(EDIT_SESSION_DIVE_ID_KEY, session.diveId);
  if (session.diveIds) {
    sessionStorage.setItem(EDIT_SESSION_DIVE_IDS_KEY, JSON.stringify(session.diveIds));
  } else {
    sessionStorage.removeItem(EDIT_SESSION_DIVE_IDS_KEY);
  }
  sessionStorage.setItem(EDIT_SESSION_MODE_KEY, session.mode);
  sessionStorage.setItem(EDIT_SESSION_STARTER_KEY, session.starterKey);
}
