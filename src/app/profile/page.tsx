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
      <PixelLayout title="Character Sheet">
        <p className="pixel-subtitle">Loading…</p>
      </PixelLayout>
    );
  }

  if (error || !summary) {
    return (
      <PixelLayout title="Character Sheet">
        <p style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
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

  /* SNES attribute chip colors: Vitality green, Strength red, Wisdom blue, etc. */
  function attrBadgeClass(key: string): string {
    const k = key.toLowerCase();
    if (k.includes("vitality") || k.includes("constitution")) return "pixel-badge snes-badge snes-badge--green";
    if (k.includes("strength")) return "pixel-badge snes-badge snes-badge--pink";
    if (k.includes("wisdom") || k.includes("intelligence")) return "pixel-badge snes-badge snes-badge--blue";
    if (k.includes("dexterity")) return "pixel-badge snes-badge pixel-badge--gold";
    return "pixel-badge snes-badge";
  }

  const classId = profile.class_selected ?? "";

  return (
    <PixelLayout title="Character Sheet">
      <div className="wood-frame-secondary wood-frame p-4 mb-6">
        <div className="parchment-panel flex items-center gap-4 flex-wrap">
          {classId && (
            <div
              className="flex-shrink-0 w-28 h-28 relative sprite-idle flex items-center justify-center"
              style={{ imageRendering: "pixelated" }}
            >
              <Image
                src={`/characters/${classId.toLowerCase()}.svg`}
                alt={classId}
                width={112}
                height={112}
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          )}
          <div>
            <h2 className="pixel-title wood-title text-xl" style={{ color: "var(--ink)" }}>
              {profile.class_selected ?? "—"} · Level {level.level}
            </h2>
          </div>
        </div>
      </div>

      <div className="wood-frame-secondary wood-frame p-4 mt-6">
        <div className="parchment-panel">
          <div className="flex justify-between text-sm pixel-subtitle mb-1">
            <span>XP</span>
            <span>
              {level.xp_into_level} / {level.xp_needed_for_next_level || "—"}
            </span>
          </div>
          <div className="segmented-bar segmented-bar--xp mt-2">
            <div
              className="segmented-bar__fill segmented-bar__fill--animated"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-4 flex-wrap">
        <div className="pixel-badge pixel-badge--streak wood-badge px-4 py-2 flex items-center gap-2">
          <span className="streak-star" aria-hidden />
          <span>
            <p className="text-xs opacity-90">Current streak</p>
            <p className="text-lg font-bold">{progress.streak_current}</p>
          </span>
        </div>
        <div className="pixel-badge pixel-badge--streak wood-badge px-4 py-2 flex items-center gap-2">
          <span className="streak-star" aria-hidden />
          <span>
            <p className="text-xs opacity-90">Best streak</p>
            <p className="text-lg font-bold">{progress.streak_best}</p>
          </span>
        </div>
      </div>

      {displayAttrs.length > 0 && (
        <div className="mt-6 wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h2 className="pixel-title wood-title text-lg mb-3" style={{ color: "var(--ink)" }}>
              Attributes
            </h2>
            <ul className="flex flex-wrap gap-2">
              {displayAttrs.map(([key, value]) => (
                <li key={key}>
                  <span className={attrBadgeClass(key)}>
                    {key}: {String(value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="pixel-title wood-title text-lg mb-2" style={{ color: "var(--ink)" }}>
          Completed today
        </h2>
        {recent.today.length === 0 ? (
          <p className="text-sm pixel-subtitle">No quests completed today yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.today.map((q, i) => (
              <li key={i} className="wood-frame-tertiary quest-card">
                <div className="quest-card__parchment flex justify-between items-center py-2 px-3">
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {q.title}
                  </span>
                  <span className="text-sm pixel-subtitle flex items-center gap-2">
                    <span className={`pixel-badge wood-badge text-xs badge-${q.category.toLowerCase()}`}>{q.category}</span>
                    {q.completion_percent}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="pixel-title wood-title text-lg mb-2" style={{ color: "var(--ink)" }}>
          Last 7 days
        </h2>
        {recent.last7days.length === 0 ? (
          <p className="text-sm pixel-subtitle">No recent activity.</p>
        ) : (
          <ul className="space-y-4">
            {recent.last7days.map((day) => (
              <li key={day.date} className="wood-frame-secondary wood-frame p-3">
                <div className="parchment-panel">
                  <p className="text-sm font-semibold pixel-subtitle mb-2">{day.date}</p>
                  <ul className="space-y-1 pl-2">
                    {day.quests.length === 0 ? (
                      <li className="text-sm pixel-subtitle">No quests logged</li>
                    ) : (
                      day.quests.map((q, i) => (
                        <li key={i} className="flex justify-between text-sm py-1 items-center gap-2">
                          <span style={{ color: "var(--ink)" }}>{q.title}</span>
                          <span className="pixel-subtitle flex items-center gap-2">
                            <span className={`pixel-badge wood-badge text-xs badge-${q.category.toLowerCase()}`}>{q.category}</span>
                            {q.completion_percent}%
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PixelLayout>
  );
}
