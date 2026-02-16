"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  const header = (
    <header className="flex justify-between items-center pb-4 mb-6 border-b border-gray-200">
      <h1 className="text-xl font-bold text-gray-800">Daily Quest Scroll</h1>
      <Link
        href="/profile"
        className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50"
      >
        View Profile
      </Link>
    </header>
  );

  if (!ready) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        {header}
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!checkin) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        {header}
        <h2 className="text-2xl font-bold">Daily Check-in</h2>
        <p className="mt-2 text-gray-600">Quick answers so we can build your scroll.</p>

        <form onSubmit={submitCheckin} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time available (minutes)
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeAvailable(t)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    timeAvailable === t
                      ? "bg-indigo-100 border-indigo-500 text-indigo-800"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Energy level
            </label>
            <div className="flex gap-4">
              {ENERGY_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="energy"
                    checked={energy === value}
                    onChange={() => setEnergy(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avoid today (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVOID_TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleAvoid(tag)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    avoidTags.includes(tag)
                      ? "bg-amber-100 border-amber-500"
                      : "border-gray-300 text-gray-700"
                  }`}
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
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {checkinSubmitting || loadingScroll ? "Building your scroll…" : "Continue"}
          </button>
        </form>
      </main>
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
    <main className="max-w-lg mx-auto px-4 py-10">
      {header}
      <h2 className="text-2xl font-bold">Your Quest Scroll</h2>
      <p className="mt-2 text-gray-600">
        Today&apos;s quests. Mark done or log progress as you go.
      </p>

      {progress != null && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm flex gap-4">
          <span>XP: {progress.xp_total}</span>
          <span>Streak: {progress.streak_current}</span>
          <span>Best: {progress.streak_best}</span>
          <span>Today: {totalPercent}%</span>
        </div>
      )}

      {loadingScroll && quests.length === 0 && (
        <p className="mt-4 text-gray-500">Generating your scroll…</p>
      )}

      {quests.length === 0 && !loadingScroll && checkin && (
        <p className="mt-4 text-gray-500">No quests yet. Complete check-in first.</p>
      )}

      <div className="mt-6 space-y-8">
        {(["Body", "Mind", "Sustenance"] as const).map((cat) => {
          const list = byCategory[cat];
          if (!list.length) return null;
          return (
            <div key={cat}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{cat}</h2>
              <ul className="space-y-4">
                {list.map((q) => {
                  const log = logs.find((l) => l.daily_quest_id === q.id);
                  const pct = log?.completion_percent ?? 0;
                  const isBinary = q.completion_type === "binary";
                  return (
                    <li
                      key={q.id}
                      className="p-4 border border-gray-200 rounded-lg bg-white"
                    >
                      <p className="font-medium">{q.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{q.description}</p>
                      <p className="mt-1 text-xs text-gray-500">~{q.est_minutes} min</p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {isBinary ? (
                          <button
                            type="button"
                            onClick={() => logQuest(q.id, pct >= 100 ? false : true)}
                            disabled={logSubmitting === q.id}
                            className={`px-3 py-1.5 rounded text-sm font-medium ${
                              pct >= 100
                                ? "bg-green-100 text-green-800"
                                : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                            }`}
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
                              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = Number(measurableValues[q.id]);
                                if (!Number.isNaN(v)) logQuest(q.id, undefined, v);
                              }}
                              disabled={logSubmitting === q.id}
                              className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-100 text-indigo-800"
                            >
                              Save
                            </button>
                          </>
                        )}
                        {pct > 0 && <span className="text-xs text-gray-500">{pct}%</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
