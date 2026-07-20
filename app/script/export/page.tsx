import { getDb } from "@/lib/db";
import { DOC_PRINT_CSS, ScriptBlocks, parseScript } from "@/lib/scriptDoc";
import PrintToolbar from "../PrintToolbar";

export const dynamic = "force-dynamic";

type Item = {
  id: number;
  title: string;
  format: string;
  status: string;
  hook: string | null;
  tags: string | null;
  script: string | null;
  target_date: string | null;
};

// GET /script/export?ids=3,7,12 — every listed idea's script as one printable
// document, in the order given, each on its own page.
export default async function ScriptBulkExportPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  let items: Item[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `SELECT id, title, format, status, hook, tags, script, target_date
         FROM content_items WHERE id IN (${placeholders})`
      )
      .all(...ids) as Item[];
    // preserve the caller's order (board order), not SQLite's IN() order
    const byId = new Map(rows.map((r) => [r.id, r]));
    items = ids.map((id) => byId.get(id)).filter((r): r is Item => !!r);
  }

  return (
    <div className="doc-root">
      <style>{DOC_PRINT_CSS}</style>

      <PrintToolbar found={items.length > 0} />

      {items.length === 0 ? (
        <div className="doc-page">
          <p className="doc-empty">
            Nothing to export — go back to the content board, pick some scripted ideas, and hit
            &quot;Export scripts&quot; again.
          </p>
        </div>
      ) : (
        items.map((item) => {
          const fmtLabel = item.format === "long" ? "Long-form video script" : "Short-form video script";
          const blocks = item.script ? parseScript(item.script) : [];
          return (
            <div key={item.id} className="doc-page">
              <h1 className="doc-title">{item.title}</h1>
              <p className="doc-meta">
                {fmtLabel}
                {item.target_date ? ` · Target: ${item.target_date}` : ""}
                {item.tags ? ` · ${item.tags}` : ""}
                {" · @CyberWithBen"}
              </p>
              <hr className="doc-rule" />

              {item.hook && (
                <>
                  <h2 className="doc-h2">Hook</h2>
                  <p className="doc-hook">“{item.hook}”</p>
                </>
              )}

              {blocks.length === 0 ? (
                <p className="doc-empty">No script written for this idea.</p>
              ) : (
                <ScriptBlocks blocks={blocks} />
              )}
            </div>
          );
        })
      )}

      {items.length > 0 && (
        <p style={{ maxWidth: "8.5in", margin: "8px auto 24px", fontSize: 9, color: "#888", textAlign: "right" }}>
          BT OS · {items.length} script{items.length > 1 ? "s" : ""} · exported{" "}
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
