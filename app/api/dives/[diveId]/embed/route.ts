import { NextResponse } from "next/server";
import {
  canAccessEditSessionDive,
  getEditSession,
  getEditSessionMotherDuckAccess,
} from "@/app/_lib/auth";
import {
  createDiveEmbedSessionForAccess,
  getAppMotherDuckAccessCacheKey,
} from "@/app/_lib/motherduck-access";

// In-memory cache: diveId:username → { session, expiresAt }
const sessionCache = new Map<string, { session: string; expiresAt: number }>();

// 23 hours in ms — refresh before the 24h expiry
const CACHE_TTL_MS = 23 * 60 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ diveId: string }> }
) {
  const editSession = await getEditSession(_request);
  if (!editSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { diveId } = await params;

  if (!diveId) {
    return NextResponse.json({ error: "Invalid dive ID" }, { status: 400 });
  }
  if (!(await canAccessEditSessionDive(editSession, diveId))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const access = await getEditSessionMotherDuckAccess(editSession);
  const cacheKey = [
    diveId,
    getAppMotherDuckAccessCacheKey(access),
    access.kind === "personal-token" ? access.tokenGeneration : "service",
  ].join(":");
  const cached = sessionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ session: cached.session });
  }

  try {
    const session = await createDiveEmbedSessionForAccess(diveId, access);

    sessionCache.set(cacheKey, {
      session,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404")) {
      return NextResponse.json({ error: "Dive not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to create embed session" },
      { status: 502 }
    );
  }
}
