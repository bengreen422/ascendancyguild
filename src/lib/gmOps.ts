import type { SupabaseClient } from "@supabase/supabase-js";

export type ResetDayResult = {
  quest_logs: number;
  daily_quests: number;
  daily_quest_sets: number;
  daily_checkins: number;
  daily_email_sends: number;
};

export type ResetAllResult = {
  quest_logs: number;
  daily_quests: number;
  daily_quest_sets: number;
  daily_checkins: number;
  daily_email_sends: number;
  progress: number;
  profiles: number;
};

/**
 * Reset a single day for the user: delete quest_logs, daily_quests, daily_quest_sets, daily_checkins, daily_email_sends for that date.
 * Deletes in correct order to respect FKs.
 */
export async function resetDay(
  admin: SupabaseClient,
  userId: string,
  date: string
): Promise<ResetDayResult> {
  const out: ResetDayResult = {
    quest_logs: 0,
    daily_quests: 0,
    daily_quest_sets: 0,
    daily_checkins: 0,
    daily_email_sends: 0,
  };

  const { data: set } = await admin
    .from("daily_quest_sets")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (set) {
    const { data: quests } = await admin
      .from("daily_quests")
      .select("id")
      .eq("quest_set_id", set.id);
    const questIds = (quests ?? []).map((q) => q.id);

    if (questIds.length > 0) {
      const { count: logCount } = await admin
        .from("quest_logs")
        .delete()
        .in("daily_quest_id", questIds)
        .select("*", { count: "exact", head: true });
      out.quest_logs = logCount ?? 0;
    }

    const { count: questCount } = await admin
      .from("daily_quests")
      .delete()
      .eq("quest_set_id", set.id)
      .select("*", { count: "exact", head: true });
    out.daily_quests = questCount ?? 0;
  }

  const { count: setCount } = await admin
    .from("daily_quest_sets")
    .delete()
    .eq("user_id", userId)
    .eq("date", date)
    .select("*", { count: "exact", head: true });
  out.daily_quest_sets = setCount ?? 0;

  const { count: checkinCount } = await admin
    .from("daily_checkins")
    .delete()
    .eq("user_id", userId)
    .eq("date", date)
    .select("*", { count: "exact", head: true });
  out.daily_checkins = checkinCount ?? 0;

  const { count: emailCount } = await admin
    .from("daily_email_sends")
    .delete()
    .eq("user_id", userId)
    .eq("date", date)
    .select("*", { count: "exact", head: true });
  out.daily_email_sends = emailCount ?? 0;

  return out;
}

/**
 * Full reset for the user: delete all their data (quest_logs via quests, daily_quests, daily_quest_sets, daily_checkins, daily_email_sends, progress, profiles).
 */
export async function resetAll(
  admin: SupabaseClient,
  userId: string
): Promise<ResetAllResult> {
  const out: ResetAllResult = {
    quest_logs: 0,
    daily_quests: 0,
    daily_quest_sets: 0,
    daily_checkins: 0,
    daily_email_sends: 0,
    progress: 0,
    profiles: 0,
  };

  const { data: sets } = await admin
    .from("daily_quest_sets")
    .select("id")
    .eq("user_id", userId);
  const setIds = (sets ?? []).map((s) => s.id);

  if (setIds.length > 0) {
    const { data: quests } = await admin
      .from("daily_quests")
      .select("id")
      .in("quest_set_id", setIds);
    const questIds = (quests ?? []).map((q) => q.id);

    if (questIds.length > 0) {
      const { count: logCount } = await admin
        .from("quest_logs")
        .delete()
        .in("daily_quest_id", questIds)
        .select("*", { count: "exact", head: true });
      out.quest_logs = logCount ?? 0;
    }

    const { count: questCount } = await admin
      .from("daily_quests")
      .delete()
      .in("quest_set_id", setIds)
      .select("*", { count: "exact", head: true });
    out.daily_quests = questCount ?? 0;
  }

  const { count: setCount } = await admin
    .from("daily_quest_sets")
    .delete()
    .eq("user_id", userId)
    .select("*", { count: "exact", head: true });
  out.daily_quest_sets = setCount ?? 0;

  const { count: checkinCount } = await admin
    .from("daily_checkins")
    .delete()
    .eq("user_id", userId)
    .select("*", { count: "exact", head: true });
  out.daily_checkins = checkinCount ?? 0;

  const { count: emailCount } = await admin
    .from("daily_email_sends")
    .delete()
    .eq("user_id", userId)
    .select("*", { count: "exact", head: true });
  out.daily_email_sends = emailCount ?? 0;

  const { count: progressCount } = await admin
    .from("progress")
    .delete()
    .eq("user_id", userId)
    .select("*", { count: "exact", head: true });
  out.progress = progressCount ?? 0;

  const { count: profileCount } = await admin
    .from("profiles")
    .delete()
    .eq("user_id", userId)
    .select("*", { count: "exact", head: true });
  out.profiles = profileCount ?? 0;

  return out;
}
