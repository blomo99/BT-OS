import { getDb, getSetting, setSetting } from "@/lib/db";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Resolve @handle -> channel id (cached). */
async function resolveChannelId(handle: string): Promise<string | null> {
  const cached = getSetting("yt_channel_id");
  if (cached) return cached;

  const clean = handle.replace(/^@/, "");
  const res = await fetch(`https://www.youtube.com/@${clean}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // YouTube shuffles its markup — try every known channel-id location
  const m =
    html.match(/"channelId":"(UC[\w-]{22})"/) ??
    html.match(/"browseId":"(UC[\w-]{22})"/) ??
    html.match(/"externalId":"(UC[\w-]{22})"/) ??
    html.match(/channel\/(UC[\w-]{22})/);
  if (!m) return null;
  setSetting("yt_channel_id", m[1]);
  return m[1];
}

/** Without an API key: a video is a Short if /shorts/<id> serves 200 instead of redirecting. */
async function isShortByProbe(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": UA },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** RSS titles arrive XML-escaped */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

const YT_TTL_MS = 30 * 60 * 1000;

/**
 * Pull recent uploads from the channel's public RSS feed, classify each as
 * short/long, and log them into content_log. With an API key, also snapshot
 * subscriber/view counts into social_stats.
 */
export async function refreshYouTube(force = false): Promise<{ error?: string }> {
  const handle = getSetting("yt_handle");
  if (!handle) return { error: "No YouTube handle configured" };

  const last = Number(getSetting("yt_fetched_at") ?? 0);
  if (!force && Date.now() - last < YT_TTL_MS) {
    const cachedErr = getSetting("yt_last_error");
    return cachedErr ? { error: cachedErr } : {};
  }

  const channelId = await resolveChannelId(handle);
  if (!channelId) {
    const error = `Could not resolve YouTube channel for ${handle}`;
    setSetting("yt_last_error", error);
    setSetting("yt_fetched_at", String(Date.now()));
    return { error };
  }

  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return { error: `YouTube feed returned ${res.status}` };
  const xml = await res.text();

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, body]) => ({
    videoId: body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? "",
    title: body.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
    published: body.match(/<published>([^<]+)<\/published>/)?.[1] ?? "",
  }));

  const db = getDb();
  const apiKey = getSetting("yt_api_key");

  // duration lookup via API when available (more reliable than the probe)
  const durations = new Map<string, number>();
  if (apiKey && entries.length) {
    try {
      const ids = entries.map((e) => e.videoId).join(",");
      const api = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${apiKey}`
      );
      if (api.ok) {
        const json = await api.json();
        for (const item of json.items ?? []) {
          durations.set(item.id, parseISODuration(item.contentDetails.duration));
        }
      }
    } catch {
      /* fall back to probe */
    }
  }

  const exists = db.prepare("SELECT 1 FROM content_items WHERE external_id = ?");
  const insert = db.prepare(
    `INSERT INTO content_items (title, platform, format, status, published_date, source, external_id)
     VALUES (?, 'youtube', ?, 'done', ?, 'youtube', ?)`
  );

  for (const e of entries) {
    if (!e.videoId || exists.get(e.videoId)) continue;
    let short: boolean;
    if (durations.has(e.videoId)) {
      short = durations.get(e.videoId)! <= 183; // <= 3:03, YouTube Shorts limit
    } else {
      short = await isShortByProbe(e.videoId);
    }
    insert.run(decodeEntities(e.title), short ? "short" : "long", e.published.slice(0, 10), e.videoId);
  }

  // channel stats snapshot (API key only)
  if (apiKey) {
    try {
      const api = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`
      );
      if (api.ok) {
        const json = await api.json();
        const stats = json.items?.[0]?.statistics;
        if (stats) {
          db.prepare(
            "INSERT INTO social_stats (platform, followers, views) VALUES ('youtube', ?, ?)"
          ).run(Number(stats.subscriberCount), Number(stats.viewCount));
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  setSetting("yt_fetched_at", String(Date.now()));
  setSetting("yt_last_error", null);
  return {};
}
