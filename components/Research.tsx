"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  Skeleton,
  fmtCompact,
} from "@/components/ui";

type IdeaSource = "google" | "reddit" | "youtube";
type IdeaHeat = "hot" | "warm" | "cool";
type TrendingIdea = { text: string; source: IdeaSource; detail?: string; url?: string; heat?: IdeaHeat };
type NicheVideo = {
  title: string;
  channel: string;
  views: number | null;
  viewsText: string;
  lengthText: string;
  published: string;
  url: string;
};
type VideoSuggestion = {
  title: string;
  format: "short" | "long";
  hook: string;
  angle: string;
  source: string;
};
type ResearchResult = {
  query: string;
  ideas: TrendingIdea[];
  topLong: NicheVideo[];
  topShort: NicheVideo[];
  sources: Record<string, string>;
  fetchedAt: number;
  strategist?: { suggestions: VideoSuggestion[]; mode: "ai" | "patterns" };
};

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  google: { label: "Google", cls: "bg-accent-soft text-accent-2" },
  reddit: { label: "Reddit", cls: "bg-warn-soft text-warn" },
  youtube: { label: "YouTube", cls: "bg-danger-soft text-danger" },
};

const HEAT_META: Record<IdeaHeat, { cls: string; label: string }> = {
  hot: { cls: "bg-accent", label: "Hot — top of its source's ranking right now" },
  warm: { cls: "bg-warn", label: "Warm — trending, mid-ranking" },
  cool: { cls: "bg-ink-3/50", label: "Cool — relevant but lower momentum" },
};

export default function Research() {
  const [data, setData] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const res = await fetch(`/api/research${refresh ? "?refresh=1" : ""}`);
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveIdea = async (idea: TrendingIdea, format: "short" | "long") => {
    await fetch("/api/content-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: idea.text, format, status: "idea", notes: `From ${idea.detail ?? idea.source}` }),
    });
    setAdded((prev) => new Set(prev).add(idea.text));
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const saveVideo = async (v: NicheVideo, format: "short" | "long") => {
    await fetch("/api/content-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: v.title,
        format,
        status: "idea",
        notes: `Emulate this performer: ${v.url}\n${v.views != null ? fmtCompact(v.views) : v.viewsText} views · ${v.published}${v.channel ? ` · ${v.channel}` : ""}`,
      }),
    });
    setAdded((prev) => new Set(prev).add(v.url));
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const saveSuggestion = async (s: VideoSuggestion) => {
    await fetch("/api/content-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: s.title,
        format: s.format,
        status: "idea",
        notes: `Hook: ${s.hook}\n\nAngle: ${s.angle}\n\nBased on: ${s.source}`,
      }),
    });
    setAdded((prev) => new Set(prev).add(s.title));
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const fetchedAgo = data ? Math.round((Date.now() - data.fetchedAt) / 60000) : 0;

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Business</p>
          <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Trending topics and top-performing videos in your niche
            {data && <span className="text-ink-3"> · updated {fetchedAgo < 1 ? "just now" : `${fetchedAgo}m ago`}</span>}
          </p>
        </div>
        <IconButton label="Refresh research" onClick={() => load(true)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </header>

      {/* trending ideas */}
      <Card>
        <CardHeader
          title="Trending topic ideas"
          hint="filtered to your niche · deduped"
          right={
            data && (
              <span className="text-[11px] text-ink-3">
                {["google", "reddit", "youtube"].map((s) => (
                  <span key={s} className="ml-2">
                    {SOURCE_META[s]?.label ?? s}: {data.sources[s] === "ok" ? "✓" : "—"}
                  </span>
                ))}
                {data.sources.x === "unavailable" && <span className="ml-2 text-ink-3/70">X: n/a</span>}
              </span>
            )
          }
        />
        {loading && !data ? (
          <Skeleton rows={5} />
        ) : !data || data.ideas.length === 0 ? (
          <EmptyState title="No ideas found" body="Sources may be rate-limiting — try refresh in a minute." />
        ) : (
          <ul className="grid grid-cols-1 gap-1 px-4 pb-4 sm:grid-cols-2">
            {data.ideas.map((idea, i) => {
              const meta = SOURCE_META[idea.source];
              const isAdded = added.has(idea.text);
              return (
                <li key={i} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-card-2 transition-colors">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${HEAT_META[idea.heat ?? "cool"].cls}`}
                    title={HEAT_META[idea.heat ?? "cool"].label}
                  />
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${meta?.cls ?? "bg-card-2 text-ink-3"}`}>
                    {meta?.label ?? idea.source}
                  </span>
                  <a
                    href={idea.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-[13px] hover:text-accent-2 transition-colors"
                    title={idea.text}
                  >
                    {idea.text}
                  </a>
                  {isAdded ? (
                    <span className="shrink-0 text-[10px] text-good">added ✓</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => saveIdea(idea, "short")} className="rounded bg-card-3 px-1.5 py-0.5 text-[10px] text-ink-2 hover:text-ink" title="Add as short-form idea">+ Short</button>
                      <button onClick={() => saveIdea(idea, "long")} className="rounded bg-card-3 px-1.5 py-0.5 text-[10px] text-ink-2 hover:text-ink" title="Add as long-form idea">+ Long</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* strategist: concepts to make next */}
      <Card>
        <CardHeader
          title="Videos to make next"
          hint="hot topics turned into concepts"
          right={
            data?.strategist && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  data.strategist.mode === "ai" ? "bg-accent-soft text-accent-2" : "bg-card-2 text-ink-3"
                }`}
                title={
                  data.strategist.mode === "ai"
                    ? "Written by Claude as a YouTube scripting strategist, from your live trend data"
                    : "Pattern-based — add an Anthropic API key in Settings for tailored AI concepts"
                }
              >
                {data.strategist.mode === "ai" ? "AI strategist" : "pattern-based"}
              </span>
            )
          }
        />
        {loading && !data ? (
          <Skeleton rows={4} />
        ) : !data?.strategist || data.strategist.suggestions.length === 0 ? (
          <EmptyState title="No suggestions yet" body="Refresh once the trend sources are reachable." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-2">
            {data.strategist.suggestions.map((s, i) => {
              const isAdded = added.has(s.title);
              return (
                <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-line bg-card-2/40 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13.5px] font-semibold leading-snug">{s.title}</span>
                    <span className="shrink-0 rounded bg-card-3 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-2">
                      {s.format}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-ink italic">“{s.hook}”</p>
                  <p className="text-[11.5px] leading-relaxed text-ink-2">{s.angle}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="min-w-0 truncate text-[10.5px] text-ink-3" title={s.source}>
                      {s.source}
                    </span>
                    {isAdded ? (
                      <span className="shrink-0 text-[10px] text-good">added ✓</span>
                    ) : (
                      <button
                        onClick={() => saveSuggestion(s)}
                        className="shrink-0 rounded bg-card-3 px-2 py-0.5 text-[10.5px] text-ink-2 hover:text-ink transition-colors"
                        title="Add to content board with hook + angle in notes"
                      >
                        + Add to board
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* top performing content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VideoList title="Top long-form in niche" hint="recent uploads · by views" videos={data?.topLong} loading={loading && !data} format="long" added={added} onAdd={saveVideo} />
        <VideoList title="Top short-form in niche" hint="recent uploads · by views" videos={data?.topShort} loading={loading && !data} format="short" added={added} onAdd={saveVideo} />
      </div>
    </div>
  );
}

function VideoList({
  title,
  hint,
  videos,
  loading,
  format,
  added,
  onAdd,
}: {
  title: string;
  hint: string;
  videos: NicheVideo[] | undefined;
  loading: boolean;
  format: "short" | "long";
  added: Set<string>;
  onAdd: (v: NicheVideo, format: "short" | "long") => void;
}) {
  return (
    <Card className="self-start">
      <CardHeader title={title} hint={hint} />
      {loading ? (
        <Skeleton rows={5} />
      ) : !videos || videos.length === 0 ? (
        <EmptyState title="Nothing found" body="YouTube may be rate-limiting — try refresh shortly." />
      ) : (
        <ol className="divide-y divide-line/50 px-5 pb-3">
          {videos.map((v, i) => (
            <li key={i} className="group flex items-center gap-2 py-2.5">
              <a href={v.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 gap-3">
                <span className="w-4 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-3">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-accent-2 transition-colors">
                    {v.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-3">
                    <span className="truncate">{v.channel}</span>
                    <span className="tabular-nums text-ink-2">{v.views != null ? `${fmtCompact(v.views)} views` : v.viewsText}</span>
                    <span>{v.lengthText}</span>
                    {v.published && <span>· {v.published}</span>}
                  </span>
                </span>
              </a>
              {added.has(v.url) ? (
                <span className="shrink-0 text-[10px] text-good">added ✓</span>
              ) : (
                <button
                  onClick={() => onAdd(v, format)}
                  className="shrink-0 rounded bg-card-3 px-2 py-0.5 text-[10.5px] text-ink-2 opacity-0 hover:text-ink group-hover:opacity-100 transition-opacity"
                  title={`Add as ${format}-form idea with the video linked for reference`}
                >
                  + Add to board
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
