import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { User } from "@supabase/supabase-js";

/**
 * Auth helpers for Next.js App Router Route Handlers (API routes).
 *
 * SUPPORTED: Authorization header (Bearer <access_token>).
 * - Client can send the session access_token in the header for server-side auth.
 * - Get the token via: (await supabase.auth.getSession()).data.session?.access_token
 *
 * NOT SUPPORTED HERE: Cookie-based auth in Route Handlers.
 * - Magic-link login sets session in cookies client-side; those cookies are not
 *   read by this helper. For cookie-based server auth (e.g. server components or
 *   cookie-only API calls), use @supabase/ssr createServerClient with request
 *   cookies, or parse the Supabase auth cookie manually.
 */

/**
 * Returns the authenticated user for the request, or null if missing/invalid.
 * Reads the JWT from the Authorization header: "Bearer <access_token>".
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return null;
  }

  const supabase = createSupabaseBrowser();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Returns the authenticated user for the request.
 * Throws a 401 Response if not authenticated (for use in Route Handlers).
 */
export async function requireUserFromRequest(
  request: Request
): Promise<User> {
  const user = await getUserFromRequest(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
