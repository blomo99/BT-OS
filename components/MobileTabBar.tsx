"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;

function Tab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
        active ? "text-accent" : "text-ink-3"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/**
 * Bottom tab bar for phones — replaces the desktop sidebar below the md
 * breakpoint. A left rail wastes width and isn't thumb-reachable on a phone,
 * so mobile gets the native pattern instead: flat tabs plus a raised center
 * capture button, with a "More" sheet for the pages that don't fit.
 */
export default function MobileTabBar({
  onOpenCapture,
  onOpenSettings,
}: {
  onOpenCapture: () => void;
  onOpenSettings: () => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const onBusiness = pathname.startsWith("/business") || pathname.startsWith("/research");

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-[#0d0e11]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Tab
          href="/"
          label="Home"
          active={pathname === "/"}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" {...stroke}>
              <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <Tab
          href="/ideas"
          label="Ideas"
          active={pathname.startsWith("/ideas")}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" {...stroke}>
              <path d="M9 18h6M10 21h4" strokeLinecap="round" />
              <path d="M12 3a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.3 1 2.1V17h6v-.3c0-.8.4-1.6 1-2.1A6.5 6.5 0 0 0 12 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />

        {/* raised center capture button — the primary phone action */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            onClick={onOpenCapture}
            aria-label="Quick capture"
            className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 active:scale-95 transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <Tab
          href="/business"
          label="Business"
          active={onBusiness}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" {...stroke}>
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />

        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
            moreOpen || pathname.startsWith("/review") ? "text-accent" : "text-ink-3"
          }`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" {...stroke}>
            <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="overlay-in fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-[3px] md:hidden"
          onMouseDown={(e) => e.target === e.currentTarget && setMoreOpen(false)}
        >
          <div
            className="modal-in w-full rounded-t-2xl border-t border-line bg-[#0d0e11] pb-2"
            style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-2" />
            <div className="flex flex-col p-2">
              <Link
                href="/research"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
              >
                Research
              </Link>
              <Link
                href="/review"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg px-4 py-3 text-[15px] text-ink hover:bg-card-2"
              >
                Weekly review
              </Link>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onOpenSettings();
                }}
                className="rounded-lg px-4 py-3 text-left text-[15px] text-ink hover:bg-card-2"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
