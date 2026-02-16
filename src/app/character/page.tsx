"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CLASSES = [
  {
    id: "Fighter",
    description:
      "You build strength and resilience through consistent physical challenges. Your quests focus on movement, resistance, and pushing past comfort.",
  },
  {
    id: "Ranger",
    description:
      "You thrive on variety and the outdoors. Your scroll mixes walking, nature, and adaptable routines that fit any environment.",
  },
  {
    id: "Monk",
    description:
      "You value balance and mindfulness. Your quests blend gentle movement, breathing, and reflection for body and mind.",
  },
  {
    id: "Cleric",
    description:
      "You prioritize rest and recovery as much as action. Your scroll emphasizes sleep, nutrition, and sustainable habits.",
  },
  {
    id: "Bard",
    description:
      "You keep things social and creative. Your quests include light social connection, expression, and fun, low-pressure challenges.",
  },
  {
    id: "Wizard",
    description:
      "You focus on mental clarity and learning. Your scroll leans into reading, meditation, and structured reflection.",
  },
] as const;

type ClassId = (typeof CLASSES)[number]["id"];

export default function CharacterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassId | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("class_recommended")
        .eq("user_id", user.id)
        .single();

      if (profile?.class_recommended) {
        setRecommended(profile.class_recommended);
        setSelected(profile.class_recommended as ClassId);
      }
      const reason = sessionStorage.getItem("class_reasoning");
      if (reason) setReasoning(reason);
    }
    load();
  }, [router]);

  async function handleConfirm() {
    const choice = selected ?? recommended;
    if (!choice) {
      setError("Please pick a class.");
      return;
    }

    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      router.push("/login");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("class_recommended")
      .eq("user_id", user.id)
      .single();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        class_selected: choice,
        class_recommended: profile?.class_recommended ?? choice,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem("class_reasoning");
    router.push("/daily");
    setLoading(false);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold">Choose your class</h1>
      <p className="mt-2 text-gray-600">
        This shapes the tone of your daily quest scroll. You can change it later.
      </p>

      {reasoning && (
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-900">
          {reasoning}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              selected === c.id
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="font-semibold">{c.id}</span>
            {recommended === c.id && (
              <span className="ml-2 text-xs text-indigo-600">Recommended</span>
            )}
            <p className="mt-1 text-sm text-gray-600">{c.description}</p>
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading}
        className="mt-8 w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Confirm and continue"}
      </button>
    </main>
  );
}
