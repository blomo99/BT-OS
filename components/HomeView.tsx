"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TodoList from "@/components/TodoList";
import CalendarView from "@/components/CalendarView";
import {
  Card,
  CardHeader,
  IconButton,
  EmptyState,
  Skeleton,
  fmtRelativeDay,
  fmtTime,
  toDateStr,
  addDaysStr,
  fromDateStr,
} from "@/components/ui";

type Deadline = { title: string; due_date: string; type: string; href: string };
type Alert = { id: string; severity: string; text: string; href: string; action: string };

type FormatCount = { done: number; goal: number };
type HomeData = {
  doneToday: number;
  deadlines: Deadline[];
  alerts: Alert[];
  week: {
    tasksDone: number;
    contentDone: number;
    contentGoal: number;
    short: FormatCount;
    long: FormatCount;
  };
};

const SEVERITY_DOT: Record<string, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-ink-3",
};

export default function HomeView() {
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(() => {
    fetch("/api/home").then((r) => r.json()).then(setData);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("btos:data-changed", load);
    return () => window.removeEventListener("btos:data-changed", load);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const businessAlerts = (data?.alerts ?? []).filter((a) => !a.id.startsWith("tasks-"));
  const personalAlerts = (data?.alerts ?? []).filter((a) => a.id.startsWith("tasks-"));

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}, Ben</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {data && (
            <span className="text-ink-3">
              {" "}· {data.doneToday} done today · {data.week.tasksDone} this week
              {" "}· {data.week.short.done}/{data.week.short.goal} shorts
              {" "}· {data.week.long.done}/{data.week.long.goal} long
            </span>
          )}
        </p>
      </header>

      {/* upper band: tasks + today's schedule + awareness, packed tight */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* to-do owns the left column, stretched to the row height */}
        <div className="lg:col-span-4">
          <TodoList />
        </div>

        {/* schedule sits beside the to-do, day-navigable */}
        <div className="lg:col-span-4">
          <DaySchedule />
        </div>

        {/* right rail: business attention + coming up + week stats */}
        <div className="flex flex-col gap-4 lg:col-span-4">
        <Card>
          <CardHeader
            title="Business"
            hint={businessAlerts.length ? `${businessAlerts.length} to review` : undefined}
            right={
              <Link href="/business" className="text-xs text-ink-2 hover:text-ink transition-colors">
                Open →
              </Link>
            }
          />
          {!data ? (
            <Skeleton rows={3} />
          ) : businessAlerts.length === 0 ? (
            <EmptyState title="All clear" body="Nothing on the business side needs you right now." />
          ) : (
            <ul className="space-y-0.5 px-5 pb-4">
              {businessAlerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-card-2 transition-colors">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} />
                    <span className="flex-1 text-[13px] leading-snug">{a.text}</span>
                    <span className="shrink-0 text-[11px] text-ink-3 group-hover:text-accent-2 transition-colors">
                      {a.action} →
                    </span>
                  </Link>
                </li>
              ))}
              {businessAlerts.length > 8 && (
                <li className="px-2 pt-1">
                  <Link href="/business" className="text-xs text-ink-2 hover:text-ink">
                    +{businessAlerts.length - 8} more →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Coming up"
            hint="14 days"
          />
          {!data ? (
            <Skeleton rows={3} />
          ) : data.deadlines.length === 0 ? (
            <p className="px-5 pb-4 text-xs text-ink-2">No deadlines in the next two weeks.</p>
          ) : (
            <ul className="space-y-1.5 px-5 pb-4">
              {data.deadlines.map((d, i) => (
                <li key={i}>
                  <Link href={d.href} className="flex items-center gap-2.5 text-sm hover:text-accent-2 transition-colors">
                    <span className="rounded bg-card-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-2">{d.type}</span>
                    <span className="flex-1 truncate">{d.title}</span>
                    <span className="text-[11px] tabular-nums text-ink-3">{fmtRelativeDay(d.due_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="This week"
            right={
              <Link href="/review" className="text-xs text-ink-2 hover:text-ink transition-colors">
                Review →
              </Link>
            }
          />
          {!data ? (
            <Skeleton rows={2} />
          ) : (
            <div className="px-5 pb-4">
              <div className="flex gap-5">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{data.week.tasksDone}</p>
                  <p className="text-[11px] text-ink-2">tasks done</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.week.short.done}
                    <span className="text-base text-ink-3">/{data.week.short.goal}</span>
                  </p>
                  <p className="text-[11px] text-ink-2">short-form</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.week.long.done}
                    <span className="text-base text-ink-3">/{data.week.long.goal}</span>
                  </p>
                  <p className="text-[11px] text-ink-2">long-form</p>
                </div>
              </div>
              {/* upload-goal progress, matching the content board bar */}
              {data.week.contentGoal > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-card-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        data.week.contentDone >= data.week.contentGoal ? "bg-good" : "bg-accent"
                      }`}
                      style={{ width: `${Math.min(100, (data.week.contentDone / data.week.contentGoal) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-ink-2">
                    {data.week.contentDone >= data.week.contentGoal
                      ? "goal hit"
                      : `${data.week.contentGoal - data.week.contentDone} to go`}
                  </span>
                </div>
              )}
              {personalAlerts.length > 0 && (
                <ul className="mt-3 space-y-0.5 border-t border-line pt-2">
                  {personalAlerts.map((a) => (
                    <li key={a.id}>
                      <Link href={a.href} className="group flex items-center gap-2.5 text-[13px] text-ink-2 hover:text-ink transition-colors">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} />
                        <span className="flex-1">{a.text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
        </div>
      </div>

      {/* calendar spans the full width along the bottom — desktop only;
          Schedule (top band) already covers the day-to-day view on phones */}
      <div className="mt-4 hidden md:block">
        <CalendarView />
      </div>
    </div>
  );
}

type SchedEvent = { id: number; title: string; start: string; all_day: number; local: number; span: string | null };

/** Day-by-day schedule with prev/next arrows, matched in height to the to-do. */
function DaySchedule() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [events, setEvents] = useState<SchedEvent[] | null>(null);
  const today = toDateStr(new Date());

  const load = useCallback((d: string) => {
    const from = new Date(`${d}T00:00`).toISOString();
    const to = new Date(`${addDaysStr(d, 1)}T00:00`).toISOString();
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => setEvents(j.events));
  }, []);

  useEffect(() => {
    load(date);
    const reload = () => load(date);
    window.addEventListener("btos:data-changed", reload);
    return () => window.removeEventListener("btos:data-changed", reload);
  }, [date, load]);

  const label =
    date === today
      ? "Today"
      : date === addDaysStr(today, 1)
        ? "Tomorrow"
        : date === addDaysStr(today, -1)
          ? "Yesterday"
          : fromDateStr(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Schedule"
        right={
          <div className="flex items-center gap-1">
            <IconButton label="Previous day" onClick={() => setDate(addDaysStr(date, -1))}>
              <ChevronIcon dir="left" />
            </IconButton>
            <button
              onClick={() => setDate(today)}
              className={`min-w-[92px] rounded-md px-2 py-0.5 text-center text-xs transition-colors ${
                date === today ? "text-ink" : "text-accent hover:bg-card-2"
              }`}
              title={date === today ? undefined : "Back to today"}
            >
              {label}
            </button>
            <IconButton label="Next day" onClick={() => setDate(addDaysStr(date, 1))}>
              <ChevronIcon dir="right" />
            </IconButton>
          </div>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-4">
        {!events ? (
          <Skeleton rows={3} />
        ) : events.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            body={date === today ? "Your day is clear — add an event with ⌘K or the + button." : "No events this day."}
          />
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={`${e.local}-${e.id}`} className="flex items-baseline gap-3">
                <span className={`w-16 shrink-0 text-xs font-medium tabular-nums ${e.all_day ? "text-ink-3" : "text-accent-2"}`}>
                  {e.all_day ? "All day" : fmtTime(e.start)}
                </span>
                <span className="truncate text-sm">{e.title}</span>
                {e.span && <span className="ml-auto shrink-0 rounded bg-card-2 px-1.5 py-0.5 text-[10px] text-ink-3">{e.span}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
