import { NextResponse } from "next/server";
import { computeAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ alerts: computeAlerts() });
}
