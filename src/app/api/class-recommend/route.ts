import { NextResponse } from "next/server";

const CLASSES = ["Fighter", "Ranger", "Monk", "Cleric", "Bard", "Wizard"] as const;
type ClassName = (typeof CLASSES)[number];

function fallbackClass(goals: string[] = []): { class_recommended: ClassName; reasoning_short: string } {
  const g = goals.map((x) => x.toLowerCase());
  if (g.includes("fitness")) return { class_recommended: "Fighter", reasoning_short: "Fitness focus maps well to steady strength-building and discipline." };
  if (g.includes("sleep")) return { class_recommended: "Cleric", reasoning_short: "Sleep and recovery align with restoration and balance." };
  if (g.includes("mental fitness")) return { class_recommended: "Monk", reasoning_short: "Mental fitness aligns with mindfulness, calm, and consistency." };
  if (g.includes("nutrition")) return { class_recommended: "Ranger", reasoning_short: "Nutrition goals pair well with practical, everyday preparation and routines." };
  return { class_recommended: "Monk", reasoning_short: "A balanced starting class that supports calm, consistency, and wellness foundations." };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const goals: string[] = body.goals ?? [];
  const constraints = body.constraints ?? {};
  const tone = body.tone ?? 50;

  const apiKey = process.env.OPENAI_API_KEY;

  // If no OpenAI key, return a deterministic fallback so onboarding still works.
  if (!apiKey) {
    return NextResponse.json(fallbackClass(goals));
  }

  // OpenAI path (keep it simple and safe)
  try {
    const prompt = {
      goals,
      constraints,
      tone,
      allowed_classes: CLASSES,
      instruction:
        "Recommend exactly one class from allowed_classes. Return JSON with keys class_recommended and reasoning_short (2-3 sentences).",
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a helpful assistant for a wellness RPG app. Output ONLY valid JSON." },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      }),
    });

    if (!resp.ok) {
      // If OpenAI errors, still don't block onboarding.
      return NextResponse.json(fallbackClass(goals));
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(fallbackClass(goals));
    }

    const rec = String(parsed.class_recommended || "");
    const reasoning = String(parsed.reasoning_short || "").slice(0, 280);

    const class_recommended = (CLASSES as readonly string[]).includes(rec) ? (rec as ClassName) : fallbackClass(goals).class_recommended;

    return NextResponse.json({
      class_recommended,
      reasoning_short: reasoning || fallbackClass(goals).reasoning_short,
    });
  } catch {
    return NextResponse.json(fallbackClass(goals));
  }
}