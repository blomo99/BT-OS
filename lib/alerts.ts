import { getDb, getSetting } from "@/lib/db";
import { todayStr, addDaysStr, mondayOf, fmtMoney } from "@/lib/format";

export type Alert = {
  id: string;
  severity: "danger" | "warn" | "info";
  text: string;
  /** app route the alert links to */
  href: string;
  /** short label for the link/action */
  action: string;
};

/**
 * Needs-attention is deliberately quiet: it only speaks when something is
 * (almost) due — overdue tasks, deal deliverables and payments coming due —
 * or when the week is ending with the content goal unmet. Everything else
 * stays on its own page.
 */
export function computeAlerts(): Alert[] {
  const db = getDb();
  const today = todayStr();
  const soon = addDaysStr(today, 3);
  const alerts: Alert[] = [];

  // ---- personal: overdue tasks
  const overdue = db
    .prepare(
      `SELECT COUNT(*) n FROM todos
       WHERE completed_date IS NULL AND status != 'cancelled'
         AND due_date IS NOT NULL AND due_date < ?`
    )
    .get(today) as { n: number };
  if (overdue.n > 0)
    alerts.push({
      id: "tasks-overdue",
      severity: "danger",
      text: `${overdue.n} overdue task${overdue.n > 1 ? "s" : ""}`,
      href: "/",
      action: "Review",
    });

  // ---- deals: deliverables and payments that are due or nearly due
  type DealRow = {
    id: number;
    brand: string;
    status: string;
    due_date: string | null;
    invoice_status: string;
    payment_due: string | null;
    payment_received: string | null;
    price: number | null;
    agency_fee: number | null;
  };
  const deals = db
    .prepare(`SELECT * FROM deals WHERE status NOT IN ('paid','lost')`)
    .all() as DealRow[];

  const DELIVERED = ["submitted", "approved", "scheduled", "published", "invoiced"];

  for (const d of deals) {
    const dealHref = `/business?tab=deals&deal=${d.id}`;
    const net = (d.price ?? 0) - (d.agency_fee ?? 0);

    if (d.due_date && !DELIVERED.includes(d.status)) {
      if (d.due_date < today) {
        alerts.push({
          id: `deal-${d.id}-overdue`,
          severity: "danger",
          text: `${d.brand}: deliverable overdue (was due ${d.due_date.slice(5)})`,
          href: dealHref,
          action: "Open",
        });
      } else if (d.due_date <= soon) {
        alerts.push({
          id: `deal-${d.id}-due-soon`,
          severity: "warn",
          text: `${d.brand}: deliverable due ${d.due_date === today ? "today" : d.due_date.slice(5)}`,
          href: dealHref,
          action: "Open",
        });
      }
    }

    if (d.invoice_status === "sent" && !d.payment_received && d.payment_due) {
      if (d.payment_due < today) {
        alerts.push({
          id: `deal-${d.id}-payment`,
          severity: "danger",
          text: `${d.brand}: payment overdue${net ? ` (${fmtMoney(net)})` : ""}`,
          href: dealHref,
          action: "Follow up",
        });
      } else if (d.payment_due <= soon) {
        alerts.push({
          id: `deal-${d.id}-payment-soon`,
          severity: "warn",
          text: `${d.brand}: payment due ${d.payment_due === today ? "today" : d.payment_due.slice(5)}${net ? ` (${fmtMoney(net)})` : ""}`,
          href: dealHref,
          action: "Open",
        });
      }
    }
  }

  // ---- content goal at risk as the week closes
  const weekStart = mondayOf(today);
  const weekEnd = addDaysStr(weekStart, 6);
  const daysLeft =
    Math.round(
      (new Date(weekEnd).getTime() - new Date(today).getTime()) / 86400000
    ) + 1;
  let goals: Record<string, number> = { short: 3, long: 1 };
  try {
    goals = { ...goals, ...JSON.parse(getSetting("content_goals") ?? "{}") };
  } catch {
    /* defaults */
  }
  const done = db
    .prepare(
      `SELECT format, COUNT(*) n FROM content_items
       WHERE status IN ('done','archived') AND published_date >= ? AND published_date <= ?
       GROUP BY format`
    )
    .all(weekStart, weekEnd) as { format: string; n: number }[];
  const byFormat = Object.fromEntries(done.map((r) => [r.format, r.n]));
  const remaining = Object.entries(goals).reduce(
    (sum, [fmt, goal]) => sum + Math.max(0, goal - (byFormat[fmt] ?? 0)),
    0
  );
  if (remaining > 0 && daysLeft <= 2) {
    alerts.push({
      id: "content-at-risk",
      severity: "warn",
      text: `Week ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""} — ${remaining} piece${remaining > 1 ? "s" : ""} short of your content goal`,
      href: "/business?tab=content",
      action: "Open board",
    });
  }

  const order = { danger: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
