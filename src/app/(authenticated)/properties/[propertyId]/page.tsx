import { redirect } from "next/navigation";
import Link from "next/link";
import { getProperty, listProperties } from "@/lib/properties";
import {
  FolderOpen,
  FileText,
  History,
  Mic2,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";
import PropertyDetails from "@/components/properties/PropertyDetails";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: { propertyId: string };
}) {
  const { property, isAdmin } = await getProperty(params.propertyId);
  if (params.propertyId !== property.property_key)
    redirect("/properties/" + property.property_key);
  const { properties } = await listProperties();
  const p = properties.find((x) => x.id === property.id)!;
  const base = "/onboarding/" + p.workspace_job_id;
  const cards = [
    {
      label: "Shared files",
      description:
        "Upload and organize documents, then submit them for review.",
      href: base + "/workspace",
      icon: FolderOpen,
      detail: p.document_count + " files",
    },
    ...(isAdmin
      ? [
          {
            label: "Knowledge",
            description:
              "Prepare sourced Q&A, edit drafts, and publish knowledge versions.",
            href: base + "/knowledge",
            icon: FileText,
            detail: p.version_count + " versions",
          },
        ]
      : []),
    {
      label: "Launch progress",
      description: "Milestones, tasks, and conversations for this property.",
      href: base + "/project",
      icon: ClipboardList,
      detail: p.status,
    },
    {
      label: "Voice Studio",
      description: "Listen to previews and choose your property’s voice.",
      href: base + "/voice-preview",
      icon: Mic2,
      detail: "Voice previews",
    },
    ...(isAdmin
      ? [
          {
            label: "Source history",
            description:
              "Website scrapes, processing attempts, and preserved earlier records.",
            href: "/properties/" + p.property_key + "/history",
            icon: History,
            detail: "Review activity",
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-6">
      <Link href="/properties" className="cs-btn-ghost inline-flex text-sm">
        <ArrowLeft size={15} />
        Properties
      </Link>
      <div className="cs-card p-6">
        <p className="cs-label text-cs-accent-brand mb-2">PROPERTY WORKSPACE</p>
        <h1 className="text-3xl font-semibold">{p.name}</h1>
        <p className="text-sm text-cs-text-muted mt-2 break-all">
          {p.website_url}
        </p>
        <div className="flex gap-3 flex-wrap mt-4">
          <span className="cs-badge bg-cs-accent-brand/10 text-cs-accent-brand">
            {p.status}
          </span>
          {isAdmin && (
            <span className="text-sm text-cs-text-muted">
              {p.account_name || "Client account not linked"}
            </span>
          )}
        </div>
        <p className="text-sm text-cs-text-secondary mt-4">
          This is the permanent home for your property. Website refreshes and
          new knowledge versions keep the same shared workspace.
        </p>
      </div>
      {p.warning && (
        <div className="cs-card p-4 text-cs-accent-orange">
          {p.warning}. Review the source before preparing knowledge.
        </div>
      )}
      {isAdmin && p.record_count > 1 && (
        <div className="cs-card p-4 text-sm">
          {p.record_count} previous onboarding records belong to this property.
          Their original content is preserved in{" "}
          <Link
            className="text-cs-accent-brand"
            href={"/properties/" + p.property_key + "/history"}
          >
            Source history
          </Link>
          .
        </div>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="cs-card-hover p-6">
            <c.icon size={22} className="text-cs-accent-brand mb-4" />
            <h2 className="font-semibold">{c.label}</h2>
            <p className="text-sm text-cs-text-secondary mt-2">
              {c.description}
            </p>
            <p className="text-xs text-cs-accent-brand mt-4">{c.detail} →</p>
          </Link>
        ))}
      </div>
      {isAdmin && <PropertyDetails property={property} />}
    </div>
  );
}
