import { NextResponse } from "next/server";
import {
  getEditSession,
  getEditSessionMotherDuckAccess,
} from "@/app/_lib/auth";
import { getMotherduckPg } from "@/app/_lib/motherduck-access";

export async function GET(req: Request) {
  const editSession = await getEditSession(req);
  if (!editSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = await getMotherduckPg(
      await getEditSessionMotherDuckAccess(editSession)
    );
    const dives = await sql`
      SELECT id, title, description, owner_name, updated_at
      FROM MD_LIST_DIVES()
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({ dives });
  } catch {
    return NextResponse.json(
      { error: "Failed to list dives" },
      { status: 502 }
    );
  }
}
