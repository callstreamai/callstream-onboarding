"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  LayoutDashboard,
  FileInput,
  Mic2,
  Settings,
  Users,
  LogOut,
  FolderOpen,
  Building2,
  X,
} from "lucide-react";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { profile, isAdmin, signOut } = useAuth();

  const submissionsLabel = "Properties";
  const mainItems: { label: string; href: string; icon: React.ElementType }[] =
    isAdmin
      ? [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Create property", href: "/onboarding", icon: FileInput },
          { label: submissionsLabel, href: "/properties", icon: FolderOpen },
          { label: "Voice Studio", href: "/voice-preview", icon: Mic2 },
        ]
      : [
          { label: "Overview", href: "/", icon: LayoutDashboard },
          { label: "Properties", href: "/properties", icon: FolderOpen },
        ];

  const NAV_SECTIONS = [
    {
      label: "MAIN",
      items: mainItems,
    },
    ...(isAdmin
      ? [
          {
            label: "ADMIN",
            items: [
              { label: "Accounts", href: "/admin/accounts", icon: Building2 },
              { label: "Users", href: "/admin/users", icon: Users },
              { label: "Settings", href: "/settings", icon: Settings },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside
      id="main-navigation"
      className={`fixed left-0 top-0 h-dvh w-60 bg-cs-bg border-r border-cs-border flex-col z-50 ${open ? "flex" : "hidden lg:flex"}`}
    >
      <div className="mx-4 pt-3 pb-3 mb-4 border-b border-cs-border flex justify-between items-center gap-2">
        <img
          src="/logo.png"
          alt="Call Stream AI"
          className="w-48 h-16 object-contain"
        />
        <button
          className="lg:hidden absolute right-2 top-2 min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="mx-4 mb-6 px-3 py-3 bg-cs-card rounded-lg border border-[#303030]">
        <p className="text-xs text-cs-text-secondary">Account</p>
        <p className="text-sm font-medium text-cs-text-primary mt-1 truncate">
          {profile?.company_name || profile?.full_name || "Call Stream AI"}
        </p>
        <p className="font-mono text-[10px] tracking-wider text-cs-text-muted mt-2">{isAdmin ? "LAUNCH · ADMIN" : "LAUNCH WORKSPACE"}</p>
      </div>

      <nav
        aria-label="Main navigation"
        className="flex-1 px-4 space-y-7 overflow-y-auto"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="cs-label px-3 mb-2">{section.label}</p>
            {section.items.map((item) => {
              const isActive = item.href === "/onboarding"
                ? pathname === "/onboarding"
                : pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/")) ||
                  (item.href === "/properties" && pathname.startsWith("/onboarding/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive ? "cs-sidebar-item-active" : "cs-sidebar-item"
                  }
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 mt-4 border-t border-cs-border space-y-1">
        <div className="px-3 py-1.5">
          <p className="text-sm text-cs-text-primary truncate">
            {profile?.full_name || "User"}
          </p>
          <p className="text-xs text-cs-text-muted truncate">
            {profile?.email}
          </p>
        </div>
        <button
          onClick={signOut}
          className="cs-sidebar-item w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
