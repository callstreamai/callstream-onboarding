"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { propertyNextStep, websiteHost } from "@/lib/launch-navigation";
import { Building2, ArrowRight, Plus, Search } from "lucide-react";
export default function PropertyList({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  const [properties, setProperties] = useState<any[]>([]),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [scope, setScope] = useState("all"),
    [search, setSearch] = useState("");
  useEffect(() => {
    fetch("/api/properties")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setProperties(d.properties);
        setAdmin(d.isAdmin);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const visible = properties.filter(
    (p) =>
      (scope === "all" || p.assigned) &&
      (p.name + " " + (p.account_name || ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <p className="cs-label text-cs-accent-brand mb-2">
            CALL STREAM AI / LAUNCH
          </p>
          <h1 className="text-3xl font-semibold">
            {dashboard ? "Your launch workspace" : "Properties"}
          </h1>
          <p className="text-cs-text-secondary mt-2">
            One workspace for each property. Files, knowledge, and launch
            progress stay together.
          </p>
        </div>
        {admin && (
          <Link className="cs-btn-primary" href="/onboarding">
            <Plus size={16} />
            Create property
          </Link>
        )}
      </div>
      {!loading && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ["Properties", properties.length],
            [
              "Files submitted",
              properties.filter((p) => p.submitted_at).length,
            ],
            [
              "Launched",
              properties.filter((p) => p.status === "Launched").length,
            ],
          ].map(([label, value]) => (
            <div key={label} className="cs-card p-5">
              <p className="cs-label">{label}</p>
              <p className="text-2xl mt-2">{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 flex-wrap items-center">
        {admin && (
          <select
            aria-label="Property scope"
            className="cs-input !w-auto"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">All properties</option>
            <option value="mine">Assigned to me</option>
          </select>
        )}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-3.5 text-cs-text-muted"
          />
          <input
            aria-label="Search properties"
            className="cs-input pl-10"
            placeholder="Search properties or clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="cs-card p-5 text-cs-accent-red">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading properties…</p>
      ) : !visible.length && !error ? (
        <div className="cs-card p-8">No properties found.</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {visible.map((p) => {
            const next = propertyNextStep(p);
            return <div
              key={p.id}
              className="cs-card p-5 sm:p-6 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <Building2
                  className="text-cs-accent-brand shrink-0"
                  size={22}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg"><Link className="hover:text-cs-accent-brand" href={"/properties/" + p.property_key}>{p.name}</Link></h2>
                  {admin && p.account_name !== p.name && (
                    <p className="text-xs text-cs-text-muted mt-1">
                      {p.account_name || "Client account not linked"}
                    </p>
                  )}
                </div>
                <Link aria-label={`Overview for ${p.name}`} href={"/properties/" + p.property_key} className="min-h-11 min-w-11 flex items-center justify-center rounded-md hover:bg-cs-border/30"><ArrowRight size={18} /></Link>
              </div>
              <p className="text-sm text-cs-text-secondary mt-3 break-words" title={p.website_url}>
                {websiteHost(p.website_url)}
              </p>
              <div className="flex flex-wrap gap-3 mt-4 text-sm">
                <span className="cs-badge bg-cs-accent-brand/10 text-cs-accent-brand">
                  {p.status}
                </span>
                <span>{p.document_count} {p.document_count === 1 ? "file" : "files"}</span>
                {admin && <span>{p.version_count} knowledge {p.version_count === 1 ? "version" : "versions"}</span>}
              </div>
              {p.warning && (
                <p className="text-xs text-cs-accent-orange mt-3">
                  {p.warning}
                </p>
              )}
              <div className="mt-auto pt-5">
                <p className="cs-label mb-1">Next step</p>
                <Link className="inline-flex min-h-11 items-center gap-2 text-sm text-cs-accent-brand font-medium" href={next.href}>{next.label}<ArrowRight size={16} /></Link>
              </div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
