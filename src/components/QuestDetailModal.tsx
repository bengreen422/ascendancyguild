"use client";

import { useEffect, useCallback } from "react";
import { PixelButton } from "./PixelButton";

export type QuestForDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  est_minutes: number;
  completion_type: string;
  metric_name: string | null;
  target_value: number | null;
  completion_percent?: number;
};

type DetailContent = {
  objective: string;
  whyItMatters: string[];
  steps: string[];
  variations: string[];
  safetyNotes: string;
};

function buildDetail(quest: QuestForDetail): DetailContent {
  const cat = quest.category || "Body";
  const tags = quest.tags ?? [];
  const noGym = tags.includes("no_gym");
  const lowEnergy = tags.includes("low_energy");
  const title = quest.title || "Complete this quest.";
  const desc = quest.description || "";

  const baseObjective = `${title}. ${desc}`.trim() || "Complete this quest for your scroll.";
  const whyItMatters: string[] = [];
  const steps: string[] = [];
  const variations: string[] = [];
  let safetyNotes = "Move at a comfortable pace. Stop if you feel pain or dizziness.";

  if (cat === "Body") {
    whyItMatters.push("Supports strength, mobility, and energy.");
    whyItMatters.push("Regular movement helps mood and focus.");
    steps.push("Warm up: 1–2 minutes of light movement (march in place, arm circles).");
    steps.push(`Main: ${title}. ${desc}`.trim() || "Do the activity at a moderate pace.");
    steps.push("Keep effort moderate—you should be able to speak in short sentences.");
    steps.push("Cool down: 1–2 minutes of gentle stretching or walking.");
    if (noGym) {
      variations.push("No equipment needed. Use bodyweight or household items.");
    }
    if (lowEnergy) {
      variations.push("Low-energy option: shorten duration by half or do seated versions.");
    }
  } else if (cat === "Sustenance") {
    whyItMatters.push("Good nutrition supports energy and recovery.");
    whyItMatters.push("Simple habits are easier to sustain.");
    steps.push(`Goal: ${title}. ${desc}`.trim() || "Include a balanced meal or snack.");
    steps.push("Include something from at least two groups: protein, vegetables/fruit, whole grains.");
    steps.push("Use hand or plate portions (e.g. palm-sized protein, fist-sized veggies).");
    steps.push("Drink water with the meal.");
    if (lowEnergy) {
      variations.push("Keep it simple: a sandwich, yogurt and fruit, or leftovers.");
    }
    safetyNotes = "This is general guidance only, not medical or diet advice. Eat in a way that works for you.";
  } else {
    // Mind
    whyItMatters.push("Mental rest and focus support overall well-being.");
    whyItMatters.push("Short practices can reduce stress and improve clarity.");
    steps.push("Find a quiet spot and set a timer for the suggested time.");
    steps.push(`Focus: ${title}. ${desc}`.trim() || "Use the time for reflection or breathing.");
    steps.push("If using breathing: inhale 4 counts, hold 2, exhale 4 (or a rhythm that feels calm).");
    steps.push("If using prompts: notice how you feel, then gently return to the practice.");
    steps.push("When the timer ends, take one more breath before getting up.");
    if (lowEnergy) {
      variations.push("Shorten to 3–5 minutes if that’s all you have.");
    }
    safetyNotes = "If you feel overwhelmed, pause and return when ready.";
  }

  return {
    objective: baseObjective,
    whyItMatters: whyItMatters.length ? whyItMatters : ["Completing quests builds consistency and progress."],
    steps: steps.length ? steps : [baseObjective],
    variations,
    safetyNotes,
  };
}

type QuestDetailModalProps = {
  open: boolean;
  onClose: () => void;
  quest: QuestForDetail | null;
  completionPercent: number;
  measurableValue: string;
  onMeasurableChange: (value: string) => void;
  onMarkDone: (markDone: boolean) => void;
  onSaveMeasurable: (value: number) => void;
  logSubmitting: boolean;
};

export function QuestDetailModal({
  open,
  onClose,
  quest,
  completionPercent,
  measurableValue,
  onMeasurableChange,
  onMarkDone,
  onSaveMeasurable,
  logSubmitting,
}: QuestDetailModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!quest) return null;

  const detail = buildDetail(quest);
  const isBinary = quest.completion_type === "binary";
  const pct = completionPercent;

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="modal-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body">
          <div className="flex justify-between items-start gap-2 mb-4">
            <div>
              <h2 id="quest-detail-title" className="pixel-title wood-title text-lg" style={{ color: "var(--ink)" }}>
                {quest.title}
              </h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`pixel-badge wood-badge text-xs badge-${quest.category.toLowerCase()}`}>
                  {quest.category}
                </span>
                <span className="pixel-badge wood-badge text-xs">~{quest.est_minutes} min</span>
                {pct > 0 && (
                  <span className="pixel-badge wood-badge pixel-badge--gold text-xs">{pct}%</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="modal-close"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <section className="mb-4">
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Objective</h3>
            <p className="text-sm" style={{ color: "var(--ink)" }}>{detail.objective}</p>
          </section>

          <section className="mb-4">
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Why it matters</h3>
            <ul className="list-disc list-inside text-sm space-y-0.5" style={{ color: "var(--ink)" }}>
              {detail.whyItMatters.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>

          <section className="mb-4">
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Step-by-step</h3>
            <ol className="list-decimal list-inside text-sm space-y-1" style={{ color: "var(--ink)" }}>
              {detail.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>

          {detail.variations.length > 0 && (
            <section className="mb-4">
              <h3 className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Variations</h3>
              <ul className="list-disc list-inside text-sm space-y-0.5" style={{ color: "var(--muted)" }}>
                {detail.variations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-4">
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Safety</h3>
            <p className="text-sm pixel-subtitle">{detail.safetyNotes}</p>
          </section>

          <section className="pt-3 border-t-2 border-[var(--wood-dark)]">
            <h3 className="text-sm font-bold mb-2" style={{ color: "var(--ink)" }}>Log progress</h3>
            {isBinary ? (
              <PixelButton
                variant={pct >= 100 ? "secondary" : "primary"}
                onClick={() => onMarkDone(pct >= 100 ? false : true)}
                disabled={logSubmitting}
                className="text-sm"
              >
                {pct >= 100 ? "Undo / Not done" : "Mark Done"}
              </PixelButton>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={0}
                  step={quest.metric_name === "minutes" ? 1 : 1}
                  placeholder={quest.metric_name === "minutes" ? "Minutes" : "Value"}
                  value={measurableValue}
                  onChange={(e) => onMeasurableChange(e.target.value)}
                  className="w-24 px-2 py-1.5 text-sm border-2 border-[var(--wood-dark)] bg-[var(--parchment)]"
                  style={{ color: "var(--ink)" }}
                />
                <PixelButton
                  variant="primary"
                  onClick={() => {
                    const v = Number(measurableValue);
                    if (!Number.isNaN(v)) onSaveMeasurable(v);
                  }}
                  disabled={logSubmitting}
                  className="text-sm"
                >
                  Save
                </PixelButton>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
