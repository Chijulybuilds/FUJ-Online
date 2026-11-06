import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { signPayload } from "@/lib/security/signed";
import { COOKIE, cookieOptions } from "@/lib/auth/session";
import { parseIntent } from "@/lib/auth/identity";
import { googleRedirectUri } from "@/lib/auth/google";

/** Starts the Google OAuth 2.0 authorization-code flow using CLIENT_ID / CLIENT_SECRET. */
export async function GET(request: NextRequest) {
  const intent = parseIntent(request.nextUrl.searchParams.get("intent"));
  if (!env.googleEnabled) return NextResponse.redirect(new URL(`/login?error=google_not_configured`, request.url));
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(COOKIE.oauth, signPayload({ state, intent, exp: Math.floor(Date.now() / 1000) + 600 }, "oauth"), cookieOptions(600));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.googleClientId, redirect_uri: googleRedirectUri(request), response_type: "code",
    scope: "openid email profile", state, prompt: "select_account", access_type: "online"
  }).toString();
  return NextResponse.redirect(url);
}
