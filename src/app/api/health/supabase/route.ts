import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  // Simple call that doesn't require your tables.
  const { data, error } = await supabase.auth.getSession();

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    hasSession: !!data.session,
  });
}