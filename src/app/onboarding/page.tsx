"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";
import { PixelButton } from "@/components/PixelButton";

const GOAL_OPTIONS = [
  "Fitness",
  "Nutrition",
  "Sleep",
  "Mental Fitness",
] as const;

const EQUIPMENT_OPTIONS = ["none", "basic", "full"] as const;

type Constraints = {
  time_default: number;
  time_max: number;
  gym_access: boolean;
  equipment: (typeof EQUIPMENT_OPTIONS)[number];
  avoid_money: boolean;
};

const DEFAULT_CONSTRAINTS: Constraints = {
  time_default: 40,
  time_max: 60,
  gym_access: false,
  equipment: "none",
  avoid_money: true,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [tone, setTone] = useState(50);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
      );
    } catch {
      setTz("UTC");
    }
  }, []);

  function toggleGoal(goal: string) {
    setGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : prev.length >= 2
          ? prev
          : [...prev, goal]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Please log in first.");
      setLoading(false);
      router.push("/login");
      return;
    }

    const profilePayload = {
      user_id: user.id,
      goals: goals,
      constraints: constraints,
      tone,
      tz,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase.from("profiles").upsert(
      profilePayload,
      { onConflict: "user_id" }
    );
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/class-recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        goals,
        constraints,
        tone,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Recommendation failed");
      setLoading(false);
      return;
    }

    if (data.reasoning_short) {
      sessionStorage.setItem("class_reasoning", data.reasoning_short);
    }

    await supabase
      .from("profiles")
      .update({
        class_recommended: data.class_recommended,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    router.push("/character");
    setLoading(false);
  }

  return (
    <PixelLayout title="Onboarding">
      <h2 className="pixel-title wood-title text-xl mb-2" style={{ color: "var(--ink)" }}>
        Welcome to Ascendancy Guild
      </h2>
      <p className="text-sm pixel-subtitle mb-6" style={{ color: "var(--muted)" }}>
        A few questions so we can tailor your quest scroll.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Goals (pick up to 2)
            </label>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => (
                <PixelButton
                  key={g}
                  type="button"
                  variant="secondary"
                  onClick={() => toggleGoal(g)}
                  className={goals.includes(g) ? "ring-2 ring-[var(--accent-blue)]" : ""}
                >
                  {g}
                </PixelButton>
              ))}
            </div>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Gym access
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--ink)" }}>
                <input
                  type="radio"
                  name="gym"
                  checked={constraints.gym_access === true}
                  onChange={() =>
                    setConstraints((c) => ({ ...c, gym_access: true }))
                  }
                  style={{ accentColor: "var(--accent-blue)" }}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--ink)" }}>
                <input
                  type="radio"
                  name="gym"
                  checked={constraints.gym_access === false}
                  onChange={() =>
                    setConstraints((c) => ({ ...c, gym_access: false }))
                  }
                  style={{ accentColor: "var(--accent-blue)" }}
                />
                No
              </label>
            </div>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Equipment at home
            </label>
            <select
              value={constraints.equipment}
              onChange={(e) =>
                setConstraints((c) => ({
                  ...c,
                  equipment: e.target.value as Constraints["equipment"],
                }))
              }
              className="w-full px-3 py-2 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
              style={{ color: "var(--ink)" }}
            >
              {EQUIPMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Tone: gentle (0) → intense (100)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={tone}
              onChange={(e) => setTone(Number(e.target.value))}
              className="w-full accent-[var(--accent-gold)]"
            />
            <span className="text-sm font-semibold ml-2" style={{ color: "var(--ink)" }}>{tone}</span>
          </div>
        </div>

        <p className="text-sm pixel-subtitle" style={{ color: "var(--muted)" }}>
          Default time: {constraints.time_default} min, max: {constraints.time_max} min. No-cost quests only.
        </p>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {error}
          </p>
        )}

        <PixelButton
          type="submit"
          disabled={loading}
          variant="primary"
          className="w-full py-3"
        >
          {loading ? "Saving…" : "Continue"}
        </PixelButton>
      </form>
    </PixelLayout>
  );
}
