import { NextRequest, NextResponse } from "next/server";
import { getProperty } from "@/lib/properties";
import { AccessError, accessResponse } from "@/lib/access";
export async function PATCH(
  req: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  try {
    const { db, property } = await getProperty(params.propertyId, true);
    const { name, website_url } = await req.json();
    if (typeof name !== "string" || !name.trim() || name.length > 200)
      throw new AccessError("Enter a property name.", 400);
    let url: URL;
    try {
      url = new URL(website_url);
    } catch {
      throw new AccessError("Enter a valid website URL.", 400);
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".")
    )
      throw new AccessError("Enter a public website URL.", 400);
    const { error } = await db
      .from("onboarding_jobs")
      .update({ property_name: name.trim(), property_url: url.href })
      .eq("id", property.workspace_job_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return accessResponse(e);
  }
}
