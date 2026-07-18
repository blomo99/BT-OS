import { NextRequest, NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";
import { refreshYouTube } from "@/lib/youtube";
import { refreshSocial } from "@/lib/social";

export const dynamic = "force-dynamic";

type Snapshot = {
  followers: number | null;
  views: number | null;
  likes: number | null;
  recorded_at: string;
};

const RANGE_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  "6month": 182,
  year: 365,
};

// GET /api/social?refresh=1&range=week|month|6month|year
// Returns, per platform, the latest snapshot plus the change across the
// selected window (vs. the newest snapshot at/before the window start) and a
// range-clipped history for the sparkline.
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const range = req.nextUrl.searchParams.get("range") ?? "month";
  const days = RANGE_DAYS[range] ?? 30;
  const { error } = await refreshYouTube(force);
  const live = await refreshSocial(force);

  const db = getDb();
  const platforms = ["youtube", "instagram", "tiktok"] as const;
  const windowStart = new Date(Date.now() - days * 86400000).toISOString();
  const out: Record<string, unknown> = {};

  for (const p of platforms) {
    const all = db
      .prepare(
        `SELECT followers, views, likes, recorded_at FROM social_stats
         WHERE platform = ? ORDER BY recorded_at ASC`
      )
      .all(p) as Snapshot[];

    const latest = all.at(-1) ?? null;
    const inWindow = all.filter((s) => s.recorded_at >= windowStart);
    // baseline = last snapshot before the window (or the first in-window point)
    const beforeWindow = all.filter((s) => s.recorded_at < windowStart).at(-1);
    const baseline = beforeWindow ?? inWindow[0] ?? null;

    const delta = (k: keyof Snapshot) =>
      latest && baseline && latest[k] != null && baseline[k] != null && latest !== baseline
        ? (latest[k] as number) - (baseline[k] as number)
        : null;

    out[p] = {
      latest,
      history: (beforeWindow ? [beforeWindow, ...inWindow] : inWindow).map((s) => ({
        followers: s.followers,
        views: s.views,
        likes: s.likes,
        recorded_at: s.recorded_at,
      })),
      delta: {
        followers: delta("followers"),
        views: delta("views"),
        likes: delta("likes"),
      },
    };
  }

  return NextResponse.json({
    range,
    live,
    stats: out,
    handles: {
      youtube: getSetting("yt_handle"),
      instagram: getSetting("ig_handle"),
      tiktok: getSetting("tt_handle"),
    },
    hasApiKey: !!getSetting("yt_api_key"),
    error: error ?? null,
  });
}

// POST /api/social { platform, followers?, views?, likes? } — manual snapshot
export async function POST(req: NextRequest) {
  const { platform, followers, views, likes } = await req.json();
  if (!["youtube", "instagram", "tiktok"].includes(platform)) {
    return NextResponse.json({ error: "bad platform" }, { status: 400 });
  }
  getDb()
    .prepare("INSERT INTO social_stats (platform, followers, views, likes) VALUES (?, ?, ?, ?)")
    .run(platform, followers ?? null, views ?? null, likes ?? null);
  return NextResponse.json({ ok: true }, { status: 201 });
}
