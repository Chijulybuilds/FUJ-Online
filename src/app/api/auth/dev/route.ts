import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { completeIdentity, parseIntent } from "@/lib/auth/identity";

/** Development-only sign-in that stands in for Google when OAuth isn't configured. */
export async function POST(request: NextRequest) {
  if (!env.devLoginEnabled) return NextResponse.json({ error: "Developer sign-in is disabled." }, { status: 403 });
  const parsed = z.object({ email: z.string().trim().email(), name: z.string().trim().max(120).nullish(), intent: z.string().nullish() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const redirect = await completeIdentity({ sub: email, email, name: parsed.data.name || email.split("@")[0], avatar: null, provider: "dev" }, parseIntent(parsed.data.intent));
  if (redirect.startsWith("/login")) return NextResponse.json({ error: "This email is not on the staff list." }, { status: 403 });
  return NextResponse.json({ redirect });
}
