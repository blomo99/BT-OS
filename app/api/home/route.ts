import { NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";
import { computeAlerts } from "@/lib/alerts";
import { todayStr, addDaysStr, mondayOf } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Aggregate for the Home command center — one round trip. */
export async function GET() {
  const db = getDb();
  const today = todayStr();
  const weekStart = mondayOf(today);
  const weekEnd = addDaysStr(weekStart, 6);
  const horizon = addDaysStr(today, 14);

  const top3 = db
    .prepare(`SELECT * FROM todos WHERE top3_date = ? ORDER BY id ASC`)
    .all(today);

  const todayOpen = db
    .prepare(
      `SELECT * FROM todos
       WHERE completed_date IS NULL AND status NOT IN ('cancelled')
         AND (created_date <= ? OR due_date <= ?)
       ORDER BY priority IS NULL, priority ASC, id ASC LIMIT 12`
    )
    .all(today, today);

  const overdue = db
    .prepare(
      `SELECT * FROM todos
       WHERE completed_date IS NULL AND status != 'cancelled'
         AND due_date IS NOT NULL AND due_date < ?
       ORDER BY due_date ASC LIMIT 8`
    )
    .all(today);

  const doneToday = db
    .prepare(`SELECT COUNT(*) n FROM todos WHERE completed_date = ?`)
    .get(today) as { n: number };

  // today's agenda: feed events + local events
  const dayStart = new Date(`${today}T00:00`).toISOString();
  const dayEnd = new Date(`${addDaysStr(today, 1)}T00:00`).toISOString();
  const feedEvents = db
    .prepare(`SELECT title, start, all_day FROM events WHERE start >= ? AND start < ? ORDER BY start ASC`)
    .all(dayStart, dayEnd) as { title: string; start: string; all_day: number }[];
  const localEvents = (
    db
      .prepare(`SELECT title, date, time FROM local_events WHERE date = ? ORDER BY time ASC`)
      .all(today) as { title: string; date: string; time: string | null }[]
  ).map((e) => ({
    title: e.title,
    start: e.time ? new Date(`${e.date}T${e.time}`).toISOString() : new Date(`${e.date}T00:00`).toISOString(),
    all_day: e.time ? 0 : 1,
  }));
  const agenda = [...feedEvents, ...localEvents].sort((a, b) =>
    a.start.localeCompare(b.start)
  );

  // upcoming deadlines (next 14 days): tasks, deal deliverables, content targets
  const deadlines = [
    ...(db
      .prepare(
        `SELECT id, text AS title, due_date FROM todos
         WHERE completed_date IS NULL AND due_date > ? AND due_date <= ?`
      )
      .all(today, horizon) as { id: number; title: string; due_date: string }[]
    ).map((r) => ({ ...r, type: "task" as const, href: "/personal" })),
    ...(db
      .prepare(
        `SELECT id, brand AS title, due_date FROM deals
         WHERE status NOT IN ('paid','lost') AND due_date > ? AND due_date <= ?`
      )
      .all(today, horizon) as { id: number; title: string; due_date: string }[]
    ).map((r) => ({ ...r, type: "deal" as const, href: `/business?tab=deals&deal=${r.id}` })),
    ...(db
      .prepare(
        `SELECT id, title, target_date AS due_date FROM content_items
         WHERE status IN ('idea','scripting','ready') AND target_date > ? AND target_date <= ?`
      )
      .all(today, horizon) as { id: number; title: string; due_date: string }[]
    ).map((r) => ({ ...r, type: "video" as const, href: "/business?tab=content" })),
  ]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8);

  // week progress
  const tasksDoneWeek = db
    .prepare(`SELECT COUNT(*) n FROM todos WHERE completed_date >= ? AND completed_date <= ?`)
    .get(weekStart, weekEnd) as { n: number };
  let goals: Record<string, number> = { short: 3, long: 1 };
  try {
    goals = { ...goals, ...JSON.parse(getSetting("content_goals") ?? "{}") };
  } catch { /* defaults */ }
  const published = db
    .prepare(
      `SELECT format, COUNT(*) n FROM content_items
       WHERE status IN ('done','archived') AND published_date >= ? AND published_date <= ?
       GROUP BY format`
    )
    .all(weekStart, weekEnd) as { format: string; n: number }[];
  const publishedByFormat = Object.fromEntries(published.map((r) => [r.format, r.n]));
  const contentGoalTotal = Object.values(goals).reduce((a, b) => a + b, 0);
  const contentDone = Object.entries(goals).reduce(
    (sum, [fmt, goal]) => sum + Math.min(goal, publishedByFormat[fmt] ?? 0),
    0
  );

  return NextResponse.json({
    date: today,
    top3,
    todayOpen,
    doneToday: doneToday.n,
    overdue,
    agenda,
    deadlines,
    alerts: computeAlerts(),
    week: {
      start: weekStart,
      tasksDone: tasksDoneWeek.n,
      contentDone,
      contentGoal: contentGoalTotal,
      // broken out so Home can show "1/3 short · 0/1 long" instead of one blended count
      short: { done: publishedByFormat.short ?? 0, goal: goals.short ?? 0 },
      long: { done: publishedByFormat.long ?? 0, goal: goals.long ?? 0 },
    },
  });
}
