import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

// Kicks off Google OAuth consent for YouTube Analytics (AdSense revenue).
export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/google/callback`;
  const url = buildAuthUrl(redirectUri);
  if (!url) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/business?tab=deals&adsense=missing_creds`
    );
  }
  return NextResponse.redirect(url);
}
