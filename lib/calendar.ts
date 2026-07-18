import ical, { VEvent } from "node-ical";
import { getDb, getSetting, setSetting } from "@/lib/db";

export type Feed = { name: string; url: string };

export function getFeeds(): Feed[] {
  try {
    return JSON.parse(getSetting("ics_feeds") ?? "[]");
  } catch {
    return [];
  }
}

const CACHE_TTL_MS = 30 * 60 * 1000;

/** Re-fetch all ICS feeds and rebuild the events cache. */
export async function refreshEvents(force = false): Promise<{ error?: string }> {
  const feeds = getFeeds();
  const last = Number(getSetting("events_fetched_at") ?? 0);
  if (!force && Date.now() - last < CACHE_TTL_MS) return {};

  const db = getDb();
  const errors: string[] = [];

  // expand a window of -1 year .. +2 years around now
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 2);

  const rows: {
    feed_name: string;
    uid: string;
    title: string;
    start: string;
    end: string | null;
    all_day: number;
  }[] = [];

  for (const feed of feeds) {
    try {
      const data = await ical.async.fromURL(feed.url.replace(/^webcal:/i, "https:"));
      for (const item of Object.values(data)) {
        if (!item || item.type !== "VEVENT") continue;
        const ev = item as VEvent;
        const allDay = (ev.datetype as string) === "date" ? 1 : 0;
        const durationMs =
          ev.end && ev.start ? ev.end.getTime() - ev.start.getTime() : 0;

        const pushRow = (start: Date) => {
          rows.push({
            feed_name: feed.name,
            uid: `${ev.uid}-${start.toISOString()}`,
            title:
              typeof ev.summary === "string"
                ? ev.summary
                : (ev.summary?.val ?? "(untitled)"),
            start: start.toISOString(),
            end: durationMs ? new Date(start.getTime() + durationMs).toISOString() : null,
            all_day: allDay,
          });
        };

        if (ev.rrule) {
          const exdates = new Set(
            Object.values(ev.exdate ?? {}).map((d) => (d as Date).toISOString())
          );
          for (const occ of ev.rrule.between(from, to, true)) {
            if (exdates.has(occ.toISOString())) continue;
            pushRow(occ);
          }
        } else if (ev.start >= from && ev.start <= to) {
          pushRow(ev.start);
        }
      }
    } catch (e) {
      errors.push(`${feed.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const replace = db.transaction(() => {
    db.prepare("DELETE FROM events").run();
    const ins = db.prepare(
      "INSERT INTO events (feed_name, uid, title, start, end, all_day) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const r of rows) ins.run(r.feed_name, r.uid, r.title, r.start, r.end, r.all_day);
  });
  replace();
  setSetting("events_fetched_at", String(Date.now()));

  return errors.length ? { error: errors.join("; ") } : {};
}
