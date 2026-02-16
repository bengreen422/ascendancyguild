"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";

const TIME_OPTIONS = [10, 20, 40, 60] as const;
const ENERGY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
] as const;
const AVOID_TAG_OPTIONS = [
  "sore_legs",
  "sore_upper",
  "stressed",
  "low_social_battery",
  "busy_day",
] as const;

function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}

type DailyQuest = {
  id: string;
  category: string;
  title: string;
  description: string;
  est_minutes: number;
  completion_type: string;
  metric_name: string | null;
  target_value: number | null;
};

type QuestLog = {
  daily_quest_id: string;
  completion_percent: number;
  completed_value?: number;
};

export default function DailyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profileTz, setProfileTz] = useState("UTC");
  const [todayDate, setTodayDate] = useState("");
  const [checkin, setCheckin] = useState<{ id: string } | null>(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [timeAvailable, setTimeAvailable] = useState(40);
  const [energy, setEnergy] = useState<"low" | "med" | "high">("med");
  const [avoidTags, setAvoidTags] = useState<string[]>([]);

  const [questSetId, setQuestSetId] = useState<string | null>(null);
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [logs, setLogs] = useState<QuestLog[]>([]);
  const [progress, setProgress] = useState<{ xp_total: number; streak_current: number; streak_best: number } | null>(null);
  const [loadingScroll, setLoadingScroll] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState<string | null>(null);
  const [measurableValues, setMeasurableValues] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_complete, tz")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      router.replace("/onboarding");
      return;
    }
    if (profile.onboarding_complete !== true) {
      router.replace("/onboarding");
      return;
    }

    const tz = (profile.tz as string) || "UTC";
    setProfileTz(tz);
    const today = getTodayInTz(tz);
    setTodayDate(today);

    const { data: checkinRow } = await supabase
      .from("daily_checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();
    setCheckin(checkinRow ?? null);

    if (checkinRow) {
      const { data: set } = await supabase
        .from("daily_quest_sets")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();
      setQuestSetId(set?.id ?? null);
      if (set) {
        const { data: questRows } = await supabase
          .from("daily_quests")
          .select("id, category, title, description, est_minutes, completion_type, metric_name, target_value")
          .eq("quest_set_id", set.id)
          .order("created_at");
        setQuests((questRows ?? []) as DailyQuest[]);

        const questIds = (questRows ?? []).map((q) => q.id);
        if (questIds.length) {
          const { data: logRows } = await supabase
            .from("quest_logs")
            .select("daily_quest_id, completion_percent, completed_value")
            .in("daily_quest_id", questIds);
          setLogs((logRows ?? []) as QuestLog[]);
        }
      }

      const { data: prog } = await supabase
        .from("progress")
        .select("xp_total, streak_current, streak_best")
        .eq("user_id", user.id)
        .single();
      setProgress(prog ?? null);
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitCheckin(e: React.FormEvent) {
    e.preventDefault();
    setCheckinError(null);
    setCheckinSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      router.replace("/login");
      setCheckinSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("daily_checkins").upsert(
      {
        user_id: user.id,
        date: todayDate,
        time_available: timeAvailable,
        energy,
        avoid_tags: avoidTags,
      },
      { onConflict: "user_id,date" }
    );

    if (insertError) {
      setCheckinError(insertError.message);
      setCheckinSubmitting(false);
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      setCheckinError("Session expired.");
      setCheckinSubmitting(false);
      return;
    }

    setLoadingScroll(true);
    const res = await fetch("/api/generate-daily", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setLoadingScroll(false);

    if (!res.ok) {
      setCheckinError(data.error ?? "Failed to generate quests");
      setCheckinSubmitting(false);
      return;
    }

    setCheckinSubmitting(false);
    await loadData();
  }

  async function logQuest(questId: string, markDone?: boolean, completedValue?: number) {
    setLogSubmitting(questId);
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      router.replace("/login");
      setLogSubmitting(null);
      return;
    }

    const body: Record<string, unknown> = { daily_quest_id: questId };
    if (markDone !== undefined) body.mark_done = markDone;
    if (completedValue !== undefined) body.completed_value = completedValue;

    const res = await fetch("/api/log-quest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    setLogSubmitting(null);

    if (res.ok) {
      const newLog: QuestLog = {
        daily_quest_id: questId,
        completion_percent: result.completion_percent ?? 0,
        completed_value: result.completed_value ?? completedValue,
      };
      setLogs((prev) => {
        const rest = prev.filter((l) => l.daily_quest_id !== questId);
        return [...rest, newLog];
      });
      if (result.xp_total != null || result.streak_current != null) {
        setProgress((p) => ({
          xp_total: result.xp_total ?? p?.xp_total ?? 0,
          streak_current: result.streak_current ?? p?.streak_current ?? 0,
          streak_best: result.streak_best ?? p?.streak_best ?? 0,
        }));
      }
      loadData();
    }
  }

  function toggleAvoid(tag: string) {
    setAvoidTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  if (!ready) {
    return (
      <PixelLayout title="Daily Quest Scroll" navLabel="View Profile" navHref="/profile">
        <p className="text-[var(--pixel-text-muted)]">Loading…</p>
      </PixelLayout>
    );
  }

  if (!checkin) {
    return (
      <PixelLayout title="Daily Quest Scroll" navLabel="View Profile" navHref="/profile">
        <div className="pixel-panel pixel-border p-4 mt-4">
          <h2 className="pixel-title text-xl">Daily Check-in</h2>
          <p className="mt-2 text-sm text-[var(--pixel-text-muted)]">
            Quick answers so we can build your scroll.
          </p>

          <form onSubmit={submitCheckin} className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[var(--pixel-text)] mb-2">
                Time available (minutes)
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeAvailable(t)}
                    className={`pixel-button ${timeAvailable === t ? "ring-2 ring-[var(--pixel-accent-bright)]" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--pixel-text)] mb-2">
                Energy level
              </label>
              <div className="flex gap-4">
                {ENERGY_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="energy"
                      checked={energy === value}
                      onChange={() => setEnergy(value)}
                      className="accent-[var(--pixel-accent)]"
                    />
                    <span className="text-[var(--pixel-text)]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--pixel-text)] mb-2">
                Avoid today (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVOID_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleAvoid(tag)}
                    className={`pixel-button ${avoidTags.includes(tag) ? "ring-2 ring-amber-600" : ""}`}
                  >
                    {tag.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {checkinError && (
              <p className="text-sm text-red-600" role="alert">
                {checkinError}
              </p>
            )}

            <button
              type="submit"
              disabled={checkinSubmitting || loadingScroll}
              className="w-full pixel-button py-3"
            >
              {checkinSubmitting || loadingScroll ? "Building your scroll…" : "Continue"}
            </button>
          </form>
        </div>
      </PixelLayout>
    );
  }

  const byCategory = {
    Body: quests.filter((q) => q.category === "Body"),
    Mind: quests.filter((q) => q.category === "Mind"),
    Sustenance: quests.filter((q) => q.category === "Sustenance"),
  };
  const totalPercent = quests.length
    ? Math.round(
        quests.reduce((s, q) => {
          const log = logs.find((l) => l.daily_quest_id === q.id);
          return s + (log?.completion_percent ?? 0);
        }, 0) / quests.length
      )
    : 0;

  return (
    <PixelLayout title="Daily Quest Scroll" navLabel="View Profile" navHref="/profile">
      <div className="pixel-panel pixel-border p-4 mt-4">
        <h2 className="pixel-title text-xl">Your Quest Scroll</h2>
        <p className="mt-2 text-sm text-[var(--pixel-text-muted)]">
          Today&apos;s quests. Mark done or log progress as you go.
        </p>

        {progress != null && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pixel-badge">XP: {progress.xp_total}</span>
            <span className="pixel-badge">Streak: {progress.streak_current}</span>
            <span className="pixel-badge">Best: {progress.streak_best}</span>
            <span className="pixel-badge">Today: {totalPercent}%</span>
          </div>
        )}

        {loadingScroll && quests.length === 0 && (
          <p className="mt-4 text-[var(--pixel-text-muted)]">Generating your scroll…</p>
        )}

        {quests.length === 0 && !loadingScroll && checkin && (
          <p className="mt-4 text-[var(--pixel-text-muted)]">No quests yet. Complete check-in first.</p>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {(["Body", "Mind", "Sustenance"] as const).map((cat) => {
          const list = byCategory[cat];
          if (!list.length) return null;
          return (
            <div key={cat}>
              <h2 className="pixel-title text-lg mb-3">{cat}</h2>
              <ul className="space-y-4">
                {list.map((q) => {
                  const log = logs.find((l) => l.daily_quest_id === q.id);
                  const pct = log?.completion_percent ?? 0;
                  const isBinary = q.completion_type === "binary";
                  return (
                    <li key={q.id} className="pixel-card p-4">
                      <p className="font-semibold text-[var(--pixel-text)]">{q.title}</p>
                      <p className="mt-1 text-sm text-[var(--pixel-text-muted)]">{q.description}</p>
                      <p className="mt-1 text-xs text-[var(--pixel-text-muted)]">~{q.est_minutes} min</p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {isBinary ? (
                          <button
                            type="button"
                            onClick={() => logQuest(q.id, pct >= 100 ? false : true)}
                            disabled={logSubmitting === q.id}
                            className={`pixel-button text-sm ${pct >= 100 ? "opacity-80" : ""}`}
                          >
                            {pct >= 100 ? "Done" : "Mark Done"}
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min={0}
                              step={q.metric_name === "minutes" ? 1 : 1}
                              placeholder={q.metric_name === "minutes" ? "Minutes" : "Value"}
                              value={measurableValues[q.id] ?? ""}
                              onChange={(e) =>
                                setMeasurableValues((prev) => ({
                                  ...prev,
                                  [q.id]: e.target.value,
                                }))
                              }
                              className="w-24 px-2 py-1.5 pixel-border bg-[var(--pixel-panel)] text-[var(--pixel-text)] text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = Number(measurableValues[q.id]);
                                if (!Number.isNaN(v)) logQuest(q.id, undefined, v);
                              }}
                              disabled={logSubmitting === q.id}
                              className="pixel-button text-sm"
                            >
                              Save
                            </button>
                          </>
                        )}
                        {pct > 0 && (
                          <span className="text-xs text-[var(--pixel-text-muted)]">{pct}%</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </PixelLayout>
  );
}
