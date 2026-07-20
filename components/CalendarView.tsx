"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  IconButton,
  Modal,
  Field,
  inputCls,
  TextButton,
  PrimaryButton,
  toDateStr,
  addDaysStr,
  fromDateStr,
  fmtTime,
  TIME_OPTIONS,
} from "@/components/ui";

type Ev = {
  id: number;
  feed_name: string;
  title: string;
  start: string;
  end: string | null;
  all_day: number;
  local: number;
  span: string | null;
};

type Mode = "week" | "month";

const FEED_DOTS = ["bg-good", "bg-warn", "bg-danger", "bg-ink-2"];

export default function CalendarView() {
  const now = new Date();
  const [mode, setMode] = useState<Mode>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [weekAnchor, setWeekAnchor] = useState(toDateStr(now));
  const [events, setEvents] = useState<Ev[]>([]);
  const [feeds, setFeeds] = useState<{ name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // add-event modal
  const [adding, setAdding] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(toDateStr(now));
  const [evEndDate, setEvEndDate] = useState("");
  const [evTime, setEvTime] = useState("");
  const [multiDay, setMultiDay] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("btos-cal-mode");
    if (saved === "week" || saved === "month") setMode(saved);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    window.localStorage.setItem("btos-cal-mode", m);
  };

  const load = useCallback(async (refresh = false) => {
    // wide window: covers month grid, week view, and 90-day agenda
    const nowD = new Date();
    const from = new Date(
      Math.min(new Date(year, month - 1, 1).getTime(), nowD.getTime() - 7 * 86400000)
    ).toISOString();
    const to = new Date(
      Math.max(
        new Date(year, month + 2, 1).getTime(),
        nowD.getTime() + 92 * 86400000
      )
    ).toISOString();
    const res = await fetch(
      `/api/events?from=${from}&to=${to}${refresh ? "&refresh=1" : ""}`
    );
    const json = await res.json();
    setEvents(json.events);
    setFeeds(json.feeds);
    setError(json.error);
  }, [year, month]);

  useEffect(() => {
    load();
    window.addEventListener("btos:data-changed", () => load());
    return () => window.removeEventListener("btos:data-changed", () => load());
  }, [load]);

  const feedDot = useMemo(() => {
    const map = new Map<string, string>([["Personal", "bg-accent"]]);
    feeds.forEach((f, i) => map.set(f.name, FEED_DOTS[i % FEED_DOTS.length]));
    return map;
  }, [feeds]);

  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const ev of events) {
      const key = toDateStr(new Date(ev.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const addEvent = async () => {
    if (!evTitle.trim()) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: evTitle,
        date: evDate,
        end_date: multiDay && evEndDate ? evEndDate : null,
        time: multiDay ? null : evTime || null,
      }),
    });
    setAdding(false);
    setEvTitle("");
    setEvTime("");
    setEvEndDate("");
    setMultiDay(false);
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const removeEvent = async (id: number) => {
    await fetch(`/api/events?id=${id}`, { method: "DELETE" });
    load();
  };

  const openAdd = (date?: string) => {
    const d = date ?? toDateStr(new Date());
    setEvDate(d);
    setEvEndDate("");
    setEvTime("");
    setMultiDay(false);
    setAdding(true);
  };

  const todayStr = toDateStr(new Date());

  /* ——— renderers per mode ——— */

  const renderWeek = () => {
    const monday = addDaysStr(weekAnchor, -((fromDateStr(weekAnchor).getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
    return (
      <div className="px-5 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Previous week" onClick={() => setWeekAnchor(addDaysStr(monday, -7))}>
            <Chevron left />
          </IconButton>
          <span className="text-xs text-ink-2">
            {fromDateStr(monday).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
            {fromDateStr(addDaysStr(monday, 6)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <IconButton label="Next week" onClick={() => setWeekAnchor(addDaysStr(monday, 7))}>
            <Chevron />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line">
          {days.map((d) => {
            const evs = byDay.get(d) ?? [];
            const isToday = d === todayStr;
            return (
              <button
                key={d}
                onClick={() => openAdd(d)}
                title="Add event on this day"
                className="min-h-[110px] border-r border-line/50 p-1.5 text-left last:border-r-0 hover:bg-card-2/60 transition-colors"
              >
                <span className={`mb-1 inline-flex h-5 items-center gap-1 text-[10px] font-medium uppercase ${isToday ? "text-accent-2" : "text-ink-3"}`}>
                  {fromDateStr(d).toLocaleDateString("en-US", { weekday: "short" })} {Number(d.slice(8))}
                </span>
                <span className="flex flex-col gap-0.5">
                  {evs.slice(0, 4).map((e) => (
                    <span key={`${e.local}-${e.id}`} className="flex items-center gap-1 text-[10.5px] leading-tight text-ink-2">
                      <span className={`h-1 w-1 shrink-0 rounded-full ${feedDot.get(e.feed_name) ?? "bg-accent"}`} />
                      <span className="truncate">{e.all_day ? e.title : `${fmtTime(e.start)} ${e.title}`}</span>
                    </span>
                  ))}
                  {evs.length > 4 && <span className="text-[10px] text-ink-3">+{evs.length - 4}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(year, month, i + 1))),
    ];
    while (cells.length % 7) cells.push(null);
    const selectedEvents = selected ? (byDay.get(selected) ?? []) : null;

    return (
      <div className="px-5 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Previous month" onClick={() => nav(-1)}>
            <Chevron left />
          </IconButton>
          <span className="text-xs text-ink-2">
            {firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <IconButton label="Next month" onClick={() => nav(1)}>
            <Chevron />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-line bg-card-2/50 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-3">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day)
              return <div key={i} className="min-h-[72px] border-b border-r border-line/50 bg-card-2/20 [&:nth-child(7n+7)]:border-r-0" />;
            const evs = byDay.get(day) ?? [];
            const isToday = day === todayStr;
            const isSelected = day === selected;
            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : day)}
                className={`flex min-h-[72px] flex-col items-stretch gap-1 border-b border-r border-line/50 p-1.5 text-left transition-colors [&:nth-child(7n+7)]:border-r-0 ${
                  isSelected ? "bg-card-2" : "hover:bg-card-2/60"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-accent font-semibold text-black" : "text-ink-3"}`}>
                  {Number(day.slice(8))}
                </span>
                <span className="flex flex-col gap-0.5">
                  {evs.slice(0, 2).map((e) => (
                    <span key={`${e.local}-${e.id}`} className="flex items-center gap-1 text-[10.5px] leading-tight text-ink-2">
                      <span className={`h-1 w-1 shrink-0 rounded-full ${feedDot.get(e.feed_name) ?? "bg-accent"}`} />
                      <span className="truncate">{e.title}</span>
                    </span>
                  ))}
                  {evs.length > 2 && <span className="text-[10px] text-ink-3">+{evs.length - 2}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-3 rounded-lg border border-line bg-card-2/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                {fromDateStr(selected).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <TextButton onClick={() => openAdd(selected)}>+ Add event</TextButton>
            </div>
            <ul className="space-y-1.5">
              {(selectedEvents ?? []).map((e) => (
                <li key={`${e.local}-${e.id}`} className="group flex items-center gap-2.5 text-sm">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${feedDot.get(e.feed_name) ?? "bg-accent"}`} />
                  <span className="truncate">{e.title}</span>
                  {e.span && <span className="shrink-0 rounded bg-card-2 px-1.5 py-0.5 text-[10px] text-ink-3">{e.span}</span>}
                  <span className="shrink-0 text-xs text-ink-3">{e.span ? "" : e.all_day ? "all day" : fmtTime(e.start)}</span>
                  {e.local === 1 && (
                    <button
                      onClick={() => removeEvent(e.id)}
                      aria-label="Delete event"
                      className="ml-auto opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all"
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
              {(selectedEvents ?? []).length === 0 && <li className="text-xs text-ink-3">No events — add one.</li>}
            </ul>
          </div>
        )}
      </div>
    );
  };

  /** Mobile: a flat chronological list instead of a grid — a 7×6 month grid
   *  is unreadable at phone width, and this is what people actually want
   *  from a phone calendar: "what's coming up". */
  const renderAgenda = () => {
    const days = Array.from({ length: 60 }, (_, i) => addDaysStr(todayStr, i)).filter(
      (d) => (byDay.get(d) ?? []).length > 0
    );
    return (
      <div className="px-5 pb-5">
        {days.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-3">Nothing on the calendar in the next 60 days.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {days.map((d) => (
              <li key={d} className="py-2.5">
                <p className={`mb-1.5 text-[11px] font-medium uppercase tracking-wide ${d === todayStr ? "text-accent-2" : "text-ink-3"}`}>
                  {d === todayStr
                    ? "Today"
                    : d === addDaysStr(todayStr, 1)
                      ? "Tomorrow"
                      : fromDateStr(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <ul className="space-y-1.5">
                  {(byDay.get(d) ?? []).map((e) => (
                    <li key={`${e.local}-${e.id}`} className="flex items-center gap-2.5 text-[13px]">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${feedDot.get(e.feed_name) ?? "bg-accent"}`} />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      {e.span && <span className="shrink-0 rounded bg-card-2 px-1.5 py-0.5 text-[10px] text-ink-3">{e.span}</span>}
                      <span className="shrink-0 text-xs text-ink-3">{e.span ? "" : e.all_day ? "all day" : fmtTime(e.start)}</span>
                      {e.local === 1 && (
                        // always visible (not hover-gated): touch has no hover state
                        <button onClick={() => removeEvent(e.id)} aria-label="Delete event" className="shrink-0 text-ink-3 active:text-danger">
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const nav = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  };

  return (
    <Card className="min-w-0 self-start">
      <CardHeader
        title="Calendar"
        right={
          <div className="flex items-center gap-1.5">
            <div className="hidden items-center rounded-md border border-line p-0.5 md:flex" role="tablist" aria-label="Calendar view">
              {(["week", "month"] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded px-2 py-0.5 text-[11px] capitalize transition-colors ${
                    mode === m ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <TextButton onClick={() => openAdd(selected ?? undefined)} className="border border-line">
              + Event
            </TextButton>
            <IconButton label="Refresh feeds" onClick={() => load(true)}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          </div>
        }
      />

      {feeds.length === 0 && (
        <p className="mx-5 mb-3 rounded-md border border-line bg-card-2 px-3 py-2 text-xs text-ink-2">
          Tip: paste your Google / Apple iCal URLs in <span className="text-ink">Settings</span> to import events, holidays and birthdays alongside the ones you add here.
        </p>
      )}
      {error && (
        <p className="mx-5 mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          Calendar feed error: {error}
        </p>
      )}

      <div className="md:hidden">{renderAgenda()}</div>
      <div className="hidden md:block">
        {mode === "week" && renderWeek()}
        {mode === "month" && renderMonth()}
      </div>

      {feeds.length > 0 && (
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Personal
          </span>
          {feeds.map((f, i) => (
            <span key={f.name} className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span className={`h-1.5 w-1.5 rounded-full ${FEED_DOTS[i % FEED_DOTS.length]}`} /> {f.name}
            </span>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New event">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            addEvent();
          }}
        >
          <Field label="Title">
            <input className={inputCls} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="What's happening?" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={multiDay ? "Start date" : "Date"}>
              <input
                type="date"
                className={inputCls}
                value={evDate}
                onChange={(e) => {
                  setEvDate(e.target.value);
                  if (multiDay && evEndDate && evEndDate < e.target.value) setEvEndDate(e.target.value);
                }}
              />
            </Field>
            {multiDay ? (
              <Field label="End date">
                <input
                  type="date"
                  className={inputCls}
                  value={evEndDate}
                  min={evDate}
                  onChange={(e) => setEvEndDate(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Time">
                <select className={inputCls} value={evTime} onChange={(e) => setEvTime(e.target.value)}>
                  <option value="">All day</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={multiDay}
              onChange={(e) => {
                setMultiDay(e.target.checked);
                if (e.target.checked && !evEndDate) setEvEndDate(addDaysStr(evDate, 1));
              }}
            />
            Multi-day event (vacation, trip…)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <TextButton onClick={() => setAdding(false)}>Cancel</TextButton>
            <PrimaryButton type="submit">Add</PrimaryButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ transform: left ? "rotate(180deg)" : undefined }}>
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
