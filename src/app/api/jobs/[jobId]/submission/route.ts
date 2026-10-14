import { NextRequest, NextResponse } from "next/server";
import { requireProject, accessResponse, AccessError } from "@/lib/access";
import { sourceInventory } from "@/lib/knowledge/sources";
export const dynamic = "force-dynamic";
export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const { db, job } = await requireProject(params.jobId);
    const [inventory, state] = await Promise.all([
      sourceInventory(db, params.jobId),
      db
        .from("property_operations")
        .select("submitted_at,submission_hash")
        .eq("job_id", params.jobId)
        .maybeSingle(),
    ]);
    if (state.error) throw state.error;
    return NextResponse.json(
      {
        propertyName: job.property_name,
        submittedAt: state.data?.submitted_at || null,
        changedSinceSubmission:
          !!state.data?.submission_hash &&
          state.data.submission_hash !== inventory.hash,
        fileCount: inventory.documents.length,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return accessResponse(error);
  }
}
export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const { db, user } = await requireProject(params.jobId);
    const inventory = await sourceInventory(db, params.jobId);
    if (!inventory.documents.length)
      throw new AccessError(
        "Upload your property files before submitting them for review.",
        422,
      );
    const { error } = await db.rpc("submit_property_files", {
      p_job: params.jobId,
      p_actor: user.id,
      p_hash: inventory.hash,
    });
    if (error) throw error;
    return NextResponse.json({ submitted: true });
  } catch (error) {
    return accessResponse(error);
  }
}
