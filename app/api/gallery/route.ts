import { NextResponse } from "next/server";
import { getEditAccess } from "@/app/_lib/auth";
import {
  createEditSessionGallery,
  createSourceGallery,
} from "@/app/_lib/dive-provisioning";

export async function GET(request: Request) {
  try {
    const access = await getEditAccess(request);
    if (access.status === "unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized", redirectTo: access.redirectTo },
        { status: 401 }
      );
    }
    const gallery = access.status === "ready"
      ? await createEditSessionGallery(access.editSession)
      : await createSourceGallery();

    return NextResponse.json(gallery, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Failed to load gallery:", err);
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 502 }
    );
  }
}
