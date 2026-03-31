"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Sidebar } from "@/components/ui/Sidebar";
import { Spinner } from "@/components/ui/Spinner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cs-bg flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </>
  );
}
