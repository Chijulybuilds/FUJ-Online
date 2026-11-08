import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runtimeEnv } from "@/lib/env";
import { runAbsenteeFollowUps } from "@/lib/repo/auto-follow-up";
import { runFirstTimerFollowUps } from "@/lib/repo/first-timers";
import { runPartnerFollowUps } from "@/lib/repo/partners";
import { sendWelcomeBacklog } from "@/lib/repo/accounts";
import { audit } from "@/lib/repo/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Daily automatic follow-up, called by Vercel Cron (see vercel.json): absent members, first timers (welcome +
 * Saturday invitations) and FUJ Partners (thank-you + monthly reminders on the chosen day). Each part runs on its
 * own, so one failing doesn't stop the others.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment variable is set;
 * without it this endpoint refuses to run in production, so strangers can't trigger messages.
 */
export async function GET(request: NextRequest) {
  const secret = runtimeEnv("CRON_SECRET");
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Set CRON_SECRET in the hosting environment variables to enable automatic follow-ups." }, { status: 401 });
  }
  if (secret && !timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const failed: string[] = [];
  const attempt = async <T,>(name: string, fn: () => Promise<T>) => {
    try { return await fn(); } catch (error) { console.error(`automatic ${name} follow-up failed`, error); failed.push(`${name}: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`); return null; }
  };
  const result = await attempt("absence", runAbsenteeFollowUps);
  if (result && (result.detected || result.firstSent || result.remindersSent || result.returned)) {
    await audit("Automatic follow-up", "follow_up.auto_run", "follow_up_tasks", null, result as unknown as Record<string, unknown>);
  }
  const firstTimers = await attempt("first-timer", () => runFirstTimerFollowUps());
  if (firstTimers && (firstTimers.welcomed || firstTimers.invited)) await audit("Automatic follow-up", "first_timers.auto_run", "first_timers", null, firstTimers as unknown as Record<string, unknown>);
  const partners = await attempt("partner", () => runPartnerFollowUps());
  if (partners && (partners.thanked || partners.reminded)) await audit("Automatic follow-up", "partners.auto_run", "partners", null, partners as unknown as Record<string, unknown>);
  // Welcome emails (flag username + set-a-password link) for anyone who registered before they existed.
  const welcome = await attempt("welcome-email", () => sendWelcomeBacklog(60));
  if (welcome?.sent) await audit("Automatic follow-up", "welcome_email.auto_run", "people", null, welcome as unknown as Record<string, unknown>);
  return NextResponse.json({ ok: failed.length === 0, ...(result ?? {}), firstTimers, partners, welcome, ...(failed.length ? { errors: failed } : {}) }, { status: failed.length === 4 ? 500 : 200 });
}
