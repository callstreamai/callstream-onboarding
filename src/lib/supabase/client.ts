import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use the PKCE flow so email links carry a `?code=` that can ONLY be
        // exchanged by the browser that requested it (it holds the code_verifier).
        // This defeats email security scanners (e.g. Microsoft Safe Links /
        // Outlook / Teams) that pre-fetch links: a scanner has no verifier, so
        // its GET cannot consume the code, and the real user's click still works.
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}
