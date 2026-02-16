import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateDailyQuests, getTodayInTz } from "@/lib/generateDailyQuests";

/**
 * Cron handler: send daily quest scroll email at 6:00am user-local time.
 * Call via GET (e.g. external cron hits this URL). Secrets (RESEND_API_KEY, etc.) are server-side only.
 */
export async function GET() {
  const admin = createSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM ?? "Ascendancy Guild <onboarding@resend.dev>";

  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not set" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, tz")
    .eq("onboarding_complete", true)
    .not("tz", "is", null);

  if (!profiles?.length) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, message: "No eligible users" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  let sent = 0;
  const errors: string[] = [];

  for (const row of profiles) {
    const userId = row.user_id as string;
    const tz = (row.tz as string) || "UTC";

    const localDate = getTodayInTz(tz);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

    if (hour !== 6 || minute >= 15) continue;

    const { data: existing } = await admin
      .from("daily_email_sends")
      .select("id")
      .eq("user_id", userId)
      .eq("date", localDate)
      .single();

    if (existing) continue;

    const result = await generateDailyQuests(admin, userId, {
      todayDate: localDate,
      createCheckinIfMissing: true,
    });

    if (!result.ok) {
      errors.push(`${userId}: ${result.error}`);
      continue;
    }

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
    const email = authData?.user?.email;
    if (authError || !email) {
      errors.push(`${userId}: no email`);
      continue;
    }

    const to = email;
    const subject = `Your Quest Scroll for ${localDate}`;
    const questList = result.quests
      .map((q) => `<li><strong>${escapeHtml(q.title)}</strong> — ${q.est_minutes} min</li>`)
      .join("");
    const html = `
      <p>Here are today's quests:</p>
      <ul>${questList}</ul>
      <p><a href="${baseUrl}/daily">Open your Quest Scroll</a></p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      errors.push(`${userId}: Resend ${res.status} ${err}`);
      continue;
    }

    await admin.from("daily_email_sends").insert({
      user_id: userId,
      date: localDate,
    });
    sent++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      errors: errors.length ? errors : undefined,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
