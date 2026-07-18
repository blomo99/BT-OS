import { NextRequest, NextResponse } from "next/server";

/**
 * Password gate for public deployments (Railway etc.). Set APP_PASSWORD in the
 * environment and every request requires HTTP Basic auth (any username). When
 * APP_PASSWORD is unset — local use — the app stays open, same as always.
 */
export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      // username is ignored; the password may itself contain ":"
      const supplied = atob(encoded).split(":").slice(1).join(":");
      if (supplied === password) return NextResponse.next();
    } catch {
      /* malformed header → 401 below */
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BT OS", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
