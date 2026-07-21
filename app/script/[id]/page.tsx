import { getDb } from "@/lib/db";
import { DOC_PRINT_CSS, scriptTextToHTML } from "@/lib/scriptDoc";
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

export default async function ScriptDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getDb()
    .prepare("SELECT id, title, format, status, hook, tags, script, target_date FROM content_items WHERE id = ?")
    .get(Number(id)) as Item | undefined;

  const fmtLabel = item?.format === "long" ? "Long-form video script" : "Short-form video script";
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

            {!html ? (
              <p className="doc-empty">No script written yet — open the idea on the content board and draft one (or hit Generate with AI).</p>
            ) : (
              <div className="script-html" dangerouslySetInnerHTML={{ __html: html }} />
            )}

            <p className="doc-footer">
              BT OS · exported {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
