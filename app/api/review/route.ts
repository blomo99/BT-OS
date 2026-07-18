import { NextRequest, NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";
import { todayStr, addDaysStr, mondayOf, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

// GET /api/review?week=YYYY-MM-DD — stats for the week + any saved review
export async function GET(req: NextRequest) {
  const anchor = req.nextUrl.searchParams.get("week") ?? todayStr();
  const weekStart = mondayOf(anchor);
  const weekEnd = addDaysStr(weekStart, 6);
  const db = getDb();
  const today = todayStr();

  const completed = db
    .prepare(
      `SELECT id, text, completed_date FROM todos
       WHERE completed_date >= ? AND completed_date <= ? ORDER BY completed_date ASC`
    )
    .all(weekStart, weekEnd) as { id: number; text: string }[];

  const overdue = db
    .prepare(
      `SELECT id, text, due_date FROM todos
       WHERE completed_date IS NULL AND status NOT IN ('someday','cancelled')
         AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date ASC`
    )
    .all(today);

  // content goals
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
  const byFormat = Object.fromEntries(published.map((r) => [r.format, r.n]));
  const contentGoal = Object.values(goals).reduce((a, b) => a + b, 0);
  const contentDone = Object.entries(goals).reduce(
    (s, [f, g]) => s + Math.min(g, byFormat[f] ?? 0),
    0
  );

  // sponsorships
  const activeDeals = db
    .prepare(
      `SELECT COALESCE(SUM(price),0) v, COUNT(*) n FROM deals WHERE status NOT IN ('paid','lost','lead')`
    )
    .get() as { v: number; n: number };
  const dueThisWeek = db
    .prepare(
      `SELECT id, brand, due_date FROM deals
       WHERE status NOT IN ('paid','lost') AND due_date >= ? AND due_date <= ?`
    )
    .all(weekStart, weekEnd);
  const unpaidInvoices = db
    .prepare(
      `SELECT id, brand, price, payment_due FROM deals
       WHERE invoice_status = 'sent' AND payment_received IS NULL`
    )
    .all();

  const saved = db
    .prepare("SELECT * FROM weekly_reviews WHERE week_start = ?")
    .get(weekStart);

  return NextResponse.json({
    weekStart,
    weekEnd,
    completed,
    overdue,
    content: { done: contentDone, goal: contentGoal, byFormat, goals },
    deals: {
      activeValue: activeDeals.v,
      activeCount: activeDeals.n,
      dueThisWeek,
      unpaidInvoices,
    },
    saved: saved ?? null,
    summaryLines: [
      `${completed.length} task${completed.length === 1 ? "" : "s"} completed`,
      `${contentDone} of ${contentGoal} content goals achieved`,
      `${fmtMoney(activeDeals.v)} in active sponsorship value`,
      ...(unpaidInvoices.length
        ? [`${unpaidInvoices.length} invoice${unpaidInvoices.length > 1 ? "s" : ""} outstanding`]
        : []),
      ...(overdue.length ? [`${overdue.length} task${overdue.length > 1 ? "s" : ""} overdue`] : []),
    ],
  });
}

// POST /api/review { week_start, reflections, priorities: string[] }
// Saves the review and creates next week's priority tasks.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const weekStart = b.week_start ?? mondayOf(todayStr());
  const db = getDb();

  db.prepare(
    `INSERT INTO weekly_reviews (week_start, summary, reflections, priorities, completed_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(week_start) DO UPDATE SET
       summary = excluded.summary, reflections = excluded.reflections,
       priorities = excluded.priorities, completed_at = excluded.completed_at`
  ).run(
    weekStart,
    JSON.stringify(b.summary ?? {}),
    b.reflections || null,
    JSON.stringify(b.priorities ?? [])
  );

  // next week's priorities become high-priority tasks due Monday
  const nextMonday = addDaysStr(weekStart, 7);
  const insert = db.prepare(
    `INSERT INTO todos (text, created_date, status, priority, due_date, updated_at)
     VALUES (?, ?, 'scheduled', 1, ?, datetime('now'))`
  );
  for (const p of (b.priorities ?? []) as string[]) {
    if (p.trim()) insert.run(p.trim(), nextMonday, nextMonday);
  }

  return NextResponse.json({ ok: true });
}
