import { getDb, getSetting, setSetting } from "@/lib/db";

/**
 * Minimal Google OAuth for YouTube Analytics (AdSense revenue). The user
 * supplies their own OAuth client (Settings → Google client ID/secret); we
 * store the refresh token and pull monthly estimatedRevenue.
 */

const SCOPE = "https://www.googleapis.com/auth/yt-analytics-monetary.readonly";
const SYNC_TTL_MS = 6 * 3600e3;

export function adsenseState() {
  return {
    configured: !!(getSetting("google_client_id") && getSetting("google_client_secret")),
    connected: !!getSetting("google_refresh_token"),
    error: getSetting("adsense_sync_error"),
  };
}

export function buildAuthUrl(redirectUri: string): string | null {
  const clientId = getSetting("google_client_id");
  if (!clientId || !getSetting("google_client_secret")) return null;
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<boolean> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getSetting("google_client_id") ?? "",
      client_secret: getSetting("google_client_secret") ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return false;
  const json = await res.json();
  if (!json.refresh_token) return false;
  setSetting("google_refresh_token", json.refresh_token);
  setSetting("adsense_synced_at", null);
  setSetting("adsense_sync_error", null);
  return true;
}

async function getAccessToken(): Promise<string | null> {
  const refresh = getSetting("google_refresh_token");
  if (!refresh) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: getSetting("google_client_id") ?? "",
      client_secret: getSetting("google_client_secret") ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token ?? null;
}

/** Pull monthly estimatedRevenue for the last 24 months into the adsense table. */
export async function syncAdsense(force = false): Promise<void> {
  if (!getSetting("google_refresh_token")) return;
  // failed syncs retry on the next request instead of waiting out the TTL
  const last = Number(getSetting("adsense_synced_at") ?? 0);
  if (!force && !getSetting("adsense_sync_error") && Date.now() - last < SYNC_TTL_MS) return;

  try {
    const token = await getAccessToken();
    if (!token) throw new Error("Could not refresh Google access token");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 23, 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const p = new URLSearchParams({
      ids: "channel==MINE",
      startDate: fmt(start),
      endDate: fmt(now),
      metrics: "estimatedRevenue",
      dimensions: "month",
    });
    const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`YouTube Analytics returned ${res.status}: ${body.slice(0, 120)}`);
    }
    const json = (await res.json()) as { rows?: [string, number][] };

    const db = getDb();
    const upsert = db.prepare(
      `INSERT INTO adsense (month, amount) VALUES (?, ?)
       ON CONFLICT(month) DO UPDATE SET amount = excluded.amount`
    );
    for (const [month, amount] of json.rows ?? []) {
      if (/^\d{4}-\d{2}$/.test(month)) upsert.run(month, amount);
    }
    setSetting("adsense_sync_error", null);
  } catch (e) {
    setSetting("adsense_sync_error", e instanceof Error ? e.message : "AdSense sync failed");
  }
  setSetting("adsense_synced_at", String(Date.now()));
}
