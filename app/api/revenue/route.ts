import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { todayStr } from "@/lib/format";
import { syncAdsense, adsenseState } from "@/lib/googleAuth";
import { syncImpact, impactState } from "@/lib/impact";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = ["lead", "contacted", "negotiating"];
const CONTRACTED_STAGES = [
  "contracted", "in_production", "submitted", "revision", "approved", "scheduled", "published", "invoiced",
];

type DealRow = {
  id: number;
  brand: string;
  campaign: string | null;
  status: string;
  price: number | null;
  agency_fee: number | null;
  invoice_status: string;
  invoice_date: string | null;
  payment_due: string | null;
  payment_received: string | null;
  ref_date: string | null;
};

/**
 * GET /api/revenue?year=2026&quarter=3&month=7&brand=X
 * Buckets are kept strictly separate: pipeline / contracted / invoiced /
 * collected are different lifecycle stages of money, never summed together.
 * Deals are placed in a period by their most-final known date
 * (payment > invoice > due > created).
 */
export async function GET(req: NextRequest) {
  await syncAdsense(); // no-op unless Google OAuth is connected (6h TTL)
  await syncImpact(); // no-op unless Impact credentials are set (6h TTL)
  const db = getDb();
  const today = todayStr();
  const year = req.nextUrl.searchParams.get("year");
  const quarter = req.nextUrl.searchParams.get("quarter");
  const month = req.nextUrl.searchParams.get("month");
  const brand = req.nextUrl.searchParams.get("brand");

  let deals = db
    .prepare(
      `SELECT id, brand, campaign, status, price, agency_fee, invoice_status,
              invoice_date, payment_due, payment_received,
              COALESCE(payment_received, invoice_date, due_date, substr(created_at,1,10)) AS ref_date
       FROM deals`
    )
    .all() as DealRow[];

  const inPeriod = (dateStr: string | null): boolean => {
    if (!dateStr) return !year; // undated only shows in "all time"
    if (year && dateStr.slice(0, 4) !== year) return false;
    if (month) return Number(dateStr.slice(5, 7)) === Number(month);
    if (quarter) return Math.ceil(Number(dateStr.slice(5, 7)) / 3) === Number(quarter);
    return true;
  };

  deals = deals.filter((d) => inPeriod(d.ref_date) && (!brand || d.brand === brand));

  const net = (d: DealRow) => (d.price ?? 0) - (d.agency_fee ?? 0);
  const sum = (rows: DealRow[]) => rows.reduce((s, d) => s + net(d), 0);

  const pipeline = deals.filter((d) => PIPELINE_STAGES.includes(d.status));
  const contracted = deals.filter((d) => CONTRACTED_STAGES.includes(d.status));
  const invoiced = deals.filter((d) => d.invoice_status !== "not_sent" || d.status === "paid");
  const collected = deals.filter((d) => d.payment_received || d.status === "paid");
  const outstanding = deals.filter(
    (d) => d.invoice_status === "sent" && !d.payment_received && d.status !== "paid"
  );
  const overdue = outstanding.filter((d) => d.payment_due && d.payment_due < today);
  const expected = deals.filter(
    (d) => CONTRACTED_STAGES.includes(d.status) && !d.payment_received
  );

  let expenses = db
    .prepare("SELECT * FROM expenses ORDER BY date DESC")
    .all() as { id: number; description: string; amount: number; date: string; category: string | null }[];
  expenses = expenses.filter((e) => inPeriod(e.date));
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // AdSense months (manually logged from YouTube Studio)
  let adsense = db
    .prepare("SELECT * FROM adsense ORDER BY month DESC")
    .all() as { id: number; month: string; amount: number }[];
  adsense = adsense.filter((a) => inPeriod(`${a.month}-01`));
  const adsenseTotal = adsense.reduce((s, a) => s + a.amount, 0);

  // Impact Radius affiliate months
  let affiliate = db
    .prepare("SELECT * FROM affiliate ORDER BY month DESC")
    .all() as { id: number; month: string; amount: number }[];
  affiliate = affiliate.filter((a) => inPeriod(`${a.month}-01`));
  const affiliateTotal = affiliate.reduce((s, a) => s + a.amount, 0);

  const brands = [...new Set(
    (db.prepare("SELECT DISTINCT brand FROM deals ORDER BY brand").all() as { brand: string }[]).map((b) => b.brand)
  )];

  return NextResponse.json({
    summary: {
      pipeline: sum(pipeline),
      pipelineCount: pipeline.length,
      contracted: sum(contracted),
      contractedCount: contracted.length,
      invoiced: sum(invoiced),
      collected: sum(collected),
      outstanding: sum(outstanding),
      outstandingCount: outstanding.length,
      overdue: sum(overdue),
      overdueCount: overdue.length,
      expected: sum(expected),
      expenses: expenseTotal,
      adsense: adsenseTotal,
      affiliate: affiliateTotal,
      // total cash in: paid sponsorships + AdSense + affiliate commissions
      totalCollected: sum(collected) + adsenseTotal + affiliateTotal,
      netCollected: sum(collected) + adsenseTotal + affiliateTotal - expenseTotal,
    },
    deals: deals
      .filter((d) => d.price)
      .sort((a, b) => (b.ref_date ?? "").localeCompare(a.ref_date ?? "")),
    expenses,
    adsense,
    affiliate,
    adsenseSync: adsenseState(),
    impactSync: impactState(),
    brands,
  });
}

// POST /api/revenue — log a business expense, an AdSense month, or an
// affiliate month. { type: "adsense"|"affiliate", month: "YYYY-MM", amount }
// upserts that month.
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (b.type === "adsense" || b.type === "affiliate") {
    if (!/^\d{4}-\d{2}$/.test(b.month ?? "") || typeof b.amount !== "number") {
      return NextResponse.json({ error: "month (YYYY-MM) and amount required" }, { status: 400 });
    }
    const table = b.type === "adsense" ? "adsense" : "affiliate";
    getDb()
      .prepare(
        `INSERT INTO ${table} (month, amount) VALUES (?, ?)
         ON CONFLICT(month) DO UPDATE SET amount = excluded.amount`
      )
      .run(b.month, b.amount);
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (!b.description?.trim() || typeof b.amount !== "number") {
    return NextResponse.json({ error: "description and amount required" }, { status: 400 });
  }
  const info = getDb()
    .prepare("INSERT INTO expenses (description, amount, date, category) VALUES (?, ?, ?, ?)")
    .run(b.description.trim(), b.amount, b.date ?? todayStr(), b.category || null);
  return NextResponse.json({ id: info.lastInsertRowid }, { status: 201 });
}

// DELETE /api/revenue?id=N | ?adsense_id=N | ?affiliate_id=N
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const adsenseId = req.nextUrl.searchParams.get("adsense_id");
  const affiliateId = req.nextUrl.searchParams.get("affiliate_id");
  if (adsenseId) {
    getDb().prepare("DELETE FROM adsense WHERE id = ?").run(adsenseId);
  } else if (affiliateId) {
    getDb().prepare("DELETE FROM affiliate WHERE id = ?").run(affiliateId);
  } else {
    getDb().prepare("DELETE FROM expenses WHERE id = ?").run(id);
  }
  return NextResponse.json({ ok: true });
}
