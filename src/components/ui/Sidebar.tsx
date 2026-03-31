"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileInput,
  ClipboardCheck,
  Settings,
  LogOut,
  User,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Onboarding", href: "/onboarding", icon: FileInput },
      { label: "Review", href: "/review", icon: ClipboardCheck },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-cs-bg border-r border-cs-border flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-sm font-bold tracking-wide text-cs-text-primary">
          CALL STREAM AI
        </h1>
        <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-0.5">
          CALLSTREAMAI.COM
        </p>
      </div>

      {/* Account badge */}
      <div className="mx-3 mb-4 px-3 py-2.5 bg-cs-card rounded-md border border-cs-border">
        <p className="cs-label text-[10px]">ACCOUNT</p>
        <p className="text-sm text-cs-text-primary mt-0.5">Call Stream AI</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="cs-label text-[10px] px-3 mb-1.5">{section.label}</p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive ? "cs-sidebar-item-active" : "cs-sidebar-item"
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="p-3 border-t border-cs-border">
        <button className="cs-sidebar-item w-full">
          <User size={16} />
          Profile
        </button>
      </div>
    </aside>
  );
}
