import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runtimeEnv } from "@/lib/env";
import { runAbsenteeFollowUps } from "@/lib/repo/auto-follow-up";
import { audit } from "@/lib/repo/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Daily automatic absence follow-up, called by Vercel Cron (see vercel.json).
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
  try {
    const result = await runAbsenteeFollowUps();
    if (result.detected || result.firstSent || result.remindersSent || result.returned) {
      await audit("Automatic follow-up", "follow_up.auto_run", "follow_up_tasks", null, result as unknown as Record<string, unknown>);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("automatic follow-up failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }, { status: 500 });
  }
}
