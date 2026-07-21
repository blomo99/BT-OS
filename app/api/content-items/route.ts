import { NextRequest, NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";
import { refreshYouTube } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/content-items?refresh=1 — full board; YouTube uploads sync in.
// Done items auto-archive after N days (settings: content_archive_days).
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const { error } = await refreshYouTube(force);
  const db = getDb();

  const archiveDays = Math.max(1, Number(getSetting("content_archive_days") ?? 14));
  db.prepare(
    `UPDATE content_items SET status = 'archived', updated_at = datetime('now')
     WHERE status = 'done'
       AND COALESCE(published_date, substr(updated_at, 1, 10)) <= date('now', ?)`
  ).run(`-${archiveDays} days`);

  const items = db
    .prepare(
      `SELECT c.*, d.brand AS sponsor_brand FROM content_items c
       LEFT JOIN deals d ON d.id = c.deal_id
       ORDER BY CASE c.status
         WHEN 'ready' THEN 0 WHEN 'scripting' THEN 1 WHEN 'idea' THEN 2
         WHEN 'done' THEN 3 ELSE 4 END,
       c.target_date IS NULL, c.target_date ASC, c.id DESC`
    )
    .all();
  return NextResponse.json({ items, archiveDays, error: error ?? null });
}

const FIELDS = [
  "title", "platform", "format", "pillar", "status", "hook", "target_date",
  "published_date", "deal_id", "cta", "links", "notes", "metrics", "script", "tags",
];

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const info = getDb()
    .prepare(
      `INSERT INTO content_items (title, platform, format, pillar, status, hook,
         target_date, deal_id, cta, links, notes, script, tags, metrics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.title.trim(),
      b.platform || null,
      b.format || "short",
      b.pillar || null,
      b.status || "idea",
      b.hook || null,
      b.target_date || null,
      b.deal_id ?? null,
      b.cta || null,
      b.links || null,
      b.notes || null,
      b.script || null,
      b.tags || null,
      b.metrics || null
    );
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of FIELDS) {
    if (f in b) {
      sets.push(`${f} = ?`);
      vals.push(b[f] === "" ? null : b[f]);
    }
  }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    getDb()
      .prepare(`UPDATE content_items SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals, b.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  // youtube items are excluded — the RSS import would just re-create them
  getDb()
    .prepare("DELETE FROM content_items WHERE id = ? AND source != 'youtube'")
    .run(id);
  return NextResponse.json({ ok: true });
}
