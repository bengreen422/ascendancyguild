import { requireGmUser } from "@/lib/gmAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resetDay, resetAll } from "@/lib/gmOps";
import { getTodayInTz } from "@/lib/generateDailyQuests";

export async function POST(request: Request) {
  let gm: { userId: string; body: Record<string, unknown> };
  try {
    gm = await requireGmUser(request);
  } catch (r) {
    return r as Response;
  }

  const { userId, body } = gm;
  const full = body?.full === true;
  const mode = body?.mode === "date" ? "date" : "today";
  const dateParam = typeof body?.date === "string" ? body.date.trim() : null;

  const admin = createSupabaseAdmin();

  if (full) {
    const result = await resetAll(admin, userId);
    return new Response(JSON.stringify({ ok: true, full: true, deleted: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let targetDate: string;
  if (mode === "date" && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam;
  } else {
    const { data: profile } = await admin
      .from("profiles")
      .select("tz")
      .eq("user_id", userId)
      .single();
    const tz = (profile?.tz as string) || "UTC";
    targetDate = getTodayInTz(tz);
  }

  const result = await resetDay(admin, userId, targetDate);
  return new Response(
    JSON.stringify({ ok: true, date: targetDate, deleted: result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
