import { requireGmUser } from "@/lib/gmAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resetDay } from "@/lib/gmOps";
import { generateDailyQuests, getTodayInTz } from "@/lib/generateDailyQuests";

type CheckinBody = {
  time_available?: 10 | 20 | 40 | 60;
  energy?: "low" | "med" | "high";
  avoid_tags?: string[];
};

export async function POST(request: Request) {
  let gm: { userId: string; body: Record<string, unknown> };
  try {
    gm = await requireGmUser(request);
  } catch (r) {
    return r as Response;
  }

  const { userId, body } = gm;
  const dateParam = typeof body?.date === "string" ? body.date.trim() : null;
  const resetFirst = body?.resetFirst === true;
  const checkin = body?.checkin as CheckinBody | undefined;

  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("tz")
    .eq("user_id", userId)
    .single();
  const tz = (profile?.tz as string) || "UTC";
  const todayDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getTodayInTz(tz);

  if (resetFirst) {
    await resetDay(admin, userId, todayDate);
  }

  if (checkin && typeof checkin === "object") {
    const time_available = [10, 20, 40, 60].includes(Number(checkin.time_available))
      ? Number(checkin.time_available)
      : 40;
    const energy = ["low", "med", "high"].includes(checkin.energy ?? "")
      ? (checkin.energy as "low" | "med" | "high")
      : "med";
    const avoid_tags = Array.isArray(checkin.avoid_tags) ? checkin.avoid_tags : [];
    await admin.from("daily_checkins").upsert(
      {
        user_id: userId,
        date: todayDate,
        time_available,
        energy,
        avoid_tags,
      },
      { onConflict: "user_id,date" }
    );
  }

  const result = await generateDailyQuests(admin, userId, {
    todayDate,
    createCheckinIfMissing: !checkin,
  });

  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      date: todayDate,
      questSetId: result.questSetId,
      questCount: result.quests.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
