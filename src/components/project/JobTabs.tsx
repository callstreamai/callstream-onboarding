"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderOpen,
  Kanban,
  Mic2,
  ArrowLeft,
  FileJson,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Props {
  jobId: string;
  propertyName?: string;
}

export default function JobTabs({ jobId, propertyName }: Props) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const tabs = [
    {
      label: "Property",
      href: "/properties/" + jobId,
      icon: Activity,
      adminOnly: false,
    },
    {
      label: "Knowledge",
      href: "/onboarding/" + jobId + "/knowledge",
      icon: FileJson,
      adminOnly: true,
    },
    {
      label: "Shared workspace",
      href: "/onboarding/" + jobId + "/workspace",
      icon: FolderOpen,
      adminOnly: false,
    },
    {
      label: "Project",
      href: "/onboarding/" + jobId + "/project",
      icon: Kanban,
      adminOnly: false,
    },
    {
      label: "Voice Studio",
      href: "/onboarding/" + jobId + "/voice-preview",
      icon: Mic2,
      adminOnly: false,
    },
    {
      label: "Source history",
      href: "/properties/" + jobId + "/history",
      icon: Activity,
      adminOnly: true,
    },
  ];

  return (
    <div className="mb-6">
      {/* Back navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/properties"
          className="flex items-center gap-1.5 text-xs text-cs-text-muted hover:text-cs-text-primary transition"
        >
          <ArrowLeft size={13} />
          Properties
        </Link>
        {propertyName && (
          <>
            <span className="text-cs-text-muted text-xs">/</span>
            <span className="text-xs text-cs-text-primary font-medium">
              {propertyName}
            </span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-cs-border">
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => {
            const active = pathname === t.href;
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "flex shrink-0 items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition " +
                  (active
                    ? "border-cs-accent-brand text-cs-accent-brand"
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
