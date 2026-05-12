import crypto from "crypto";
import { auth } from "@/auth";
import {
  type EditSessionRow,
  type AppUserRow,
  createAppUser,
  findAppUserByEmail,
  findAppUserMotherDuckToken,
  findEditSessionById,
  findAnonymousEditSessionBySecretHash,
  upsertPersonalEditSession,
  upsertSharedEditSession,
} from "./db";
import { createMotherDuckUser } from "@/lib/motherduck/api";
import {
  getMotherduckPg,
  serviceAccountAccess,
  type AppMotherDuckAccess,
} from "@/app/_lib/motherduck-access";
import {
  getMotherDuckTokenAppName,
  getMotherDuckTokenRequestUrl,
} from "./personal-token";
import {
  getAppUserIdFromPersonalPatSubject,
  getPersonalMotherDuckAccessForAppUser,
  getPersonalPatSubjectForAppUser,
  getStoredMotherDuckPatPrincipal,
} from "./motherduck-token-store";
import { hashPassword } from "./password";

export const DEFAULT_SHARED_SERVICE_ACCOUNT_USERNAME = "app_shared";

export function isPasswordAuthEnabled(): boolean {
  return process.env.PASSWORD_AUTH_ENABLED === "true";
}

export function isPersonalMotherDuckAuthMode(): boolean {
  return process.env.MOTHERDUCK_AUTH_MODE === "personal_pat";
}

export function getSharedServiceAccountUsername(): string {
  return (
    process.env.MOTHERDUCK_SHARED_SERVICE_ACCOUNT_USERNAME ||
    DEFAULT_SHARED_SERVICE_ACCOUNT_USERNAME
  );
}

const SHARED_EDIT_SESSION_ID = "shared-password-auth-session";
const PERSONAL_EDIT_SESSION_ID_PREFIX = "personal-edit-session:";
let sharedUserSetupPromise: Promise<void> | null = null;
// Shared mode resolves to a single static row keyed by SHARED_EDIT_SESSION_ID,
// so cache it process-wide to avoid a Postgres upsert per request.
let sharedEditSessionPromise: Promise<EditSessionRow> | null = null;

type EditAccess =
  | {
      status: "ready";
      editSession: EditSessionRow;
      sessionSecret?: string;
    }
  | { status: "anonymous_allowed" }
  | { status: "unauthorized"; redirectTo: "/login" | "/motherduck-token" };

type AuthStatus = {
  redirectTo: "/login" | "/motherduck-token" | null;
  account: {
    email: string;
    motherduckUsername: string | null;
  } | null;
  usePersonalMotherDuckToken: boolean;
  motherDuckTokenAppName: string;
  motherDuckTokenRequestUrl: string;
};

async function getSharedEditSession(): Promise<EditSessionRow> {
  const sharedUsername = getSharedServiceAccountUsername();
  sharedUserSetupPromise ??= createMotherDuckUser(sharedUsername)
    .then(() => undefined)
    .catch((err) => {
      sharedUserSetupPromise = null;
      throw err;
    });
  await sharedUserSetupPromise;
  sharedEditSessionPromise ??= upsertSharedEditSession({
    id: SHARED_EDIT_SESSION_ID,
    motherduck_username: sharedUsername,
  }).catch((err) => {
    sharedEditSessionPromise = null;
    throw err;
  });
  return sharedEditSessionPromise;
}

async function getAuthenticatedAppUser(): Promise<AppUserRow | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return (await findAppUserByEmail(email)) ?? null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const session = await auth();
  const passwordAuthEnabled = isPasswordAuthEnabled();
  const personalMotherDuckAuthMode = isPersonalMotherDuckAuthMode();
  const email = session?.user?.email ?? null;
  const motherDuckTokenAppName = getMotherDuckTokenAppName();
  const motherDuckTokenRequestUrl = getMotherDuckTokenRequestUrl();

  if (!passwordAuthEnabled) {
    return {
      redirectTo: null,
      account: null,
      usePersonalMotherDuckToken: false,
      motherDuckTokenAppName,
      motherDuckTokenRequestUrl,
    };
  }

  if (!email) {
    return {
      redirectTo: "/login",
      account: null,
      usePersonalMotherDuckToken: personalMotherDuckAuthMode,
      motherDuckTokenAppName,
      motherDuckTokenRequestUrl,
    };
  }

  if (!personalMotherDuckAuthMode) {
    return {
      redirectTo: null,
      account: {
        email,
        motherduckUsername: getSharedServiceAccountUsername(),
      },
      usePersonalMotherDuckToken: false,
      motherDuckTokenAppName,
      motherDuckTokenRequestUrl,
    };
  }

  const appUser = (await findAppUserByEmail(email)) ?? null;
  const storedToken = appUser ? await findAppUserMotherDuckToken(appUser.id) : null;
  const motherduckUsername =
    appUser && storedToken
      ? await getStoredMotherDuckPatPrincipal(appUser.id).catch(() => null)
      : null;

  return {
    redirectTo: storedToken ? null : "/motherduck-token",
    account: {
      email,
      motherduckUsername: motherduckUsername ?? (storedToken ? "Personal MotherDuck token" : null),
    },
    usePersonalMotherDuckToken: true,
    motherDuckTokenAppName,
    motherDuckTokenRequestUrl,
  };
}

export async function createDemoAuthUser(
  email: string,
  password: string
): Promise<
  | { status: "created"; user: AppUserRow }
  | { status: "disabled" }
  | { status: "invalid_email" }
  | { status: "invalid_password" }
  | { status: "already_exists" }
> {
  if (!isPasswordAuthEnabled()) return { status: "disabled" };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { status: "invalid_email" };
  }
  if (password.length < 8) {
    return { status: "invalid_password" };
  }
  if (await findAppUserByEmail(normalizedEmail)) {
    return { status: "already_exists" };
  }

  return {
    status: "created",
    user: await createAppUser(normalizedEmail, await hashPassword(password)),
  };
}

async function hasAppUserMotherDuckToken(appUserId: string): Promise<boolean> {
  return Boolean(await findAppUserMotherDuckToken(appUserId));
}

function getAppUserEditSessionId(appUserId: string): string {
  return `${PERSONAL_EDIT_SESSION_ID_PREFIX}${appUserId}`;
}

export async function upsertAppUserMotherDuckEditSession(
  appUser: AppUserRow
): Promise<EditSessionRow> {
  return upsertPersonalEditSession({
    id: getAppUserEditSessionId(appUser.id),
    motherduck_username: getPersonalPatSubjectForAppUser(appUser.id),
  });
}

async function getOrCreateAppUserEditSession(
  appUser: AppUserRow
): Promise<EditSessionRow | null> {
  if (!(await hasAppUserMotherDuckToken(appUser.id))) return null;

  const existing = await findEditSessionById(getAppUserEditSessionId(appUser.id));
  if (existing) return existing;

  return upsertAppUserMotherDuckEditSession(appUser);
}

export function createEditSessionSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashEditSessionSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

export async function getEditAccess(request: Request): Promise<EditAccess> {
  if (isPasswordAuthEnabled()) {
    const appUser = await getAuthenticatedAppUser();
    if (!appUser) return { status: "unauthorized", redirectTo: "/login" };

    if (isPersonalMotherDuckAuthMode()) {
      const editSession = await getOrCreateAppUserEditSession(appUser);
      return editSession
        ? { status: "ready", editSession }
        : { status: "unauthorized", redirectTo: "/motherduck-token" };
    }

    return { status: "ready", editSession: await getSharedEditSession() };
  }

  const token = getBearerToken(request);
  if (!token) return { status: "anonymous_allowed" };

  const editSession = (await findAnonymousEditSessionBySecretHash(
    hashEditSessionSecret(token)
  )) ?? null;

  return editSession
    ? { status: "ready", editSession, sessionSecret: token }
    : { status: "anonymous_allowed" };
}

export async function getEditSession(
  request: Request
): Promise<EditSessionRow | null> {
  const access = await getEditAccess(request);
  return access.status === "ready" ? access.editSession : null;
}

export async function getEditSessionMotherDuckAccess(
  session: EditSessionRow
): Promise<AppMotherDuckAccess> {
  const appUserId = getAppUserIdFromPersonalPatSubject(
    session.motherduck_username
  );
  if (!appUserId) return serviceAccountAccess(session.motherduck_username);

  const access = await getPersonalMotherDuckAccessForAppUser(appUserId);
  if (!access) {
    throw new Error("MotherDuck token is required for this user");
  }
  return access;
}

export async function getMotherDuckTokenAuthContext(): Promise<
  | { status: "ready"; appUser: AppUserRow }
  | { status: "not_found" }
  | { status: "unauthorized" }
> {
  if (!isPasswordAuthEnabled() || !isPersonalMotherDuckAuthMode()) {
    return { status: "not_found" };
  }

  const appUser = await getAuthenticatedAppUser();
  return appUser ? { status: "ready", appUser } : { status: "unauthorized" };
}

export function getEditSessionDiveIds(
  session: EditSessionRow
): Record<string, string> {
  if (!session.dive_ids_json) return {};
  try {
    const parsed = JSON.parse(session.dive_ids_json) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

export async function canAccessEditSessionDive(
  session: EditSessionRow,
  diveId: string
): Promise<boolean> {
  if (Object.values(getEditSessionDiveIds(session)).includes(diveId)) return true;

  const sql = await getMotherduckPg(
    await getEditSessionMotherDuckAccess(session)
  );
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM MD_LIST_DIVES()
    WHERE id = ${diveId}
    LIMIT 1
  `;
  return rows.length > 0;
}
