"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Summary = {
  profile: { class_selected: string | null; goals: unknown; tone: number };
  progress: {
    xp_total: number;
    streak_current: number;
    streak_best: number;
    attributes: Record<string, number | string>;
  };
  level: {
    level: number;
    xp_into_level: number;
    xp_needed_for_next_level: number;
  };
  recent: {
    today: Array<{
      title: string;
      category: string;
      completion_percent: number;
      completed_at: string | null;
    }>;
    last7days: Array<{
      date: string;
      quests: Array<{
        title: string;
        category: string;
        completion_percent: number;
        completed_at: string | null;
      }>;
    }>;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
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
        .select("onboarding_complete")
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

      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/profile/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Failed to load profile");
        setLoading(false);
        return;
      }

      setSummary(data as Summary);
      setLoading(false);
    }
    run();
  }, [router]);

  const header = (
    <header className="flex justify-between items-center pb-4 mb-6 border-b border-gray-200">
      <h1 className="text-xl font-bold text-gray-800">Character Sheet</h1>
      <Link
        href="/daily"
        className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50"
      >
        Back to Daily
      </Link>
    </header>
  );

  if (loading) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        {header}
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        {header}
        <p className="text-red-600">{error ?? "Not found"}</p>
      </main>
    );
  }

  const { profile, progress, level, recent } = summary;
  const xpPct =
    level.xp_needed_for_next_level > 0
      ? Math.min(100, (level.xp_into_level / level.xp_needed_for_next_level) * 100)
      : 100;

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      {header}
      <h2 className="text-2xl font-bold">Profile</h2>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-semibold text-gray-800">
          {profile.class_selected ?? "—"}
        </span>
        <span className="text-gray-500">Level {level.level}</span>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>XP</span>
          <span>
            {level.xp_into_level} / {level.xp_needed_for_next_level || "—"}
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-6">
        <div>
          <p className="text-xs text-gray-500">Current streak</p>
          <p className="text-lg font-semibold">{progress.streak_current}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Best streak</p>
          <p className="text-lg font-semibold">{progress.streak_best}</p>
        </div>
      </div>

      {Object.keys(progress.attributes).length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Attributes</h2>
          <ul className="space-y-1">
            {Object.entries(progress.attributes).map(([key, value]) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-gray-700">{key}</span>
                <span className="font-medium">{String(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Completed today</h2>
        {recent.today.length === 0 ? (
          <p className="text-sm text-gray-500">No quests completed today yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.today.map((q, i) => (
              <li
                key={i}
                className="flex justify-between items-center py-2 border-b border-gray-100"
              >
                <span className="font-medium">{q.title}</span>
                <span className="text-sm text-gray-500">
                  {q.category} · {q.completion_percent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Last 7 days</h2>
        {recent.last7days.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <ul className="space-y-4">
            {recent.last7days.map((day) => (
              <li key={day.date}>
                <p className="text-sm font-medium text-gray-600 mb-2">{day.date}</p>
                <ul className="space-y-1 pl-2">
                  {day.quests.length === 0 ? (
                    <li className="text-sm text-gray-400">No quests logged</li>
                  ) : (
                    day.quests.map((q, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-sm py-1"
                      >
                        <span>{q.title}</span>
                        <span className="text-gray-500">{q.completion_percent}%</span>
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
