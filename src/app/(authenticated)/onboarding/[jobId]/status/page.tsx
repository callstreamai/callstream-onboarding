"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusScreen } from "@/components/onboarding/StatusScreen";
import { Activity, Kanban, ClipboardCheck, FolderOpen } from "lucide-react";

export default function StatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const pathname = usePathname();

  const tabs = [
    { label: "Status", href: "/onboarding/" + jobId + "/status", icon: Activity },
    { label: "Workspace", href: "/onboarding/" + jobId + "/workspace", icon: FolderOpen },
    { label: "Project", href: "/onboarding/" + jobId + "/project", icon: Kanban },
    { label: "Review", href: "/onboarding/" + jobId + "/review", icon: ClipboardCheck },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-cs-border mb-6">
        {tabs.map((t) => {
          const active = pathname === t.href;
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
              <t.icon size={14} />
              {t.label}
            </Link>
          );
        })}
      </div>
      <StatusScreen jobId={jobId} />
    </div>
  );
}
