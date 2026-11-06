import type { NextRequest } from "next/server";
export function googleRedirectUri(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}
