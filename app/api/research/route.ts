import { NextRequest, NextResponse } from "next/server";
import { getResearch } from "@/lib/research";
import { getStrategist } from "@/lib/strategist";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // strategist may call Claude

// GET /api/research?refresh=1 — trending ideas + top niche videos + video concepts
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const data = await getResearch(force);
  const strategist = await getStrategist(data, force);
  return NextResponse.json({ ...data, strategist });
}
