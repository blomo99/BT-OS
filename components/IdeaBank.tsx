"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  EmptyState,
  Field,
  Modal,
  PrimaryButton,
  Skeleton,
  TextButton,
  inputCls,
} from "@/components/ui";
import RichTextEditor from "@/components/RichTextEditor";
import { htmlToPreviewText } from "@/lib/richText";

type Idea = {
  id: number;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** SQLite datetime('now') is UTC, space-separated — parse it as such. */
function fmtWhen(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IdeaBank() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [editing, setEditing] = useState<Idea | "new" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ideas");
    const j = await res.json();
    setIdeas(j.ideas);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-up mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Idea Bank</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Random thoughts, worth keeping — nothing here expires or moves on its own.
          </p>
        </div>
        <PrimaryButton onClick={() => setEditing("new")} className="self-start sm:self-auto">
          + New idea
        </PrimaryButton>
      </header>

      {ideas === null ? (
        <Card>
          <Skeleton rows={4} />
        </Card>
      ) : ideas.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing captured yet"
            body="Drop in a random thought — it stays here until you delete it."
            action={<PrimaryButton onClick={() => setEditing("new")}>+ New idea</PrimaryButton>}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <button
                onClick={() => setEditing(idea)}
                className="surface surface-hover flex h-full w-full flex-col gap-1.5 p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 text-[14px] font-medium leading-snug">{idea.title}</h3>
                  <span className="shrink-0 text-[10.5px] text-ink-3">{fmtWhen(idea.created_at)}</span>
                </div>
                {idea.notes && htmlToPreviewText(idea.notes) && (
                  <p className="line-clamp-4 text-[12.5px] leading-relaxed text-ink-2">
                    {htmlToPreviewText(idea.notes)}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <IdeaEditor
        idea={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
}

function IdeaEditor({
  idea,
  onClose,
  onSaved,
}: {
  idea: Idea | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = idea === "new";
  // notes lives in a ref, not state: RichTextEditor only reads its `content`
  // prop once (at mount) to seed the doc, so the initial value must be
  // correct on the very first render. Routing it through a reset-effect +
  // state (the way `title` does it) has a one-tick gap where the fresh
  // editor mounts and reads the *previous* idea's notes before the effect
  // clears it — the editor bakes that stale value in and never sees the
  // correction. Effects are still fine for the ref since nothing reads it
  // until the user clicks Save, long after the effect has run.
  const notesRef = useRef("");

  useEffect(() => {
    if (idea === "new") {
      setTitle("");
      notesRef.current = "";
    } else if (idea) {
      setTitle(idea.title);
      notesRef.current = idea.notes ?? "";
    }
  }, [idea]);

  if (!idea) return null;

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const notes = notesRef.current;
    await fetch("/api/ideas", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isNew ? { title, notes } : { id: (idea as Idea).id, title, notes }
      ),
    });
    setSaving(false);
    onSaved();
  };

  const remove = async () => {
    if (!isNew && confirm("Delete this idea? This can't be undone.")) {
      await fetch(`/api/ideas?id=${(idea as Idea).id}`, { method: "DELETE" });
      onSaved();
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? "New idea" : "Edit idea"} wide>
      <div className="space-y-3">
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A random thought worth keeping…"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && save()}
          />
        </Field>
        <Field label="Notes">
          <RichTextEditor
            key={isNew ? "new" : (idea as Idea).id}
            content={isNew ? "" : (idea as Idea).notes ?? ""}
            onChange={(html) => {
              notesRef.current = html;
            }}
            placeholder="Anything else — details, context, links… (# for a heading, **bold**, *italic*, ⌘U to underline)"
            minHeight="35vh"
          />
        </Field>
        <div className="flex items-center justify-between border-t border-line pt-3">
          {!isNew ? (
            <TextButton onClick={remove} className="!text-danger/80 hover:!text-danger">
              Delete
            </TextButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <TextButton onClick={onClose}>Cancel</TextButton>
            <PrimaryButton onClick={save} type="submit">
              {saving ? "Saving…" : isNew ? "Add idea" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
