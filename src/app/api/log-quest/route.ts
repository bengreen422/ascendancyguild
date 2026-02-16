import { requireUserFromRequest } from "@/lib/authServer";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Returns YYYY-MM-DD for "today" in the given timezone. */
function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}

export async function POST(request: Request) {
  const user = await requireUserFromRequest(request);
  const admin = createSupabaseAdmin();

  let body: {
    daily_quest_id?: string;
    completed_value?: number;
    mark_done?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { daily_quest_id, completed_value, mark_done } = body;
  if (!daily_quest_id) {
    return new Response(
      JSON.stringify({ error: "daily_quest_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: quest, error: questError } = await admin
    .from("daily_quests")
    .select("id, quest_set_id, completion_type, metric_name, target_value, est_minutes, category")
    .eq("id", daily_quest_id)
    .single();

  if (questError || !quest) {
    return new Response(
      JSON.stringify({ error: "Quest not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: set } = await admin
    .from("daily_quest_sets")
    .select("user_id, date")
    .eq("id", quest.quest_set_id)
    .single();

  if (!set || set.user_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  let completionPercent = 0;
  const completedAt = new Date().toISOString();

  if (quest.completion_type === "binary") {
    completionPercent = mark_done === true ? 100 : 0;
  } else {
    const val = completed_value ?? 0;
    const target = quest.target_value != null ? Number(quest.target_value) : null;
    const estMins = Number(quest.est_minutes) || 10;
    if (quest.metric_name === "minutes" && (target != null || estMins > 0)) {
      const denom = target ?? estMins;
      completionPercent = Math.min(100, Math.round((val / denom) * 100));
    } else if (quest.metric_name === "reps" && target != null && target > 0) {
      completionPercent = Math.min(100, Math.round((val / target) * 100));
    } else {
      completionPercent = val > 0 ? 100 : 0;
    }
  }

  const { data: existingLog } = await admin
    .from("quest_logs")
    .select("id, completion_percent")
    .eq("daily_quest_id", daily_quest_id)
    .limit(1)
    .single();

  const previousPercent = existingLog ? (existingLog.completion_percent ?? 0) : 0;

  if (existingLog) {
    await admin
      .from("quest_logs")
      .update({
        completed_value: completed_value ?? null,
        completion_percent: completionPercent,
        completed_at: completionPercent >= 100 ? completedAt : null,
      })
      .eq("id", existingLog.id);
  } else {
    await admin.from("quest_logs").insert({
      daily_quest_id,
      completed_value: completed_value ?? null,
      completion_percent: completionPercent,
      completed_at: completionPercent >= 100 ? completedAt : null,
    });
  }

  const profileTz = ((await admin.from("profiles").select("tz").eq("user_id", user.id).single()).data?.tz as string) || "UTC";
  const todayDate = getTodayInTz(profileTz);

  const { data: questSet } = await admin
    .from("daily_quest_sets")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", todayDate)
    .single();

  if (!questSet) {
    return new Response(
      JSON.stringify({ ok: true, completion_percent: completionPercent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: todayQuests } = await admin
    .from("daily_quests")
    .select("id")
    .eq("quest_set_id", questSet.id);

  const questIds = (todayQuests ?? []).map((q) => q.id);
  const { data: logs } = await admin
    .from("quest_logs")
    .select("daily_quest_id, completion_percent")
    .in("daily_quest_id", questIds);

  const sumPercent = (logs ?? []).reduce((s, l) => s + (l.completion_percent ?? 0), 0);
  const countQuests = questIds.length || 1;
  const avgPercent = Math.round(sumPercent / countQuests);
  const xpFromToday = Math.round(sumPercent / 10);

  const { data: progressRow } = await admin
    .from("progress")
    .select("xp_total, streak_current, streak_best, attributes")
    .eq("user_id", user.id)
    .single();

  let xpTotal = Number(progressRow?.xp_total) || 0;
  let streakCurrent = Number(progressRow?.streak_current) || 0;
  let streakBest = Number(progressRow?.streak_best) || 0;
  const attrs = (progressRow?.attributes as Record<string, number | string>) || {};

  const xpSnapshotKey = "xp_snapshot_date";
  const xpSnapshotValKey = "xp_snapshot_value";
  const streakCountedKey = "streak_counted_date";

  const snapshotDate = attrs[xpSnapshotKey] as string | undefined;
  const snapshotVal = Number(attrs[xpSnapshotValKey]) || 0;
  if (snapshotDate !== todayDate) {
    attrs[xpSnapshotKey] = todayDate;
    attrs[xpSnapshotValKey] = xpTotal;
  }
  xpTotal = (snapshotDate === todayDate ? snapshotVal : xpTotal) + xpFromToday;

  if (avgPercent >= 70) {
    const lastCounted = attrs[streakCountedKey] as string | undefined;
    if (lastCounted !== todayDate) {
      if (lastCounted === yesterday(profileTz)) {
        streakCurrent += 1;
      } else if (!lastCounted || lastCounted < yesterday(profileTz)) {
        streakCurrent = 1;
      }
      streakBest = Math.max(streakBest, streakCurrent);
      attrs[streakCountedKey] = todayDate;
    }
  }

  const categoryToAttr: Record<string, string> = {
    Body: "Strength",
    Mind: "Wisdom",
    Sustenance: "Vitality",
  };
  const attrKey = categoryToAttr[quest.category as string] ?? quest.category;
  const delta = (completionPercent - previousPercent) / 100;
  attrs[attrKey] = (Number(attrs[attrKey]) || 0) + Math.round(delta);

  await admin
    .from("progress")
    .upsert(
      {
        user_id: user.id,
        xp_total: xpTotal,
        streak_current: streakCurrent,
        streak_best: streakBest,
        attributes: attrs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return new Response(
    JSON.stringify({
      ok: true,
      completion_percent: completionPercent,
      xp_total: xpTotal,
      streak_current: streakCurrent,
      streak_best: streakBest,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function yesterday(tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}
