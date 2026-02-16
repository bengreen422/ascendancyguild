"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace("/login");
        return;
      }
      router.replace("/instructions");
    });
  }, [router]);

  return (
    <main className="max-w-lg mx-auto px-4 py-6 min-h-screen flex items-center justify-center" style={{ background: "var(--bg-sky0, #87ceeb)" }}>
      <p className="pixel-subtitle text-sm" style={{ color: "var(--ink, #1a1a3e)" }}>Taking you to the guild…</p>
    </main>
  );
}
