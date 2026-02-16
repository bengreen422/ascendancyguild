import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

const GM_EMAIL = process.env.GM_EMAIL;

export type GmUserResult = { userId: string; email: string; body: Record<string, unknown> };

/**
 * Verify the request is from the GM user (email matches GM_EMAIL).
 * Expects JSON body: { access_token: string, ...rest }. Parses body once and returns it so routes can use other fields.
 * Returns { userId, email, body } or throws Response (403/500).
 */
export async function requireGmUser(request: Request): Promise<GmUserResult> {
  if (!GM_EMAIL || GM_EMAIL.trim() === "") {
    return Promise.reject(
      new Response(
        JSON.stringify({ error: "GM_EMAIL is not configured. Set GM_EMAIL in environment." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Promise.reject(
      new Response(
        JSON.stringify({ error: "Invalid JSON body. Send { access_token } from supabase.auth.getSession()." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
  }

  const accessToken =
    typeof body?.access_token === "string" ? body.access_token.trim() : null;

  if (!accessToken) {
    return Promise.reject(
      new Response(
        JSON.stringify({ error: "Missing access_token in body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
  }

  const supabase = createSupabaseBrowser();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return Promise.reject(
      new Response(
        JSON.stringify({ error: "Invalid or expired token." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  const expectedEmail = GM_EMAIL.trim().toLowerCase();

  if (email !== expectedEmail) {
    return Promise.reject(
      new Response(
        JSON.stringify({ error: "Forbidden. GM access only." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    );
  }

  return { userId: user.id, email: user.email ?? "", body: body ?? {} };
}
