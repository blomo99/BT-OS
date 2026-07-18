"use client";

import { ReactNode, useEffect } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h2 className="shrink-0 text-xs font-semibold tracking-[0.08em] uppercase text-ink-2">
          {title}
        </h2>
        {hint && <span className="truncate text-xs text-ink-3">{hint}</span>}
      </div>
      {right}
    </header>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-card-2 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs text-ink-2 hover:text-ink hover:bg-card-2 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_4px_12px_-4px_rgba(245,197,24,0.45)] hover:bg-accent-2 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Shared checkbox. tone: accent (todos) | good (goals). Empty goal slots use
 * dashed. readOnly renders without a button role.
 */
export function Checkbox({
  checked,
  onToggle,
  tone = "accent",
  dashed = false,
  label,
}: {
  checked: boolean;
  onToggle?: () => void;
  tone?: "accent" | "good";
  dashed?: boolean;
  label?: string;
}) {
  const toneCls = tone === "good" ? "border-good bg-good" : "border-accent bg-accent";
  const cls = `flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
    checked
      ? toneCls
      : dashed
        ? "border-dashed border-line-2"
        : "border-line-2 hover:border-accent"
  }`;
  const mark = checked && (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="check-pop">
      <path
        d="M1.5 5.5l2.5 2.5 4.5-6"
        stroke="var(--bg)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  if (!onToggle) {
    return <span className={cls}>{mark}</span>;
  }
  return (
    <button
      onClick={onToggle}
      aria-label={label ?? (checked ? "Mark incomplete" : "Mark complete")}
      className={cls}
    >
      {mark}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  size,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** "full" nearly fills the viewport width — for editors that need room */
  size?: "full";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widthCls =
    size === "full" ? "max-w-[min(1400px,95vw)]" : wide ? "max-w-2xl" : "max-w-md";
  return (
    <div
      className={`overlay-in fixed inset-0 z-50 flex items-start justify-center bg-black/65 backdrop-blur-[3px] p-4 overflow-y-auto max-md:p-0 ${size === "full" ? "pt-[4vh]" : "pt-[8vh]"} max-md:pt-0`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`surface modal-in w-full ${widthCls} !shadow-2xl max-md:min-h-dvh max-md:max-w-none max-md:rounded-none`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-medium">{title}</h3>
          <IconButton label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </IconButton>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* 15-minute increments, starting the list at 7:00 AM so the common range is on top */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const idx = (i + 28) % 96;
  const h = Math.floor(idx / 4);
  const m = (idx % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

export const inputCls =
  "w-full rounded-lg border border-line bg-card-2 px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 transition-colors";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---- shared formatting lives in lib/format (server-safe); re-exported for
        existing client imports ---- */
export {
  toDateStr,
  fromDateStr,
  addDaysStr,
  fmtMoney,
  fmtCompact,
  fmtDay,
  fmtRelativeDay,
  fmtTime,
} from "@/lib/format";

/* ---- empty / loading states ---- */

export function EmptyState({
  title,
  body,
  action,
  className = "",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 py-8 text-center ${className}`}>
      <p className="text-xs font-semibold tracking-[0.08em] uppercase text-ink-3">
        {title}
      </p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2.5 px-5 pb-5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-card-2"
          style={{ width: `${85 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
