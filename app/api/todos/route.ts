import { NextRequest, NextResponse } from "next/server";
import { getDb, todayStr } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/todos?date=YYYY-MM-DD
// open  = items that were (or still are) unfinished on that date
// done  = items completed on that date
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  const db = getDb();

  const open = db
    .prepare(
      `SELECT * FROM todos
       WHERE created_date <= ?
         AND (completed_date IS NULL OR completed_date > ?)
       ORDER BY created_date ASC, id ASC`
    )
    .all(date, date);

  const done = db
    .prepare(`SELECT * FROM todos WHERE completed_date = ? ORDER BY id ASC`)
    .all(date);

  return NextResponse.json({ date, open, done });
}

// POST /api/todos  { text, date }
export async function POST(req: NextRequest) {
  const { text, date } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const created = date ?? todayStr();
  const info = getDb()
    .prepare("INSERT INTO todos (text, created_date) VALUES (?, ?)")
    .run(text.trim(), created);
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}
