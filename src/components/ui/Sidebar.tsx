"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  LayoutDashboard, FileInput, Mic2, Settings,
  Users, LogOut, FolderOpen, Building2, CalendarSearch,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { profile, isAdmin, signOut } = useAuth();

  const submissionsLabel = isAdmin ? "My Submissions" : "My Projects";
  const mainItems: { label: string; href: string; icon: React.ElementType }[] = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: submissionsLabel, href: "/submissions", icon: FolderOpen },
    { label: "Voice Preview", href: "/voice-preview", icon: Mic2 },
  ];
  if (isAdmin) mainItems.splice(1, 0, { label: "Onboarding", href: "/onboarding", icon: FileInput });

  const NAV_SECTIONS = [
    {
      label: "MAIN",
      items: mainItems,
    },
    ...(isAdmin
      ? [
          {
            label: "TOOLS",
            items: [
              { label: "Event Scraper", href: "/tools/event-scraper", icon: CalendarSearch },
            ],
          },
          {
            label: "ADMIN",
            items: [
              { label: "Accounts", href: "/admin/accounts", icon: Building2 },
              { label: "All Submissions", href: "/admin/submissions", icon: FolderOpen },
              { label: "Users", href: "/admin/users", icon: Users },
              { label: "Settings", href: "/settings", icon: Settings },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-cs-bg border-r border-cs-border flex flex-col z-50">
      <div className="px-5 pt-5 pb-4">
        <img src="/logo.png" alt="Call Stream AI" className="h-8 w-auto object-contain" />
      </div>

      <div className="mx-3 mb-4 px-3 py-2.5 bg-cs-card rounded-md border border-cs-border">
        <p className="cs-label text-[10px]">ACCOUNT</p>
        <p className="text-sm text-cs-text-primary mt-0.5 truncate">
          {profile?.company_name || profile?.full_name || "Call Stream AI"}
        </p>
        {isAdmin && (
          <span className="cs-badge bg-cs-accent-purple/10 text-cs-accent-purple mt-1">ADMIN</span>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="cs-label text-[10px] px-3 mb-1.5">{section.label}</p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={isActive ? "cs-sidebar-item-active" : "cs-sidebar-item"}>
                  <Icon size={16} />{item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-cs-border space-y-1">
        <div className="px-3 py-1.5">
          <p className="text-xs text-cs-text-primary truncate">{profile?.full_name || "User"}</p>
          <p className="text-[10px] text-cs-text-muted truncate">{profile?.email}</p>
        </div>
        <button onClick={signOut} className="cs-sidebar-item w-full text-cs-accent-red/70 hover:text-cs-accent-red">
          <LogOut size={16} />Sign out
        </button>
      </div>
    </aside>
  );
}
