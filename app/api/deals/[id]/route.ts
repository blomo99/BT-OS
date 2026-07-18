import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb, UPLOADS_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

const FIELDS = [
  "brand", "price", "due_date", "status", "poc_name", "poc_email", "notes",
  "campaign", "deliverables", "agency_fee", "contract_status", "publish_date",
  "invoice_status", "invoice_date", "payment_due", "payment_received", "next_action",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const b = await req.json();
  const db = getDb();

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
    db.prepare(`UPDATE deals SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const files = db
    .prepare("SELECT stored_name FROM deal_files WHERE deal_id = ?")
    .all(id) as { stored_name: string }[];
  for (const f of files) {
    fs.rmSync(path.join(UPLOADS_DIR, f.stored_name), { force: true });
  }
  db.prepare("DELETE FROM deal_files WHERE deal_id = ?").run(id);
  db.prepare("DELETE FROM deals WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
