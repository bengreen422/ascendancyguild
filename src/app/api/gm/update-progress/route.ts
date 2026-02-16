import { requireGmUser } from "@/lib/gmAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  let gm: { userId: string; body: Record<string, unknown> };
  try {
    gm = await requireGmUser(request);
  } catch (r) {
    return r as Response;
  }

  const { userId, body } = gm;
  const xpDelta = typeof body?.xp_delta === "number" ? body.xp_delta : undefined;
  const xpTotalSet = typeof body?.xp_total === "number" ? body.xp_total : undefined;
  const streakCurrent =
    typeof body?.streak_current === "number" ? body.streak_current : undefined;
  const streakBest =
    typeof body?.streak_best === "number" ? body.streak_best : undefined;

  if (
    xpDelta === undefined &&
    xpTotalSet === undefined &&
    streakCurrent === undefined &&
    streakBest === undefined
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Send at least one of: xp_delta, xp_total, streak_current, streak_best",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("progress")
    .select("xp_total, streak_current, streak_best, attributes")
    .eq("user_id", userId)
    .single();

  let xpTotal = Number(existing?.xp_total) ?? 0;
  if (xpDelta !== undefined) {
    xpTotal = Math.max(0, xpTotal + xpDelta);
  } else if (xpTotalSet !== undefined) {
    xpTotal = Math.max(0, xpTotalSet);
  }

  let streakCurrentVal = Number(existing?.streak_current) ?? 0;
  let streakBestVal = Number(existing?.streak_best) ?? 0;
  if (streakCurrent !== undefined) {
    streakCurrentVal = Math.max(0, streakCurrent);
    if (streakBestVal < streakCurrentVal) streakBestVal = streakCurrentVal;
  }
  if (streakBest !== undefined) {
    streakBestVal = Math.max(0, streakBest);
  }

  const { error } = await admin.from("progress").upsert(
    {
      user_id: userId,
      xp_total: xpTotal,
      streak_current: streakCurrentVal,
      streak_best: streakBestVal,
      attributes: existing?.attributes ?? {},
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      progress: {
        xp_total: xpTotal,
        streak_current: streakCurrentVal,
        streak_best: streakBestVal,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
