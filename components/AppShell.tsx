"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
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
      <Suspense fallback={<aside className="sticky top-0 hidden h-screen w-52 shrink-0 border-r border-line bg-[#0d0e11] md:block" />}>
        <Sidebar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCapture={() => setCaptureOpen(true)}
        />
      </Suspense>
      <main
        className="min-w-0 flex-1 px-6 py-6 lg:px-8 max-md:px-3 max-md:pb-[calc(6rem+env(safe-area-inset-bottom))]"
        style={{ paddingTop: "max(1.5rem, calc(0.75rem + env(safe-area-inset-top)))" }}
      >
        {children}
      </main>

      <Suspense>
        <MobileTabBar
          onOpenCapture={() => setCaptureOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </Suspense>

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
