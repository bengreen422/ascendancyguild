"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold">Welcome to Ascendancy Guild</h1>
      <p className="mt-2 text-gray-600">
        A few questions so we can tailor your quest scroll.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Goals (pick up to 2)
          </label>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  goals.includes(g)
                    ? "bg-indigo-100 border-indigo-500 text-indigo-800"
                    : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gym access
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="gym"
                checked={constraints.gym_access === true}
                onChange={() =>
                  setConstraints((c) => ({ ...c, gym_access: true }))
                }
              />
              Yes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="gym"
                checked={constraints.gym_access === false}
                onChange={() =>
                  setConstraints((c) => ({ ...c, gym_access: false }))
                }
              />
              No
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {EQUIPMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tone: gentle (0) → intense (100)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-sm text-gray-500">{tone}</span>
        </div>

        <p className="text-sm text-gray-500">
          Default time: {constraints.time_default} min, max:{" "}
          {constraints.time_max} min. No-cost quests only.
        </p>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
