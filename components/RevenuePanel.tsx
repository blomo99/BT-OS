"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  PrimaryButton,
  Skeleton,
  TextButton,
  inputCls,
  fmtMoney,
  fmtDay,
} from "@/components/ui";
import { STAGES } from "@/components/Deals";

type Summary = {
  pipeline: number;
  pipelineCount: number;
  contracted: number;
  contractedCount: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  expected: number;
  expenses: number;
  adsense: number;
  affiliate: number;
  totalCollected: number;
  netCollected: number;
};

type MonthRow = { id: number; month: string; amount: number };

type MoneyDeal = {
  id: number;
  brand: string;
  campaign: string | null;
  status: string;
  price: number | null;
  agency_fee: number | null;
  invoice_status: string;
  payment_due: string | null;
  payment_received: string | null;
  ref_date: string | null;
};

type Expense = { id: number; description: string; amount: number; date: string; category: string | null };
type AdsenseSync = { configured: boolean; connected: boolean; error: string | null };
type ImpactSync = { configured: boolean; error: string | null };

export default function RevenuePanel() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [period, setPeriod] = useState("year"); // year | q1..q4 | m1..m12
  const [brand, setBrand] = useState("");
  const [data, setData] = useState<{ summary: Summary; deals: MoneyDeal[]; expenses: Expense[]; adsense: MonthRow[]; affiliate: MonthRow[]; adsenseSync?: AdsenseSync; impactSync?: ImpactSync; brands: string[] } | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [exp, setExp] = useState({ description: "", amount: "", date: "", category: "" });
  // monthKind: which revenue-month modal is open (adsense | affiliate)
  const [monthKind, setMonthKind] = useState<null | "adsense" | "affiliate">(null);
  const [monthForm, setMonthForm] = useState({ month: new Date().toISOString().slice(0, 7), amount: "" });

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (year !== "all") p.set("year", year);
    if (period.startsWith("q")) p.set("quarter", period.slice(1));
    if (period.startsWith("m")) p.set("month", period.slice(1));
    if (brand) p.set("brand", brand);
    fetch(`/api/revenue?${p}`).then((r) => r.json()).then(setData);
  }, [year, period, brand]);

  useEffect(() => {
    load();
    window.addEventListener("btos:data-changed", load);
    return () => window.removeEventListener("btos:data-changed", load);
  }, [load]);

  const saveExpense = async () => {
    if (!exp.description.trim() || !exp.amount) return;
    await fetch("/api/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: exp.description,
        amount: Number(exp.amount.replace(/[^\d.]/g, "")),
        date: exp.date || undefined,
        category: exp.category || null,
      }),
    });
    setAddExpense(false);
    setExp({ description: "", amount: "", date: "", category: "" });
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const removeExpense = async (id: number) => {
    await fetch(`/api/revenue?id=${id}`, { method: "DELETE" });
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const saveMonth = async () => {
    if (!monthKind || !monthForm.month || !monthForm.amount) return;
    await fetch("/api/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: monthKind,
        month: monthForm.month,
        amount: Number(monthForm.amount.replace(/[^\d.]/g, "")),
      }),
    });
    setMonthKind(null);
    setMonthForm({ month: new Date().toISOString().slice(0, 7), amount: "" });
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const removeMonth = async (kind: "adsense" | "affiliate", id: number) => {
    await fetch(`/api/revenue?${kind}_id=${id}`, { method: "DELETE" });
    load();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  const s = data?.summary;

  const tiles: { label: string; value: number | undefined; sub?: string; tone?: string }[] = [
    { label: "Pipeline", value: s?.pipeline, sub: `${s?.pipelineCount ?? 0} deals · not yet won` },
    { label: "Contracted", value: s?.contracted, sub: `${s?.contractedCount ?? 0} deals · net of fees` },
    { label: "Outstanding", value: s?.outstanding, sub: `${s?.outstandingCount ?? 0} unpaid invoices`, tone: s?.outstanding ? "text-warn" : undefined },
    { label: "Overdue", value: s?.overdue, sub: `${s?.overdueCount ?? 0} past payment date`, tone: s?.overdue ? "text-danger" : undefined },
    { label: "Sponsorships (paid)", value: s?.collected, sub: "counted only once paid" },
    {
      label: "AdSense",
      value: s?.adsense,
      sub: data?.adsenseSync?.connected
        ? "YouTube ad revenue · syncing"
        : s?.adsense
          ? "logged manually · included in totals below"
          : "not connected — nothing syncs yet",
      tone: !data?.adsenseSync?.connected && !s?.adsense ? "text-ink-3" : undefined,
    },
    { label: "Affiliate", value: s?.affiliate, sub: "Impact total earnings (actions + other)" },
    { label: "Total collected", value: s?.totalCollected, sub: "sponsorships + AdSense + affiliate", tone: "text-good" },
    { label: "Expenses", value: s?.expenses, sub: "business costs" },
    { label: "Net collected", value: s?.netCollected, sub: "total − expenses", tone: "text-good" },
  ];

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-24`} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
          <option value="all">All time</option>
          {[0, 1, 2].map((i) => {
            const y = now.getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <select
          className={`${inputCls} !w-32`}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={year === "all"}
          aria-label="Period"
        >
          <option value="year">Full year</option>
          {[1, 2, 3, 4].map((q) => <option key={q} value={`q${q}`}>Q{q}</option>)}
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={`m${i + 1}`}>
              {new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" })}
            </option>
          ))}
        </select>
        <select className={`${inputCls} !w-36`} value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">
          <option value="">All brands</option>
          {(data?.brands ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {data?.adsenseSync?.connected ? (
            <span className="flex items-center gap-1.5 rounded-md bg-good-soft px-2 py-1 text-[11px] text-good" title="Monthly revenue syncs from YouTube Analytics automatically">
              <span className="h-1.5 w-1.5 rounded-full bg-good" /> AdSense synced
            </span>
          ) : data?.adsenseSync?.configured ? (
            <a
              href="/api/google/auth"
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-black hover:bg-accent-2 transition-colors"
            >
              Connect AdSense
            </a>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new Event("btos:open-settings"))}
              className="rounded-md border border-warn/40 bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn hover:border-warn transition-colors"
              title="AdSense isn't syncing: add a Google OAuth client ID + secret in Settings, then connect"
            >
              Set up AdSense sync
            </button>
          )}
          {data?.impactSync?.configured && !data?.impactSync?.error && (
            <span className="flex items-center gap-1.5 rounded-md bg-good-soft px-2 py-1 text-[11px] text-good" title="Affiliate commissions sync from Impact Radius automatically">
              <span className="h-1.5 w-1.5 rounded-full bg-good" /> Impact synced
            </span>
          )}
          <TextButton onClick={() => setMonthKind("adsense")} className="border border-line">
            + AdSense
          </TextButton>
          <TextButton onClick={() => setMonthKind("affiliate")} className="border border-line">
            + Affiliate
          </TextButton>
          <TextButton onClick={() => setAddExpense(true)} className="border border-line">
            + Expense
          </TextButton>
        </div>
      </div>

      {data?.adsenseSync?.error && (
        <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          AdSense sync failed: {data.adsenseSync.error}
        </p>
      )}
      {data?.impactSync?.error && (
        <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          Impact sync failed: {data.impactSync.error}
        </p>
      )}

      {/* summary tiles — lifecycle buckets kept separate by design */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.label}</p>
            <p className={`mt-0.5 text-xl font-semibold tabular-nums ${t.tone ?? ""}`}>
              {s ? fmtMoney(t.value ?? 0) : "—"}
            </p>
            {t.sub && <p className="text-[11px] text-ink-3">{t.sub}</p>}
          </Card>
        ))}
      </div>

      {/* deal money table */}
      <Card>
        <CardHeader title="Deal ledger" hint="net values" />
        {!data ? (
          <Skeleton rows={4} />
        ) : data.deals.length === 0 ? (
          <EmptyState title="No revenue records" body="Deals with a price appear here once created in Sponsorships." />
        ) : (
          <div className="overflow-x-auto px-5 pb-4 -mx-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="pb-2 pr-4 font-medium">Brand</th>
                  <th className="pb-2 pr-4 font-medium">Stage</th>
                  <th className="pb-2 pr-4 font-medium text-right">Gross</th>
                  <th className="pb-2 pr-4 font-medium text-right">Net</th>
                  <th className="pb-2 pr-4 font-medium">Payment</th>
                  <th className="pb-2 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((d) => (
                  <tr key={d.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">{d.brand}</td>
                    <td className="py-2 pr-4 text-xs text-ink-2">
                      {STAGES.find((x) => x.key === d.status)?.label ?? d.status}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-2">{fmtMoney(d.price)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtMoney((d.price ?? 0) - (d.agency_fee ?? 0))}</td>
                    <td className="py-2 pr-4 text-xs">
                      {d.payment_received ? (
                        <span className="text-good">received</span>
                      ) : d.invoice_status === "sent" ? (
                        <span className="text-warn">awaiting</span>
                      ) : (
                        <span className="text-ink-3">not invoiced</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-xs tabular-nums text-ink-3">
                      {d.ref_date ? fmtDay(d.ref_date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* monthly revenue streams */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data && data.adsense.length > 0 && (
          <MonthList kind="adsense" title="AdSense" total={data.summary.adsense} rows={data.adsense} onRemove={removeMonth} />
        )}
        {data && data.affiliate.length > 0 && (
          <MonthList kind="affiliate" title="Affiliate (Impact)" total={data.summary.affiliate} rows={data.affiliate} onRemove={removeMonth} />
        )}
      </div>

      {/* expenses */}
      {data && data.expenses.length > 0 && (
        <Card>
          <CardHeader title="Expenses" hint={fmtMoney(data.summary.expenses)} />
          <ul className="space-y-1 px-5 pb-4">
            {data.expenses.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{e.description}</span>
                {e.category && <span className="rounded bg-card-2 px-1.5 py-0.5 text-[10px] text-ink-2">{e.category}</span>}
                <span className="tabular-nums text-ink-2">{fmtMoney(e.amount)}</span>
                <span className="text-[11px] tabular-nums text-ink-3">{fmtDay(e.date)}</span>
                <button
                  onClick={() => removeExpense(e.id)}
                  aria-label="Delete expense"
                  className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!monthKind} onClose={() => setMonthKind(null)} title={monthKind === "affiliate" ? "Affiliate month" : "AdSense month"}>
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-ink-3">
            {monthKind === "affiliate"
              ? "Enter the month's total Impact Radius commissions. Re-entering a month updates it. Or add your Impact credentials in Settings and months sync automatically."
              : "Copy the monthly estimated revenue from YouTube Studio → Analytics → Revenue. Re-entering a month updates it. Or set up Google OAuth in Settings and months sync automatically."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Month">
              <input type="month" className={inputCls} value={monthForm.month} onChange={(e) => setMonthForm({ ...monthForm, month: e.target.value })} />
            </Field>
            <Field label="Amount (USD)">
              <input className={inputCls} inputMode="decimal" value={monthForm.amount} onChange={(e) => setMonthForm({ ...monthForm, amount: e.target.value })} placeholder="1240.55" autoFocus />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <TextButton onClick={() => setMonthKind(null)}>Cancel</TextButton>
            <PrimaryButton onClick={saveMonth}>Save</PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={addExpense} onClose={() => setAddExpense(false)} title="Log expense">
        <div className="space-y-3">
          <Field label="Description">
            <input className={inputCls} value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="Editor invoice, gear, software…" autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount (USD)">
              <input className={inputCls} inputMode="decimal" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} placeholder="250" />
            </Field>
            <Field label="Date">
              <input type="date" className={inputCls} value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} />
            </Field>
            <Field label="Category">
              <input className={inputCls} value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} placeholder="editing" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <TextButton onClick={() => setAddExpense(false)}>Cancel</TextButton>
            <PrimaryButton onClick={saveExpense}>Save</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MonthList({
  kind,
  title,
  total,
  rows,
  onRemove,
}: {
  kind: "adsense" | "affiliate";
  title: string;
  total: number;
  rows: MonthRow[];
  onRemove: (kind: "adsense" | "affiliate", id: number) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} hint={fmtMoney(total)} />
      <ul className="space-y-1 px-5 pb-4">
        {rows.map((r) => (
          <li key={r.id} className="group flex items-center gap-3 text-sm">
            <span className="flex-1">
              {new Date(`${r.month}-15`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <span className="tabular-nums text-ink-2">{fmtMoney(r.amount)}</span>
            <button
              onClick={() => onRemove(kind, r.id)}
              aria-label={`Delete ${title} month`}
              className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
