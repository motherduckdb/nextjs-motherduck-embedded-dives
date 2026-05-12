import { NextResponse } from "next/server";
import {
  canAccessEditSessionDive,
  getEditSession,
  getEditSessionMotherDuckAccess,
} from "@/app/_lib/auth";
import { assertSameOrigin } from "@/app/_lib/csrf";
import { getMotherduckPg } from "@/app/_lib/motherduck-access";
import {
  mdPositiveIntegerLiteral,
  mdStringLiteral,
} from "@/lib/motherduck/sql";

/** POST — revert a dive to a previous version */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ diveId: string }> }
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const editSession = await getEditSession(request);
  if (!editSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { diveId } = await params;
  if (!(await canAccessEditSessionDive(editSession, diveId))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const { version } = (await request.json().catch(() => ({}))) as {
    version?: unknown;
  };

  if (version == null) {
    return NextResponse.json(
      { error: "Missing version parameter" },
      { status: 400 }
    );
  }

  let versionLiteral: string;
  try {
    versionLiteral = mdPositiveIntegerLiteral(version, "version");
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  try {
    const sql = await getMotherduckPg(
      await getEditSessionMotherDuckAccess(editSession)
    );

    // Get content from the target version
    const versionRows = await sql.unsafe(`
      SELECT content
      FROM MD_GET_DIVE_VERSION(id = ${mdStringLiteral(diveId)}, version = ${versionLiteral})
    `);
    if (versionRows.length === 0) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    const oldContent = versionRows[0].content as string;

    // Update the dive back to that content
    await sql.unsafe(`
      SELECT *
      FROM MD_UPDATE_DIVE_CONTENT(id = ${mdStringLiteral(diveId)}, content = ${mdStringLiteral(oldContent)})
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to revert dive:", err);
    return NextResponse.json(
      { error: "Failed to revert dive" },
      { status: 502 }
    );
  }
}
