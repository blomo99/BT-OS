"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  IconButton,
  Modal,
  Field,
  inputCls,
  TextButton,
  PrimaryButton,
  fmtCompact,
} from "@/components/ui";

type Snapshot = {
  followers: number | null;
  views: number | null;
  likes: number | null;
  recorded_at: string;
};
type Delta = { followers: number | null; views: number | null; likes: number | null };
type PlatformStats = { latest: Snapshot | null; history: Snapshot[]; delta: Delta };

const PLATFORMS = [
  {
    key: "youtube",
    label: "YouTube",
    primary: "subscribers",
    na: { likes: "YouTube doesn't publish channel-wide likes" },
  },
  {
    key: "instagram",
    label: "Instagram",
    primary: "followers",
    na: {
      views: "Instagram doesn't publish total views",
      likes: "Instagram doesn't publish total likes",
    },
  },
  {
    key: "tiktok",
    label: "TikTok",
    primary: "followers",
    na: { views: "TikTok doesn't publish total views" },
  },
] as const;

const RANGES = [
  { key: "week", label: "1W" },
  { key: "month", label: "1M" },
  { key: "6month", label: "6M" },
  { key: "year", label: "1Y" },
] as const;

export default function Metrics() {
  const [stats, setStats] = useState<Record<string, PlatformStats>>({});
  const [live, setLive] = useState<Record<string, string>>({});
  const [range, setRange] = useState<string>("month");
  const [logFor, setLogFor] = useState<string | null>(null);
  const [followers, setFollowers] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (r: string, refresh = false) => {
      const res = await fetch(`/api/social?range=${r}${refresh ? "&refresh=1" : ""}`);
      const json = await res.json();
      setStats(json.stats);
      setLive(json.live ?? {});
      setError(json.error);
    },
    []
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  const saveSnapshot = async () => {
    if (!logFor || (!followers && !views && !likes)) return;
    const num = (s: string) => (s ? Number(s.replace(/[^\d]/g, "")) : null);
    await fetch("/api/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: logFor,
        followers: num(followers),
        views: num(views),
        likes: num(likes),
      }),
    });
    setLogFor(null);
    setFollowers("");
    setViews("");
    setLikes("");
    load(range);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xs font-semibold tracking-[0.08em] uppercase text-ink-2">
            Live metrics
          </h2>
          <span className="text-xs text-ink-3">@CyberWithBen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-line p-0.5" role="tablist" aria-label="Metric range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                onClick={() => setRange(r.key)}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                  range === r.key ? "bg-card-2 text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <IconButton label="Refresh" onClick={() => load(range, true)}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-md border border-line bg-card-2 px-3 py-1.5 text-[11px] text-ink-3">
          YouTube sync: {error} — check the handle in Settings.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => {
          const s = stats[p.key];
          const latest = s?.latest;
          const delta = s?.delta;
          const history = s?.history ?? [];
          const liveState = live[p.key];
          const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";
          return (
            <Card key={p.key} className="surface-hover">
              <div className="flex items-start justify-between px-4 pt-3.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                  {p.label}
                  {liveState === "live" ? (
                    <span className="flex items-center gap-1 rounded bg-good-soft px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-good" title="Counts pulled automatically from the public profile">
                      <span className="h-1 w-1 rounded-full bg-good" /> live
                    </span>
                  ) : (
                    <span className="rounded bg-card-2 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-ink-3" title={liveState === "manual" ? "This platform blocks anonymous reads — log snapshots with +" : "Live fetch unavailable — log snapshots with +"}>
                      manual
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setLogFor(p.key)}
                  className="text-ink-3 hover:text-ink transition-colors"
                  aria-label={`Log ${p.label} snapshot`}
                  title="Log a snapshot"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-2">
                <p className="text-2xl font-semibold tabular-nums text-ink">
                  {fmtCompact(latest?.followers)}
                </p>
                <p className="flex items-center gap-2 text-[11px] text-ink-3">
                  {p.primary}
                  <DeltaBadge value={delta?.followers} />
                </p>
                {history.length > 1 && (
                  <Sparkline values={history.map((h) => h.followers ?? 0)} className="mt-1.5" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-px border-t border-line">
                <MetricCell
                  label="Views"
                  total={latest?.views}
                  gain={delta?.views}
                  rangeLabel={rangeLabel}
                  na={"views" in p.na ? p.na.views : undefined}
                />
                <MetricCell
                  label="Likes"
                  total={latest?.likes}
                  gain={delta?.likes}
                  rangeLabel={rangeLabel}
                  na={"likes" in p.na ? p.na.likes : undefined}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!logFor}
        onClose={() => setLogFor(null)}
        title={`Log ${PLATFORMS.find((p) => p.key === logFor)?.label ?? ""} snapshot`}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label={logFor === "youtube" ? "Subscribers" : "Followers"}>
              <input className={inputCls} value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="12500" inputMode="numeric" autoFocus />
            </Field>
            <Field label="Total views">
              <input className={inputCls} value={views} onChange={(e) => setViews(e.target.value)} placeholder="1200000" inputMode="numeric" />
            </Field>
            <Field label="Total likes">
              <input className={inputCls} value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="84000" inputMode="numeric" />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-3">
            Snapshots build the trend and the change shown for each range.
            YouTube subscribers &amp; views fill in automatically once an API key
            is set in Settings; likes and the other platforms are logged here.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <TextButton onClick={() => setLogFor(null)}>Cancel</TextButton>
            <PrimaryButton onClick={saveSnapshot}>Save</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Views/Likes cell. When a period gain can be computed for the selected range
 * it leads with "+gain in {range}" (what a creator actually tracks) and keeps
 * the lifetime total as a muted secondary line; otherwise it shows the total.
 */
function MetricCell({
  label,
  total,
  gain,
  rangeLabel,
  na,
}: {
  label: string;
  total: number | null | undefined;
  gain: number | null | undefined;
  rangeLabel: string;
  /** why this metric can never exist for this platform */
  na?: string;
}) {
  const unavailable = total == null && na;
  const hasGain = gain != null && gain !== 0;
  return (
    <div className="bg-card px-4 py-2.5" title={unavailable ? na : undefined}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">
        {label}
        {hasGain && <span className="ml-1 normal-case text-ink-3/80">· {rangeLabel}</span>}
      </p>
      {unavailable ? (
        <p className="text-sm font-semibold tabular-nums text-ink-3">n/a</p>
      ) : hasGain ? (
        <p className="leading-tight">
          <span className={`text-sm font-semibold tabular-nums ${gain! > 0 ? "text-good" : "text-danger"}`}>
            {gain! > 0 ? "+" : "−"}
            {fmtCompact(Math.abs(gain!))}
          </span>
          <span className="ml-1.5 text-[10px] tabular-nums text-ink-3">{fmtCompact(total)} total</span>
        </p>
      ) : (
        <p className="text-sm font-semibold tabular-nums text-ink">{fmtCompact(total)}</p>
      )}
    </div>
  );
}

function DeltaBadge({ value, small }: { value: number | null | undefined; small?: boolean }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`${small ? "text-[10px]" : "text-[11px]"} ${up ? "text-good" : "text-danger"}`}>
      {up ? "↑" : "↓"}
      {fmtCompact(Math.abs(value))}
    </span>
  );
}

/* single-series sparkline; hue validated against the dark card surface */
function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const w = 150;
  const h = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / range) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} role="img" aria-label={`Trend: ${values[0].toLocaleString()} to ${values.at(-1)?.toLocaleString()}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts.at(-1)?.split(",")[0]} cy={pts.at(-1)?.split(",")[1]} r="2.5" fill="var(--accent)" />
    </svg>
  );
}
