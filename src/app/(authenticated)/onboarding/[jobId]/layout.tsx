import { requireProject } from "@/lib/access";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { jobId: string };
}) {
  let access;
  try {
    access = await requireProject(params.jobId);
  } catch {
    redirect("/properties");
  }
  const { data: property } = access.job.property_id
    ? await access.db
        .from("properties")
        .select("workspace_job_id,id,name")
        .eq("id", access.job.property_id)
        .maybeSingle()
    : { data: null };
  return (
    <>
      {property && property.workspace_job_id !== params.jobId && (
        <div className="cs-card p-4 mb-5 text-sm">
          You are viewing a preserved earlier workspace.{" "}
          <Link
            className="text-cs-accent-brand"
            href={"/properties/" + property.id}
          >
            Open the current {property.name} property →
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
