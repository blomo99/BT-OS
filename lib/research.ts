import { getSetting, setSetting } from "@/lib/db";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // every other day — trends move slowly, be a polite scraper

export type IdeaSource = "google" | "reddit" | "youtube";
export type IdeaHeat = "hot" | "warm" | "cool";
export type TrendingIdea = {
  text: string;
  source: IdeaSource;
  detail?: string;
  url?: string;
  /** popularity rank at the source (0 = top autocomplete suggestion / hottest post) */
  pop?: number;
  heat?: IdeaHeat;
};
export type NicheVideo = {
  title: string;
  channel: string;
  views: number | null;
  viewsText: string;
  lengthSeconds: number | null;
  lengthText: string;
  published: string;
  url: string;
};
export type ResearchResult = {
  query: string;
  ideas: TrendingIdea[];
  topLong: NicheVideo[];
  topShort: NicheVideo[];
  /** raw niche discussion titles (unfiltered) — strategist context, not shown directly */
  pulse: string[];
  sources: Record<string, "ok" | "failed" | "unavailable">;
  fetchedAt: number;
};

// niche is configurable; defaults tuned to Ben's channel
const DEFAULT_SEEDS = [
  "cybersecurity career beginner",
  "cybersecurity certifications",
  "how to get into cybersecurity",
  "cybersecurity jobs",
];
const REDDIT_SUBS = ["cybersecurity", "ITCareerQuestions", "SecurityCareerAdvice"];

/* ——— relevance model: does this belong on a cybersecurity-beginner-career channel? ——— */
const NICHE_TOKENS = new Set([
  "cybersecurity", "cyber", "security", "infosec", "soc", "siem", "pentest",
  "pentesting", "hacking", "hacker", "hackers", "comptia", "security+", "cissp",
  "ccna", "ceh", "oscp", "cysa", "analyst", "networking", "linux", "tryhackme",
  "hackthebox", "grc", "malware", "phishing", "firewall",
]);
const AUDIENCE_TOKENS = new Set([
  "beginner", "beginners", "career", "careers", "job", "jobs", "entry",
  "roadmap", "salary", "salaries", "interview", "interviews", "certification",
  "certifications", "cert", "certs", "course", "courses", "degree", "learn",
  "learning", "start", "starting", "remote", "path", "skills", "resume",
  "internship", "internships", "training", "bootcamp", "experience", "paying",
  "study", "projects", "portfolio", "helpdesk", "tech", "it",
]);
// junk that autocomplete/reddit surface but that can't become a video
const BLACKLIST = [
  /near me/i,
  /\breddit\b/i,
  /\bquizlet\b/i,
  /^what (are|is) .{0,20}$/i,
  /login/i,
  /\.com\b/i,
  // AI-overview sentence fragments that leak into autocomplete
  /\ba way for you\b/i,
  /^outline\b/i,
  // subreddit stickies / megathreads
  /mentorship monday|megathread|weekly thread|post all/i,
  // location-specific queries ("cybersecurity jobs arlington va")
  /\b(al|ak|az|ar|co|ct|dc|de|fl|ga|hi|id|il|ia|ks|ky|la|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\.?$/i,
  /\b(washington|arlington|atlanta|dallas|houston|chicago|london|toronto|sydney|dubai|bangalore|hyderabad)\b/i,
];

// non-English content isn't emulatable competitor material
const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿऀ-෿฀-๿぀-ヿ一-鿿가-힯]/;
const NON_ENGLISH_WORDS = /\b(kaise|kya|bane|karo|hindi|telugu|tamil|urdu|bangla|español|sinhala)\b/i;

const STOPWORDS = new Set([
  "the", "a", "an", "to", "in", "for", "of", "and", "or", "is", "are", "how",
  "what", "do", "does", "you", "your", "i", "my", "me", "we", "with", "on",
  "at", "get", "into", "can", "should", "be", "it", "as", "vs", "from",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/cyber\s+security/g, "cybersecurity")
    .replace(/[^a-z0-9\s+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

type Scored = { nicheHits: number; audienceHits: number };
function scoreText(s: string): Scored {
  const toks = tokenSet(s);
  let nicheHits = 0;
  let audienceHits = 0;
  for (const t of toks) {
    if (NICHE_TOKENS.has(t)) nicheHits++;
    if (AUDIENCE_TOKENS.has(t)) audienceHits++;
  }
  return { nicheHits, audienceHits };
}

/** Keep only ideas Ben could genuinely film, then drop near-duplicate phrasings. */
function filterIdeas(ideas: TrendingIdea[], seeds: string[]): TrendingIdea[] {
  const seedSets = seeds.map(tokenSet);
  const candidates = ideas
    .filter((i) => {
      const len = i.text.trim().length;
      // real search queries are short — long "suggestions" are AI-overview fragments
      if (len < 8 || len > (i.source === "google" ? 64 : 120)) return false;
      if (BLACKLIST.some((re) => re.test(i.text))) return false;
      const { nicheHits, audienceHits } = scoreText(i.text);
      // reddit posts come from niche subs, so the sub supplies the niche signal
      const niche = i.source === "reddit" ? nicheHits + 1 : nicheHits;
      return niche >= 1 && audienceHits >= 1;
    })
    .map((i) => {
      const { nicheHits, audienceHits } = scoreText(i.text);
      const toks = tokenSet(i.text);
      // reward specificity beyond the seed itself
      let novelty = 0;
      for (const t of toks) if (!seedSets.some((s) => s.has(t))) novelty++;
      return { idea: i, toks, score: audienceHits + nicheHits * 0.5 + Math.min(novelty, 3) * 0.75 };
    })
    .sort((a, b) => b.score - a.score);

  const kept: { idea: TrendingIdea; toks: Set<string> }[] = [];
  for (const c of candidates) {
    // near-duplicate of a seed ("cybersecurity jobs" ≈ the seed) or of a kept idea
    if (seedSets.some((s) => jaccard(c.toks, s) >= 0.8)) continue;
    if (kept.some((k) => jaccard(c.toks, k.toks) >= 0.55)) continue;
    kept.push({ idea: c.idea, toks: c.toks });
  }
  // heat = position at the source: top autocomplete slots / hottest posts rank first
  return kept.map((k) => ({
    ...k.idea,
    heat: (k.idea.pop ?? 99) <= 2 ? ("hot" as const) : (k.idea.pop ?? 99) <= 6 ? ("warm" as const) : ("cool" as const),
  }));
}

/** Recent + on-niche videos only: nothing "years ago", nothing off-topic. */
function relevantVideo(v: NicheVideo): boolean {
  if (/year/i.test(v.published)) return false; // "1 year ago" and older
  if (NON_LATIN.test(v.title) || NON_ENGLISH_WORDS.test(v.title)) return false;
  const { nicheHits } = scoreText(v.title); // competitors = cybersecurity channels, not tech-career-at-large
  return nicheHits >= 1;
}

async function getText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseCompactViews(s: string): number | null {
  const cleaned = s.replace(/,/g, "");
  // handle "1.9 thousand" / "2.3 million" (shorts accessibility text) and "1.2K" / "3M"
  const word = cleaned.match(/([\d.]+)\s*(thousand|million|billion)/i);
  if (word) {
    const mult = /million/i.test(word[2]) ? 1e6 : /billion/i.test(word[2]) ? 1e9 : 1e3;
    return Math.round(Number(word[1]) * mult);
  }
  const m = cleaned.match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const u = m[2]?.toUpperCase();
  const mult = u === "B" ? 1e9 : u === "M" ? 1e6 : u === "K" ? 1e3 : 1;
  return Math.round(Number(m[1]) * mult);
}

function parseLength(s: string): number | null {
  const parts = s.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/* ——— Google autocomplete: real trending completions for a seed ——— */
async function googleSuggests(seed: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`;
  const txt = await getText(url);
  if (!txt) return [];
  try {
    const json = JSON.parse(txt);
    return (json[1] as string[]) ?? [];
  } catch {
    return [];
  }
}

/* ——— Reddit: hot post titles from niche subs = what people ask about ——— */
async function redditTitles(): Promise<TrendingIdea[]> {
  const out: TrendingIdea[] = [];
  for (const sub of REDDIT_SUBS) {
    const xml = await getText(`https://www.reddit.com/r/${sub}/hot/.rss?limit=8`, {
      "User-Agent": "btos-dashboard:v1.0 (personal research)",
    });
    if (!xml) continue;
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    entries.slice(0, 8).forEach(([, body], idx) => {
      const title = body.match(/<title>([^<]+)<\/title>/)?.[1];
      const link = body.match(/<link href="([^"]+)"/)?.[1];
      if (title) out.push({ text: decode(title), source: "reddit", detail: `r/${sub}`, url: link, pop: idx });
    });
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/* ——— YouTube search: parse ytInitialData for top videos in the niche ——— */

// sp params = protobuf filters: sort by views · upload window · type video (· duration)
const SP = {
  monthLong: "CAMSBAgEEAE%3D", // this month
  yearLong: "CAMSBAgFEAE%3D", // this year
  monthShort: "CAMSBggEEAEYAQ%3D%3D", // this month · under 4 min
  yearShort: "CAMSBggFEAEYAQ%3D%3D", // this year · under 4 min
};

type YtRenderer = {
  title?: { runs?: { text: string }[] };
  viewCountText?: { simpleText?: string };
  lengthText?: { simpleText?: string };
  ownerText?: { runs?: { text: string }[] };
  publishedTimeText?: { simpleText?: string };
  videoId?: string;
};

function collectRenderers(node: unknown, out: YtRenderer[]) {
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  if (rec.videoRenderer) out.push(rec.videoRenderer as YtRenderer);
  for (const k in rec) collectRenderers(rec[k], out);
}

async function youtubeSearch(query: string, sp: string): Promise<NicheVideo[]> {
  const html = await getText(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${sp}`
  );
  if (!html) return [];
  const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const renderers: YtRenderer[] = [];
  collectRenderers(data, renderers);

  const seen = new Set<string>();
  const vids: NicheVideo[] = [];
  for (const v of renderers) {
    const id = v.videoId;
    const title = v.title?.runs?.[0]?.text;
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const viewsText = v.viewCountText?.simpleText ?? "";
    const lengthText = v.lengthText?.simpleText ?? "";
    vids.push({
      title: decode(title),
      channel: v.ownerText?.runs?.[0]?.text ?? "",
      views: viewsText ? parseCompactViews(viewsText) : null,
      viewsText: viewsText.replace(" views", ""),
      lengthSeconds: lengthText ? parseLength(lengthText) : null,
      lengthText,
      published: v.publishedTimeText?.simpleText ?? "",
      url: `https://www.youtube.com/watch?v=${id}`,
    });
  }
  return vids;
}

/** Fresh high-performers first: this-month uploads that actually pulled views rank
 *  ahead, then everything else (month + year) by views. Nothing over a year old. */
const FRESH_VIEW_FLOOR = 1000; // a 30-view upload from this month isn't "high-performing"
function mergeRank(
  month: NicheVideo[],
  year: NicheVideo[],
  fits: (v: NicheVideo) => boolean
): NicheVideo[] {
  const seen = new Set<string>();
  const pool: NicheVideo[] = [];
  for (const v of [...month, ...year]) {
    if (seen.has(v.url) || !fits(v) || !relevantVideo(v)) continue;
    seen.add(v.url);
    pool.push(v);
  }
  const byViews = (a: NicheVideo, b: NicheVideo) => (b.views ?? 0) - (a.views ?? 0);
  const monthUrls = new Set(month.map((v) => v.url));
  const fresh = pool.filter((v) => monthUrls.has(v.url) && (v.views ?? 0) >= FRESH_VIEW_FLOOR).sort(byViews);
  const rest = pool.filter((v) => !fresh.includes(v)).sort(byViews);
  return [...fresh, ...rest].slice(0, 6);
}

export function getResearchSeeds(): string[] {
  try {
    const saved = JSON.parse(getSetting("research_seeds") ?? "[]");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    /* defaults */
  }
  return DEFAULT_SEEDS;
}

/** Aggregate trending ideas + top-performing niche videos, cached for 1h. */
export async function getResearch(force = false): Promise<ResearchResult> {
  const cachedRaw = getSetting("research_cache");
  if (!force && cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as ResearchResult;
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS && Array.isArray(cached.pulse)) return cached;
    } catch {
      /* refetch */
    }
  }

  const seeds = getResearchSeeds();
  const sources: ResearchResult["sources"] = {
    google: "failed",
    reddit: "failed",
    youtube: "failed",
    x: "unavailable", // X/Twitter has no anonymous API; kept honest, not faked
  };

  // Google autocomplete across seeds → raw candidate pool
  const rawIdeas: TrendingIdea[] = [];
  const seenText = new Set<string>();
  for (const seed of seeds) {
    const suggests = await googleSuggests(seed);
    if (suggests.length) sources.google = "ok";
    suggests.forEach((s, idx) => {
      const key = normalize(s);
      if (key === normalize(seed) || seenText.has(key)) return;
      seenText.add(key);
      rawIdeas.push({
        text: s,
        source: "google",
        detail: "rising search",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(s)}`,
        pop: idx, // autocomplete order ≈ search volume
      });
    });
  }

  // Reddit discussion topics — filtered ones become ideas, all titles feed the strategist
  const reddit = await redditTitles();
  if (reddit.length) sources.reddit = "ok";
  const pulse = reddit.map((r) => `${r.text} (${r.detail})`);

  // one filtered, deduped list: unique concepts Ben could actually make
  const ideas = filterIdeas([...rawIdeas, ...reddit], seeds).slice(0, 16);

  // Top niche videos — recent uploads only (this month, backfilled from this year)
  const [longMonth, longYear, shortMonth, shortYear] = await Promise.all([
    youtubeSearch(seeds[0], SP.monthLong),
    youtubeSearch(seeds[0], SP.yearLong),
    youtubeSearch(seeds[0], SP.monthShort),
    youtubeSearch(seeds[0], SP.yearShort),
  ]);
  if (longMonth.length || longYear.length || shortMonth.length || shortYear.length)
    sources.youtube = "ok";

  const SHORT_MAX = 245; // <= ~4 min ≈ short-form
  const topLong = mergeRank(longMonth, longYear, (v) => (v.lengthSeconds ?? 0) > SHORT_MAX);
  const topShort = mergeRank(shortMonth, shortYear, (v) => (v.lengthSeconds ?? Infinity) <= SHORT_MAX);

  const result: ResearchResult = {
    query: seeds[0],
    ideas,
    topLong,
    topShort,
    pulse,
    sources,
    fetchedAt: Date.now(),
  };
  setSetting("research_cache", JSON.stringify(result));
  return result;
}
