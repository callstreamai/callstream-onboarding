"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, FolderOpen, Kanban, Mic2, ArrowLeft, FileJson } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface PropertyOption { id: string; name: string; workspace_job_id: string; property_key: string }

export default function JobTabs({ jobId, propertyName }: { jobId: string; propertyName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/properties", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setProperties(data.properties || []);
      }).catch(() => {});
    return () => controller.abort();
  }, [jobId]);
  const current = properties.find(p => p.workspace_job_id === jobId || p.id === jobId);
  const name = current?.name || propertyName || "Property workspace";
  const overview = "/properties/" + (current?.property_key || jobId);
  const tabs = [
    { label: "Overview", href: overview, icon: Activity },
    { label: "Files", href: `/onboarding/${jobId}/workspace`, icon: FolderOpen },
    { label: "Knowledge", href: `/onboarding/${jobId}/knowledge`, icon: FileJson },
    { label: "Launch progress", href: `/onboarding/${jobId}/project`, icon: Kanban },
    { label: "Voice", href: `/onboarding/${jobId}/voice-preview`, icon: Mic2 },
    ...(isAdmin ? [{ label: "Source history", href: `/properties/${current?.property_key || jobId}/history`, icon: Activity }] : []),
  ];
  const selected = tabs.find(t => pathname === t.href || (t.label === "Overview" && pathname.startsWith("/properties/") && !pathname.endsWith("/history")))?.href || "";
  return (
    <div className="mb-8 space-y-5">
      <Link href="/properties" className="inline-flex min-h-11 items-center gap-2 text-sm text-cs-text-secondary hover:text-white">
        <ArrowLeft size={16} /> All properties
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="cs-label mb-1">Property workspace</p>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.03em] leading-tight break-words">{name}</p>
        </div>
        {properties.length > 1 && <label className="block sm:w-64 shrink-0">
          <span className="sr-only">Switch property</span>
          <select aria-label="Switch property" className="cs-input min-h-11" value={current?.workspace_job_id || ""} onChange={e => {
            const next = properties.find(p => p.workspace_job_id === e.target.value);
            if (!next) return;
            const section = pathname.startsWith(`/onboarding/${jobId}/`) ? pathname.slice(`/onboarding/${jobId}`.length) : null;
            router.push(section ? `/onboarding/${next.workspace_job_id}${section}` : `/properties/${next.property_key}${pathname.endsWith('/history') ? '/history' : ''}`);
          }}>
            {!current && <option value="" disabled>Choose a property</option>}
            {properties.map(p => <option key={p.id} value={p.workspace_job_id}>{p.name}</option>)}
          </select>
        </label>}
      </div>
      <label className="block sm:hidden">
        <span className="cs-label block mb-2">Workspace section</span>
        <select aria-label="Workspace section" className="cs-input min-h-11" value={selected} onChange={e => router.push(e.target.value)}>
          {!selected && <option value="" disabled>Choose a section</option>}
          {tabs.map(t => <option key={t.href} value={t.href}>{t.label}</option>)}
        </select>
      </label>
      <nav aria-label="Property sections" className="hidden sm:flex flex-wrap gap-2 border-b border-cs-border pt-2">
        {tabs.map(t => <Link key={t.href} href={t.href} aria-current={selected === t.href ? "page" : undefined}
          className={`flex min-h-11 items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition ${selected === t.href ? "border-cs-accent-brand text-cs-text-primary" : "border-transparent text-cs-text-secondary hover:text-white"}`}>
          <t.icon size={16} />{t.label}
        </Link>)}
      </nav>
    </div>
  );
}
