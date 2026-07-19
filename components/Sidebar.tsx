"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;

const HomeIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
    <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BusinessIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IdeaIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
    <path d="M9 18h6M10 21h4" strokeLinecap="round" />
    <path d="M12 3a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.3 1 2.1V17h6v-.3c0-.8.4-1.6 1-2.1A6.5 6.5 0 0 0 12 3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BUSINESS_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "content", label: "Content" },
  { key: "deals", label: "Brand Deals" },
];

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors ${
        active
          ? "bg-card-2 text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
          : "text-ink-2 hover:text-ink hover:bg-card-2/50"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
      )}
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({
  onOpenSettings,
  onOpenCapture,
}: {
  onOpenSettings: () => void;
  onOpenCapture: () => void;
}) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const onBusiness = pathname.startsWith("/business");
  const onResearch = pathname.startsWith("/research");

  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-line bg-[#0d0e11] md:flex">
      <div className="flex items-center px-4 py-3">
        {/* true-transparency PNG (white art, alpha from luminance) — sits on any background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="BT OS" className="h-16 w-16 object-cover" />
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onOpenCapture}
          title="Quick capture (⌘K)"
          className="flex w-full items-center gap-2.5 rounded-md border border-line bg-card px-2.5 py-[7px] text-[13px] text-ink-3 hover:border-line-2 hover:text-ink-2 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          <span>Capture</span>
          <kbd className="ml-auto text-[10px] text-ink-3">⌘K</kbd>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        <NavLink href="/" label="Home" icon={HomeIcon} active={pathname === "/"} />
        <NavLink href="/ideas" label="Idea Bank" icon={IdeaIcon} active={pathname.startsWith("/ideas")} />

        <NavLink href="/business" label="Business" icon={BusinessIcon} active={onBusiness || onResearch} />
        {/* business sub-items: sections scroll within the business page; Research is its own page */}
        {(onBusiness || onResearch) && (
          <div className="mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3 ml-3.5">
            {BUSINESS_SECTIONS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  if (!onBusiness) {
                    window.location.href = `/business?tab=${t.key}`;
                  } else if (t.key === "overview") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    document.getElementById(t.key)?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="rounded-md px-2.5 py-[5px] text-left text-[12.5px] text-ink-3 hover:text-ink hover:bg-card-2/40 transition-colors"
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/research"
              className={`rounded-md px-2.5 py-[5px] text-[12.5px] transition-colors ${
                onResearch ? "text-ink bg-card-2/70" : "text-ink-3 hover:text-ink hover:bg-card-2/40"
              }`}
            >
              Research
            </Link>
          </div>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-5">
        <NavLink
          href="/review"
          label="Weekly review"
          active={pathname.startsWith("/review")}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-ink-2 hover:text-ink hover:bg-card-2/50 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
        {now && (
          <p className="px-2.5 pt-2 text-[11px] leading-snug text-ink-3">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>
    </aside>
  );
}
