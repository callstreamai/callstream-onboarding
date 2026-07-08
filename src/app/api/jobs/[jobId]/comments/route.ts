import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
    const supabase = createServiceClient();
    const { body, authorId, mentions } = await req.json();

    const { data: comment, error } = await supabase
      .from("project_comments")
      .insert({
        job_id: params.jobId,
        author_id: authorId,
        body,
        mentions: mentions || [],
      })
      .select()
      .single();
    if (error) throw error;

    // Create notifications for mentioned users
    if (mentions && mentions.length > 0) {
      // Resolve @callstreamai to all admins
      let mentionedUserIds: string[] = [];

      if (mentions.includes("callstreamai")) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin");
        mentionedUserIds.push(...(admins || []).map((a) => a.id));
      }

      // Resolve other user mentions by email or name
      const otherMentions = mentions.filter((m: string) => m !== "callstreamai");
      if (otherMentions.length > 0) {
        const { data: users } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .or(otherMentions.map((m: string) => "email.eq." + m + ",full_name.ilike.%" + m + "%").join(","));
        mentionedUserIds.push(...(users || []).map((u) => u.id));
      }

      // Dedupe and exclude author
      const uniqueIds = Array.from(new Set(mentionedUserIds)).filter((id) => id !== authorId);

      if (uniqueIds.length > 0) {
        const notifications = uniqueIds.map((uid) => ({
          user_id: uid,
          type: "mention" as const,
          title: "You were mentioned in a comment",
          body: body.slice(0, 200),
          link: "/onboarding/" + params.jobId + "/project",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    }

    return NextResponse.json({ comment });
  } catch (err) {
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
