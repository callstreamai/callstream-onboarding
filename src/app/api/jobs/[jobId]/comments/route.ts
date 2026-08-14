import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

function getUserClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

async function getProfilesByIds(supabase: ReturnType<typeof createServiceClient>, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map((data || []).map((profile: any) => [profile.id, profile]));
}

function enrichComment(comment: any, profilesById: Map<string, any>) {
  const profile = profilesById.get(comment.author_id);
  return {
    ...comment,
    author_name: profile?.full_name || null,
    author_email: profile?.email || null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();

    const { data: comments, error } = await supabase
      .from("project_comments")
      .select("*")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const profilesById = await getProfilesByIds(
      supabase,
      (comments || []).map((comment: any) => comment.author_id)
    );
    const enriched = (comments || []).map((comment: any) => enrichComment(comment, profilesById));

    const { data: members, error: membersError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("job_id", params.jobId);
    if (membersError) throw membersError;

    const memberProfilesById = await getProfilesByIds(
      supabase,
      (members || []).map((member: any) => member.user_id)
    );
    const users = Array.from(memberProfilesById.values());

    return NextResponse.json({ comments: enriched, users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const userClient = getUserClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { body, mentions } = await req.json();
    const cleanBody = String(body || "").trim();

    if (!cleanBody) {
      return NextResponse.json({ error: "Comment body required" }, { status: 400 });
    }

    const { data: comment, error } = await supabase
      .from("project_comments")
      .insert({
        job_id: params.jobId,
        author_id: user.id,
        body: cleanBody,
        mentions: Array.isArray(mentions) ? mentions : [],
      })
      .select("*")
      .single();
    if (error) throw error;

    const mentionList = Array.isArray(mentions) ? mentions : [];

    // Create notifications for mentioned users
    if (mentionList.length > 0) {
      let mentionedUserIds: string[] = [];

      if (mentionList.includes("callstreamai")) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin");
        mentionedUserIds.push(...(admins || []).map((a) => a.id));
      }

      const otherMentions = mentionList.filter((m: string) => m !== "callstreamai");
      if (otherMentions.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("email", otherMentions);
        mentionedUserIds.push(...(profiles || []).map((p) => p.id));
      }

      const uniqueIds = Array.from(new Set(mentionedUserIds)).filter((id) => id !== user.id);
      if (uniqueIds.length > 0) {
        const notifications = uniqueIds.map((uid) => ({
          user_id: uid,
          type: "mention" as const,
          title: "You were mentioned in a comment",
          body: cleanBody.slice(0, 200),
          link: "/onboarding/" + params.jobId + "/project",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    }

    const profilesById = await getProfilesByIds(supabase, [comment.author_id]);
    return NextResponse.json({ comment: enrichComment(comment, profilesById) });
  } catch (err: any) {
    console.error("comment post error:", err);
    return NextResponse.json({ error: err.message || "Failed to post comment" }, { status: 500 });
  }
}
