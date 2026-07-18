"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardHeader,
  Checkbox,
  IconButton,
  inputCls,
  toDateStr,
  fromDateStr,
  addDaysStr,
  fmtRelativeDay,
} from "@/components/ui";

type Todo = {
  id: number;
  text: string;
  created_date: string;
  completed_date: string | null;
  due_date: string | null;
  priority: number | null;
  top3_date: string | null;
  project_name: string | null;
};

export default function TodoList() {
  const today = toDateStr(new Date());
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState<Todo[]>([]);
  const [done, setDone] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/tasks?view=day&date=${d}`);
    const json = await res.json();
    setOpen(json.open);
    setDone(json.done);
  }, []);

  useEffect(() => {
    load(date);
    const reload = () => load(date);
    window.addEventListener("btos:data-changed", reload);
    return () => window.removeEventListener("btos:data-changed", reload);
  }, [date, load]);

  const add = async () => {
    if (!text.trim()) return;
    setText("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, date, status: "next" }),
    });
    load(date);
    inputRef.current?.focus();
  };

  const toggle = async (todo: Todo, completed: boolean) => {
    if (completed) {
      setOpen((o) => o.filter((t) => t.id !== todo.id));
      setDone((d) => [...d, { ...todo, completed_date: date }]);
    } else {
      setDone((d) => d.filter((t) => t.id !== todo.id));
      setOpen((o) => [...o, { ...todo, completed_date: null }]);
    }
    await fetch(`/api/tasks/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed, date }),
    });
    load(date);
  };

  const star = async (todo: Todo) => {
    await fetch(`/api/tasks/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ top3: todo.top3_date !== today, date: today }),
    });
    load(date);
  };

  const remove = async (id: number) => {
    setOpen((o) => o.filter((t) => t.id !== id));
    setDone((d) => d.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  };

  const isToday = date === today;
  const isPast = date < today;
  const d = fromDateStr(date);
  const label = isToday
    ? "Today"
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="To-do"
        hint={isPast ? "history" : undefined}
        right={
          <div className="flex items-center gap-1">
            <IconButton label="Previous day" onClick={() => setDate(addDaysStr(date, -1))}>
              <Chevron dir="left" />
            </IconButton>
            <button
              onClick={() => setDate(today)}
              className={`min-w-[92px] rounded-md px-2 py-0.5 text-center text-xs transition-colors ${
                isToday ? "text-ink" : "text-accent hover:bg-card-2"
              }`}
              title={isToday ? undefined : "Back to today"}
            >
              {label}
            </button>
            <IconButton
              label="Next day"
              onClick={() => !isToday && setDate(addDaysStr(date, 1))}
              className={isToday ? "opacity-30 pointer-events-none" : ""}
            >
              <Chevron dir="right" />
            </IconButton>
          </div>
        }
      />

      <div className="flex flex-1 flex-col px-5 pb-4">
        {!isPast && (
          <form
            className="mb-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a task…"
              className={inputCls}
            />
          </form>
        )}

        <ul className="space-y-0.5">
          {open.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              checked={false}
              today={today}
              rolledOver={t.created_date < date}
              onToggle={() => toggle(t, true)}
              onStar={() => star(t)}
              onDelete={() => remove(t.id)}
            />
          ))}
          {open.length === 0 && done.length === 0 && (
            <li className="py-6 text-center text-xs text-ink-2">
              {isPast ? "Nothing recorded this day" : "All clear — capture something or plan from your inbox"}
            </li>
          )}
        </ul>

        {done.length > 0 && (
          <>
            <div className="mt-4 mb-1.5 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-ink-3">
                Done · {done.length}
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
            <ul className="space-y-0.5">
              {done.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  checked
                  today={today}
                  onToggle={() => toggle(t, false)}
                  onDelete={() => remove(t.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

function TodoRow({
  todo,
  checked,
  today,
  rolledOver,
  onToggle,
  onStar,
  onDelete,
}: {
  todo: Todo;
  checked: boolean;
  today: string;
  rolledOver?: boolean;
  onToggle: () => void;
  onStar?: () => void;
  onDelete: () => void;
}) {
  const starred = todo.top3_date === today;
  return (
    <li className="group flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-card-2 transition-colors">
      <Checkbox checked={checked} onToggle={onToggle} />
      <span className={`flex-1 text-sm leading-snug ${checked ? "text-ink-3 line-through" : "text-ink"}`}>
        {todo.text}
        {rolledOver && !checked && (
          <span className="ml-2 align-middle text-[10px] uppercase tracking-wide text-warn/90">carried</span>
        )}
      </span>
      {todo.priority === 1 && !checked && (
        <span className="text-[10px] font-semibold uppercase text-danger">High</span>
      )}
      {todo.due_date && !checked && (
        <span className={`text-[11px] tabular-nums ${todo.due_date < today ? "text-danger" : "text-ink-3"}`}>
          {fmtRelativeDay(todo.due_date)}
        </span>
      )}
      {onStar && !checked && (
        <button
          onClick={onStar}
          aria-label={starred ? "Remove from Top 3" : "Add to Top 3"}
          title={starred ? "Remove from Top 3" : "Make this a Top 3 for today"}
          className={`transition-all ${starred ? "text-accent" : "text-ink-3 opacity-0 group-hover:opacity-100 hover:text-accent"}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
            <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
