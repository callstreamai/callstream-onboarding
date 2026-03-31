import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, companyName } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user via admin API (bypasses client-side signup trigger issues)
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName, company_name: companyName },
    });

    if (userError) {
      // If user already exists, try to just create the profile
      if (userError.message.includes("already been registered")) {
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email === email);
        if (existing) {
          await supabase.from("profiles").upsert({
            id: existing.id,
            email,
            full_name: fullName,
            company_name: companyName,
            role: "client",
          }, { onConflict: "id" });
          return NextResponse.json({ success: true, message: "Profile created for existing user" });
        }
      }
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    if (userData?.user) {
      // Manually create profile row
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userData.user.id,
        email,
        full_name: fullName,
        company_name: companyName,
        role: "client",
      }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }

      return NextResponse.json({ success: true, userId: userData.user.id });
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
