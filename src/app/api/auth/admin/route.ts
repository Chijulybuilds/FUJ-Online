import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { signInSharedAdmin } from "@/lib/auth/identity";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/repo/audit";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Shared FUJ admin login: ADMIN_LOGIN_EMAIL + ADMIN_LOGIN_PASSWORD. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`admin-login:${ip}`, 8, 10 * 60000) || !rateLimit("admin-login:global", 40, 10 * 60000)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait 10 minutes." }, { status: 429 });
  }
  const parsed = z.object({ email: z.string().trim().max(200), password: z.string().max(200), name: z.string().trim().max(60).nullish() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the admin email and password." }, { status: 400 });
  const shared = env.sharedAdmin;
  if (!shared) return NextResponse.json({ error: "The FUJ admin login isn't set up. Add ADMIN_LOGIN_EMAIL and ADMIN_LOGIN_PASSWORD (12+ characters) to the server environment." }, { status: 503 });
  const emailOk = parsed.data.email.toLowerCase() === shared.email;
  const passOk = timingSafeEqual(digest(parsed.data.password), digest(shared.password));
  if (!emailOk || !passOk) {
    await audit(null, "staff.sign_in_failed", "admin_users", null, { ip });
    return NextResponse.json({ error: "Incorrect admin email or password." }, { status: 401 });
  }
  await signInSharedAdmin(parsed.data.name ?? "");
  return NextResponse.json({ redirect: "/admin" });
}
