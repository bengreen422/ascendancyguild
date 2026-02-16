"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // After clicking the email link, send them here:
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) setStatus(error.message);
    else setStatus("Check your email for the login link.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Ascendancy Guild</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Log in to receive your daily quest scroll.
      </p>

      <form onSubmit={sendMagicLink} style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Email address
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="you@email.com"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}