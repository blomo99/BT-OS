"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  PrimaryButton,
  Skeleton,
  inputCls,
  fmtMoney,
  fmtDay,
} from "@/components/ui";

type Row = { id: number; text?: string; name?: string; brand?: string; due_date?: string; waiting_on?: string; price?: number; payment_due?: string };

type ReviewData = {
  weekStart: string;
  weekEnd: string;
  completed: Row[];
  overdue: Row[];
  content: { done: number; goal: number };
  deals: { activeValue: number; activeCount: number; dueThisWeek: Row[]; unpaidInvoices: Row[] };
  saved: { reflections: string | null; priorities: string; completed_at: string } | null;
  summaryLines: string[];
};

function Section({
  title,
  items,
  render,
  emptyText,
  href,
}: {
  title: string;
  items: Row[];
  render: (r: Row) => React.ReactNode;
  emptyText: string;
  href?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
          {title} · {items.length}
        </p>
        {href && items.length > 0 && (
          <Link href={href} className="text-[11px] text-ink-3 hover:text-ink transition-colors">
            Open →
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-ink-3">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 6).map((r) => (
            <li key={r.id} className="truncate text-[13px] text-ink-2">{render(r)}</li>
          ))}
          {items.length > 6 && <li className="text-[11px] text-ink-3">+{items.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

export default function ReviewView() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [reflections, setReflections] = useState("");
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    fetch("/api/review").then((r) => r.json()).then((d: ReviewData) => {
      setData(d);
      if (d.saved) {
        setReflections(d.saved.reflections ?? "");
        try {
          const p = JSON.parse(d.saved.priorities ?? "[]");
          setPriorities([p[0] ?? "", p[1] ?? "", p[2] ?? ""]);
        } catch { /* keep blanks */ }
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!data) return;
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week_start: data.weekStart,
        reflections,
        priorities: priorities.filter((p) => p.trim()),
        summary: { lines: data.summaryLines },
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  if (!data)
    return (
      <div className="mx-auto max-w-4xl">
        <Card><Skeleton rows={6} /></Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Weekly review</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {fmtDay(data.weekStart)} – {fmtDay(data.weekEnd)}
          {data.saved?.completed_at && (
            <span className="text-good"> · reviewed</span>
          )}
        </p>
      </header>

      {/* generated summary */}
      <Card className="mb-4">
        <CardHeader title="This week in numbers" />
        <ul className="space-y-1 px-5 pb-4">
          {data.summaryLines.map((l, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <span className="h-1 w-1 rounded-full bg-accent" />
              {l}
            </li>
          ))}
        </ul>
      </Card>

      {/* inspect */}
      <Card className="mb-4">
        <CardHeader title="Inspect" hint="what needs a decision" />
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 sm:grid-cols-2">
          <Section
            title="Completed"
            items={data.completed}
            render={(r) => <>✓ {r.text}</>}
            emptyText="Nothing completed this week."
            href="/personal"
          />
          <Section
            title="Overdue"
            items={data.overdue}
            render={(r) => <>{r.text} <span className="text-danger">· {r.due_date && fmtDay(r.due_date)}</span></>}
            emptyText="Nothing overdue."
            href="/personal"
          />
          <Section
            title="Deal deadlines this week"
            items={data.deals.dueThisWeek}
            render={(r) => <>{r.brand} <span className="text-ink-3">· {r.due_date && fmtDay(r.due_date)}</span></>}
            emptyText="No deliverables due."
            href="/business?tab=deals"
          />
          <Section
            title="Outstanding invoices"
            items={data.deals.unpaidInvoices}
            render={(r) => <>{r.brand} <span className="text-ink-3">· {fmtMoney(r.price ?? null)}</span></>}
            emptyText="No invoices outstanding."
            href="/business?tab=deals"
          />
        </div>
      </Card>

      {/* reset */}
      <Card>
        <CardHeader title="Reset" hint="close the loop" />
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Reflections & lessons
            </p>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={reflections}
              onChange={(e) => setReflections(e.target.value)}
              placeholder="What worked? What didn't? What will you change?"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Next week&apos;s priorities
            </p>
            <p className="mb-2 text-[11px] text-ink-3">
              Saved as high-priority tasks scheduled for Monday.
            </p>
            <div className="space-y-2">
              {priorities.map((p, i) => (
                <input
                  key={i}
                  className={inputCls}
                  value={p}
                  onChange={(e) =>
                    setPriorities(priorities.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder={`Priority ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-xs text-good">Review saved</span>}
            <PrimaryButton onClick={save}>Complete review</PrimaryButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
