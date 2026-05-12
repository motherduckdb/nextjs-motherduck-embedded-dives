import { API_BASE, authHeaders } from "./api";

export async function createDiveEmbedSession(options: {
  diveId: string;
  username?: string | null;
  token?: string;
}): Promise<string> {
  const res = await fetch(
    `${API_BASE}/v1/dives/${encodeURIComponent(options.diveId)}/embed-session`,
    {
      method: "POST",
      headers: authHeaders(options.token),
      body: JSON.stringify(
        options.username ? { username: options.username } : {}
      ),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MotherDuck API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { session?: string };
  if (!data.session) {
    throw new Error("MotherDuck API response missing embed session");
  }

  return data.session;
}
