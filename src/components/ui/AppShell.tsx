"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Sidebar } from "@/components/ui/Sidebar";
import { Spinner } from "@/components/ui/Spinner";
import NotificationBell from "@/components/project/NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cs-bg flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <>
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="lg:ml-56 min-h-screen min-w-0">
        {/* Global top bar with notification bell */}
        <div className="flex items-center justify-between lg:justify-end px-5 sm:px-8 py-4 border-b border-cs-border/50">
          <button className="cs-btn-secondary lg:hidden" aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={18} />Menu</button>
          {user && <NotificationBell userId={user.id} />}
        </div>
        <div className="p-5 sm:p-8">{children}</div>
      </main>
    </>
  );
}
