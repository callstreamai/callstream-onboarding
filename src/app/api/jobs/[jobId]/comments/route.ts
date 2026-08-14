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

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();

    const { data: comments, error } = await supabase
      .from("project_comments")
      .select("*, profiles:author_id(full_name, email, role)")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const enriched = (comments || []).map((c: any) => ({
      ...c,
      author_name: c.profiles?.full_name || null,
      author_email: c.profiles?.email || null,
    }));

    const { data: members } = await supabase
      .from("project_members")
      .select("user_id, profiles:user_id(id, full_name, email, role)")
      .eq("job_id", params.jobId);

    const users = (members || []).map((m: any) => m.profiles).filter(Boolean);

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
      .select("*, profiles:author_id(full_name, email, role)")
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

    return NextResponse.json({
      comment: {
        ...comment,
        author_name: (comment as any).profiles?.full_name || null,
        author_email: (comment as any).profiles?.email || null,
      },
    });
  } catch (err: any) {
    console.error("comment post error:", err);
    return NextResponse.json({ error: err.message || "Failed to post comment" }, { status: 500 });
  }
}
