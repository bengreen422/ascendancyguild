"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";

const HIDDEN_ATTR_KEYS = ["xp_snapshot_date", "xp_snapshot_value", "streak_counted_date"];

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

  if (loading) {
    return (
      <PixelLayout title="Character Sheet" navLabel="Back to Daily" navHref="/daily">
        <p className="text-[var(--pixel-text-muted)]">Loading…</p>
      </PixelLayout>
    );
  }

  if (error || !summary) {
    return (
      <PixelLayout title="Character Sheet" navLabel="Back to Daily" navHref="/daily">
        <p className="text-red-600">{error ?? "Not found"}</p>
      </PixelLayout>
    );
  }

  const { profile, progress, level, recent } = summary;
  const xpPct =
    level.xp_needed_for_next_level > 0
      ? Math.min(100, (level.xp_into_level / level.xp_needed_for_next_level) * 100)
      : 100;

  const displayAttrs = Object.entries(progress.attributes).filter(
    ([k]) => !HIDDEN_ATTR_KEYS.includes(k)
  );

  const classId = profile.class_selected ?? "";

  return (
    <PixelLayout title="Character Sheet" navLabel="Back to Daily" navHref="/daily">
      <div className="pixel-panel pixel-border p-4 flex items-center gap-4 mb-6">
        {classId && (
          <div className="flex-shrink-0 w-16 h-16 relative">
            <Image
              src={`/characters/${classId.toLowerCase()}.svg`}
              alt={classId}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
        )}
        <div>
          <h2 className="pixel-title text-xl">
            {profile.class_selected ?? "—"} · Level {level.level}
          </h2>
        </div>
      </div>

      <div className="pixel-panel pixel-border p-4 mt-6">
        <div className="flex justify-between text-sm text-[var(--pixel-text-muted)] mb-1">
          <span>XP</span>
          <span>
            {level.xp_into_level} / {level.xp_needed_for_next_level || "—"}
          </span>
        </div>
        <div
          className="h-4 overflow-hidden pixel-border"
          style={{ background: "var(--pixel-panel-dark)" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${xpPct}%`,
              background: "var(--pixel-accent-bright)",
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <div className="pixel-badge px-4 py-2">
          <p className="text-xs opacity-90">Current streak</p>
          <p className="text-lg font-bold">{progress.streak_current}</p>
        </div>
        <div className="pixel-badge px-4 py-2">
          <p className="text-xs opacity-90">Best streak</p>
          <p className="text-lg font-bold">{progress.streak_best}</p>
        </div>
      </div>

      {displayAttrs.length > 0 && (
        <div className="mt-6 pixel-panel pixel-border p-4">
          <h2 className="pixel-title text-lg mb-3">Attributes</h2>
          <ul className="space-y-2">
            {displayAttrs.map(([key, value]) => (
              <li key={key} className="flex justify-between text-sm">
                <span className="text-[var(--pixel-text)]">{key}</span>
                <span className="font-semibold">{String(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h2 className="pixel-title text-lg mb-2">Completed today</h2>
        {recent.today.length === 0 ? (
          <p className="text-sm text-[var(--pixel-text-muted)]">No quests completed today yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.today.map((q, i) => (
              <li
                key={i}
                className="pixel-card flex justify-between items-center py-2 px-3"
              >
                <span className="font-medium">{q.title}</span>
                <span className="text-sm text-[var(--pixel-text-muted)]">
                  {q.category} · {q.completion_percent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="pixel-title text-lg mb-2">Last 7 days</h2>
        {recent.last7days.length === 0 ? (
          <p className="text-sm text-[var(--pixel-text-muted)]">No recent activity.</p>
        ) : (
          <ul className="space-y-4">
            {recent.last7days.map((day) => (
              <li key={day.date} className="pixel-panel pixel-border p-3">
                <p className="text-sm font-semibold text-[var(--pixel-text-muted)] mb-2">
                  {day.date}
                </p>
                <ul className="space-y-1 pl-2">
                  {day.quests.length === 0 ? (
                    <li className="text-sm text-[var(--pixel-text-muted)]">No quests logged</li>
                  ) : (
                    day.quests.map((q, i) => (
                      <li key={i} className="flex justify-between text-sm py-1">
                        <span>{q.title}</span>
                        <span className="text-[var(--pixel-text-muted)]">
                          {q.completion_percent}%
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PixelLayout>
  );
}
