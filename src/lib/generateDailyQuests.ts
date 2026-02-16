import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns YYYY-MM-DD for "today" in the given timezone. */
export function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}

/** Hard-block unsafe patterns in rewritten text. Fall back to template if triggered. */
const UNSAFE_PATTERNS = [
  /\b(max(imum)?\s*(lift|weight|rep))/i,
  /\b(to\s*failure)\b/i,
  /\b(extreme\s*fast(ing)?)\b/i,
  /\b(sprint(ing)?\s*(all\s*out|max))/i,
  /\b(heavy\s*(lift|weight))\b/i,
  /\b(one\s*rep\s*max)\b/i,
  /\b(hiit\s*(max|all\s*out))/i,
];

function isUnsafe(text: string): boolean {
  return UNSAFE_PATTERNS.some((re) => re.test(text));
}

export type DailyQuestRow = {
  id: string;
  title: string;
  description: string;
  est_minutes: number;
  category: string;
};

type TemplateRow = {
  id: string;
  category: string;
  tags: string[] | null;
  base_minutes: number;
  completion_type: string;
  metric_name: string | null;
  is_repeatable: boolean;
  title_template: string;
  description_template: string;
};

export type GenerateDailyQuestsOptions = {
  todayDate?: string;
  /** If true, insert a default check-in when none exists (e.g. for cron email). */
  createCheckinIfMissing?: boolean;
};

export type GenerateDailyQuestsResult =
  | { ok: true; questSetId: string; quests: DailyQuestRow[] }
  | { ok: false; error: string };

/**
 * Ensure a daily quest set exists for the user on the given date; create it if not.
 * Uses admin client. When createCheckinIfMissing is true, creates a default check-in so generation can run.
 */
export async function generateDailyQuests(
  admin: SupabaseClient,
  userId: string,
  options: GenerateDailyQuestsOptions = {}
): Promise<GenerateDailyQuestsResult> {
  const { data: profile } = await admin
    .from("profiles")
    .select("tz, constraints, tone")
    .eq("user_id", userId)
    .single();

  const profileTz = (profile?.tz as string) || "UTC";
  const todayDate = options.todayDate ?? getTodayInTz(profileTz);
  const constraints = (profile?.constraints as Record<string, unknown>) || {};
  const gymAccess = constraints.gym_access === true;
  const tone = typeof profile?.tone === "number" ? profile.tone : 50;

  let { data: checkin } = await admin
    .from("daily_checkins")
    .select("id, time_available, energy, avoid_tags")
    .eq("user_id", userId)
    .eq("date", todayDate)
    .single();

  if (!checkin && options.createCheckinIfMissing) {
    await admin.from("daily_checkins").insert({
      user_id: userId,
      date: todayDate,
      time_available: 40,
      energy: "med",
      avoid_tags: [],
    });
    const { data: inserted } = await admin
      .from("daily_checkins")
      .select("id, time_available, energy, avoid_tags")
      .eq("user_id", userId)
      .eq("date", todayDate)
      .single();
    checkin = inserted ?? undefined;
  }

  if (!checkin) {
    return { ok: false, error: "No check-in for today. Complete check-in first." };
  }

  const budget = Math.min(Number(checkin.time_available) || 40, 60);
  const energy = (checkin.energy as string) || "med";
  const avoidTags = (checkin.avoid_tags as string[]) || [];

  const { data: existingSet } = await admin
    .from("daily_quest_sets")
    .select("id")
    .eq("user_id", userId)
    .eq("date", todayDate)
    .single();

  if (existingSet) {
    const { data: quests } = await admin
      .from("daily_quests")
      .select("id, title, description, est_minutes, category")
      .eq("quest_set_id", existingSet.id)
      .order("created_at");
    return {
      ok: true,
      questSetId: existingSet.id,
      quests: (quests ?? []) as DailyQuestRow[],
    };
  }

  const energyTag =
    energy === "low" ? "low_energy" : energy === "high" ? "high_energy" : "medium_energy";

  let { data: templates } = await admin
    .from("quest_templates")
    .select("id, category, tags, base_minutes, completion_type, metric_name, is_repeatable, title_template, description_template");

  if (!templates?.length) {
    return { ok: false, error: "No quest templates found" };
  }

  if (!gymAccess) {
    templates = templates.filter((t) => (t.tags as string[])?.includes("no_gym"));
  }

  templates = templates.filter((t) => {
    const tags = (t.tags as string[]) || [];
    if (avoidTags.includes("sore_legs") && (tags.includes("cardio_light") || tags.includes("strength_light"))) return false;
    if (avoidTags.includes("sore_upper") && tags.includes("strength_light")) return false;
    if (avoidTags.includes("low_social_battery") && tags.includes("social_light")) return false;
    return true;
  });

  const withEnergy = templates.filter((t) => (t.tags as string[])?.includes(energyTag));
  const pool = withEnergy.length >= 3 ? withEnergy : templates;

  const byCategory = {
    Body: pool.filter((t) => t.category === "Body"),
    Mind: pool.filter((t) => t.category === "Mind"),
    Sustenance: pool.filter((t) => t.category === "Sustenance"),
  };
  const repeatable = pool.filter((t) => t.is_repeatable === true);
  const oneOff = pool.filter((t) => t.is_repeatable === false);

  const selected: TemplateRow[] = [];
  let totalMins = 0;
  const usedId = new Set<string>();

  const pick = (arr: TemplateRow[], maxMins: number, preferShort: boolean) => {
    const sorted = preferShort
      ? [...arr].sort((a, b) => (a.base_minutes ?? 0) - (b.base_minutes ?? 0))
      : [...arr].sort((a, b) => (b.base_minutes ?? 0) - (a.base_minutes ?? 0));
    for (const t of sorted) {
      if (usedId.has(t.id)) continue;
      const m = t.base_minutes ?? 10;
      if (totalMins + m <= maxMins) {
        selected.push(t);
        usedId.add(t.id);
        totalMins += m;
        return true;
      }
    }
    return false;
  };

  const preferShort = avoidTags.includes("busy_day");

  for (const cat of ["Body", "Mind", "Sustenance"] as const) {
    const arr = byCategory[cat];
    if (arr.length) pick(arr, budget, preferShort);
  }
  if (repeatable.length && !selected.some((t) => t.is_repeatable)) {
    pick(repeatable, budget - totalMins, preferShort);
  }
  if (oneOff.length && !selected.some((t) => !t.is_repeatable)) {
    pick(oneOff, budget - totalMins, preferShort);
  }

  while (selected.length < 6 && totalMins < budget) {
    const remaining = pool.filter((t) => !usedId.has(t.id));
    if (!remaining.length) break;
    const next = preferShort
      ? remaining.sort((a, b) => (a.base_minutes ?? 0) - (b.base_minutes ?? 0))[0]
      : remaining[0];
    if (totalMins + (next.base_minutes ?? 10) <= budget) {
      selected.push(next);
      usedId.add(next.id);
      totalMins += next.base_minutes ?? 10;
    } else break;
  }

  if (selected.length === 0) {
    for (const t of pool.slice(0, Math.min(6, Math.floor(budget / 10)))) {
      selected.push(t);
      totalMins += t.base_minutes ?? 10;
    }
  }

  const { data: questSet, error: setError } = await admin
    .from("daily_quest_sets")
    .insert({
      user_id: userId,
      date: todayDate,
      minutes_budget: budget,
      generation_version: "v1",
    })
    .select("id")
    .single();

  if (setError || !questSet) {
    return { ok: false, error: setError?.message ?? "Failed to create quest set" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const openaiAvailable = Boolean(apiKey);

  const questsToInsert: Array<{
    quest_set_id: string;
    template_id: string | null;
    source: string;
    category: string;
    tags: string[];
    title: string;
    description: string;
    est_minutes: number;
    completion_type: string;
    metric_name: string | null;
    target_value: number | null;
  }> = [];

  for (const t of selected) {
    let title = t.title_template ?? "";
    let description = t.description_template ?? "";

    if (openaiAvailable) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Rewrite the following wellness quest title and description with light fantasy flavor (e.g. quest, scroll, guild). Do NOT change the underlying action, duration, or intensity. Do NOT add risky or intense exercises. Output ONLY valid JSON: {\"title\": \"...\", \"description\": \"...\"}",
              },
              {
                role: "user",
                content: `Tone 0-100 (higher = more intense wording): ${tone}. Title: ${title}. Description: ${description}.`,
              },
            ],
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const raw = data.choices?.[0]?.message?.content?.trim();
          if (raw) {
            const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
            const parsed = JSON.parse(cleaned) as { title?: string; description?: string };
            const newTitle = typeof parsed.title === "string" ? parsed.title : title;
            const newDesc = typeof parsed.description === "string" ? parsed.description : description;
            if (!isUnsafe(newTitle) && !isUnsafe(newDesc)) {
              title = newTitle;
              description = newDesc;
            }
          }
        }
      } catch {
        // keep template text
      }
    }

    questsToInsert.push({
      quest_set_id: questSet.id,
      template_id: t.id,
      source: "template",
      category: t.category,
      tags: (t.tags as string[]) ?? [],
      title,
      description,
      est_minutes: t.base_minutes ?? 10,
      completion_type: t.completion_type,
      metric_name: t.metric_name ?? null,
      target_value: t.metric_name === "minutes" ? (t.base_minutes ?? 10) : t.metric_name === "reps" ? 10 : null,
    });
  }

  const { data: inserted, error: insertError } = await admin
    .from("daily_quests")
    .insert(questsToInsert)
    .select("id, title, description, est_minutes, category");

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return {
    ok: true,
    questSetId: questSet.id,
    quests: (inserted ?? []) as DailyQuestRow[],
  };
}
