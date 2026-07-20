"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ensureHTML } from "@/lib/richText";

/**
 * Notion-style notes editor: type "# "/"## "/"### " for headings, "**text**"
 * or ⌘B for bold, "*text*" or ⌘I for italic, ⌘U for underline (Notion has no
 * markdown shortcut for underline either — matches its own behavior).
 */
export default function RichTextEditor({
  content,
  onChange,
  placeholder,
  minHeight = "35vh",
  autoFocus = false,
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    // avoids a Tiptap/Next.js SSR hydration warning on mount
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // exactly the formatting asked for — headings, bold, italic,
        // underline — nothing else the board doesn't need
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: ensureHTML(content),
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "richtext-body",
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: (ctx) =>
      ctx.editor
        ? {
            bold: ctx.editor.isActive("bold"),
            italic: ctx.editor.isActive("italic"),
            underline: ctx.editor.isActive("underline"),
            h1: ctx.editor.isActive("heading", { level: 1 }),
            h2: ctx.editor.isActive("heading", { level: 2 }),
            h3: ctx.editor.isActive("heading", { level: 3 }),
          }
        : null,
  });

  if (!editor) {
    return <div className="rounded-lg border border-line bg-card-2" style={{ minHeight: `calc(${minHeight} + 2.25rem)` }} />;
  }

  const btnCls = (active: boolean | undefined) =>
    `flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[12px] transition-colors ${
      active ? "bg-accent-soft text-accent-2" : "text-ink-2 hover:bg-card-3 hover:text-ink"
    }`;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card-2 focus-within:border-line-2">
      <div className="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
        <button type="button" title="Heading 1 (# )" className={`${btnCls(state?.h1)} font-semibold`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </button>
        <button type="button" title="Heading 2 (## )" className={`${btnCls(state?.h2)} font-semibold`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" title="Heading 3 (### )" className={`${btnCls(state?.h3)} font-semibold`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" title="Bold (⌘B or **text**)" className={`${btnCls(state?.bold)} font-bold`} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" title="Italic (⌘I or *text*)" className={`${btnCls(state?.italic)} italic`} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button type="button" title="Underline (⌘U)" className={`${btnCls(state?.underline)} underline`} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
