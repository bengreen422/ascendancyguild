import { requireUserFromRequest } from "@/lib/authServer";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTodayInTz } from "@/lib/generateDailyQuests";

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

function computeLevel(xpTotal: number): {
  level: number;
  xp_into_level: number;
  xp_needed_for_next_level: number;
} {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      const currentThreshold = LEVEL_THRESHOLDS[i];
      const nextThreshold = LEVEL_THRESHOLDS[i + 1];
      const xpIntoLevel = xpTotal - currentThreshold;
      const xpNeeded = nextThreshold != null ? nextThreshold - currentThreshold : 0;
      return {
        level,
        xp_into_level: xpIntoLevel,
        xp_needed_for_next_level: xpNeeded,
      };
    }
  }
  return {
    level: 1,
    xp_into_level: xpTotal,
    xp_needed_for_next_level: LEVEL_THRESHOLDS[1]! - LEVEL_THRESHOLDS[0]!,
  };
}

export async function GET(request: Request) {
  const user = await requireUserFromRequest(request);
  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("class_selected, goals, tone, tz")
    .eq("user_id", user.id)
    .single();

  const { data: progress } = await admin
    .from("progress")
    .select("xp_total, streak_current, streak_best, attributes")
    .eq("user_id", user.id)
    .single();

  const tz = (profile?.tz as string) || "UTC";
  const today = getTodayInTz(tz);

  function prevDate(dateStr: string, timeZone: string): string {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toLocaleDateString("en-CA", { timeZone });
  }

  const dates: string[] = [today];
  let d = today;
  for (let i = 0; i < 6; i++) {
    d = prevDate(d, tz);
    dates.push(d);
  }
  const fromDate = dates[dates.length - 1]!;
  const toDate = today;

  const { data: sets } = await admin
    .from("daily_quest_sets")
    .select("id, date")
    .eq("user_id", user.id)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (!sets?.length) {
    const xpTotal = Number(progress?.xp_total) ?? 0;
    const level = computeLevel(xpTotal);
    return new Response(
      JSON.stringify({
        profile: {
          class_selected: profile?.class_selected ?? null,
          goals: profile?.goals ?? [],
          tone: profile?.tone ?? 0,
        },
        progress: {
          xp_total: xpTotal,
          streak_current: Number(progress?.streak_current) ?? 0,
          streak_best: Number(progress?.streak_best) ?? 0,
          attributes: progress?.attributes ?? {},
        },
        level,
        recent: {
          today: [],
          last7days: [],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const setIds = sets.map((s) => s.id);
  const { data: quests } = await admin
    .from("daily_quests")
    .select("id, quest_set_id, title, category")
    .in("quest_set_id", setIds);

  const setIdToDate = new Map(sets.map((s) => [s.id, s.date as string]));
  const questIdToQuest = new Map(
    (quests ?? []).map((q) => [
      q.id,
      { title: q.title, category: q.category, quest_set_id: q.quest_set_id },
    ])
  );
  const questIds = (quests ?? []).map((q) => q.id);

  const { data: logs } = await admin
    .from("quest_logs")
    .select("daily_quest_id, completion_percent, completed_at")
    .in("daily_quest_id", questIds);

  const todayQuests: Array<{
    title: string;
    category: string;
    completion_percent: number;
    completed_at: string | null;
  }> = [];
  const byDate: Record<
    string,
    Array<{ title: string; category: string; completion_percent: number; completed_at: string | null }>
  > = {};

  for (const log of logs ?? []) {
    const quest = questIdToQuest.get(log.daily_quest_id);
    if (!quest) continue;
    const date = setIdToDate.get(quest.quest_set_id);
    if (!date) continue;
    const entry = {
      title: quest.title,
      category: quest.category,
      completion_percent: Number(log.completion_percent) ?? 0,
      completed_at: log.completed_at as string | null,
    };
    if (date === today) {
      todayQuests.push(entry);
    } else {
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(entry);
    }
  }

  const last7days = dates
    .filter((date) => date !== today)
    .reverse()
    .map((date) => ({
      date,
      quests: byDate[date] ?? [],
    }));

  const xpTotal = Number(progress?.xp_total) ?? 0;
  const level = computeLevel(xpTotal);

  return new Response(
    JSON.stringify({
      profile: {
        class_selected: profile?.class_selected ?? null,
        goals: profile?.goals ?? [],
        tone: profile?.tone ?? 0,
      },
      progress: {
        xp_total: xpTotal,
        streak_current: Number(progress?.streak_current) ?? 0,
        streak_best: Number(progress?.streak_best) ?? 0,
        attributes: progress?.attributes ?? {},
      },
      level,
      recent: {
        today: todayQuests,
        last7days,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
