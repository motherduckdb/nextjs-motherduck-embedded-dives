export const API_BASE =
  process.env.MOTHERDUCK_API_BASE || "https://api.motherduck.com";
const ADMIN_TOKEN = process.env.MOTHERDUCK_TOKEN || "";

function adminHeaders(): Record<string, string> {
  if (!ADMIN_TOKEN) {
    throw new Error("MOTHERDUCK_TOKEN is not configured");
  }
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export function authHeaders(token?: string): Record<string, string> {
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }
  return adminHeaders();
}

type MotherDuckErrorBody = {
  message?: string;
  code?: string;
  data?: {
    path?: string;
    code?: string;
  };
};

function isExistingUserError(status: number, body: string): boolean {
  if (status === 409) return true;

  let parsed: MotherDuckErrorBody | null = null;
  try {
    parsed = JSON.parse(body) as MotherDuckErrorBody;
  } catch {
    return false;
  }

  return (
    status === 400 &&
    parsed.data?.path === "users.createServiceAccount" &&
    parsed.message?.includes("alive_entity_unique_name_per_parent_and_type") ===
      true
  );
}

/** Create a MotherDuck user (Member role). */
export async function createMotherDuckUser(
  username: string
): Promise<{ username: string }> {
  const res = await fetch(`${API_BASE}/v1/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (isExistingUserError(res.status, text)) {
      return { username };
    }
    throw new Error(`MotherDuck API error ${res.status}: ${text}`);
  }

  return { username };
}

/** Mint a short-lived token for a MotherDuck user. Called on demand, not stored in DB. */
export async function createMotherDuckToken(
  username: string,
  name: string,
  ttl: number = 3600
): Promise<{ token: string; id: string }> {
  const res = await fetch(
    `${API_BASE}/v1/users/${encodeURIComponent(username)}/tokens`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name, ttl, token_type: "read_write" }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MotherDuck API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { token: data.token, id: data.id };
}
