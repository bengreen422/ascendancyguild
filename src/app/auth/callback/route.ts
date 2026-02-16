import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/daily";
  return NextResponse.redirect(
    new URL(`/auth/finalize?next=${encodeURIComponent(next)}`, url.origin)
  );
}