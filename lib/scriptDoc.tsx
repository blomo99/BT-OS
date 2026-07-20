/**
 * Word-style document rendering for content scripts — shared between the
 * single-idea export (`/script/[id]`) and the bulk export (`/script/export`)
 * so both produce identically formatted pages.
 */

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "para"; text: string };

export function parseScript(script: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "para", text: para.join(" ") });
    para = [];
  };
  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    // "HOOK: first line…" → heading + remainder as its own paragraph
    const prefix = line.match(/^([A-Z][A-Z0-9 /&-]{1,24}):\s+(\S.*)$/);
    if (prefix && prefix[1] === prefix[1].toUpperCase()) {
      flush();
      blocks.push({ kind: "heading", text: prefix[1] });
      para.push(prefix[2]);
      continue;
    }
    const isCue = /^\[.*\]$/.test(line);
    const bare = line.replace(/[^a-zA-Z]/g, "");
    const isHeading =
      !isCue &&
      line.length <= 70 &&
      bare.length >= 2 &&
      bare === bare.toUpperCase() &&
      /[A-Z]/.test(bare);
    const isMdHeading = /^#{1,3}\s+/.test(line);
    if (isHeading || isMdHeading) {
      flush();
      blocks.push({ kind: "heading", text: line.replace(/^#{1,3}\s+/, "").replace(/:$/, "") });
    } else if (isCue) {
      flush();
      blocks.push({ kind: "cue", text: line });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** minimal inline markdown: **bold** and *italic* from AI drafts */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function ScriptBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h2 key={i} className="doc-h2">
            <Inline text={b.text} />
          </h2>
        ) : b.kind === "cue" ? (
          <p key={i} className="doc-cue">
            <Inline text={b.text} />
          </p>
        ) : (
          <p key={i} className="doc-p">
            <Inline text={b.text} />
          </p>
        )
      )}
    </>
  );
}

/** document view is always light, regardless of app theme. `.doc-page` is
 *  reused per-item in the bulk export, with a page-break between each. */
export const DOC_PRINT_CSS = `
  body { background: #e8e8e8 !important; }
  .doc-root { font-family: Calibri, "Segoe UI", -apple-system, Helvetica, Arial, sans-serif; color: #111; }
  .doc-page {
    background: #fff; max-width: 8.5in; margin: 24px auto; padding: 1in;
    box-shadow: 0 2px 16px rgba(0,0,0,0.18); min-height: 11in;
  }
  .doc-title { font-size: 24pt; font-weight: 700; line-height: 1.15; margin: 0 0 4pt; }
  .doc-meta { font-size: 10pt; color: #555; margin: 0 0 6pt; }
  .doc-rule { border: none; border-top: 2px solid #111; margin: 10pt 0 16pt; }
  .doc-h2 { font-size: 13pt; font-weight: 700; margin: 16pt 0 5pt; letter-spacing: 0.02em; }
  .doc-p { font-size: 11pt; line-height: 1.5; margin: 0 0 9pt; }
  .doc-cue { font-size: 10pt; font-style: italic; color: #666; margin: 0 0 9pt; }
  .doc-hook { font-size: 11pt; font-style: italic; margin: 0 0 9pt; }
  .doc-footer { font-size: 9pt; color: #888; margin-top: 28pt; border-top: 1px solid #ddd; padding-top: 8pt; }
  .doc-empty { font-size: 11pt; color: #666; font-style: italic; }
  @page { margin: 0.75in; }
  @media print {
    body { background: #fff !important; }
    .doc-page { box-shadow: none; margin: 0 auto; padding: 0; min-height: 0; max-width: none; break-after: page; }
    .doc-page:last-child { break-after: auto; }
    .doc-toolbar { display: none; }
  }
`;
