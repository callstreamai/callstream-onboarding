import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureContactPortalUser } from "@/lib/provisionContactUser";

export async function POST(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const { email, fullName } = await req.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const supabase = createServiceClient();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const provisioned = await ensureContactPortalUser({
      accountId: params.accountId,
      email,
      fullName,
    });

    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", params.accountId)
      .single();

    const firstJobId = provisioned.linkedJobs[0] || null;
    const loginUrl = appUrl + "/login";
    const onboardingUrl = firstJobId ? appUrl + "/onboarding/" + firstJobId + "/workspace" : loginUrl;

    return NextResponse.json({
      success: true,
      userId: provisioned.user?.id,
      magicLink: loginUrl,
      loginUrl,
      onboardingUrl,
      linkedJobs: provisioned.linkedJobs,
      propertyName: account?.name || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
