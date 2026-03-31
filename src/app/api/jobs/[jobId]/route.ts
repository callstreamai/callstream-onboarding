import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data: job, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("id", params.jobId)
      .single();

    if (error) throw error;
    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const jobId = params.jobId;

    // Delete storage files for this job
    const { data: files } = await supabase.storage
      .from("onboarding-files")
      .list(jobId);

    if (files && files.length > 0) {
      // List all files recursively
      const allPaths: string[] = [];

      const listRecursive = async (prefix: string) => {
        const { data } = await supabase.storage.from("onboarding-files").list(prefix);
        if (!data) return;
        for (const item of data) {
          const path = prefix + "/" + item.name;
          if (item.id) {
            allPaths.push(path);
          } else {
            await listRecursive(path);
          }
        }
      }

      await listRecursive(jobId);
      if (allPaths.length > 0) {
        await supabase.storage.from("onboarding-files").remove(allPaths);
      }
    }

    // Delete related records (cascade should handle most, but be explicit)
    await supabase.from("space_documents").delete().eq("job_id", jobId);
    await supabase.from("spaces").delete().eq("job_id", jobId);
    await supabase.from("project_invitations").delete().eq("job_id", jobId);
    await supabase.from("project_members").delete().eq("job_id", jobId);
    await supabase.from("extraction_fields").delete().eq("job_id", jobId);
    await supabase.from("extracted_data").delete().eq("job_id", jobId);
    await supabase.from("review_actions").delete().eq("job_id", jobId);
    await supabase.from("uploaded_files").delete().eq("job_id", jobId);
    await supabase.from("crawled_pages").delete().eq("job_id", jobId);

    // Delete the job itself
    const { error } = await supabase
      .from("onboarding_jobs")
      .delete()
      .eq("id", jobId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
