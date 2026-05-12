import { NextResponse } from "next/server";
import { createDemoAuthUser } from "@/app/_lib/auth";
import { assertSameOrigin } from "@/app/_lib/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
  };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const result = await createDemoAuthUser(email, password);

  if (result.status === "disabled") {
    return NextResponse.json({ error: "Password auth disabled" }, { status: 404 });
  }
  if (result.status === "invalid_email") {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (result.status === "invalid_password") {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (result.status === "already_exists") {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  return NextResponse.json(
    { id: result.user.id, email: result.user.email },
    { status: 201 }
  );
}
