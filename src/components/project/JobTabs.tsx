"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderOpen, Kanban, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Props {
  jobId: string;
}

export default function JobTabs({ jobId }: Props) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const tabs = [
    { label: "Status",     href: "/onboarding/" + jobId + "/status",    icon: Activity,      adminOnly: false },
    { label: "Workspace",  href: "/onboarding/" + jobId + "/workspace", icon: FolderOpen,    adminOnly: false },
    { label: "Project",    href: "/onboarding/" + jobId + "/project",   icon: Kanban,        adminOnly: false },
    { label: "Review",     href: "/onboarding/" + jobId + "/review",    icon: ClipboardCheck, adminOnly: true },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-cs-border mb-6">
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
  );
}
