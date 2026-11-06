import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { verifyPayload } from "@/lib/security/signed";
import { COOKIE } from "@/lib/auth/session";
import { completeIdentity, type Intent } from "@/lib/auth/identity";
import { googleRedirectUri } from "@/lib/auth/google";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const saved = verifyPayload<{ state: string; intent: Intent; exp: number }>(store.get(COOKIE.oauth)?.value, "oauth");
  store.delete(COOKIE.oauth);
  const fail = (code: string, intent?: Intent) =>
    NextResponse.redirect(new URL(`/login?error=${code}${intent === "admin" ? "&as=staff" : ""}`, request.url));
  if (!saved || saved.state !== params.get("state")) return fail("oauth_state");
  if (params.get("error") || !params.get("code")) return fail("oauth_cancelled", saved.intent);
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.get("code")!, client_id: env.googleClientId, client_secret: env.googleClientSecret,
        redirect_uri: googleRedirectUri(request), grant_type: "authorization_code"
      })
    });
    if (!tokenRes.ok) return fail("oauth_exchange", saved.intent);
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!profileRes.ok) return fail("oauth_profile", saved.intent);
    const profile = (await profileRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!profile.sub || (profile.email && profile.email_verified === false)) return fail("oauth_unverified", saved.intent);
    const destination = await completeIdentity(
      { sub: profile.sub, email: profile.email?.toLowerCase() ?? null, name: profile.name ?? "", avatar: profile.picture ?? null, provider: "google" },
      saved.intent
    );
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return fail("oauth_failed", saved.intent);
  }
}
