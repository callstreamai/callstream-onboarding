import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/jobs/:jobId
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;
    const includeFields = req.nextUrl.searchParams.get("include") === "fields";

    const { data: job, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const response: Record<string, unknown> = { job };

    if (includeFields) {
      const { data: fields } = await supabase
        .from("extraction_fields")
        .select("*")
        .eq("job_id", jobId)
        .order("field_name");

      response.fields = fields || [];
    }

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

// PATCH /api/jobs/:jobId - Update field review status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;
    const body = await req.json();

    // Approve all pending fields
    if (body.action === "approve_all") {
      await supabase
        .from("extraction_fields")
        .update({ status: "accepted", reviewed_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("status", "pending");

      // Update job counts
      const { data: fields } = await supabase
        .from("extraction_fields")
        .select("status")
        .eq("job_id", jobId);

      const counts = {
        fields_reviewed: fields?.length || 0,
        fields_accepted: fields?.filter((f) => f.status === "accepted").length || 0,
        fields_edited: fields?.filter((f) => f.status === "edited").length || 0,
        fields_rejected: fields?.filter((f) => f.status === "rejected").length || 0,
        status: "approved",
      };

      await supabase
        .from("onboarding_jobs")
        .update(counts)
        .eq("id", jobId);

      return NextResponse.json({ success: true });
    }

    // Update single field
    const { fieldName, action, newValue } = body;

    const updateData: Record<string, unknown> = {
      reviewed_at: new Date().toISOString(),
    };

    if (action === "accept") {
      updateData.status = "accepted";
    } else if (action === "edit") {
      updateData.status = "edited";
      updateData.edited_value =
        typeof newValue === "string" ? JSON.stringify(newValue) : newValue;
    } else if (action === "reject") {
      updateData.status = "rejected";
    }

    await supabase
      .from("extraction_fields")
      .update(updateData)
      .eq("job_id", jobId)
      .eq("field_name", fieldName);

    // Update job review counts
    const { data: allFields } = await supabase
      .from("extraction_fields")
      .select("status")
      .eq("job_id", jobId);

    const reviewed = allFields?.filter((f) => f.status !== "pending").length || 0;
    const total = allFields?.length || 0;

    await supabase
      .from("onboarding_jobs")
      .update({
        fields_reviewed: reviewed,
        fields_accepted: allFields?.filter((f) => f.status === "accepted").length || 0,
        fields_edited: allFields?.filter((f) => f.status === "edited").length || 0,
        fields_rejected: allFields?.filter((f) => f.status === "rejected").length || 0,
        status: reviewed >= total ? "review_in_progress" : "review_pending",
      })
      .eq("id", jobId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update field" },
      { status: 500 }
    );
  }
}
