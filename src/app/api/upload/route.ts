import { NextResponse } from "next/server";
import { requireAdmin,accessResponse } from "@/lib/access";
export async function POST(){try {await requireAdmin();return NextResponse.json({error:"Please reload and use Create property to start onboarding."},{status:410});}catch(error){return accessResponse(error);}}
