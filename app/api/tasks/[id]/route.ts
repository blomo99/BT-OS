import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { todayStr, addDaysStr } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIELDS = [
  "text",
  "notes",
  "status",
  "priority",
  "due_date",
  "area_id",
  "project_id",
  "waiting_on",
  "estimate_mins",
  "recurrence",
  "created_date",
] as const;

function nextRecurrence(due: string, rec: string): string {
  if (rec === "daily") return addDaysStr(due, 1);
  if (rec === "weekly") return addDaysStr(due, 7);
  // monthly
  const [y, m, d] = due.split("-").map(Number);
  const next = new Date(y, m, d); // month + 1 (0-based month arithmetic)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

// PATCH /api/tasks/:id — field updates, completion, Top 3 flag
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const b = await req.json();
  const db = getDb();

  if (typeof b.completed === "boolean") {
    const completedDate = b.completed ? (b.date ?? todayStr()) : null;
    db.prepare(
      `UPDATE todos SET completed_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(completedDate, b.completed ? "done" : "next", id);

    // recurring tasks spawn their next occurrence on completion
    if (b.completed) {
      const t = db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as {
        text: string;
        notes: string | null;
        recurrence: string | null;
        due_date: string | null;
        priority: number | null;
        area_id: number | null;
        project_id: number | null;
        estimate_mins: number | null;
      };
      if (t?.recurrence) {
        const baseDue = t.due_date ?? todayStr();
        const nextDue = nextRecurrence(baseDue, t.recurrence);
        db.prepare(
          `INSERT INTO todos (text, notes, created_date, status, priority, due_date,
             area_id, project_id, estimate_mins, recurrence, updated_at)
           VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          t.text,
          t.notes,
          nextDue,
          t.priority,
          nextDue,
          t.area_id,
          t.project_id,
          t.estimate_mins,
          t.recurrence
        );
      }
    }
  }

  if (typeof b.top3 === "boolean") {
    const date = b.date ?? todayStr();
    if (b.top3) {
      const count = db
        .prepare("SELECT COUNT(*) n FROM todos WHERE top3_date = ? AND id != ?")
        .get(date, id) as { n: number };
      if (count.n >= 3) {
        return NextResponse.json(
          { error: "Top 3 is full — unstar one first" },
          { status: 409 }
        );
      }
    }
    db.prepare(
      "UPDATE todos SET top3_date = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(b.top3 ? date : null, id);
  }

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
    db.prepare(`UPDATE todos SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
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
