import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-SIDE ONLY. Use in API routes, Route Handlers, and server components.
 * Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS. Never expose to the browser.
 */
export function createSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createSupabaseAdmin() must not be used in the browser. Use createSupabaseBrowser() or supabase from supabaseBrowser.ts instead."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
