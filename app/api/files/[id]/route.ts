import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb, UPLOADS_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = getDb()
    .prepare("SELECT original_name, stored_name FROM deal_files WHERE id = ?")
    .get(id) as { original_name: string; stored_name: string } | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const filePath = path.join(UPLOADS_DIR, row.stored_name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
  const data = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(row.original_name)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const row = db
    .prepare("SELECT stored_name FROM deal_files WHERE id = ?")
    .get(id) as { stored_name: string } | undefined;
  if (row) {
    fs.rmSync(path.join(UPLOADS_DIR, row.stored_name), { force: true });
    db.prepare("DELETE FROM deal_files WHERE id = ?").run(id);
  }
  return NextResponse.json({ ok: true });
}
