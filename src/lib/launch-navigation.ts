export function propertyNextStep(property: {
  workspace_job_id: string;
  status: string;
  document_count: number;
  submitted_at?: string | null;
}) {
  const base = `/onboarding/${property.workspace_job_id}`;
  if (property.status === "Launched") return { label: "View launch progress", href: `${base}/project`, description: "Your property is launched. View its milestones and team updates." };
  if (!property.document_count) return { label: "Upload property documents", href: `${base}/workspace`, description: "Add menus, policies, and other property documents to your folders." };
  if (!property.submitted_at) return { label: "Submit files for review", href: `${base}/workspace`, description: "When your documents are ready, submit them together for team review." };
  return { label: "View review progress", href: `${base}/project`, description: "Follow the review milestones and updates from your Call Stream team." };
}

export function websiteHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}
