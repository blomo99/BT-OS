"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Metrics from "@/components/Metrics";
import Deals from "@/components/Deals";
import ContentPipeline from "@/components/ContentPipeline";
import RevenuePanel from "@/components/RevenuePanel";
import { Card, CardHeader, Skeleton, TextButton, fmtMoney } from "@/components/ui";

type Alert = { id: string; severity: string; text: string; href: string; action: string };
type RevenueSummary = {
  totalCollected: number;
  outstanding: number;
  pipeline: number;
  contracted: number;
  netCollected: number;
};

const SEVERITY_DOT: Record<string, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-ink-3",
};

/**
 * One consolidated Business page: live metrics → attention + revenue at a
 * glance → content board → brand deals. Sidebar sub-items jump to sections.
 */
export default function BusinessTab() {
  const params = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [showFullRevenue, setShowFullRevenue] = useState(false);

  const load = useCallback(() => {
    fetch("/api/alerts").then((r) => r.json()).then((j) =>
      setAlerts((j.alerts as Alert[]).filter((a) => !a.id.startsWith("tasks-")))
    );
    fetch(`/api/revenue?year=${new Date().getFullYear()}`)
      .then((r) => r.json())
      .then((j) => setRevenue(j.summary));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("btos:data-changed", load);
    return () => window.removeEventListener("btos:data-changed", load);
  }, [load]);

  // legacy links (?tab=content / ?tab=deals / #content / #deals) scroll to the section
  useEffect(() => {
    const target = params.get("tab") ?? window.location.hash.replace("#", "");
    const key =
      target === "content" || target === "ideas"
        ? "content"
        : ["deals", "sponsorships", "revenue"].includes(target ?? "")
          ? "deals"
          : null;
    if (key) {
      setTimeout(() => document.getElementById(key)?.scrollIntoView({ behavior: "smooth" }), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revStats: { label: string; value: number | undefined; tone?: string }[] = [
    { label: "Collected", value: revenue?.totalCollected, tone: "text-good" },
    { label: "Outstanding", value: revenue?.outstanding, tone: revenue?.outstanding ? "text-warn" : undefined },
    { label: "Contracted", value: revenue?.contracted },
    { label: "Pipeline", value: revenue?.pipeline },
    { label: "Net", value: revenue?.netCollected, tone: "text-good" },
  ];

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-5">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Business</p>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      </header>

      {/* live audience metrics */}
      <Metrics />

      {/* attention (compact) + revenue at a glance */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader title="Needs attention" hint={alerts?.length ? `${alerts.length}` : undefined} />
          {!alerts ? (
            <Skeleton rows={2} />
          ) : alerts.length === 0 ? (
            <p className="px-5 pb-4 text-xs text-ink-2">All clear — nothing is due soon.</p>
          ) : (
            <ul className="space-y-0.5 px-5 pb-4">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="group flex items-center gap-2 rounded-md px-2 py-1 -mx-2 hover:bg-card-2 transition-colors">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} />
                    <span className="flex-1 truncate text-[12.5px] leading-snug">{a.text}</span>
                  </Link>
                </li>
              ))}
              {alerts.length > 4 && (
                <li className="px-2 text-[11px] text-ink-3">+{alerts.length - 4} more</li>
              )}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader
            title="Revenue"
            hint="this year"
            right={
              <TextButton onClick={() => setShowFullRevenue(!showFullRevenue)}>
                {showFullRevenue ? "Hide details" : "Details →"}
              </TextButton>
            }
          />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 pb-4 sm:grid-cols-5">
            {revStats.map((s) => (
              <div key={s.label}>
                <p className={`text-lg font-semibold tabular-nums ${s.tone ?? ""}`}>
                  {revenue ? fmtMoney(s.value ?? 0) : "—"}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {showFullRevenue && (
        <div className="fade-up">
          <RevenuePanel />
        </div>
      )}

      {/* content production */}
      <section id="content" className="scroll-mt-6">
        <ContentPipeline />
      </section>

      {/* sponsorships */}
      <section id="deals" className="scroll-mt-6">
        <Deals />
      </section>
    </div>
  );
}
