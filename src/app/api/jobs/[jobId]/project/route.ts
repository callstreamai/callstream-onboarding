import { NextRequest, NextResponse } from "next/server";

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    "apikey": SB_KEY(),
    "Authorization": "Bearer " + SB_KEY(),
    "Content-Type": "application/json",
  };
}

async function fetchJson(path: string) {
  const res = await fetch(SB_URL() + path, { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const [milestones, tasks, rawComments] = await Promise.all([
      fetchJson("/rest/v1/project_milestones?job_id=eq." + params.jobId + "&select=*&order=sort_order"),
      fetchJson("/rest/v1/project_tasks?job_id=eq." + params.jobId + "&select=*&order=created_at.desc"),
      fetchJson("/rest/v1/project_comments?job_id=eq." + params.jobId + "&select=*&order=created_at.asc"),
    ]);

    const authorIds = Array.from(new Set((Array.isArray(rawComments) ? rawComments : []).map((c: any) => c.author_id).filter(Boolean)));
    let profilesById = new Map<string, any>();

    if (authorIds.length > 0) {
      const encodedIds = authorIds.map((id) => '"' + id + '"').join(",");
      const profiles = await fetchJson("/rest/v1/profiles?id=in.(" + encodedIds + ")&select=id,full_name,email,role");
      profilesById = new Map((Array.isArray(profiles) ? profiles : []).map((profile: any) => [profile.id, profile]));
    }

    const comments = Array.isArray(rawComments)
      ? rawComments.map((c: any) => {
          const profile = profilesById.get(c.author_id);
          return {
            ...c,
            author_name: profile?.full_name || null,
            author_email: profile?.email || null,
          };
        })
      : [];

    return NextResponse.json({
      milestones: Array.isArray(milestones) ? milestones : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      comments,
    });
  } catch {
    return NextResponse.json({ milestones: [], tasks: [], comments: [] }, { status: 500 });
  }
}
