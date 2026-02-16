import { requireGmUser } from "@/lib/gmAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resetAll } from "@/lib/gmOps";

export async function POST(request: Request) {
  let gm: { userId: string };
  try {
    gm = await requireGmUser(request);
  } catch (r) {
    return r as Response;
  }

  const admin = createSupabaseAdmin();
  const result = await resetAll(admin, gm.userId);

  return new Response(
    JSON.stringify({ ok: true, deleted: result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
