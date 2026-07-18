# BT OS

Personal operating system / second brain. Local-first: everything lives in a
SQLite database at `data/btos.db`; uploaded contracts live in `data/uploads/`.

## Run it

```bash
npm run dev        # http://localhost:3000  (development)
npm run serve      # build + production server on :3000
```

## Use it from your phone (Tailscale)

BT OS is a server app with a local SQLite database — it cannot run on
static hosts like GitHub Pages. The intended setup for phone access is
[Tailscale](https://tailscale.com) (free), which gives your devices a
private network to the Mac running BT OS:

1. Install Tailscale on the Mac (App Store or tailscale.com/download)
   and sign in; do the same on your phone with the same account.
2. Keep the server running on the Mac — `npm run serve`, or install
   `deploy/com.btos.server.plist` (instructions inside) to auto-start
   it on login.
3. On the phone, open `http://<mac-name>:3000` (the machine name shown
   in the Tailscale app — MagicDNS resolves it from anywhere).
4. Add it to your home screen — the UI is mobile-optimized with a
   floating quick-capture button.

Notes: the Mac must be awake for access (System Settings → Battery →
prevent sleeping when plugged in helps); Google's OAuth consent for
AdSense should be done from the Mac itself since its redirect URI is
`localhost`.

## Structure

Two places in the sidebar:

- **Home** (`/`) — large greeting, then a packed top band of equal-height
  tiles: the day-based to-do (carries forward; ⭐ sets Top 3), a day-navigable
  **Schedule** (arrows to any day), and a rail with Business attention /
  Coming up / this-week stats (with an upload-goal progress bar). The calendar
  spans the full width beneath (week/month toggles, events in 15-minute
  increments, **multi-day events** for vacations, iCal feeds). (`/personal`
  redirects here.)
- **Business** (`/business`) — one consolidated page; the sidebar sub-items
  (Overview / Content / Brand Deals) jump to sections:
  - **Live metrics** (Overview only): per-platform tiles (YouTube / Instagram
    / TikTok) with subscribers/followers, **views and likes**. YouTube
    subs+views and TikTok followers+likes are scraped live (● live badge).
    Views/Likes are **range-scoped** — pick 1W / 1M / 6M / 1Y and they show the
    gain over that window (e.g. "+141K · 1M") with the lifetime total beside
    it. Metrics a platform never publishes show "n/a" with an explanation.
  - **Needs attention** (compact — only near-due deliverables/payments,
    overdue tasks, or an at-risk weekly goal) beside a **Revenue** strip
    (collected / outstanding / contracted / pipeline / net, with the full
    panel behind "Details").
  - **Content board**: **Raw idea → Scripting → Ready to film → Done** with
    a full-page script editor per card; **Generate with AI** in the script
    editor has Claude (as a YouTube scripting pro) draft a ready-to-film
    script from the title/hook/notes — needs the Anthropic API key in
    Settings; **Export PDF** opens the saved script at `/script/[id]` as a
    Word-style document (white page, headings, print CSS) — hit "Save as
    PDF" in the print dialog; weekly output goals on top; YouTube uploads auto-detected
    (short vs long), TikTok/Instagram posts detected via post-count changes;
    Done auto-archives after N days.
  - **Brand Deals**: 13-stage sponsorship CRM (next actions, contracts,
    invoices, files). **Total collected = paid sponsorships + AdSense +
    affiliate** (sponsorships count only once paid; AdSense syncs via Google
    OAuth; Impact Radius affiliate commissions sync via the Impact API — both
    also loggable by month manually).
  - **Research** (`/research`) — trending topic ideas (Google autocomplete +
    Reddit niche discussions) **filtered as an idea funnel**: junk/fragments
    dropped, off-niche queries scored out, near-duplicate phrasings deduped
    (token-overlap), so only unique, genuinely-filmable ideas remain. Each
    idea carries a **heat dot** (yellow = hot / orange = warm / gray = cool)
    from its rank at the source — autocomplete position ≈ search volume,
    Reddit hot rank ≈ discussion momentum.
    **Videos to make next** turns the trend data into 6 concrete concepts
    (title / hook / angle / format) — written by Claude acting as a YouTube
    scripting strategist when an Anthropic API key is set in Settings,
    pattern-based otherwise. Top long-form and short-form lists show only
    **recent** high-performers (this-month uploads first, nothing over a
    year old, English + on-niche only). Any idea, concept, or top video adds
    to the content board with one click (videos land with the link + stats
    in notes as an "emulate this" reference). Niche seeds are configurable in Settings
    (`research_seeds`); X is marked n/a (no anonymous API).
- **Weekly review** (`/review`) — generated week-in-numbers, completed/overdue
  tasks, deal deadlines, outstanding invoices, reflections, and next week's
  priorities (saved as Monday tasks).

**Quick capture**: ⌘K / Ctrl+K anywhere — tasks (land on today's list),
events, content ideas, deal leads. On phones a floating **+** button
opens the same capture sheet (modals go full-screen below the md
breakpoint; the sidebar collapses to an icon rail).

## Data model (SQLite, `lib/db.ts`, migrations via `user_version`)

`todos`, `content_items` (idea→done board incl. script/tags; YouTube sync),
`deals` + `deal_files`, `adsense`, `expenses`, `weekly_reviews`, `events`
(ICS cache), `local_events`, `social_stats`, `settings`. Alerts are derived
(`lib/alerts.ts`) — fixing the record clears the alert. Formatting is
centralized in `lib/format.ts` (local timezone).

## Integrations

- **Calendar**: paste iCal URLs in Settings (Google "secret address", iCloud
  public calendar, holiday/birthday feeds).
- **YouTube**: live subscriber + lifetime-view scrape from the public channel
  pages; uploads detected from the public feed (shorts vs long
  auto-classified); optional Data API key for exact counts.
- **TikTok**: live followers, total likes, and post count from the public
  profile; new posts auto-log as short-form content.
- **Instagram**: blocks anonymous reads — paste your `sessionid` cookie in
  Settings to go live (it stays local and is only sent to Instagram);
  otherwise manual snapshots.
- **AdSense**: Google OAuth client in Settings → "Connect AdSense" on the
  Business page → monthly `estimatedRevenue` syncs automatically.
- **Affiliate (Impact Radius)**: Account SID + Auth token in Settings →
  monthly commissions sync from the Impact Actions API (also loggable by hand).
- **Research**: Google autocomplete, Reddit RSS, and YouTube search — all
  anonymous public sources, cached 1h. No keys required. Optionally add an
  Anthropic API key in Settings to have the "Videos to make next" concepts
  written by Claude (`lib/strategist.ts`, cached 6h).

(CertLaunch was removed from the dashboard for now; git history has the
integration if it comes back.)

## Design system

Tokens in `app/globals.css`; primitives in `components/ui.tsx`. Preview cards
in `design-system/` sync to the **BT OS Design System** project on
claude.ai/design.
