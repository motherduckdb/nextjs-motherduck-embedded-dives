import { NextResponse } from "next/server";
import {
  canAccessEditSessionDive,
  getEditSession,
  getEditSessionMotherDuckAccess,
} from "@/app/_lib/auth";
import { getMotherduckPg } from "@/app/_lib/motherduck-access";
import { mdStringLiteral } from "@/lib/motherduck/sql";

/** GET — return current dive version number */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ diveId: string }> }
) {
  const editSession = await getEditSession(_request);
  if (!editSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { diveId } = await params;
  if (!(await canAccessEditSessionDive(editSession, diveId))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const sql = await getMotherduckPg(
      await getEditSessionMotherDuckAccess(editSession)
    );
    const rows = await sql.unsafe(`
      SELECT current_version
      FROM MD_GET_DIVE(id = ${mdStringLiteral(diveId)})
    `);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Dive not found" }, { status: 404 });
    }
    return NextResponse.json({ version: rows[0].current_version });
  } catch (err) {
    console.error("Failed to get dive version:", err);
    return NextResponse.json(
      { error: "Failed to get dive version" },
      { status: 502 }
    );
  }
}
