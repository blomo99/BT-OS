import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { refreshEvents, getFeeds } from "@/lib/calendar";
import { addDaysStr } from "@/lib/format";

export const dynamic = "force-dynamic";

type LocalEvent = {
  id: number;
  title: string;
  date: string;
  end_date: string | null;
  time: string | null;
  notes: string | null;
};

const MAX_SPAN_DAYS = 60;

// GET /api/events?from=ISO&to=ISO&refresh=1
// Returns feed events merged with locally created events in one shape.
// Multi-day local events (vacations) expand to one entry per day.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  const { error } = await refreshEvents(force);

  const db = getDb();
  const feedEvents = (
    from && to
      ? db
          .prepare(
            "SELECT * FROM events WHERE start < ? AND (COALESCE(end, start) >= ? OR start >= ?) ORDER BY start ASC"
          )
          .all(to, from, from)
      : db.prepare("SELECT * FROM events ORDER BY start ASC").all()
  ) as {
    id: number;
    feed_name: string;
    title: string;
    start: string;
    end: string | null;
    all_day: number;
  }[];

  const locals = db
    .prepare("SELECT * FROM local_events ORDER BY date ASC, time ASC")
    .all() as LocalEvent[];

  const localEntries: {
    id: number;
    feed_name: string;
    title: string;
    start: string;
    end: string | null;
    all_day: number;
    local: number;
    span: string | null;
  }[] = [];

  for (const e of locals) {
    // day count for a span, capped for safety; single-day = 1
    let days = 1;
    if (e.end_date && e.end_date > e.date) {
      const ms = new Date(e.end_date).getTime() - new Date(e.date).getTime();
      days = Math.min(Math.round(ms / 86400000) + 1, MAX_SPAN_DAYS);
    }
    for (let i = 0; i < days; i++) {
      const day = addDaysStr(e.date, i);
      const timed = e.time && i === 0; // time applies to the first day only
      localEntries.push({
        id: e.id,
        feed_name: "Personal",
        title: e.title,
        start: timed
          ? new Date(`${day}T${e.time}`).toISOString()
          : new Date(`${day}T00:00`).toISOString(),
        end: null,
        all_day: timed ? 0 : 1,
        local: 1,
        span: days > 1 ? `Day ${i + 1}/${days}` : null,
      });
    }
  }

  const merged = [
    ...feedEvents.map((e) => ({ ...e, local: 0, span: null as string | null })),
    ...localEntries.filter((e) => !from || !to || (e.start >= from && e.start < to)),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ events: merged, feeds: getFeeds(), error: error ?? null });
}

// POST /api/events { title, date: YYYY-MM-DD, end_date?: YYYY-MM-DD, time?: HH:MM, notes? }
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) {
    return NextResponse.json({ error: "title and date required" }, { status: 400 });
  }
  const endDate =
    b.end_date && /^\d{4}-\d{2}-\d{2}$/.test(b.end_date) && b.end_date > b.date
      ? b.end_date
      : null;
  const info = getDb()
    .prepare(
      "INSERT INTO local_events (title, date, end_date, time, notes) VALUES (?, ?, ?, ?, ?)"
    )
    .run(b.title.trim(), b.date, endDate, b.time || null, b.notes || null);
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}

// DELETE /api/events?id=N  (locally created events only; removes the whole span)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  getDb().prepare("DELETE FROM local_events WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
