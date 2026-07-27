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

export default async function ScriptDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getDb()
    .prepare(
      `SELECT c.id, c.title, c.format, c.status, c.hook, c.tags, c.script, c.target_date,
              d.brand AS sponsor_brand
       FROM content_items c
       LEFT JOIN deals d ON d.id = c.deal_id
       WHERE c.id = ?`
    )
    .get(Number(id)) as Item | undefined;

  const html = item?.script ? scriptTextToHTML(item.script) : "";

  return (
    <div className="doc-root">
      <style>{DOC_PRINT_CSS}</style>

      <PrintToolbar found={!!item} />

      <div className="doc-page">
        {!item ? (
          <p className="doc-empty">Script not found — the idea may have been deleted.</p>
        ) : (
          <>
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
              <p className="doc-empty">No script written yet — open the idea on the content board and draft one (or hit Generate with AI).</p>
            ) : (
              <div className="script-html" dangerouslySetInnerHTML={{ __html: html }} />
            )}

            <p className="doc-footer">
              @CyberWithBen · exported {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
