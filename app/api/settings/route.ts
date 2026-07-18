import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const KEYS = [
  "ics_feeds",
  "yt_handle",
  "yt_api_key",
  "ig_handle",
  "ig_session",
  "tt_handle",
  "content_goals",
  "content_archive_days",
  "google_client_id",
  "google_client_secret",
  "impact_sid",
  "impact_token",
  "research_seeds",
  "anthropic_api_key",
] as const;

export async function GET() {
  const out: Record<string, string | null> = {};
  for (const k of KEYS) out[k] = getSetting(k);
  return NextResponse.json(out);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  for (const k of KEYS) {
    if (k in body) setSetting(k, body[k]);
  }
  // feed list or handle changes invalidate caches
  if ("ics_feeds" in body) setSetting("events_fetched_at", null);
  if ("yt_handle" in body) {
    setSetting("yt_channel_id", null);
    setSetting("yt_fetched_at", null);
  }
  return NextResponse.json({ ok: true });
}
