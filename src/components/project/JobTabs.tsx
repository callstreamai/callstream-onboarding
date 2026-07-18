"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderOpen, Kanban, Mic2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Props {
  jobId: string;
  propertyName?: string;
}

export default function JobTabs({ jobId, propertyName }: Props) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const tabs = [
    { label: "Status",        href: "/onboarding/" + jobId + "/status",        icon: Activity,  adminOnly: false },
    { label: "Workspace",     href: "/onboarding/" + jobId + "/workspace",     icon: FolderOpen, adminOnly: false },
    { label: "Project",       href: "/onboarding/" + jobId + "/project",       icon: Kanban,    adminOnly: false },
    { label: "Voice Preview", href: "/onboarding/" + jobId + "/voice-preview", icon: Mic2,      adminOnly: false },
  ];

  return (
    <div className="mb-6">
      {/* Back navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/submissions"
          className="flex items-center gap-1.5 text-xs text-cs-text-muted hover:text-cs-text-primary transition"
        >
          <ArrowLeft size={13} />
          My Projects
        </Link>
        {propertyName && (
          <>
            <span className="text-cs-text-muted text-xs">/</span>
            <span className="text-xs text-cs-text-primary font-medium">{propertyName}</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-cs-border">
        {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition " +
                (active
                  ? "border-cs-accent-blue text-cs-accent-blue"
                  : "border-transparent text-cs-text-muted hover:text-cs-text-secondary")
              }
            >
              <Icon size={14} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
