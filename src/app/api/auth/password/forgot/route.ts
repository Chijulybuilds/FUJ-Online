import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/repo/accounts";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** POST { login } (username or email) → emails a set-a-new-password link. Never says whether the account exists. */
export async function POST(request: NextRequest) {
  const parsed = z.object({ login: z.string().trim().min(3).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username or email." }, { status: 400 });
  if (!rateLimit(`forgot:${clientIp(request.headers)}`, 5, 15 * 60000) || !rateLimit(`forgot:${parsed.data.login.toLowerCase()}`, 3, 60 * 60000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a little and try again." }, { status: 429 });
  }
  await sendPasswordReset(parsed.data.login).catch((error) => console.error("password reset email failed", error));
  return NextResponse.json({ ok: true, message: "If we have an email address for that account, a link to set a new password is on its way. It works for 2 hours." });
}
