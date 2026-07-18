import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDb, UPLOADS_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getDb()
    .prepare(
      "SELECT id, original_name, size, uploaded_at FROM deal_files WHERE deal_id = ? ORDER BY id DESC"
    )
    .all(id);
  return NextResponse.json({ files });
}

// POST multipart form-data with one or more "file" entries
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await req.formData();
  const entries = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!entries.length) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }
  const db = getDb();
  for (const file of entries) {
    const ext = path.extname(file.name).slice(0, 10);
    const stored = `${crypto.randomUUID()}${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
    db.prepare(
      "INSERT INTO deal_files (deal_id, original_name, stored_name, size) VALUES (?, ?, ?, ?)"
    ).run(id, file.name, stored, buf.length);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
