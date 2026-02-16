import { requireGmUser } from "@/lib/gmAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTodayInTz } from "@/lib/generateDailyQuests";

export async function POST(request: Request) {
  let gm: { userId: string; email: string };
  try {
    gm = await requireGmUser(request);
  } catch (r) {
    return r as Response;
  }
  const { userId, email } = gm;

  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_complete, tz")
    .eq("user_id", userId)
    .single();

  const tz = (profile?.tz as string) || "UTC";
  const today = getTodayInTz(tz);

  const { data: checkin } = await admin
    .from("daily_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  const { data: questSet } = await admin
    .from("daily_quest_sets")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  let questCount = 0;
  if (questSet?.id) {
    const { count } = await admin
      .from("daily_quests")
      .select("id", { count: "exact", head: true })
      .eq("quest_set_id", questSet.id);
    questCount = count ?? 0;
  }

  const { data: progress } = await admin
    .from("progress")
    .select("xp_total, streak_current, streak_best")
    .eq("user_id", userId)
    .single();

  return new Response(
    JSON.stringify({
      ok: true,
      userId,
      email,
      profile: {
        onboarding_complete: profile?.onboarding_complete ?? false,
        tz,
      },
      today: { date: today },
      hasCheckin: Boolean(checkin?.id),
      hasQuestSet: Boolean(questSet?.id),
      questCount,
      progress: {
        xp_total: Number(progress?.xp_total) ?? 0,
        streak_current: Number(progress?.streak_current) ?? 0,
        streak_best: Number(progress?.streak_best) ?? 0,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
