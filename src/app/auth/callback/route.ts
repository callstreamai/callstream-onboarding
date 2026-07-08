import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const type = searchParams.get("type") ?? "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Recovery / password reset -> go to reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/auth/reset-password", appUrl));
      }

      // Invite or new user with no password -> complete signup
      const isInvite = type === "invite" || next.includes("complete-signup");
      const hasNoPassword = data?.user?.app_metadata?.provider === "email" &&
        !data?.user?.last_sign_in_at && data?.user?.created_at === data?.user?.updated_at;

      if (isInvite || hasNoPassword) {
        return NextResponse.redirect(new URL("/auth/complete-signup", appUrl));
      }

      return NextResponse.redirect(new URL(next, appUrl));
    }
  }

  return NextResponse.redirect(new URL("/login", appUrl));
}
