"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Field,
  inputCls,
  Skeleton,
  TextButton,
  PrimaryButton,
  fmtMoney,
  fmtRelativeDay,
  toDateStr,
} from "@/components/ui";

export type Deal = {
  id: number;
  brand: string;
  campaign: string | null;
  price: number | null;
  agency_fee: number | null;
  due_date: string | null;
  publish_date: string | null;
  status: string;
  contract_status: string;
  invoice_status: string;
  invoice_date: string | null;
  payment_due: string | null;
  payment_received: string | null;
  next_action: string | null;
  deliverables: string | null;
  poc_name: string | null;
  poc_email: string | null;
  notes: string | null;
  file_count: number;
};

type DealFile = { id: number; original_name: string; size: number };

export const STAGES = [
  { key: "lead", label: "Lead", cls: "text-ink-2 bg-card-3", dot: "bg-ink-3" },
  { key: "contacted", label: "Contacted", cls: "text-ink-2 bg-card-3", dot: "bg-ink-2" },
  { key: "negotiating", label: "Negotiating", cls: "text-warn bg-warn-soft", dot: "bg-warn" },
  { key: "contracted", label: "Contracted", cls: "text-accent-2 bg-accent-soft", dot: "bg-accent" },
  { key: "in_production", label: "In production", cls: "text-accent-2 bg-accent-soft", dot: "bg-accent" },
  { key: "submitted", label: "Submitted", cls: "text-accent-2 bg-accent-soft", dot: "bg-accent" },
  { key: "revision", label: "Revision requested", cls: "text-warn bg-warn-soft", dot: "bg-warn" },
  { key: "approved", label: "Approved", cls: "text-good bg-good-soft", dot: "bg-good" },
  { key: "scheduled", label: "Scheduled", cls: "text-good bg-good-soft", dot: "bg-good" },
  { key: "published", label: "Published", cls: "text-good bg-good-soft", dot: "bg-good" },
  { key: "invoiced", label: "Invoiced", cls: "text-good bg-good-soft", dot: "bg-good" },
  { key: "paid", label: "Paid", cls: "text-good bg-good-soft", dot: "bg-good" },
  { key: "lost", label: "Lost", cls: "text-ink-3 bg-card-2", dot: "bg-ink-3" },
] as const;

const stageMeta = (key: string) => STAGES.find((s) => s.key === key) ?? STAGES[0];

/** the obvious next step for a deal in this stage, used when none is set */
// deliverables are a fixed menu; stored as "2× Short-form video + 1× Dedicated video"
const DELIVERABLE_TYPES = ["Long-form integration", "Short-form video", "Dedicated video"] as const;

function parseDeliverables(s: string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of DELIVERABLE_TYPES) {
    const m = s?.match(new RegExp(`(\\d+)\\s*[×x]\\s*${t}`, "i"));
    if (m) out[t] = Number(m[1]);
  }
  return out;
}

function serializeDeliverables(counts: Record<string, number>): string {
  return DELIVERABLE_TYPES.filter((t) => (counts[t] ?? 0) > 0)
    .map((t) => `${counts[t]}× ${t}`)
    .join(" + ");
}

const SUGGESTED_ACTION: Record<string, string> = {
  lead: "Reach out with rates",
  contacted: "Follow up on intro",
  negotiating: "Agree on scope & price",
  contracted: "Set content due date & start production",
  in_production: "Finish and submit deliverable",
  submitted: "Chase approval",
  revision: "Apply requested changes",
  approved: "Schedule the post",
  scheduled: "Publish on schedule",
  published: "Send invoice",
  invoiced: "Confirm payment received",
};

export default function Deals() {
  const params = useSearchParams();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Deal | "new" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/deals");
    const json = await res.json();
    setDeals(json.deals);
    return json.deals as Deal[];
  }, []);

  useEffect(() => {
    load().then((ds) => {
      const openId = params.get("deal");
      if (openId) {
        const d = ds.find((x) => x.id === Number(openId));
        if (d) setEditing(d);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStage = async (deal: Deal, status: string) => {
    setDeals((ds) => (ds ?? []).map((d) => (d.id === deal.id ? { ...d, status } : d)));
    await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const visible = (deals ?? []).filter((d) =>
    showClosed ? true : !["paid", "lost"].includes(d.status)
  );
  const active = (deals ?? []).filter((d) => !["paid", "lost", "lead", "contacted"].includes(d.status));
  const activeValue = active.reduce((s, d) => s + ((d.price ?? 0) - (d.agency_fee ?? 0)), 0);
  const today = toDateStr(new Date());

  return (
    <Card>
      <CardHeader
        title="Sponsorships"
        hint={active.length ? `${active.length} active · ${fmtMoney(activeValue)} net` : undefined}
        right={
          <div className="flex items-center gap-2">
            {(deals ?? []).some((d) => ["paid", "lost"].includes(d.status)) && (
              <TextButton onClick={() => setShowClosed(!showClosed)}>
                {showClosed ? "Hide closed" : "Show closed"}
              </TextButton>
            )}
            <PrimaryButton onClick={() => setEditing("new")} className="!py-1">
              + New deal
            </PrimaryButton>
          </div>
        }
      />

      <div className="px-5 pb-5">
        {!deals ? (
          <Skeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No deals in play"
            body="Track every sponsorship from first contact to paid invoice — with a clear next action at each stage."
            action={<TextButton className="border border-line" onClick={() => setEditing("new")}>Add your first deal</TextButton>}
          />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-3">
                  <th className="pb-2 pr-4 font-medium">Brand</th>
                  <th className="pb-2 pr-4 font-medium">Stage</th>
                  <th className="pb-2 pr-4 font-medium">Next action</th>
                  <th className="pb-2 pr-4 font-medium text-right">Net</th>
                  <th className="pb-2 pr-4 font-medium">Due</th>
                  <th className="pb-2 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const net = (d.price ?? 0) - (d.agency_fee ?? 0);
                  const overdue =
                    d.due_date && d.due_date < today &&
                    !["submitted", "approved", "scheduled", "published", "invoiced", "paid", "lost"].includes(d.status);
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setEditing(d)}
                      className="cursor-pointer border-b border-line/50 last:border-0 hover:bg-card-2 transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-ink">{d.brand}</span>
                        {d.campaign && <span className="ml-1.5 text-xs text-ink-3">{d.campaign}</span>}
                      </td>
                      <td className="py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
                        <StagePill deal={d} onChange={(s) => setStage(d, s)} />
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 pr-4 text-xs">
                        {d.next_action ? (
                          <span className="text-ink-2">{d.next_action}</span>
                        ) : ["paid", "lost"].includes(d.status) ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <span className="text-warn" title="No next action set — suggestion based on stage">
                            {SUGGESTED_ACTION[d.status] ?? "Define next action"} ?
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-ink-2">
                        {d.price ? fmtMoney(net) : "—"}
                      </td>
                      <td className={`py-2.5 pr-4 text-xs tabular-nums ${overdue ? "text-danger" : "text-ink-2"}`}>
                        {d.due_date ? fmtRelativeDay(d.due_date) : <span className="text-warn">not set</span>}
                      </td>
                      <td className="py-2.5 text-xs">
                        {d.invoice_status === "paid" || d.payment_received ? (
                          <span className="text-good">paid</span>
                        ) : d.invoice_status === "sent" ? (
                          <span className={d.payment_due && d.payment_due < today ? "text-danger" : "text-accent-2"}>
                            {d.payment_due && d.payment_due < today ? "overdue" : "sent"}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DealDrawer
        deal={editing}
        onClose={() => setEditing(null)}
        onChanged={() => {
          load();
          window.dispatchEvent(new Event("btos:data-changed"));
        }}
      />
    </Card>
  );
}

function StagePill({ deal, onChange }: { deal: Deal; onChange: (s: string) => void }) {
  const meta = stageMeta(deal.status);
  return (
    <div className="relative inline-block">
      <span className={`pointer-events-none absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${meta.dot}`} />
      <select
        value={deal.status}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-full py-0.5 pl-[22px] pr-6 text-[11px] font-medium cursor-pointer ${meta.cls}`}
        aria-label={`Stage for ${deal.brand}`}
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key} className="bg-card text-ink">{s.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50" width="8" height="8" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function DealDrawer({
  deal,
  onClose,
  onChanged,
}: {
  deal: Deal | "new" | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<DealFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deal) return;
    if (deal === "new") {
      setF({ status: "lead", contract_status: "none", invoice_status: "not_sent" });
      setFiles([]);
    } else {
      setF({
        brand: deal.brand,
        campaign: deal.campaign ?? "",
        status: deal.status,
        deliverables: deal.deliverables ?? "",
        price: deal.price?.toString() ?? "",
        agency_fee: deal.agency_fee?.toString() ?? "",
        contract_status: deal.contract_status,
        due_date: deal.due_date ?? "",
        publish_date: deal.publish_date ?? "",
        invoice_status: deal.invoice_status,
        invoice_date: deal.invoice_date ?? "",
        payment_due: deal.payment_due ?? "",
        payment_received: deal.payment_received?.slice(0, 10) ?? "",
        poc_name: deal.poc_name ?? "",
        poc_email: deal.poc_email ?? "",
        next_action: deal.next_action ?? "",
        notes: deal.notes ?? "",
      });
      fetch(`/api/deals/${deal.id}/files`).then((r) => r.json()).then((j) => setFiles(j.files));
    }
  }, [deal]);

  if (!deal) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const net = (Number(f.price) || 0) - (Number(f.agency_fee) || 0);

  const save = async () => {
    if (!f.brand?.trim()) return;
    const payload = {
      ...f,
      price: f.price ? Number(f.price.replace(/[^\d.]/g, "")) : null,
      agency_fee: f.agency_fee ? Number(f.agency_fee.replace(/[^\d.]/g, "")) : null,
    };
    if (deal === "new") {
      await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    onChanged();
    onClose();
  };

  const remove = async () => {
    if (deal !== "new" && confirm(`Delete the ${deal.brand} deal and its files?`)) {
      await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length || deal === "new") return;
    setUploading(true);
    const fd = new FormData();
    for (const file of Array.from(list)) fd.append("file", file);
    await fetch(`/api/deals/${deal.id}/files`, { method: "POST", body: fd });
    const res = await fetch(`/api/deals/${deal.id}/files`);
    setFiles((await res.json()).files);
    setUploading(false);
    onChanged();
  };

  const deleteFile = async (id: number) => {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    setFiles((fs) => fs.filter((x) => x.id !== id));
  };

  return (
    <Modal open onClose={onClose} title={deal === "new" ? "New deal" : (f.brand || "Deal")} wide>
      <div className="space-y-4">
        {/* identity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Brand">
            <input className={inputCls} value={f.brand ?? ""} onChange={set("brand")} autoFocus={deal === "new"} />
          </Field>
          <Field label="Campaign">
            <input className={inputCls} value={f.campaign ?? ""} onChange={set("campaign")} placeholder="Q3 integration" />
          </Field>
          <Field label="Stage">
            <select className={inputCls} value={f.status ?? "lead"} onChange={set("status")}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Next action">
          <input
            className={inputCls}
            value={f.next_action ?? ""}
            onChange={set("next_action")}
            placeholder={SUGGESTED_ACTION[f.status ?? ""] ?? "What moves this deal forward?"}
          />
        </Field>

        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Deliverables
          </span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {DELIVERABLE_TYPES.map((t) => {
              const counts = parseDeliverables(f.deliverables);
              const n = counts[t] ?? 0;
              const setCount = (next: number) => {
                const updated = { ...counts, [t]: Math.max(0, next) };
                setF((prev) => ({ ...prev, deliverables: serializeDeliverables(updated) }));
              };
              return (
                <label
                  key={t}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12.5px] transition-colors cursor-pointer ${
                    n > 0 ? "border-accent/40 bg-accent-soft/40 text-ink" : "border-line bg-card-2/40 text-ink-2 hover:border-line-2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={n > 0}
                    onChange={(e) => setCount(e.target.checked ? 1 : 0)}
                    className="accent-[#f5c518]"
                  />
                  <span className="min-w-0 flex-1 truncate">{t}</span>
                  {n > 0 && (
                    <input
                      type="number"
                      min={1}
                      value={n}
                      onChange={(e) => setCount(Number(e.target.value) || 1)}
                      onClick={(e) => e.preventDefault()}
                      className="w-12 rounded border border-line bg-card px-1.5 py-0.5 text-right text-[12px] tabular-nums"
                      aria-label={`${t} count`}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* money */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Gross (USD)">
            <input className={inputCls} inputMode="decimal" value={f.price ?? ""} onChange={set("price")} placeholder="3500" />
          </Field>
          <Field label="Agency fee">
            <input className={inputCls} inputMode="decimal" value={f.agency_fee ?? ""} onChange={set("agency_fee")} placeholder="0" />
          </Field>
          <Field label="Net">
            <div className={`${inputCls} !bg-transparent tabular-nums text-ink-2`}>{fmtMoney(net)}</div>
          </Field>
          <Field label="Contract">
            <select className={inputCls} value={f.contract_status ?? "none"} onChange={set("contract_status")}>
              <option value="none">Not sent</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
            </select>
          </Field>
        </div>

        {/* dates */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Content due">
            <input type="date" className={inputCls} value={f.due_date ?? ""} onChange={set("due_date")} />
          </Field>
          <Field label="Publish date">
            <input type="date" className={inputCls} value={f.publish_date ?? ""} onChange={set("publish_date")} />
          </Field>
          <Field label="POC name">
            <input className={inputCls} value={f.poc_name ?? ""} onChange={set("poc_name")} />
          </Field>
        </div>

        {/* invoicing */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Invoice">
            <select className={inputCls} value={f.invoice_status ?? "not_sent"} onChange={set("invoice_status")}>
              <option value="not_sent">Not sent</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Payment due">
            <input type="date" className={inputCls} value={f.payment_due ?? ""} onChange={set("payment_due")} />
          </Field>
          <Field label="Payment received">
            <input type="date" className={inputCls} value={f.payment_received ?? ""} onChange={set("payment_received")} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={f.notes ?? ""} onChange={set("notes")} placeholder="Usage rights, payment terms, exclusivity…" />
        </Field>

        {deal !== "new" && (
          <div className="border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Contracts & files</span>
              <TextButton onClick={() => fileInput.current?.click()}>
                {uploading ? "Uploading…" : "+ Attach"}
              </TextButton>
              <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </div>
            {files.length === 0 ? (
              <p className="text-xs text-ink-3">No files — attach agreements, briefs, invoices.</p>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => (
                  <li key={file.id} className="group flex items-center gap-2 text-sm">
                    <a href={`/api/files/${file.id}`} className="truncate text-ink hover:text-accent-2 transition-colors">
                      {file.original_name}
                    </a>
                    <span className="text-[11px] text-ink-3">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all"
                      aria-label="Delete file"
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-3">
          {deal !== "new" ? (
            <TextButton onClick={remove} className="!text-danger/80 hover:!text-danger">Delete deal</TextButton>
          ) : <span />}
          <div className="flex gap-2">
            <TextButton onClick={onClose}>Cancel</TextButton>
            <PrimaryButton onClick={save}>{deal === "new" ? "Create" : "Save"}</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
