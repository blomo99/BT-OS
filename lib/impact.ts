import { getDb, getSetting, setSetting } from "@/lib/db";

/**
 * Impact (Impact Radius) affiliate earnings. Basic auth with the Account SID +
 * a scoped access token (impact.com → Settings → Technical → API — the token
 * needs the Reports scope). Monthly TOTAL earnings (action earnings + other
 * earnings like flat placement fees) come from the same "Performance by Month"
 * report the impact.com dashboard shows, in a single request for the whole
 * 24-month window — refreshed fully every sync so reversals and restatements
 * self-heal. Manual month entry stays available as an override/fallback.
 */

const SYNC_TTL_MS = 6 * 3600e3;
const REPORT = "partner_performance_by_month";
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

export function impactState() {
  return {
    configured: !!(getSetting("impact_sid") && getSetting("impact_token")),
    error: getSetting("impact_sync_error"),
  };
}

export async function syncImpact(force = false): Promise<void> {
  const sid = getSetting("impact_sid");
  const token = getSetting("impact_token");
  if (!sid || !token) return;

  // a failed sync retries on the next request — otherwise a fixed token
  // would sit blocked behind the TTL for hours
  const last = Number(getSetting("impact_synced_at") ?? 0);
  if (!force && !getSetting("impact_sync_error") && Date.now() - last < SYNC_TTL_MS) return;

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start = new Date();
    start.setMonth(start.getMonth() - 23, 1);

    const p = new URLSearchParams({ START_DATE: fmt(start), END_DATE: fmt(new Date()) });
    const res = await fetch(
      `https://api.impact.com/Mediapartners/${encodeURIComponent(sid)}/Reports/${REPORT}?${p}`,
      {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160);
      // 403 with valid-looking creds = scoped token missing the Reports scope
      const hint =
        res.status === 403
          ? " — your token authenticates but lacks API scopes; create a new access token on impact.com with the Reports scope enabled"
          : "";
      throw new Error(`Impact API returned ${res.status} (${body})${hint}`);
    }
    const json = (await res.json()) as {
      Records?: { Month?: string; Total_Cost?: string | number }[];
    };

    const db = getDb();
    const upsert = db.prepare(
      `INSERT INTO affiliate (month, amount) VALUES (?, ?)
       ON CONFLICT(month) DO UPDATE SET amount = excluded.amount`
    );
    for (const rec of json.Records ?? []) {
      // "2026 - Jul" → "2026-07"; Total_Cost = the dashboard's Total Earnings
      const m = (rec.Month ?? "").match(/^(\d{4})\s*-\s*([A-Za-z]{3})$/);
      const month = m && MONTHS[m[2]] ? `${m[1]}-${MONTHS[m[2]]}` : null;
      const amount = Number(rec.Total_Cost ?? 0);
      if (month && amount) upsert.run(month, Math.round(amount * 100) / 100);
    }
    setSetting("impact_sync_error", null);
  } catch (e) {
    setSetting("impact_sync_error", e instanceof Error ? e.message : "Impact sync failed");
  }
  setSetting("impact_synced_at", String(Date.now()));
}
