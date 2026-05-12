import { NextResponse } from "next/server";
import { getEditAccess } from "@/app/_lib/auth";
import { assertSameOrigin } from "@/app/_lib/csrf";
import {
  createAnonymousCustomization,
  getExistingCustomization,
} from "@/app/_lib/dive-provisioning";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      starter?: string;
      diveId?: string;
      demoSessionId?: string;
    };
    const access = await getEditAccess(request);

    if (access.status === "ready") {
      return NextResponse.json({
        ...(await getExistingCustomization(
          access.editSession,
          body.starter,
          body.diveId
        )),
        ...(access.sessionSecret ? { sessionSecret: access.sessionSecret } : {}),
      });
    }

    if (access.status === "unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", redirectTo: access.redirectTo },
        { status: 401 }
      );
    }

    const session = await createAnonymousCustomization(body.starter);
    return NextResponse.json(
      {
        ...session,
        demoSessionId: body.demoSessionId ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create edit session:", err);
    return NextResponse.json(
      { error: "Failed to create edit session" },
      { status: 502 }
    );
  }
}
