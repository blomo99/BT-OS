import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getSetting, setSetting } from "@/lib/db";
import type { ResearchResult } from "@/lib/research";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — suggestions cost tokens; refresh regenerates

export type VideoSuggestion = {
  title: string;
  format: "short" | "long";
  hook: string;
  angle: string;
  source: string;
};
export type StrategistResult = {
  suggestions: VideoSuggestion[];
  mode: "ai" | "patterns";
  fetchedAt: number;
};

const SuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      title: z.string().describe("Exact clickable YouTube title, under 70 characters"),
      format: z.enum(["short", "long"]),
      hook: z.string().describe("The first line spoken on camera — 1 sentence that earns the next 10 seconds"),
      angle: z.string().describe("1-2 sentence strategist rationale: why this will perform, grounded in the trend/competitor data"),
      source: z.string().describe("The trend, discussion, or competitor video this concept is built from"),
    })
  ),
});

function buildPrompt(research: ResearchResult): string {
  const trends = research.ideas.map((i) => `- ${i.text} (${i.source})`).join("\n");
  const pulse = research.pulse.slice(0, 18).map((p) => `- ${p}`).join("\n");
  const long = research.topLong
    .map((v) => `- "${v.title}" — ${v.viewsText} views, ${v.published} (${v.channel})`)
    .join("\n");
  const short = research.topShort
    .map((v) => `- "${v.title}" — ${v.viewsText} views, ${v.published}`)
    .join("\n");
  return `Channel: @CyberWithBen — cybersecurity content for beginners breaking into the field (careers, certifications, roadmaps, salaries, day-in-the-life). Formats: YouTube Shorts and long-form.

Fresh research data:

TRENDING SEARCHES (filtered to the niche):
${trends || "- none available"}

WHAT THE COMMUNITY IS DISCUSSING RIGHT NOW (Reddit hot posts):
${pulse || "- none available"}

TOP-PERFORMING RECENT LONG-FORM IN THE NICHE:
${long || "- none available"}

TOP-PERFORMING RECENT SHORTS IN THE NICHE:
${short || "- none available"}

Suggest exactly 6 video concepts (mix of shorts and long-form) this channel should make next. Every concept must be grounded in the data above — a trend with search demand, a live community discussion, or a competitor format that is demonstrably working right now. Titles must be specific and clickable, not generic. Hooks must open a curiosity gap in one spoken sentence. Angles must explain the strategic bet like a professional would in a pitch meeting.`;
}

async function aiSuggestions(apiKey: string, research: ResearchResult): Promise<VideoSuggestion[] | null> {
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system:
        "You are a veteran YouTube scripting professional and channel strategist. You have written scripts behind multiple 1M+ subscriber education channels and you think in terms of packaging (title + thumbnail promise), retention curves, search demand, and format-market fit. You never suggest generic ideas — every concept is a specific, differentiated bet grounded in current data.",
      messages: [{ role: "user", content: buildPrompt(research) }],
      output_config: { format: zodOutputFormat(SuggestionsSchema) },
    });
    return response.parsed_output?.suggestions?.slice(0, 6) ?? null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("strategist: invalid Anthropic API key");
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("strategist: rate limited");
    } else {
      console.error("strategist:", err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/* ——— script generation: turn a board idea into a full script ——— */

export type ScriptRequest = {
  title: string;
  format: "short" | "long";
  hook?: string | null;
  notes?: string | null;
  tags?: string | null;
};

const SCRIPT_SYSTEM =
  "You are a veteran YouTube scripting professional who has written for multiple 1M+ subscriber education channels. You write for @CyberWithBen — cybersecurity content for beginners breaking into the field (careers, certifications, roadmaps, salaries). Voice: direct, practical, credible practitioner talking to a smart friend; no fluff, no filler intros, no 'hey guys welcome back'. Every script opens with a curiosity-gap hook and is structured for retention.";

function scriptPrompt(req: ScriptRequest): string {
  const ctx = [
    req.hook?.trim() && `Working hook (use or improve it): ${req.hook.trim()}`,
    req.notes?.trim() && `Notes / references from the creator:\n${req.notes.trim()}`,
    req.tags?.trim() && `Tags: ${req.tags.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const spec =
    req.format === "short"
      ? `Write a complete YouTube Short script (45–60 seconds spoken, ~140–170 words).
Structure it as:
HOOK — one spoken line that stops the scroll (first 2 seconds)
BODY — rapid beats, one idea per line, each line earning the next
CTA — one closing line (follow / comment prompt tied to the topic)
Include [b-roll / on-screen text] cues in brackets where they add punch.`
      : `Write a complete long-form YouTube script (8–12 minute video).
Structure it as:
HOOK (0:00–0:20) — spoken cold-open that sets the promise of the video
INTRO — one short paragraph establishing credibility and the roadmap
Then 3–5 titled SECTIONS with full spoken copy — not bullet summaries — with [b-roll / on-screen] cues where useful and a mid-video retention hook between sections
CTA — closing that sets up the next video
Also include a suggested TITLE + THUMBNAIL TEXT block at the top.`;

  return `Video idea: "${req.title}"
Format: ${req.format === "short" ? "YouTube Short" : "Long-form YouTube video"}
${ctx ? `\n${ctx}\n` : ""}
${spec}

Write the full script now — ready to read from a teleprompter.`;
}

/** Generate a ready-to-film script for a content-board idea. Returns null without a key. */
export async function generateScript(req: ScriptRequest): Promise<{ script: string } | { error: string }> {
  const apiKey = getSetting("anthropic_api_key")?.trim();
  if (!apiKey) return { error: "no_key" };
  const client = new Anthropic({ apiKey });
  try {
    // scripts are long output — stream to avoid request timeouts
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SCRIPT_SYSTEM,
      messages: [{ role: "user", content: scriptPrompt(req) }],
    });
    const final = await stream.finalMessage();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text ? { script: text } : { error: "Claude returned an empty script — try again." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: "Invalid Anthropic API key — check Settings." };
    if (err instanceof Anthropic.RateLimitError) return { error: "Rate limited by Anthropic — try again in a minute." };
    return { error: err instanceof Error ? err.message : "Script generation failed." };
  }
}

/* ——— no-key fallback: proven packaging patterns applied to the filtered trends ——— */
const PATTERNS: { make: (topic: string) => Omit<VideoSuggestion, "source"> }[] = [
  {
    make: (t) => ({
      title: `${cap(t)} — What Nobody Tells You`,
      format: "long",
      hook: `Everyone searching "${t}" is being told the same three things — and all three are outdated.`,
      angle: "Contrarian take on a rising search: demand already exists, the twist earns the click over generic tutorials ranking today.",
    }),
  },
  {
    make: (t) => ({
      title: `I Tested "${cap(t)}" So You Don't Have To`,
      format: "short",
      hook: `I spent a week on ${t} — here's the 30-second verdict.`,
      angle: "First-person experiment format: highest-retention short structure (stake → montage → verdict) applied to a trending query.",
    }),
  },
  {
    make: (t) => ({
      title: `${cap(t)}: The 2026 Reality Check`,
      format: "long",
      hook: `Before you spend a dollar or an hour on ${t}, watch this.`,
      angle: "Loss-aversion framing converts search traffic better than how-to phrasing; year stamp signals freshness against stale competitors.",
    }),
  },
  {
    make: (t) => ({
      title: `3 Mistakes Everyone Makes With ${cap(t)}`,
      format: "short",
      hook: `Mistake #1 with ${t} costs people six months — and almost everyone makes it.`,
      angle: "Numbered-mistakes shorts loop well (viewers rewatch to catch all items) and the format is proven in this niche.",
    }),
  },
  {
    make: (t) => ({
      title: `The Truth About ${cap(t)} (From Someone In The Field)`,
      format: "long",
      hook: `I work in cybersecurity — and what people online say about ${t} is mostly wrong.`,
      angle: "Credibility-led angle: practitioner POV differentiates against aggregator channels covering the same trend.",
    }),
  },
  {
    make: (t) => ({
      title: `${cap(t)} in 60 Seconds`,
      format: "short",
      hook: `Here's ${t}, compressed into one minute — save this.`,
      angle: "Utility short optimized for saves/shares, the strongest distribution signal for search-adjacent topics.",
    }),
  },
];

function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanTopic(s: string): string {
  return s
    .replace(/\s*\([^)]*\)/g, "") // drop parentheticals like "(cssc)"
    .replace(/cyber\s+security/gi, "cybersecurity")
    .replace(/\s+/g, " ")
    .trim();
}

function patternSuggestions(research: ResearchResult): VideoSuggestion[] {
  const topics = research.ideas.filter((i) => i.source === "google").map((i) => i.text);
  // reddit discussions as backup topics if autocomplete came up short
  for (const i of research.ideas) if (i.source === "reddit" && topics.length < 6) topics.push(i.text);
  return topics.slice(0, 6).map((t, idx) => ({
    ...PATTERNS[idx % PATTERNS.length].make(cleanTopic(t.toLowerCase())),
    source: `Trending: "${t}"`,
  }));
}

/** Video concepts from the research data — AI strategist with key, patterns without. Cached 6h. */
export async function getStrategist(research: ResearchResult, force = false): Promise<StrategistResult> {
  const apiKey = getSetting("anthropic_api_key")?.trim();

  const cachedRaw = getSetting("strategist_cache");
  if (!force && cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as StrategistResult;
      const fresh = Date.now() - cached.fetchedAt < CACHE_TTL_MS;
      // regenerate if a key was added since the cached pattern-based run
      const upgradeable = cached.mode === "patterns" && apiKey;
      if (fresh && !upgradeable && cached.suggestions?.length) return cached;
    } catch {
      /* regenerate */
    }
  }

  let suggestions: VideoSuggestion[] | null = null;
  let mode: StrategistResult["mode"] = "patterns";
  if (apiKey) {
    suggestions = await aiSuggestions(apiKey, research);
    if (suggestions?.length) mode = "ai";
  }
  if (!suggestions?.length) suggestions = patternSuggestions(research);

  const result: StrategistResult = { suggestions, mode, fetchedAt: Date.now() };
  setSetting("strategist_cache", JSON.stringify(result));
  return result;
}
