import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code       = searchParams.get("code");
  const tokenHash  = searchParams.get("token_hash");
  const type       = searchParams.get("type") ?? "";
  const next       = searchParams.get("next") ?? "/";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  let data: any = null;
  let error: any = null;

  if (code) {
    // PKCE flow — exchange code for session
    ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    // Implicit / email OTP flow — verify token_hash directly
    ({ data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    }));
  }

  if (!error && data?.user) {
    // Recovery / password reset
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/auth/reset-password", appUrl));
    }

    // Invite or new user with no password set -> complete signup
    const isInvite = type === "invite" || type === "magiclink" && !data.user.last_sign_in_at;
    const hasNoPassword =
      data.user.app_metadata?.provider === "email" &&
      !data.user.last_sign_in_at;

    if (isInvite || hasNoPassword || next.includes("complete-signup")) {
      return NextResponse.redirect(new URL("/auth/complete-signup", appUrl));
    }

    return NextResponse.redirect(new URL(next || "/", appUrl));
  }

  // Nothing worked — go to login
  return NextResponse.redirect(new URL("/login?error=auth_failed", appUrl));
}
