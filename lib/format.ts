/**
 * Centralized date/currency formatting. Pure helpers — safe to import from
 * both server (API routes, lib) and client components. All date math is in
 * the machine's local timezone.
 */

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysStr(s: string, n: number): string {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** Monday of the week containing the given date. */
export function mondayOf(dateStr: string): string {
  const d = fromDateStr(dateStr);
  const day = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

/** "Jul 24" */
export function fmtDay(s: string): string {
  return fromDateStr(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Today" | "Tomorrow" | "Mon, Jul 20" | "Jul 3 (5d ago)" for overdue */
export function fmtRelativeDay(s: string): string {
  const today = todayStr();
  if (s === today) return "Today";
  if (s === addDaysStr(today, 1)) return "Tomorrow";
  if (s === addDaysStr(today, -1)) return "Yesterday";
  const diff = Math.round(
    (fromDateStr(s).getTime() - fromDateStr(today).getTime()) / 86400000
  );
  if (diff < 0) return `${fmtDay(s)} · ${-diff}d late`;
  if (diff < 7)
    return fromDateStr(s).toLocaleDateString("en-US", { weekday: "short" });
  return fmtDay(s);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
