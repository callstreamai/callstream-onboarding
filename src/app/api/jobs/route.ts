import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch (_e) {}
          },
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const supabase = createServiceClient();

    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }

    const statusFilter = req.nextUrl.searchParams.get("status");
    const showAll = req.nextUrl.searchParams.get("all") === "true";

    let query = supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (showAll && isAdmin) {
      // Admin viewing all — no filter
    } else if (user) {
      // Get job_ids where this user is a project member (invited)
      const { data: memberships } = await supabase
        .from("project_members")
        .select("job_id")
        .eq("user_id", user.id);

      const memberJobIds = (memberships ?? []).map((m: any) => m.job_id).filter(Boolean);

      if (memberJobIds.length > 0) {
        // Show jobs they created OR were invited to
        query = query.or(`created_by.eq.${user.id},id.in.(${memberJobIds.join(",")})`);
      } else {
        // No memberships — just their own
        query = query.eq("created_by", user.id);
      }
    }

    if (statusFilter) {
      const statuses = statusFilter.split(",");
      query = query.in("status", statuses);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ jobs: jobs || [] });
  } catch (_err) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { requireAdmin, AccessError } = await import("@/lib/access");
    const { user, db } = await requireAdmin();
    const body = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId || "") || typeof body.name !== "string" || !body.name.trim() || body.name.length > 200) throw new AccessError("Enter a property name and website.",400);
    let url: URL;
    try { url = new URL(body.url); } catch { throw new AccessError("Enter a valid public website URL.",400); }
    if (!["https:","http:"].includes(url.protocol) || url.username || url.password || url.hostname === "localhost" || !url.hostname.includes(".")) throw new AccessError("Enter a valid public website URL.",400);
    const { data, error } = await db.rpc("create_managed_property", { p_id:body.requestId,p_actor:user.id,p_url:url.href,p_name:body.name.trim(),p_account:body.accountId || null,p_vertical:body.vertical || null });
    if (error) throw error;
    return NextResponse.json({ jobId:data, reused:data!==body.requestId });
  } catch(error) { const { accessResponse } = await import("@/lib/access"); return accessResponse(error); }
}
