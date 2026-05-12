import { NextResponse } from "next/server";
import { createSourceEmbedSession } from "@/app/_lib/dive-provisioning";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await createSourceEmbedSession(url.searchParams.get("starter")),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Failed to load source dive:", err);
    return NextResponse.json(
      { error: "Failed to load source dive" },
      { status: 502 }
    );
  }
}
