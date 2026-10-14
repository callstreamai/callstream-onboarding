import { redirect } from "next/navigation";
import Link from "next/link";
import { getProperty } from "@/lib/properties";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: { propertyId: string };
}) {
  const { db, property } = await getProperty(params.propertyId, true);
  if (params.propertyId !== property.property_key)
    redirect("/properties/" + property.property_key + "/history");
  const [rr, jr, vr] = await Promise.all([
    db
      .from("property_runs")
      .select("id,job_id,kind,status,started_at,finished_at,summary")
      .eq("property_id", property.id)
      .order("started_at", { ascending: false })
      .limit(100),
    db
      .from("onboarding_jobs")
      .select("id,created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false }),
    db
      .from("knowledge_versions")
      .select("id,status,created_at")
      .eq("job_id", property.workspace_job_id)
      .order("created_at", { ascending: false }),
  ]);
  for (const r of [rr, jr, vr]) if (r.error) throw r.error;
  const labels: Record<string, string> = {
    legacy_import: "Earlier onboarding record",
    crawl: "Website refresh",
    extract: "Structured extraction",
  };
  return (
    <div className="space-y-6">
      <Link
        href={"/properties/" + property.property_key}
        className="text-sm text-cs-accent-brand"
      >
        ← {property.name}
      </Link>
      <div>
        <p className="cs-label text-cs-accent-brand mb-2">PROPERTY SOURCES</p>
        <h1 className="text-3xl font-semibold">Source history</h1>
        <p className="text-cs-text-secondary mt-2">
          Processing activity belongs to this property. Refreshes keep its
          workspace and files in place.
        </p>
      </div>
      <div className="cs-card p-5">
        <h2 className="font-semibold">Current workspace</h2>
        <div className="flex gap-4 mt-3 text-sm">
          <Link
            href={"/onboarding/" + property.workspace_job_id + "/knowledge"}
            className="text-cs-accent-brand"
          >
            Refresh website / prepare knowledge →
          </Link>
          <Link
            href={"/onboarding/" + property.workspace_job_id + "/workspace"}
            className="text-cs-accent-brand"
          >
            Shared files →
          </Link>
        </div>
        <p className="text-sm text-cs-text-muted mt-3">
          {vr.data?.length || 0} knowledge versions. Knowledge publication and
          agent selection are separate from website processing.
        </p>
      </div>
      <div className="space-y-3">
        {rr.data?.map((run) => (
          <div key={run.id} className="cs-card p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-medium">{labels[run.kind] || run.kind}</h2>
              <span className="cs-badge bg-cs-card">
                {run.status === "needs_review"
                  ? "Imported · needs review"
                  : run.status === "running" &&
                      Date.now() - new Date(run.started_at).getTime() >
                        30 * 60 * 1000
                    ? "Interrupted / retry available"
                    : run.status}
              </span>
            </div>
            <p className="text-xs text-cs-text-muted mt-2">
              {new Date(run.started_at).toLocaleString("en-US", {
                timeZone: "America/New_York",
              })}{" "}
              ET
            </p>
            {run.summary?.note && (
              <p className="text-sm text-cs-text-secondary mt-3">
                {run.summary.note}
              </p>
            )}
            {run.summary?.pagesCrawled !== undefined && (
              <p className="text-sm mt-2">
                {run.summary.pagesCrawled} readable pages
              </p>
            )}
            {run.kind === "legacy_import" &&
              run.job_id !== property.workspace_job_id && (
                <Link
                  className="text-sm text-cs-accent-brand inline-block mt-3"
                  href={"/onboarding/" + run.job_id + "/workspace"}
                >
                  Open preserved earlier workspace →
                </Link>
              )}
          </div>
        ))}
      </div>
      {!rr.data?.length && (
        <p className="cs-card p-6">No website processing runs yet.</p>
      )}
    </div>
  );
}
