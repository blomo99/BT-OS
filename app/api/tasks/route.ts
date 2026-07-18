import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTIVE = `t.completed_date IS NULL AND t.status NOT IN ('cancelled')`;

// GET /api/tasks?view=…&date=YYYY-MM-DD
// Views: inbox | today | top3 | upcoming | overdue | waiting | someday | completed | day
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get("view") ?? "today";
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  const db = getDb();
  const today = todayStr();

  const base = `SELECT t.*, p.name AS project_name, a.name AS area_name, a.icon AS area_icon
                FROM todos t
                LEFT JOIN projects p ON p.id = t.project_id
                LEFT JOIN areas a ON a.id = t.area_id`;

  if (view === "counts") {
    const c = (sql: string, ...args: unknown[]) =>
      (db.prepare(sql).get(...args) as { n: number }).n;
    return NextResponse.json({
      inbox: c(`SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status = 'inbox'`),
      today: c(
        `SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status NOT IN ('someday','waiting','inbox') AND (t.created_date <= ? OR t.due_date <= ?)`,
        today,
        today
      ),
      top3: c(`SELECT COUNT(*) n FROM todos t WHERE t.top3_date = ?`, today),
      upcoming: c(
        `SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status NOT IN ('someday','inbox') AND t.due_date IS NOT NULL AND t.due_date >= ?`,
        today
      ),
      overdue: c(
        `SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status NOT IN ('someday') AND t.due_date IS NOT NULL AND t.due_date < ?`,
        today
      ),
      waiting: c(`SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status = 'waiting'`),
      someday: c(`SELECT COUNT(*) n FROM todos t WHERE ${ACTIVE} AND t.status = 'someday'`),
    });
  }

  let rows;
  switch (view) {
    case "inbox":
      rows = db
        .prepare(`${base} WHERE ${ACTIVE} AND t.status = 'inbox' ORDER BY t.id DESC`)
        .all();
      break;
    case "top3":
      rows = db
        .prepare(`${base} WHERE t.top3_date = ? ORDER BY t.id ASC`)
        .all(date);
      break;
    case "upcoming":
      rows = db
        .prepare(
          `${base} WHERE ${ACTIVE} AND t.status NOT IN ('someday','inbox')
           AND t.due_date IS NOT NULL AND t.due_date >= ?
           ORDER BY t.due_date ASC LIMIT 100`
        )
        .all(today);
      break;
    case "overdue":
      rows = db
        .prepare(
          `${base} WHERE ${ACTIVE} AND t.status NOT IN ('someday')
           AND t.due_date IS NOT NULL AND t.due_date < ?
           ORDER BY t.due_date ASC`
        )
        .all(today);
      break;
    case "waiting":
      rows = db
        .prepare(`${base} WHERE ${ACTIVE} AND t.status = 'waiting' ORDER BY t.updated_at DESC`)
        .all();
      break;
    case "someday":
      rows = db
        .prepare(`${base} WHERE ${ACTIVE} AND t.status = 'someday' ORDER BY t.id DESC`)
        .all();
      break;
    case "completed":
      rows = db
        .prepare(
          `${base} WHERE t.completed_date IS NOT NULL ORDER BY t.completed_date DESC, t.id DESC LIMIT 200`
        )
        .all();
      break;
    case "day": {
      // legacy day view with rollover: open on that date + completed that date
      const open = db
        .prepare(
          `${base} WHERE t.created_date <= ?
             AND (t.completed_date IS NULL OR t.completed_date > ?)
             AND t.status NOT IN ('someday','cancelled','waiting','inbox')
           ORDER BY t.top3_date = ? DESC, t.priority IS NULL, t.priority ASC, t.created_date ASC, t.id ASC`
        )
        .all(date, date, date);
      const done = db
        .prepare(`${base} WHERE t.completed_date = ? ORDER BY t.id ASC`)
        .all(date);
      return NextResponse.json({ open, done });
    }
    case "today":
    default:
      rows = db
        .prepare(
          `${base} WHERE ${ACTIVE}
             AND t.status NOT IN ('someday','waiting','inbox')
             AND (t.created_date <= ? OR t.due_date <= ?)
           ORDER BY t.top3_date = ? DESC, t.priority IS NULL, t.priority ASC, t.id ASC`
        )
        .all(today, today, today);
  }
  // optional area filter, applied to any view
  const area = req.nextUrl.searchParams.get("area");
  if (area) {
    rows = (rows as { area_id: number | null }[]).filter(
      (r) => r.area_id === Number(area)
    );
  }
  return NextResponse.json({ tasks: rows });
}

// POST /api/tasks — quick capture + full create
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const info = getDb()
    .prepare(
      `INSERT INTO todos (text, notes, created_date, status, priority, due_date,
        area_id, project_id, waiting_on, estimate_mins, recurrence, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      b.text.trim(),
      b.notes || null,
      b.date ?? todayStr(),
      b.status ?? "next",
      b.priority ?? null,
      b.due_date || null,
      b.area_id ?? null,
      b.project_id ?? null,
      b.waiting_on || null,
      b.estimate_mins ?? null,
      b.recurrence || null
    );
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}
