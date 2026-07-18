"use client";

export default function PrintToolbar({ found }: { found: boolean }) {
  return (
    <div className="doc-toolbar" style={{ maxWidth: "8.5in", margin: "16px auto 0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
      {found && (
        <button
          onClick={() => window.print()}
          style={{
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save as PDF
        </button>
      )}
      <button
        onClick={() => window.close()}
        style={{
          background: "#fff",
          color: "#333",
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: "8px 16px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  );
}
