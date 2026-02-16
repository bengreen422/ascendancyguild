import { requireUserFromRequest } from "@/lib/authServer";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateDailyQuests } from "@/lib/generateDailyQuests";

export async function POST(request: Request) {
  const user = await requireUserFromRequest(request);
  const admin = createSupabaseAdmin();

  const result = await generateDailyQuests(admin, user.id, {
    createCheckinIfMissing: false,
  });

  if (!result.ok) {
    const status = result.error.includes("check-in") ? 400 : 502;
    return new Response(
      JSON.stringify({ error: result.error }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ quests: result.quests }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
