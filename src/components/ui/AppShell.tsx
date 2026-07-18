"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Sidebar } from "@/components/ui/Sidebar";
import { Spinner } from "@/components/ui/Spinner";
import NotificationBell from "@/components/project/NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();

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
        {/* Global top bar with notification bell */}
        <div className="flex items-center justify-end px-8 pt-4 pb-0">
          {user && <NotificationBell userId={user.id} />}
        </div>
        <div className="p-8 pt-4">{children}</div>
      </main>
    </>
  );
}
