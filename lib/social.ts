import { getDb, getSetting, setSetting } from "@/lib/db";
import { todayStr } from "@/lib/format";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const TTL_MS = 45 * 60 * 1000;
/** never auto-log more than this many posts from one count jump */
const MAX_AUTO_POSTS = 5;

export type LiveStatus = Record<string, "live" | "failed" | "manual" | "no-handle">;

/** "21.1M" | "12.5K" | "1,234" → number */
function parseCompact(s: string): number | null {
  const m = s.trim().match(/^([\d.,]+)\s*([KM])?/i);
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(base)) return null;
  const mult = m[2]?.toUpperCase() === "M" ? 1e6 : m[2]?.toUpperCase() === "K" ? 1e3 : 1;
  return Math.round(base * mult);
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** TikTok profile page embeds exact counts in its hydration JSON. */
async function fetchTikTok(handle: string) {
  const html = await get(`https://www.tiktok.com/@${handle.replace(/^@/, "")}`);
  if (!html) return null;
  const followers = html.match(/"followerCount":(\d+)/)?.[1];
  const likes = html.match(/"heartCount":(\d+)/)?.[1];
  const videos = html.match(/"videoCount":(\d+)/)?.[1];
  if (!followers) return null;
  return {
    followers: Number(followers),
    views: null, // TikTok has no public total-views metric
    likes: likes ? Number(likes) : null,
    posts: videos ? Number(videos) : null,
  };
}

/**
 * YouTube channel page carries an approximate subscriber string ("12.5K");
 * the /about page carries the exact lifetime view count.
 */
async function fetchYouTubeApprox(handle: string) {
  const clean = handle.replace(/^@/, "");
  const html = await get(`https://www.youtube.com/@${clean}`);
  if (!html) return null;
  const text =
    html.match(/"subscriberCountText"[^}]*?"simpleText":"([^"]+)"/)?.[1] ??
    html.match(/([\d.,]+[KM]?) subscribers/)?.[1];
  const followers = text ? parseCompact(text) : null;
  if (followers == null) return null;

  let views: number | null = null;
  const about = await get(`https://www.youtube.com/@${clean}/about`);
  if (about) {
    const v =
      about.match(/"viewCountText":\{"simpleText":"([\d,.]+) views"/)?.[1] ??
      about.match(/([\d,]+) views/)?.[1];
    if (v) views = parseCompact(v);
  }
  return { followers, views, likes: null, posts: null };
}

/**
 * Instagram blocks anonymous reads. With the user's own session cookie
 * (Settings → Instagram session) we can use the same internal endpoint the
 * web app uses; otherwise fall back to the og meta, which rarely survives.
 */
async function fetchInstagram(handle: string) {
  const clean = handle.replace(/^@/, "");
  const session = getSetting("ig_session");

  if (session) {
    try {
      const res = await fetch(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${clean}`,
        {
          headers: {
            "User-Agent": UA,
            "x-ig-app-id": "936619743392459",
            Cookie: `sessionid=${session.trim()}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const user = json?.data?.user;
        if (user?.edge_followed_by?.count != null) {
          return {
            followers: user.edge_followed_by.count as number,
            views: null,
            likes: null,
            posts: (user.edge_owner_to_timeline_media?.count as number) ?? null,
          };
        }
      }
    } catch {
      /* fall through to og attempt */
    }
  }

  const html = await get(`https://www.instagram.com/${clean}/`);
  if (!html) return null;
  const og = html.match(/<meta (?:property="og:description"|name="description") content="([^"]+)"/)?.[1];
  if (!og) return null;
  const followers = og.match(/([\d.,]+[KM]?)\s+Followers/i)?.[1];
  const posts = og.match(/([\d.,]+[KM]?)\s+Posts/i)?.[1];
  if (!followers) return null;
  return {
    followers: parseCompact(followers),
    views: null,
    likes: null,
    posts: posts ? parseCompact(posts) : null,
  };
}

function recordSnapshot(
  platform: string,
  data: { followers: number | null; views?: number | null; likes: number | null }
) {
  const db = getDb();
  const latest = db
    .prepare(
      `SELECT followers, views, likes, recorded_at FROM social_stats
       WHERE platform = ? ORDER BY recorded_at DESC LIMIT 1`
    )
    .get(platform) as
    | { followers: number | null; views: number | null; likes: number | null; recorded_at: string }
    | undefined;

  const views = data.views ?? latest?.views ?? null;
  const changed =
    !latest ||
    latest.followers !== data.followers ||
    latest.likes !== data.likes ||
    latest.views !== views;
  const stale =
    !latest || Date.now() - new Date(latest.recorded_at + "Z").getTime() > 20 * 3600e3;
  if (changed || stale) {
    db.prepare(
      "INSERT INTO social_stats (platform, followers, views, likes) VALUES (?, ?, ?, ?)"
    ).run(platform, data.followers, views, data.likes);
  }
}

/**
 * When a platform's public post count rises, log the new posts as done
 * short-form content so the weekly goal advances automatically. (YouTube is
 * handled precisely — short vs long — by the RSS import in lib/youtube.)
 */
function autoLogPosts(platform: string, newCount: number | null) {
  if (newCount == null) return;
  const db = getDb();
  let baselines: Record<string, number> = {};
  try {
    baselines = JSON.parse(getSetting("social_post_baselines") ?? "{}");
  } catch { /* fresh */ }

  const prev = baselines[platform];
  if (typeof prev === "number" && newCount > prev) {
    const n = Math.min(newCount - prev, MAX_AUTO_POSTS);
    const insert = db.prepare(
      `INSERT OR IGNORE INTO content_items
         (title, platform, format, status, published_date, source, external_id)
       VALUES (?, ?, 'short', 'done', ?, ?, ?)`
    );
    for (let i = 1; i <= n; i++) {
      const count = prev + i;
      insert.run(
        `${platform === "tiktok" ? "TikTok" : "Instagram"} post (auto-detected)`,
        platform,
        todayStr(),
        platform,
        `${platform}-post-${count}`
      );
    }
  }
  baselines[platform] = newCount;
  setSetting("social_post_baselines", JSON.stringify(baselines));
}

/**
 * Pull live follower/like counts from public profile pages. TikTok and
 * YouTube work anonymously; Instagram usually requires manual snapshots.
 */
export async function refreshSocial(force = false): Promise<LiveStatus> {
  const readStatus = (): LiveStatus => {
    try {
      return JSON.parse(getSetting("social_live_status") ?? "{}");
    } catch {
      return {};
    }
  };

  const last = Number(getSetting("social_scraped_at") ?? 0);
  if (!force && Date.now() - last < TTL_MS) return readStatus();

  const status: LiveStatus = {};

  // TikTok
  const tt = getSetting("tt_handle");
  if (!tt) status.tiktok = "no-handle";
  else {
    const data = await fetchTikTok(tt);
    if (data) {
      recordSnapshot("tiktok", data);
      autoLogPosts("tiktok", data.posts);
      status.tiktok = "live";
    } else status.tiktok = "failed";
  }

  // Instagram (best-effort)
  const ig = getSetting("ig_handle");
  if (!ig) status.instagram = "no-handle";
  else {
    const data = await fetchInstagram(ig);
    if (data && data.followers != null) {
      recordSnapshot("instagram", data);
      autoLogPosts("instagram", data.posts);
      status.instagram = "live";
    } else status.instagram = "manual";
  }

  // YouTube — exact stats come via the Data API (lib/youtube); this is the
  // no-API-key fallback for an approximate live subscriber count.
  const yt = getSetting("yt_handle");
  if (!yt) status.youtube = "no-handle";
  else if (getSetting("yt_api_key")) status.youtube = "live";
  else {
    const data = await fetchYouTubeApprox(yt);
    if (data) {
      recordSnapshot("youtube", data);
      status.youtube = "live";
    } else status.youtube = "failed";
  }

  setSetting("social_scraped_at", String(Date.now()));
  setSetting("social_live_status", JSON.stringify(status));
  return status;
}
