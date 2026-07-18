"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Field,
  inputCls,
  TextButton,
  PrimaryButton,
  toDateStr,
  TIME_OPTIONS,
} from "@/components/ui";

type CaptureType = "task" | "event" | "content" | "deal";

const TYPES: { key: CaptureType; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "event", label: "Event" },
  { key: "content", label: "Content idea" },
  { key: "deal", label: "Deal lead" },
];

export default function CaptureModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("");
  const [format, setFormat] = useState("short");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const reset = () => {
    setTitle("");
    setNotes("");
    setDueDate("");
    setTime("");
    setPriority("");
  };

  const save = async (keepOpen = false) => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      if (type === "task") {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: title,
            notes: notes || null,
            status: "next",
            date: toDateStr(new Date()),
            due_date: dueDate || null,
            priority: priority ? Number(priority) : null,
          }),
        });
      } else if (type === "event") {
        res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            date: dueDate || toDateStr(new Date()),
            time: time || null,
            notes: notes || null,
          }),
        });
      } else if (type === "content") {
        res = await fetch("/api/content-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            format,
            status: "idea",
            target_date: dueDate || null,
            notes: notes || null,
          }),
        });
      } else {
        res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: title,
            status: "lead",
            due_date: dueDate || null,
            notes: notes || null,
          }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      onSaved();
      reset();
      if (!keepOpen) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick capture" wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Capture type">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              onClick={() => setType(t.key)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                type === t.key
                  ? "bg-accent-soft text-accent-2"
                  : "text-ink-2 hover:bg-card-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className={`${inputCls} !py-2 !text-[15px]`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "task"
              ? "Call the property manager Friday…"
              : type === "content"
                ? "Video idea: certifications employers respect"
                : type === "deal"
                  ? "Brand name"
                  : "Mylo vet appointment"
          }
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {type === "task" && (
            <Field label="Priority">
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">None</option>
                <option value="1">High</option>
                <option value="2">Medium</option>
                <option value="3">Low</option>
              </select>
            </Field>
          )}
          {type === "content" && (
            <Field label="Format">
              <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="short">Short</option>
                <option value="long">Long-form</option>
                <option value="carousel">Carousel</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </Field>
          )}
          <Field label={type === "event" ? "Date" : type === "content" ? "Target date" : "Due date"}>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {type === "event" && (
            <Field label="Time">
              <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">All day</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <textarea
          className={`${inputCls} min-h-[56px] resize-y`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-ink-3">↵ to save · esc to close</span>
          <div className="flex gap-2">
            <TextButton onClick={() => save(true)}>Save & add another</TextButton>
            <PrimaryButton type="submit">{saving ? "Saving…" : "Save"}</PrimaryButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
