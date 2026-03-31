import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    
    // Simple secret to prevent unauthorized access
    if (secret !== "callstream-setup-2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Drop the broken trigger
    const { error: dropErr } = await supabase.rpc("exec_sql", {
      sql: "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;"
    });
    
    // If exec_sql doesn't exist, try another approach
    if (dropErr) {
      console.log("exec_sql not available, trying direct approach:", dropErr.message);
    }

    // Step 2: Create admin user via auth admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: "vince@callstreamai.com",
      password: "CallStream2026!",
      email_confirm: true,
      user_metadata: {
        full_name: "Vincent Lamartina",
        company_name: "Call Stream AI"
      }
    });

    if (userError && !userError.message.includes("already been registered")) {
      // If user creation fails due to trigger, we need the trigger fixed first
      return NextResponse.json({
        error: "User creation failed - trigger still broken",
        detail: userError.message,
        fix: "Run this SQL in Supabase SQL Editor: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; Then call this endpoint again."
      }, { status: 500 });
    }

    // Step 3: If user exists or was just created, ensure profile exists
    const { data: users } = await supabase.auth.admin.listUsers();
    const vince = users?.users?.find(u => u.email === "vince@callstreamai.com");
    
    if (vince) {
      // Upsert profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: vince.id,
          email: "vince@callstreamai.com",
          full_name: "Vincent Lamartina",
          company_name: "Call Stream AI",
          role: "admin",
        }, { onConflict: "id" });

      if (profileError) {
        return NextResponse.json({
          success: false,
          error: "Profile upsert failed: " + profileError.message,
          userId: vince.id
        });
      }

      // Confirm email if not confirmed
      if (!vince.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(vince.id, {
          email_confirm: true,
        });
      }

      return NextResponse.json({
        success: true,
        userId: vince.id,
        message: "Admin user created and profile set up"
      });
    }

    return NextResponse.json({
      error: "Could not find or create user",
      fix: "Run DROP TRIGGER on_auth_user_created in SQL Editor first"
    }, { status: 500 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
