import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/ideas — the whole bank, newest first. Ideas persist until deleted.
export async function GET() {
  const ideas = getDb().prepare("SELECT * FROM ideas ORDER BY id DESC").all();
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const info = getDb()
    .prepare("INSERT INTO ideas (title, notes) VALUES (?, ?)")
    .run(b.title.trim(), b.notes?.trim() || null);
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!b.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  getDb()
    .prepare("UPDATE ideas SET title = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(b.title.trim(), b.notes?.trim() || null, b.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  getDb().prepare("DELETE FROM ideas WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
