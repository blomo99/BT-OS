/**
 * Word-style document rendering for content scripts — shared between the
 * single-idea export (`/script/[id]`) and the bulk export (`/script/export`),
 * and between those pages and the Script rich-text editor on the content
 * board, so all three treat formatting identically.
 */

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "para"; text: string };

/** Parses a plain-text script (AI drafts, or anything typed before the
 *  Script field became rich text) into structured blocks: ALL-CAPS or
 *  "#"-prefixed lines become headings, "[bracketed]" lines become cues,
 *  everything else is a paragraph. */
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** **bold** / *italic* markdown → real tags, applied after escaping so the
 *  tags this inserts can't collide with escaped user text. */
function inlineMarkdownToHTML(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function blocksToHTML(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.kind === "heading") return `<h2>${inlineMarkdownToHTML(b.text)}</h2>`;
      if (b.kind === "cue") return `<p><em>${inlineMarkdownToHTML(b.text)}</em></p>`;
      return `<p>${inlineMarkdownToHTML(b.text)}</p>`;
    })
    .join("");
}

const HAS_TAGS = /<[a-z][\s\S]*>/i;

/** Idempotent: real Tiptap HTML passes through untouched; plain text (AI
 *  drafts, anything written before the Script field became rich text) gets
 *  parsed and upgraded into real headings/bold/italic. Both the editor and
 *  the export pages call this, so older scripts self-upgrade the moment
 *  they're opened or exported — no migration step needed. */
export function scriptTextToHTML(text: string): string {
  if (!text.trim()) return "";
  if (HAS_TAGS.test(text)) return text;
  return blocksToHTML(parseScript(text));
}

/** document view is always light, regardless of app theme. `.doc-page` is
 *  reused per-item in the bulk export, with a page-break between each.
 *  `.script-html` scopes the injected rich-text body so its generic h1-h3
 *  rules can't collide with `.doc-title` (also an h1, styled very
 *  differently) sitting outside that wrapper. */
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
  .doc-hook { font-size: 11pt; font-style: italic; margin: 0 0 9pt; }
  .doc-footer { font-size: 9pt; color: #888; margin-top: 28pt; border-top: 1px solid #ddd; padding-top: 8pt; }
  .doc-empty { font-size: 11pt; color: #666; font-style: italic; }
  .script-html h1, .script-html h2, .script-html h3 {
    font-weight: 700; margin: 16pt 0 5pt; letter-spacing: 0.02em;
  }
  .script-html h1 { font-size: 15pt; }
  .script-html h2 { font-size: 13pt; }
  .script-html h3 { font-size: 12pt; }
  .script-html p { font-size: 11pt; line-height: 1.5; margin: 0 0 9pt; }
  .script-html strong { font-weight: 700; }
  .script-html em { font-style: italic; }
  .script-html u { text-decoration: underline; }
  @page { margin: 0.75in; }
  @media print {
    body { background: #fff !important; }
    .doc-page { box-shadow: none; margin: 0 auto; padding: 0; min-height: 0; max-width: none; break-after: page; }
    .doc-page:last-child { break-after: auto; }
    .doc-toolbar { display: none; }
  }
`;
