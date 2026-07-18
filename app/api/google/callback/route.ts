import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

// OAuth redirect target — stores the refresh token, then back to Revenue.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;
  if (!code) {
    return NextResponse.redirect(`${origin}/business?tab=deals&adsense=denied`);
  }
  const ok = await exchangeCode(code, `${origin}/api/google/callback`);
  return NextResponse.redirect(
    `${origin}/business?tab=deals&adsense=${ok ? "connected" : "failed"}`
  );
}
