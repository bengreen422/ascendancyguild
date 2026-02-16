"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthFinalizePage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    // Give Supabase a moment to persist the session after redirect.
    const run = async () => {
      // This forces the client to parse and store session if present.
      await supabase.auth.getSession();

      // If session exists now, proceed. If not, show a helpful hint.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMsg("Still signing you in… If this hangs, request a new magic link and try again.");
        // Try one more time shortly.
        setTimeout(async () => {
          const retry = await supabase.auth.getSession();
          if (retry.data.session) {
            const params = new URLSearchParams(window.location.search);
            window.location.replace(params.get("next") || "/daily");
          }
        }, 800);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      window.location.replace(params.get("next") || "/daily");
    };

    run();
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>{msg}</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Finishing login and taking you to your quests.
      </p>
    </main>
  );
}