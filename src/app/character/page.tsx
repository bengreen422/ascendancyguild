"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";
import { PixelCard } from "@/components/PixelCard";
import { PixelButton } from "@/components/PixelButton";

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
    <PixelLayout title="Choose Your Class">
      <p className="mt-2 pixel-subtitle text-sm">
        This shapes the tone of your daily quest scroll. You can change it later.
      </p>

      {reasoning && (
        <div className="mt-4 pixel-panel p-3 text-sm" style={{ color: "var(--ink)" }}>
          {reasoning}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {CLASSES.map((c) => (
          <PixelCard
            key={c.id}
            as="button"
            type="button"
            selected={selected === c.id}
            sparkle={recommended === c.id}
            onClick={() => setSelected(c.id)}
            className="w-full text-left flex gap-4 items-start"
          >
            <div
              className="flex-shrink-0 w-24 h-24 relative"
              style={{ imageRendering: "pixelated" }}
            >
              <Image
                src={`/characters/${c.id.toLowerCase()}.svg`}
                alt={c.id}
                width={96}
                height={96}
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="pixel-title font-semibold" style={{ color: "var(--ink)" }}>
                {c.id}
              </span>
              {recommended === c.id && (
                <span className="ml-2 pixel-badge pixel-badge--gold">Recommended</span>
              )}
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {c.description}
              </p>
            </div>
          </PixelCard>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}

      <PixelButton
        onClick={handleConfirm}
        disabled={loading}
        variant="primary"
        className="mt-8 w-full py-3"
      >
        {loading ? "Saving…" : "Confirm and continue"}
      </PixelButton>
    </PixelLayout>
  );
}
