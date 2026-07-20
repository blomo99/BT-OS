/** Shared helpers for the rich-text (Tiptap) notes fields. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const HAS_TAGS = /<[a-z][\s\S]*>/i;

/**
 * Notes written before rich text existed (or via Quick Capture, which is
 * still a plain textarea) are bare strings. Tiptap expects HTML, so wrap
 * them into paragraphs first — otherwise blank lines collapse and the
 * editor shows one run-on line.
 */
export function ensureHTML(value: string): string {
  if (!value.trim()) return "";
  if (HAS_TAGS.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Plain-text preview for card lists — strip tags, collapse whitespace. */
export function htmlToPreviewText(html: string): string {
  return html
    .replace(/<\/(p|h[1-3]|li|br)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
