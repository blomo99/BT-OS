"use client";

import { useEffect, useState } from "react";
import { Modal, Field, inputCls, TextButton, PrimaryButton } from "@/components/ui";

type Feed = { name: string; url: string };

const US_HOLIDAYS: Feed = {
  name: "US Holidays",
  url: "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics",
};

export default function SettingsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [ytHandle, setYtHandle] = useState("");
  const [ytKey, setYtKey] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [igSession, setIgSession] = useState("");
  const [ttHandle, setTtHandle] = useState("");
  const [gClientId, setGClientId] = useState("");
  const [gClientSecret, setGClientSecret] = useState("");
  const [impactSid, setImpactSid] = useState("");
  const [impactToken, setImpactToken] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        try {
          setFeeds(JSON.parse(s.ics_feeds ?? "[]"));
        } catch {
          setFeeds([]);
        }
        setYtHandle(s.yt_handle ?? "@CyberWithBen");
        setYtKey(s.yt_api_key ?? "");
        setIgHandle(s.ig_handle ?? "@CyberWithBen");
        setIgSession(s.ig_session ?? "");
        setTtHandle(s.tt_handle ?? "@CyberWithBen");
        setGClientId(s.google_client_id ?? "");
        setGClientSecret(s.google_client_secret ?? "");
        setImpactSid(s.impact_sid ?? "");
        setImpactToken(s.impact_token ?? "");
        setAnthropicKey(s.anthropic_api_key ?? "");
      });
  }, [open]);

  const addFeed = () => {
    if (!newUrl.trim()) return;
    setFeeds([...feeds, { name: newName.trim() || `Calendar ${feeds.length + 1}`, url: newUrl.trim() }]);
    setNewName("");
    setNewUrl("");
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ics_feeds: JSON.stringify(feeds),
        yt_handle: ytHandle,
        yt_api_key: ytKey,
        ig_handle: igHandle,
        ig_session: igSession,
        tt_handle: ttHandle,
        google_client_id: gClientId,
        google_client_secret: gClientSecret,
        impact_sid: impactSid,
        impact_token: impactToken,
        anthropic_api_key: anthropicKey,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings" wide>
      <div className="space-y-5">
        <section>
          <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Calendar feeds (iCal)
          </h4>
          <p className="mb-2 text-[11px] leading-relaxed text-ink-3">
            Google Calendar: Settings → your calendar → “Secret address in iCal
            format”. Apple: iCloud.com → Calendar → share as public calendar
            (webcal link). Birthdays &amp; holiday calendars work the same way.
          </p>
          <ul className="mb-2 space-y-1">
            {feeds.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 text-ink">{f.name}</span>
                <span className="truncate text-xs text-ink-3">{f.url}</span>
                <button
                  onClick={() => setFeeds(feeds.filter((_, j) => j !== i))}
                  className="ml-auto text-ink-3 hover:text-danger transition-colors"
                  aria-label={`Remove ${f.name}`}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
            {feeds.length === 0 && (
              <li className="text-xs text-ink-3">No feeds added.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <input
              className={`${inputCls} !w-32 shrink-0`}
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="https://…/basic.ics or webcal://…"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFeed()}
            />
            <TextButton onClick={addFeed} className="shrink-0 border border-line">
              Add
            </TextButton>
          </div>
          {!feeds.some((f) => f.url === US_HOLIDAYS.url) && (
            <button
              onClick={() => setFeeds([...feeds, US_HOLIDAYS])}
              className="mt-2 text-[11px] text-accent hover:underline"
            >
              + Add US Holidays calendar
            </button>
          )}
        </section>

        <section className="border-t border-line pt-4">
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Social accounts
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="YouTube handle">
              <input className={inputCls} value={ytHandle} onChange={(e) => setYtHandle(e.target.value)} placeholder="@CyberWithBen" />
            </Field>
            <Field label="Instagram handle">
              <input className={inputCls} value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="@CyberWithBen" />
            </Field>
            <Field label="TikTok handle">
              <input className={inputCls} value={ttHandle} onChange={(e) => setTtHandle(e.target.value)} placeholder="@CyberWithBen" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="YouTube Data API key (optional)">
              <input className={inputCls} value={ytKey} onChange={(e) => setYtKey(e.target.value)} placeholder="AIza…" />
            </Field>
            <Field label="Instagram session cookie (optional)">
              <input className={inputCls} value={igSession} onChange={(e) => setIgSession(e.target.value)} placeholder="sessionid value" />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
            YouTube subscribers, views and uploads are pulled live from public
            pages; TikTok followers, likes and posts too. Instagram blocks
            anonymous reads — to make it live, paste your{" "}
            <span className="text-ink-2">sessionid</span> cookie (instagram.com
            → DevTools → Application → Cookies). It stays in your local
            database and is only sent to Instagram itself.
          </p>
        </section>

        <section className="border-t border-line pt-4">
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Google / AdSense sync
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="OAuth client ID">
              <input
                className={inputCls}
                value={gClientId}
                onChange={(e) => setGClientId(e.target.value)}
                placeholder="…apps.googleusercontent.com"
              />
            </Field>
            <Field label="OAuth client secret">
              <input
                className={inputCls}
                value={gClientSecret}
                onChange={(e) => setGClientSecret(e.target.value)}
                placeholder="GOCSPX-…"
              />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
            For automatic monthly AdSense revenue: Google Cloud Console → create
            an OAuth client (Web application) with redirect URI{" "}
            <span className="text-ink-2">http://localhost:3000/api/google/callback</span>,
            enable the YouTube Analytics API, paste the credentials here, then
            hit “Connect AdSense” on the Business page.
          </p>
        </section>

        <section className="border-t border-line pt-4">
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Impact Radius (affiliate)
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Account SID">
              <input
                className={inputCls}
                value={impactSid}
                onChange={(e) => setImpactSid(e.target.value)}
                placeholder="IRxxxxxxxx…"
              />
            </Field>
            <Field label="Auth token">
              <input
                className={inputCls}
                value={impactToken}
                onChange={(e) => setImpactToken(e.target.value)}
                placeholder="from impact.com → Settings → API"
              />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
            Pulls your affiliate commissions by month from impact.com (Actions
            API). Both credentials live in impact.com → Settings → Technical →
            API. They stay in your local database and are only sent to Impact.
          </p>
        </section>

        <section className="border-t border-line pt-4">
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Research strategist (Anthropic)
          </h4>
          <Field label="API key">
            <input
              className={inputCls}
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-…"
            />
          </Field>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
            With a key, the Research tab’s “Videos to make next” concepts are
            written by Claude acting as a YouTube scripting strategist, grounded
            in your live trend data. Without one, pattern-based suggestions are
            used instead. The key stays in your local database and is only sent
            to Anthropic. Get one at console.anthropic.com.
          </p>
        </section>

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <TextButton onClick={onClose}>Cancel</TextButton>
          <PrimaryButton onClick={save}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
