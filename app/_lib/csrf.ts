import { NextResponse } from "next/server";

// Same-origin gate for mutating route handlers (CSRF defense).
//
// NextAuth v5 cookies default to sameSite=lax, which blocks cross-site
// cookie-bearing POSTs in modern browsers. But the template may be deployed
// behind custom subdomains or with relaxed CORS, so we additionally require
// the Origin header to match the request's Host on every state-changing
// request. Browsers always send Origin on POST; a missing or mismatched
// Origin means the request is cross-site or non-browser, and we reject.
//
// If you need to allow a specific extra origin (e.g. an embedding host),
// set AUTH_TRUSTED_ORIGINS to a comma-separated list of `scheme://host[:port]`
// values.
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return forbidden();

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return forbidden();
  }

  if (originHost === host) return null;
  if (getTrustedOrigins().has(origin)) return null;
  return forbidden();
}

function getTrustedOrigins(): Set<string> {
  const raw = process.env.AUTH_TRUSTED_ORIGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: "Forbidden: cross-origin request" },
    { status: 403 }
  );
}
