"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  PrimaryButton,
  Skeleton,
  TextButton,
  inputCls,
  fmtRelativeDay,
  fmtDay,
  toDateStr,
  addDaysStr,
} from "@/components/ui";
import { mondayOf } from "@/lib/format";

export type ContentItem = {
  id: number;
  title: string;
  platform: string | null;
  format: string;
  pillar: string | null;
  status: string;
  hook: string | null;
  target_date: string | null;
  published_date: string | null;
  deal_id: number | null;
  sponsor_brand: string | null;
  cta: string | null;
  links: string | null;
  notes: string | null;
  metrics: string | null;
  script: string | null;
  tags: string | null;
  source: string;
};

export const STAGES = [
  { key: "idea", label: "Raw idea" },
  { key: "scripting", label: "Scripting" },
  { key: "ready", label: "Ready to film" },
  { key: "done", label: "Done" },
] as const;

const FORMATS = [
  { key: "short", label: "Short" },
  { key: "long", label: "Long-form" },
  { key: "carousel", label: "Carousel" },
  { key: "newsletter", label: "Newsletter" },
];

type Goals = Record<string, number>;
const DEFAULT_GOALS: Goals = { short: 3, long: 1, carousel: 0, newsletter: 0 };

/**
 * Unified content board: raw ideas through finished videos in one 4-stage
 * flow. Done items auto-archive after a configurable number of days.
 */
export default function ContentPipeline() {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveDays, setArchiveDays] = useState(14);
  const [formatFilter, setFormatFilter] = useState<"all" | "short" | "long">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [editGoals, setEditGoals] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const res = await fetch(`/api/content-items${refresh ? "?refresh=1" : ""}`);
    const json = await res.json();
    setItems(json.items);
    setError(json.error);
    if (json.archiveDays) setArchiveDays(json.archiveDays);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        try {
          setGoals({ ...DEFAULT_GOALS, ...JSON.parse(s.content_goals ?? "{}") });
        } catch { /* defaults */ }
      });
  }, [load]);

  const today = toDateStr(new Date());
  const weekStart = mondayOf(today);
  const weekEnd = addDaysStr(weekStart, 6);
  const daysLeft = Math.max(
    1,
    Math.round((new Date(weekEnd).getTime() - new Date(today).getTime()) / 86400000) + 1
  );

  const weekStats = useMemo(() => {
    const all = items ?? [];
    const stats: Record<string, { published: number; inFlight: number; goal: number }> = {};
    for (const [fmt, goal] of Object.entries(goals)) {
      if (goal <= 0) continue;
      const published = all.filter(
        (i) => i.format === fmt && ["done", "archived"].includes(i.status) &&
          i.published_date && i.published_date >= weekStart && i.published_date <= weekEnd
      ).length;
      const inFlight = all.filter(
        (i) => i.format === fmt && ["scripting", "ready"].includes(i.status)
      ).length;
      stats[fmt] = { published, inFlight, goal };
    }
    return stats;
  }, [items, goals, weekStart, weekEnd]);

  const visible = useMemo(() => {
    let all = items ?? [];
    if (formatFilter === "short") all = all.filter((i) => ["short", "carousel"].includes(i.format));
    if (formatFilter === "long") all = all.filter((i) => ["long", "newsletter"].includes(i.format));
    return all;
  }, [items, formatFilter]);

  const archived = visible.filter((i) => i.status === "archived");

  const patch = async (id: number, body: Record<string, unknown>) => {
    await fetch("/api/content-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const advance = (item: ContentItem) => {
    const order = ["idea", "scripting", "ready", "done"];
    const next = order[order.indexOf(item.status) + 1];
    if (!next) return;
    const body: Record<string, unknown> = { status: next };
    if (next === "done" && !item.published_date) body.published_date = today;
    patch(item.id, body);
  };

  const saveGoals = async (g: Goals, days: number) => {
    setGoals(g);
    setArchiveDays(days);
    setEditGoals(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_goals: JSON.stringify(g),
        content_archive_days: String(days),
      }),
    });
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const totalGoal = Object.values(weekStats).reduce((s, x) => s + x.goal, 0);
  const totalPublished = Object.values(weekStats).reduce((s, x) => s + Math.min(x.published, x.goal), 0);

  return (
    <div className="space-y-4">
      {/* weekly output goal */}
      <Card>
        <CardHeader
          title="Weekly output"
          hint={`${daysLeft} day${daysLeft > 1 ? "s" : ""} left this week`}
          right={<TextButton onClick={() => setEditGoals(true)}>Edit goals</TextButton>}
        />
        <div className="px-5 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-card-2">
              <div
                className={`h-full rounded-full transition-all ${totalPublished >= totalGoal ? "bg-good" : "bg-accent"}`}
                style={{ width: `${totalGoal ? (totalPublished / totalGoal) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-ink-2">{totalPublished}/{totalGoal} done</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(weekStats).map(([fmt, s]) => {
              const remaining = Math.max(0, s.goal - s.published);
              return (
                <div key={fmt} className="rounded-lg border border-line bg-card-2/40 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                    {FORMATS.find((x) => x.key === fmt)?.label ?? fmt}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {s.published}<span className="text-sm text-ink-3">/{s.goal}</span>
                  </p>
                  <p className="text-[11px] text-ink-2">
                    {remaining === 0 ? (
                      <span className="text-good">done</span>
                    ) : (
                      <>
                        {s.inFlight > 0 && <span>{s.inFlight} in the works · </span>}
                        {remaining} to go
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* board */}
      <Card>
        <CardHeader
          title={showArchived ? "Archive" : "Idea board"}
          hint={showArchived ? `auto-archived ${archiveDays} days after done` : undefined}
          right={
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-md border border-line p-0.5" role="tablist" aria-label="Format filter">
                {([["all", "All"], ["short", "Short"], ["long", "Long"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={formatFilter === k}
                    onClick={() => setFormatFilter(k)}
                    className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                      formatFilter === k ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TextButton onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? "Back to board" : `Archive${archived.length ? ` · ${archived.length}` : ""}`}
              </TextButton>
              <PrimaryButton onClick={() => setEditing("new")} className="!py-1">
                + New idea
              </PrimaryButton>
            </div>
          }
        />

        {error && (
          <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-md border border-warn/30 bg-warn-soft px-3 py-2">
            <p className="text-xs text-warn">
              YouTube sync failed: {error}. Published uploads aren&apos;t being detected automatically.
            </p>
            <div className="flex shrink-0 gap-1">
              <TextButton onClick={() => load(true)}>Retry</TextButton>
              <TextButton onClick={() => window.dispatchEvent(new Event("btos:open-settings"))}>
                Edit handle
              </TextButton>
            </div>
          </div>
        )}

        {!items ? (
          <Skeleton rows={5} />
        ) : showArchived ? (
          archived.length === 0 ? (
            <EmptyState
              title="Archive is empty"
              body={`Done videos move here automatically ${archiveDays} days after completion.`}
            />
          ) : (
            <ul className="divide-y divide-line/50 px-5 pb-3">
              {archived.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <button onClick={() => setEditing(i)} className="min-w-0 flex-1 truncate text-left text-sm text-ink-2 hover:text-ink transition-colors">
                    {i.title}
                  </button>
                  <span className="rounded bg-card-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-2">{i.format}</span>
                  {i.published_date && (
                    <span className="text-[11px] tabular-nums text-ink-3">{i.published_date}</span>
                  )}
                  <TextButton onClick={() => patch(i.id, { status: "done" })}>Restore</TextButton>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((stage) => {
              const list = visible.filter((i) => i.status === stage.key);
              return (
                <div key={stage.key} className="min-w-0 rounded-lg border border-line bg-card-2/25 p-2">
                  <p className="flex items-baseline justify-between px-1.5 pb-2 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                      {stage.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-ink-3">{list.length}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    {list.length === 0 && (
                      <p className="px-1.5 pb-2 text-[11px] text-ink-3">
                        {stage.key === "idea" ? "Bank an idea with + New idea or ⌘K." : "Nothing here."}
                      </p>
                    )}
                    {list.map((i) => (
                      <div
                        key={i.id}
                        className="group cursor-pointer rounded-lg border border-line bg-card px-3 py-2.5 hover:border-line-2 transition-colors"
                        onClick={() => setEditing(i)}
                      >
                        <p className="text-[13px] font-medium leading-snug">{i.title}</p>
                        {i.hook && <p className="mt-0.5 truncate text-[11px] text-ink-2">{i.hook}</p>}
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-card-3 px-1.5 py-0.5 text-[10px] uppercase text-ink-2">
                            {i.format}
                          </span>
                          {i.script && stage.key !== "done" && (
                            <span className="rounded bg-good-soft px-1.5 py-0.5 text-[10px] text-good">script</span>
                          )}
                          {i.sponsor_brand && (
                            <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] text-warn">{i.sponsor_brand}</span>
                          )}
                          {i.source === "youtube" && (
                            <span className="text-[10px] text-ink-3" title="Detected from YouTube automatically">auto</span>
                          )}
                          {i.target_date && stage.key !== "done" && (
                            <span className={`ml-auto text-[10px] tabular-nums ${i.target_date < today ? "text-danger" : "text-ink-3"}`}>
                              {fmtRelativeDay(i.target_date)}
                            </span>
                          )}
                          {stage.key === "done" && i.published_date && (
                            <span className="ml-auto text-[10px] tabular-nums text-ink-3">{fmtDay(i.published_date)}</span>
                          )}
                        </p>
                        {stage.key !== "done" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              advance(i);
                            }}
                            title={`Move to ${STAGES[STAGES.findIndex((s) => s.key === stage.key) + 1]?.label}`}
                            aria-label="Advance stage"
                            className="mt-1.5 hidden w-full rounded-md border border-line py-1 text-[11px] text-ink-2 hover:border-accent hover:text-accent-2 transition-colors group-hover:block"
                          >
                            {STAGES[STAGES.findIndex((s) => s.key === stage.key) + 1]?.label} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ContentEditor
        item={editing}
        onClose={() => setEditing(null)}
        onChanged={() => {
          load();
          window.dispatchEvent(new Event("btos:data-changed"));
        }}
      />

      <Modal open={editGoals} onClose={() => setEditGoals(false)} title="Weekly goals">
        <GoalsEditor
          goals={goals}
          archiveDays={archiveDays}
          onSave={saveGoals}
          onCancel={() => setEditGoals(false)}
        />
      </Modal>
    </div>
  );
}

function GoalsEditor({
  goals,
  archiveDays,
  onSave,
  onCancel,
}: {
  goals: Goals;
  archiveDays: number;
  onSave: (g: Goals, days: number) => void;
  onCancel: () => void;
}) {
  const [g, setG] = useState<Goals>(goals);
  const [days, setDays] = useState(String(archiveDays));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {FORMATS.map((f) => (
          <Field key={f.key} label={`${f.label} / week`}>
            <input
              className={inputCls}
              inputMode="numeric"
              value={g[f.key] ?? 0}
              onChange={(e) => setG({ ...g, [f.key]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            />
          </Field>
        ))}
      </div>
      <Field label="Archive done videos after (days)">
        <input
          className={inputCls}
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <TextButton onClick={onCancel}>Cancel</TextButton>
        <PrimaryButton onClick={() => onSave(g, Math.max(1, Number(days) || 14))}>Save</PrimaryButton>
      </div>
    </div>
  );
}

function ContentEditor({
  item,
  onClose,
  onChanged,
}: {
  item: ContentItem | "new" | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [deals, setDeals] = useState<{ id: number; brand: string }[]>([]);
  const [genState, setGenState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const isNew = item === "new";

  useEffect(() => {
    if (!item) return;
    fetch("/api/deals").then((r) => r.json()).then((j) => setDeals(j.deals));
    if (item === "new") {
      setF({ format: "short", status: "idea" });
    } else {
      setF({
        title: item.title,
        format: item.format,
        status: item.status,
        hook: item.hook ?? "",
        tags: item.tags ?? "",
        script: item.script ?? "",
        target_date: item.target_date ?? "",
        published_date: item.published_date ?? "",
        deal_id: item.deal_id?.toString() ?? "",
        notes: item.notes ?? "",
        metrics: item.metrics ?? "",
      });
    }
  }, [item]);

  if (!item) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const generate = async () => {
    if (!f.title?.trim()) {
      setGenState({ busy: false, error: "Give the idea a title first." });
      return;
    }
    if (f.script?.trim() && !confirm("Replace the current script with an AI draft?")) return;
    setGenState({ busy: true, error: null });
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: f.title, format: f.format ?? "short", hook: f.hook, notes: f.notes, tags: f.tags }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenState({ busy: false, error: json.error ?? "Script generation failed." });
        return;
      }
      setF((prev) => ({ ...prev, script: json.script }));
      setGenState({ busy: false, error: null });
    } catch {
      setGenState({ busy: false, error: "Script generation failed — is the server running?" });
    }
  };

  const save = async () => {
    if (!f.title?.trim()) return;
    const payload: Record<string, unknown> = {
      ...f,
      deal_id: f.deal_id ? Number(f.deal_id) : null,
    };
    if (f.status === "done" && !f.published_date) {
      payload.published_date = toDateStr(new Date());
    }
    if (!isNew) payload.id = (item as ContentItem).id;
    await fetch("/api/content-items", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    onChanged();
    onClose();
  };

  const remove = async () => {
    if (!isNew && (item as ContentItem).source === "manual" && confirm("Delete this item?")) {
      await fetch(`/api/content-items?id=${(item as ContentItem).id}`, { method: "DELETE" });
      onChanged();
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? "New idea" : "Video"} size="full">
      <div className="flex flex-col gap-3">
        <input
          className={`${inputCls} !text-lg !py-2`}
          value={f.title ?? ""}
          onChange={set("title")}
          placeholder="Certifications employers actually respect in 2026"
          autoFocus={isNew}
        />

        {/* two columns: metadata rail + full-height script editor */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Format">
                <select className={inputCls} value={f.format ?? "short"} onChange={set("format")}>
                  {FORMATS.map((x) => (
                    <option key={x.key} value={x.key}>{x.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select className={inputCls} value={f.status ?? "idea"} onChange={set("status")}>
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>
            {/* new ideas stay light — extra metadata appears once the card exists */}
            {!isNew && (
              <>
                <Field label="Hook">
                  <textarea className={`${inputCls} min-h-[56px] resize-y`} value={f.hook ?? ""} onChange={set("hook")} placeholder="First line that stops the scroll" />
                </Field>
                <Field label="Tags (comma-separated)">
                  <input className={inputCls} value={f.tags ?? ""} onChange={set("tags")} placeholder="security+, beginner, career" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target date">
                    <input type="date" className={inputCls} value={f.target_date ?? ""} onChange={set("target_date")} />
                  </Field>
                  <Field label="Sponsor">
                    <select className={inputCls} value={f.deal_id ?? ""} onChange={set("deal_id")}>
                      <option value="">None</option>
                      {deals.map((d) => (
                        <option key={d.id} value={d.id}>{d.brand}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea className={`${inputCls} min-h-[72px] resize-y`} value={f.notes ?? ""} onChange={set("notes")} placeholder="References, b-roll, links…" />
                </Field>
              </>
            )}
            {(f.status === "done" || f.status === "archived" || f.metrics) && (
              <Field label="Performance (after publish)">
                <input className={inputCls} value={f.metrics ?? ""} onChange={set("metrics")} placeholder="120K views · 8.2% CTR · 340 subs" />
              </Field>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Script</span>
              <div className="flex items-center gap-2">
                {genState.error && <span className="text-[11px] text-warn">{genState.error}</span>}
                {!isNew && (item as ContentItem).script && (
                  <button
                    onClick={() => window.open(`/script/${(item as ContentItem).id}`, "_blank")}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-card-2 px-2.5 py-1 text-[11px] text-ink-2 hover:border-line-2 hover:text-ink transition-colors"
                    title="Opens the saved script as a formatted document — save first if you just edited it"
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Export PDF
                  </button>
                )}
                <button
                  onClick={generate}
                  disabled={genState.busy}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-card-2 px-2.5 py-1 text-[11px] text-ink-2 hover:border-accent/40 hover:text-accent-2 transition-colors disabled:opacity-60"
                  title="Claude writes a ready-to-film draft from the title, hook, and notes (needs an Anthropic API key in Settings)"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1l1.8 4.6L14.5 7 9.8 8.9 8 13.5 6.2 8.9 1.5 7l4.7-1.4L8 1z" />
                  </svg>
                  {genState.busy ? "Writing…" : "Generate with AI"}
                </button>
              </div>
            </div>
            <textarea
              className={`${inputCls} min-h-[56vh] resize-y leading-relaxed`}
              value={f.script ?? ""}
              onChange={set("script")}
              placeholder={"HOOK:\n\nBODY:\n\nCTA:\n\n(or hit Generate with AI)"}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          {!isNew && (item as ContentItem).source === "manual" ? (
            <TextButton onClick={remove} className="!text-danger/80 hover:!text-danger">Delete</TextButton>
          ) : (
            <span className="text-[11px] text-ink-3">
              {!isNew && (item as ContentItem).source === "youtube" ? "Imported from YouTube" : ""}
            </span>
          )}
          <div className="flex gap-2">
            <TextButton onClick={onClose}>Cancel</TextButton>
            <PrimaryButton onClick={save}>{isNew ? "Create" : "Save"}</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
