import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") ?? "";
  const next      = searchParams.get("next") ?? "/";
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";

  // If there's a code (PKCE flow) or token_hash, handle server-side
  if (code || tokenHash) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    let data: any = null;
    let error: any = null;

    if (code) {
      ({ data, error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (tokenHash && type) {
      ({ data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any }));
    }

    if (!error && data?.user) {
      if (type === "recovery") return NextResponse.redirect(new URL("/auth/reset-password", appUrl));
      const isNew = !data.user.last_sign_in_at || (data.user.created_at === data.user.updated_at);
      if (type === "invite" || type === "magiclink" && isNew) {
        return NextResponse.redirect(new URL("/auth/complete-signup", appUrl));
      }
      return NextResponse.redirect(new URL(next || "/", appUrl));
    }
  }

  // No server-readable token — must be implicit flow (hash fragment).
  // Forward to the client-side handler which can read window.location.hash.
  return NextResponse.redirect(new URL("/auth/handle", appUrl));
}
