"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PixelLayout } from "@/components/PixelLayout";
import { PixelButton } from "@/components/PixelButton";

type Status = {
  ok: boolean;
  userId?: string;
  email?: string;
  profile?: { onboarding_complete: boolean; tz: string };
  today?: { date: string };
  hasCheckin?: boolean;
  hasQuestSet?: boolean;
  questCount?: number;
  progress?: { xp_total: number; streak_current: number; streak_best: number };
};

const TIME_OPTIONS = [10, 20, 40, 60] as const;
const ENERGY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
] as const;
const AVOID_TAGS = [
  "sore_legs",
  "sore_upper",
  "stressed",
  "low_social_battery",
  "busy_day",
];

async function postGm(body: Record<string, unknown>, path: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not logged in");
  const res = await fetch(`/api/gm/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export default function GmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [dateOverride, setDateOverride] = useState("");
  const [checkinTime, setCheckinTime] = useState<10 | 20 | 40 | 60>(40);
  const [checkinEnergy, setCheckinEnergy] = useState<"low" | "med" | "high">("med");
  const [checkinAvoid, setCheckinAvoid] = useState<string[]>([]);
  const [fullResetConfirm, setFullResetConfirm] = useState(false);
  const [fullResetDone, setFullResetDone] = useState(false);
  const [xpDelta, setXpDelta] = useState("");
  const [streakCurrent, setStreakCurrent] = useState("");
  const [streakBest, setStreakBest] = useState("");

  const loadStatus = useCallback(async () => {
    setError(null);
    try {
      const data = await postGm({}, "status");
      setStatus(data);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Failed to load status");
      if (String(e).includes("403") || String(e).includes("Forbidden")) {
        router.replace("/daily");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function resetToday() {
    setAction("reset-today");
    setError(null);
    try {
      await postGm({ mode: "today" }, "reset-today");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setAction(null);
    }
  }

  async function generateToday() {
    setAction("generate");
    setError(null);
    try {
      await postGm({ resetFirst: true }, "generate");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setAction(null);
    }
  }

  async function resetDate() {
    if (!dateOverride || !/^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
      setError("Enter date YYYY-MM-DD");
      return;
    }
    setAction("reset-date");
    setError(null);
    try {
      await postGm({ mode: "date", date: dateOverride }, "reset-today");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setAction(null);
    }
  }

  async function generateDate() {
    const date = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride) ? dateOverride : undefined;
    setAction("generate-date");
    setError(null);
    try {
      await postGm({ date, resetFirst: true }, "generate");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setAction(null);
    }
  }

  async function generateWithCheckin() {
    setAction("generate-checkin");
    setError(null);
    try {
      await postGm(
        {
          resetFirst: true,
          checkin: {
            time_available: checkinTime,
            energy: checkinEnergy,
            avoid_tags: checkinAvoid,
          },
        },
        "generate"
      );
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setAction(null);
    }
  }

  async function doFullReset() {
    if (!fullResetConfirm) return;
    setAction("reset-all");
    setError(null);
    try {
      await postGm({}, "reset-all");
      setFullResetDone(true);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Full reset failed");
    } finally {
      setAction(null);
    }
  }

  function toggleAvoid(tag: string) {
    setCheckinAvoid((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function updateProgress() {
    const payload: Record<string, unknown> = {};
    const xp = xpDelta.trim() !== "" ? parseInt(xpDelta, 10) : undefined;
    if (xp !== undefined && !Number.isNaN(xp)) payload.xp_delta = xp;
    const sc = streakCurrent.trim() !== "" ? parseInt(streakCurrent, 10) : undefined;
    if (sc !== undefined && !Number.isNaN(sc)) payload.streak_current = sc;
    const sb = streakBest.trim() !== "" ? parseInt(streakBest, 10) : undefined;
    if (sb !== undefined && !Number.isNaN(sb)) payload.streak_best = sb;
    if (Object.keys(payload).length === 0) {
      setError("Enter at least one value (Add XP, Streak current, or Streak best)");
      return;
    }
    setAction("update-progress");
    setError(null);
    try {
      await postGm(payload, "update-progress");
      setXpDelta("");
      setStreakCurrent("");
      setStreakBest("");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <PixelLayout title="GM">
        <p className="pixel-subtitle">Loading…</p>
      </PixelLayout>
    );
  }

  if (error && !status?.ok) {
    return (
      <PixelLayout title="GM">
        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            <PixelButton href="/daily" variant="secondary" className="mt-4">
              Back to Daily
            </PixelButton>
          </div>
        </div>
      </PixelLayout>
    );
  }

  return (
    <PixelLayout title="GM">
      <div className="space-y-6">
        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h2 className="pixel-title wood-title text-lg mb-2" style={{ color: "var(--ink)" }}>
              GM Status
            </h2>
            <p className="text-sm pixel-subtitle mb-1">Email: {status?.email ?? "—"}</p>
            <p className="text-sm pixel-subtitle mb-1">
              Tz: {status?.profile?.tz ?? "—"} · Today: {status?.today?.date ?? "—"}
            </p>
            <p className="text-sm pixel-subtitle mb-1">
              Check-in: {status?.hasCheckin ? "Yes" : "No"} · Quest set: {status?.hasQuestSet ? "Yes" : "No"} · Quests: {status?.questCount ?? 0}
            </p>
            <p className="text-sm pixel-subtitle mb-1">
              XP: {status?.progress?.xp_total ?? 0} · Streak: {status?.progress?.streak_current ?? 0} · Best: {status?.progress?.streak_best ?? 0}
            </p>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h3 className="pixel-title wood-title text-base mb-3" style={{ color: "var(--ink)" }}>
              Rank &amp; streak
            </h3>
            <p className="text-sm pixel-subtitle mb-3">
              Add XP to level up (rank), or set streak current / best. Leaves other fields unchanged.
            </p>
            <div className="flex flex-wrap gap-4 items-end mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Add XP</span>
                <input
                  type="number"
                  min={0}
                  value={xpDelta}
                  onChange={(e) => setXpDelta(e.target.value)}
                  placeholder="0"
                  className="w-24 px-2 py-1.5 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Streak current</span>
                <input
                  type="number"
                  min={0}
                  value={streakCurrent}
                  onChange={(e) => setStreakCurrent(e.target.value)}
                  placeholder="set"
                  className="w-24 px-2 py-1.5 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Streak best</span>
                <input
                  type="number"
                  min={0}
                  value={streakBest}
                  onChange={(e) => setStreakBest(e.target.value)}
                  placeholder="set"
                  className="w-24 px-2 py-1.5 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                />
              </label>
              <PixelButton
                variant="primary"
                onClick={updateProgress}
                disabled={!!action}
              >
                {action === "update-progress" ? "…" : "Update progress"}
              </PixelButton>
            </div>
          </div>
        </div>

        {error && status?.ok && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {error}
          </p>
        )}

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h3 className="pixel-title wood-title text-base mb-3" style={{ color: "var(--ink)" }}>
              Today
            </h3>
            <div className="flex flex-wrap gap-2">
              <PixelButton
                variant="secondary"
                onClick={resetToday}
                disabled={!!action}
              >
                Reset Today
              </PixelButton>
              <PixelButton
                variant="primary"
                onClick={generateToday}
                disabled={!!action}
              >
                {action === "generate" ? "…" : "Generate Today"}
              </PixelButton>
            </div>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h3 className="pixel-title wood-title text-base mb-3" style={{ color: "var(--ink)" }}>
              Date
            </h3>
            <input
              type="date"
              value={dateOverride}
              onChange={(e) => setDateOverride(e.target.value)}
              className="w-full max-w-xs px-2 py-1.5 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)] mb-2"
              style={{ color: "var(--ink)" }}
            />
            <div className="flex flex-wrap gap-2">
              <PixelButton
                variant="secondary"
                onClick={resetDate}
                disabled={!!action}
              >
                Reset Date
              </PixelButton>
              <PixelButton
                variant="primary"
                onClick={generateDate}
                disabled={!!action}
              >
                Generate Date
              </PixelButton>
            </div>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4">
          <div className="parchment-panel">
            <h3 className="pixel-title wood-title text-base mb-3" style={{ color: "var(--ink)" }}>
              Check-in override
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>Time: </span>
                <select
                  value={checkinTime}
                  onChange={(e) => setCheckinTime(Number(e.target.value) as 10 | 20 | 40 | 60)}
                  className="ml-2 px-2 py-1 border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t} min</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>Energy: </span>
                <select
                  value={checkinEnergy}
                  onChange={(e) => setCheckinEnergy(e.target.value as "low" | "med" | "high")}
                  className="ml-2 px-2 py-1 border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                >
                  {ENERGY_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="font-semibold block mb-1" style={{ color: "var(--ink)" }}>Avoid:</span>
                <div className="flex flex-wrap gap-2">
                  {AVOID_TAGS.map((tag) => (
                    <PixelButton
                      key={tag}
                      type="button"
                      variant="secondary"
                      onClick={() => toggleAvoid(tag)}
                      className={checkinAvoid.includes(tag) ? "ring-2 ring-[var(--accent-gold)]" : ""}
                    >
                      {tag.replace(/_/g, " ")}
                    </PixelButton>
                  ))}
                </div>
              </div>
            </div>
            <PixelButton
              variant="primary"
              onClick={generateWithCheckin}
              disabled={!!action}
              className="mt-3"
            >
              Generate With These Inputs
            </PixelButton>
          </div>
        </div>

        <div className="wood-frame-secondary wood-frame p-4 border-2 border-[var(--accent-red)]">
          <div className="parchment-panel">
            <h3 className="text-base font-bold mb-2" style={{ color: "var(--accent-red)" }}>
              Danger zone
            </h3>
            <p className="text-sm pixel-subtitle mb-3">
              FULL RESET: delete your profile and all data (quests, check-ins, progress). Only affects your account.
            </p>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fullResetConfirm}
                onChange={(e) => setFullResetConfirm(e.target.checked)}
              />
              <span style={{ color: "var(--ink)" }}>I understand, reset my account</span>
            </label>
            <PixelButton
              variant="secondary"
              onClick={doFullReset}
              disabled={!fullResetConfirm || !!action}
              className="opacity-90"
              style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
            >
              {fullResetDone ? "Done (reload)" : "FULL RESET"}
            </PixelButton>
          </div>
        </div>
      </div>
    </PixelLayout>
  );
}
