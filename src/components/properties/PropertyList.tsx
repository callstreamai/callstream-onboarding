"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, Plus, Search } from "lucide-react";
import { propertyNextStep, websiteHost } from "@/lib/launch-navigation";

export default function PropertyList({ dashboard = false }: { dashboard?: boolean }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/properties", { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load properties.");
        if (controller.signal.aborted) return;
        setProperties(data.properties);
        setAdmin(data.isAdmin);
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const visible = properties.filter(property =>
    (scope === "all" || property.assigned) &&
    `${property.name} ${property.account_name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const metrics = [
    { label: "Properties", value: properties.length, detail: "Across your workspace" },
    { label: "Files submitted", value: properties.filter(property => property.submitted_at).length, detail: "Properties with a submission" },
    { label: "Launched", value: properties.filter(property => property.status === "Launched").length, detail: "Confirmed property launches" },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-5">
        <div>
          <h1 className="cs-page-heading">{dashboard ? "Launch overview" : "Properties"}</h1>
          <p className="text-sm leading-[21px] text-cs-text-secondary mt-2 max-w-xl">
            {dashboard ? "Your properties, their progress, and what comes next." : "Documents, knowledge, and launch progress. One workspace for each property."}
          </p>
        </div>
        {admin && <Link className="cs-btn-primary shrink-0" href="/onboarding"><Plus size={16} />Create property</Link>}
      </header>

      {!loading && !error && <section aria-label="Launch summary" className="cs-metric-grid">
        {metrics.map(metric => <div className="cs-metric" key={metric.label}>
          <p className="cs-metric-value">{metric.value}</p>
          <p className="text-xs sm:text-sm text-cs-text-secondary mt-3">{metric.label}</p>
          <p className="hidden sm:block text-xs text-cs-text-muted mt-2">{metric.detail}</p>
        </div>)}
      </section>}

      <section aria-labelledby="property-list-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 id="property-list-heading" className="cs-section-heading">Your properties</h2>
            <p className="text-sm text-cs-text-secondary mt-1">Choose a property to continue its launch.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:max-w-lg w-full">
            {admin && <select aria-label="Property scope" className="cs-input sm:!w-auto" value={scope} onChange={event => setScope(event.target.value)}>
              <option value="all">All properties</option><option value="mine">Assigned to me</option>
            </select>}
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted pointer-events-none" />
              <input aria-label="Search properties" className="cs-input pl-10" placeholder="Search properties" value={search} onChange={event => setSearch(event.target.value)} />
            </div>
          </div>
        </div>

        {error ? <p role="alert" className="cs-card p-6 text-cs-accent-red">{error}</p>
          : loading ? <p role="status" className="cs-card p-8 text-sm text-cs-text-secondary">Loading your properties…</p>
          : !visible.length ? <div className="cs-card px-6 py-12 text-center">
            <Building2 size={28} className="mx-auto text-cs-text-muted mb-4" />
            <h3 className="cs-section-heading">{search || scope !== "all" ? "No matching properties" : "Your workspace starts here"}</h3>
            <p className="text-sm text-cs-text-secondary mt-2">{search || scope !== "all" ? "Try a different search or property filter." : admin ? "Create a property to start organizing its launch." : "Your assigned properties will appear here. Contact your Call Stream team if you need access."}</p>
            {(search || scope !== "all") && <button className="cs-btn-secondary mt-5" onClick={() => { setSearch(""); setScope("all"); }}>Clear filters</button>}
          </div>
          : <div className="grid xl:grid-cols-2 gap-5">
            {visible.map(property => {
              const next = propertyNextStep(property);
              return <article key={property.id} className="cs-card flex flex-col transition-colors hover:border-cs-border-hover">
                <div className="p-5 sm:p-7 flex-1">
                  <div className="flex items-start gap-3">
                    <Building2 size={22} className="text-cs-text-secondary shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold leading-snug"><Link className="hover:text-cs-accent-brand transition-colors" href={`/properties/${property.property_key}`}>{property.name}</Link></h3>
                      <p className="text-sm text-cs-text-secondary mt-2 break-words" title={property.website_url}>{websiteHost(property.website_url)}</p>
                      {admin && property.account_name !== property.name && <p className="text-xs text-cs-text-muted mt-1">{property.account_name || "Client account not linked"}</p>}
                    </div>
                    <Link aria-label={`Overview for ${property.name}`} className="min-h-11 min-w-11 flex items-center justify-center -mt-2 -mr-2 rounded-lg text-cs-text-secondary hover:text-white hover:bg-white/5" href={`/properties/${property.property_key}`}><ArrowRight size={18} /></Link>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <span className="cs-status"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${property.status === "Launched" ? "bg-cs-accent-green" : "bg-cs-accent-brand"}`} />{property.status}</span>
                    <span className="text-xs text-cs-text-secondary">{property.document_count} {property.document_count === 1 ? "file" : "files"}</span>
                    {admin && <span className="text-xs text-cs-text-secondary">{property.version_count} knowledge {property.version_count === 1 ? "version" : "versions"}</span>}
                  </div>
                  {property.warning && <p className="text-sm text-cs-accent-orange mt-4">{property.warning}</p>}
                </div>
                <div className="px-5 sm:px-7 py-4 border-t border-cs-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="cs-label">Next step</p>
                  <Link className="inline-flex min-h-11 items-center gap-2 text-sm text-cs-text-primary hover:text-cs-accent-brand transition-colors" href={next.href}>{next.label}<ArrowRight size={16} className="text-cs-accent-brand" /></Link>
                </div>
              </article>;
            })}
          </div>}
      </section>
    </div>
  );
}
