import { requireUser, requireProject, AccessError } from "@/lib/access";
import { isBlockedSource } from "@/lib/knowledge/source-quality";

export async function listProperties() {
  const access = await requireUser();
  const { db, user, isAdmin } = access;
  const [pr, mr] = await Promise.all([
    db.from("properties").select("*").order("created_at", { ascending: false }),
    db.from("project_members").select("job_id").eq("user_id", user.id),
  ]);
  if (pr.error || mr.error) throw pr.error || mr.error;
  const memberships = new Set((mr.data || []).map((m) => m.job_id));
  const properties = (pr.data || []).filter(
    (p) =>
      isAdmin ||
      p.created_by === user.id ||
      memberships.has(p.workspace_job_id),
  );
  const ids = properties.map((p) => p.workspace_job_id);
  if (!ids.length) return { ...access, properties: [] };
  const results = await Promise.all([
    db.from("space_documents").select("job_id").in("job_id", ids),
    db
      .from("knowledge_versions")
      .select("job_id,status,created_at")
      .in("job_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("property_operations")
      .select("job_id,submitted_at")
      .in("job_id", ids),
    db.from("accounts").select("id,name,property_url"),
    db
      .from("crawled_pages")
      .select("job_id,title,content_text,status")
      .in("job_id", ids),
    db
      .from("onboarding_jobs")
      .select("id,property_id")
      .in(
        "property_id",
        properties.map((p) => p.id),
      ),
    db
      .from("project_milestones")
      .select("job_id,status,name")
      .in("job_id", ids),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [docs, versions, submissions, accounts, pages, jobs, milestones] =
    results.map((r) => r.data || []) as any[][];
  return {
    ...access,
    properties: properties.map((p) => {
      const sourcePages = pages.filter((c) => c.job_id === p.workspace_job_id);
      const readable = sourcePages.filter(
        (c) =>
          c.status === "fetched" &&
          !isBlockedSource(c.title || "", c.content_text || "") &&
          (c.content_text || "").trim().length > 50,
      ).length;
      const latest = versions.find((v) => v.job_id === p.workspace_job_id);
      const account = accounts.find((a) => a.id === p.account_id);
      const submitted = submissions.find(
        (s) => s.job_id === p.workspace_job_id,
      )?.submitted_at;
      const launched = milestones.some(
        (m) =>
          m.job_id === p.workspace_job_id &&
          m.name === "Launch" &&
          m.status === "complete",
      );
      let warning =
        sourcePages.length && !readable ? "Website needs attention" : null;
      if (
        isAdmin &&
        properties.some(
          (other) =>
            other.id !== p.id &&
            other.website_url.replace(/\/$/, "") ===
              p.website_url.replace(/\/$/, ""),
        )
      )
        warning = "Website is also assigned to another property";
      if (isAdmin && account?.property_url) {
        try {
          if (
            new URL(account.property_url).hostname !==
            new URL(p.website_url).hostname
          )
            warning = "Website differs from client account";
        } catch {}
      }
      return {
        ...p,
        assigned:
          p.created_by === user.id || memberships.has(p.workspace_job_id),
        account_name: isAdmin ? account?.name : null,
        document_count: docs.filter((d) => d.job_id === p.workspace_job_id)
          .length,
        readable_pages: readable,
        version_count: versions.filter((v) => v.job_id === p.workspace_job_id)
          .length,
        latest_knowledge_status: isAdmin ? latest?.status : null,
        submitted_at: submitted,
        record_count: isAdmin
          ? jobs.filter((j) => j.property_id === p.id).length
          : 1,
        warning: isAdmin ? warning : null,
        status: launched
          ? "Launched"
          : submitted
            ? "Files submitted"
            : latest
              ? latest.status === "published" ? "Knowledge ready" : "Knowledge in preparation"
              : "Collecting information",
      };
    }),
  };
}
export async function getProperty(id: string, adminOnly = false) {
  const access = await requireUser();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let { data: property, error } = await access.db
    .from("properties")
    .select("*")
    .eq(uuid ? "id" : "property_key", id)
    .maybeSingle();
  if (error) throw error;
  if (!property && !uuid) {
    const { data: alias, error: aliasError } = await access.db
      .from("property_aliases")
      .select("property_id")
      .eq("key", id)
      .maybeSingle();
    if (aliasError) throw aliasError;
    if (alias) {
      const r = await access.db
        .from("properties")
        .select("*")
        .eq("id", alias.property_id)
        .single();
      if (r.error) throw r.error;
      property = r.data;
    }
  }
  if (!property && uuid) {
    const { job } = await requireProject(id, adminOnly);
    if (job.property_id) {
      const r = await access.db
        .from("properties")
        .select("*")
        .eq("id", job.property_id)
        .single();
      if (r.error) throw r.error;
      property = r.data;
    }
  }
  if (!property) throw new AccessError("Property not found.", 404);
  await requireProject(property.workspace_job_id, adminOnly);
  return { ...access, property };
}
