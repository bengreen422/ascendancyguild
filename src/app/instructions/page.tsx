"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";
import { PixelButton } from "@/components/PixelButton";

export default function InstructionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

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
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single();
      setOnboardingComplete(profile?.onboarding_complete === true);
      setLoading(false);
    }
    run();
  }, [router]);

  if (loading) {
    return (
      <PixelLayout title="Instructions">
        <p className="pixel-subtitle snes-subtitle">Loading…</p>
      </PixelLayout>
    );
  }

  return (
    <PixelLayout title="Instructions">
      <div className="snes-panel pixel-panel p-4 mb-6">
        <h2 className="pixel-title snes-title text-xl mb-2" style={{ color: "var(--ink)" }}>
          Welcome to Ascendancy Guild
        </h2>
        <p className="text-sm pixel-subtitle snes-subtitle" style={{ color: "var(--muted)" }}>
          The guild has prepared a path for you. Each day you&apos;ll receive a scroll of small quests—enough to
          sharpen body, mind, and habits without overwhelming you. Complete what you can, return when you&apos;re ready.
        </p>
      </div>

      <div className="snes-panel pixel-panel p-4 mb-6">
        <h3 className="pixel-title snes-title text-lg mb-3" style={{ color: "var(--ink)" }}>
          How it works
        </h3>
        <ol className="space-y-3 list-decimal list-inside text-sm" style={{ color: "var(--ink)" }}>
          <li>
            <strong>Receive your daily Quest Scroll</strong>—about 40 minutes of quests on average, up to 60. We
            tailor it to your time and energy.
          </li>
          <li>
            <strong>Complete quests in Body, Mind, and Sustenance</strong> to earn XP and build your streak. Log
            progress as you go, or mark them done later.
          </li>
          <li>
            <strong>Return tomorrow</strong> to level up your class and strengthen your attributes. Consistency
            is rewarded; missing a day is not a failure.
          </li>
        </ol>
      </div>

      <div className="snes-panel pixel-panel p-4 mb-6">
        <h3 className="pixel-title snes-title text-base mb-2" style={{ color: "var(--ink)" }}>
          Important notes
        </h3>
        <ul className="space-y-2 text-sm list-disc list-inside" style={{ color: "var(--ink)" }}>
          <li>Quests are no-cost and low-risk—designed so you can start small and stay safe.</li>
          <li>You can log quests later; offline completion is supported.</li>
          <li>Missing a day isn&apos;t a failure. Streaks are encouragement, not punishment.</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <PixelButton
          variant="primary"
          href="/onboarding"
          className="flex-1 py-3"
        >
          Begin your character creation
        </PixelButton>
        {onboardingComplete ? (
          <PixelButton
            variant="secondary"
            href="/daily"
            className="flex-1 py-3"
          >
            Go to Daily Quest Scroll
          </PixelButton>
        ) : (
          <PixelButton
            variant="secondary"
            disabled
            className="flex-1 py-3 opacity-70"
          >
            Complete character creation first
          </PixelButton>
        )}
      </div>
    </PixelLayout>
  );
}
