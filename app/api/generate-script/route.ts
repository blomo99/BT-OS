import { NextRequest, NextResponse } from "next/server";
import { generateScript } from "@/lib/strategist";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // long-form scripts take a while

// POST /api/generate-script — { title, format, hook?, notes?, tags? } → { script } | { error }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const format = body.format === "long" ? "long" : "short";
  if (!title) return NextResponse.json({ error: "Give the idea a title first." }, { status: 400 });

  const result = await generateScript({
    title,
    format,
    hook: typeof body.hook === "string" ? body.hook : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    tags: typeof body.tags === "string" ? body.tags : null,
  });
  if ("error" in result) {
    const msg =
      result.error === "no_key"
        ? "Add your Anthropic API key in Settings to generate scripts."
        : result.error;
    return NextResponse.json({ error: msg }, { status: result.error === "no_key" ? 400 : 502 });
  }
  return NextResponse.json(result);
}
