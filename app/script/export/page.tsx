import { getDb } from "@/lib/db";
import { DOC_PRINT_CSS, DocHeader, scriptTextToHTML } from "@/lib/scriptDoc";
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
  sponsor_brand: string | null;
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
        `SELECT c.id, c.title, c.format, c.status, c.hook, c.tags, c.script, c.target_date,
                d.brand AS sponsor_brand
         FROM content_items c
         LEFT JOIN deals d ON d.id = c.deal_id
         WHERE c.id IN (${placeholders})`
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
          const html = item.script ? scriptTextToHTML(item.script) : "";
          return (
            <div key={item.id} className="doc-page">
              <DocHeader
                meta={{
                  title: item.title,
                  format: item.format,
                  targetDate: item.target_date,
                  tags: item.tags,
                  sponsorBrand: item.sponsor_brand,
                  hook: item.hook,
                }}
              />

              {!html ? (
                <p className="doc-empty">No script written for this idea.</p>
              ) : (
                <div className="script-html" dangerouslySetInnerHTML={{ __html: html }} />
              )}
            </div>
          );
        })
      )}

      {items.length > 0 && (
        <p style={{ maxWidth: "8.5in", margin: "8px auto 24px", fontSize: 9, color: "#888", textAlign: "right" }}>
          @CyberWithBen · {items.length} script{items.length > 1 ? "s" : ""} · exported{" "}
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
