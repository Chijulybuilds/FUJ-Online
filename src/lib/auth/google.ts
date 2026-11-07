import type { NextRequest } from "next/server";
import { cleanEnvValue, runtimeEnv } from "@/lib/env";
export function googleRedirectUri(request: NextRequest) {
  const base = runtimeEnv("NEXT_PUBLIC_APP_URL") || cleanEnvValue(process.env.NEXT_PUBLIC_APP_URL) || request.nextUrl.origin;
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}
