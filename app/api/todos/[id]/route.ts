import { NextRequest, NextResponse } from "next/server";
import { getDb, todayStr } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/todos/:id  { completed: boolean, date?: YYYY-MM-DD } | { text }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (typeof body.completed === "boolean") {
    // checking off while viewing a past day records it on that day
    const completedDate = body.completed ? (body.date ?? todayStr()) : null;
    db.prepare("UPDATE todos SET completed_date = ? WHERE id = ?").run(
      completedDate,
      id
    );
  }
  if (typeof body.text === "string" && body.text.trim()) {
    db.prepare("UPDATE todos SET text = ? WHERE id = ?").run(body.text.trim(), id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  getDb().prepare("DELETE FROM todos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
