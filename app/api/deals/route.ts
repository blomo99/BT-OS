import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const deals = db
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM deal_files f WHERE f.deal_id = d.id) AS file_count
       FROM deals d
       ORDER BY CASE WHEN d.due_date IS NULL THEN 1 ELSE 0 END, d.due_date ASC, d.id DESC`
    )
    .all();
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.brand?.trim()) {
    return NextResponse.json({ error: "brand required" }, { status: 400 });
  }
  const info = getDb()
    .prepare(
      `INSERT INTO deals (brand, price, due_date, status, poc_name, poc_email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.brand.trim(),
      b.price ?? null,
      b.due_date || null,
      b.status || "lead",
      b.poc_name || null,
      b.poc_email || null,
      b.notes || null
    );
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}
