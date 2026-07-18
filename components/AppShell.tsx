"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import CaptureModal from "@/components/CaptureModal";

export default function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  // global ⌘K / Ctrl+K → quick capture; components can request the settings modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    const onOpenSettings = () => setSettingsOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("btos:open-settings", onOpenSettings);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("btos:open-settings", onOpenSettings);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<aside className="sticky top-0 h-screen w-52 shrink-0 border-r border-line bg-[#0d0e11] max-md:w-14" />}>
        <Sidebar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCapture={() => setCaptureOpen(true)}
        />
      </Suspense>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8 max-md:px-3 max-md:py-4 max-md:pb-24">{children}</main>

      {/* phone: thumb-reachable quick capture (⌘K has no mobile equivalent) */}
      <button
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture"
        className="fixed bottom-5 right-5 z-40 hidden items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 active:scale-95 transition-transform max-md:flex"
        style={{ height: 52, width: 52 }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
        </svg>
      </button>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => window.dispatchEvent(new Event("btos:data-changed"))}
      />
      <CaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSaved={() => window.dispatchEvent(new Event("btos:data-changed"))}
      />
    </div>
  );
}
