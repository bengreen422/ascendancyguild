import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Supabase handles the token exchange client-side automatically with signInWithOtp.
  // This route simply redirects users after they click the email link.
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  return NextResponse.redirect(new URL(next, url.origin));
}