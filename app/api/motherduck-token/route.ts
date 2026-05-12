import { NextResponse } from "next/server";
import {
  getMotherDuckTokenAuthContext,
  upsertAppUserMotherDuckEditSession,
} from "@/app/_lib/auth";
import { assertSameOrigin } from "@/app/_lib/csrf";
import { storeMotherDuckPat } from "@/app/_lib/motherduck-token-store";
import {
  verifyMotherDuckPat,
} from "@/app/_lib/personal-token";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const authContext = await getMotherDuckTokenAuthContext();
  if (authContext.status === "not_found") {
    return NextResponse.json({ error: "Personal MotherDuck token auth disabled" }, { status: 404 });
  }
  if (authContext.status === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
  };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "MotherDuck token required" }, { status: 400 });
  }

  try {
    await verifyMotherDuckPat(token);
    await storeMotherDuckPat(authContext.appUser.id, token);
    await upsertAppUserMotherDuckEditSession(authContext.appUser);
    return NextResponse.json({
      ok: true,
      preview: token.length > 4 ? token.slice(-4) : null,
    });
  } catch (err) {
    console.error("Failed to verify MotherDuck token:", err);
    return NextResponse.json(
      { error: "Could not verify MotherDuck token" },
      { status: 400 }
    );
  }
}
