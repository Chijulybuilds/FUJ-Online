import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env, PLACEHOLDER_SECRET } from "@/lib/env";
import { providers } from "@/lib/messaging/providers";
import { configProblems } from "@/lib/env-check";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    app: "FlagUpJesus", mode: env.useSupabaseData ? "supabase" : "local", googleAuth: env.googleEnabled,
    adminLogin: Boolean(env.sharedAdmin), registrationOtp: env.registrationOtp, sms: providers.sms, whatsapp: providers.whatsapp, whatsappTemplate: Boolean(providers.whatsappTemplate),
    devLogin: env.devLoginEnabled,
    signingSecret: !process.env.QR_SIGNING_SECRET && !process.env.SESSION_SECRET ? "missing" : (process.env.SESSION_SECRET || process.env.QR_SIGNING_SECRET) === PLACEHOLDER_SECRET ? "placeholder" : "set",
    timestamp: new Date().toISOString()
  };
  const problems = configProblems();
  const fix = problems.length ? { fix: problems, howToFix: "Add/correct these in your host's Environment Variables (Production), then redeploy." } : {};
  try {
    await db().list("church_settings", { limit: 1 });
    return NextResponse.json({ ok: problems.length === 0, ...base, database: "ready", ...fix });
  } catch (error) {
    return NextResponse.json({ ok: false, ...base, database: "unavailable", detail: error instanceof Error ? error.message.slice(0, 200) : "unknown", ...fix }, { status: 503 });
  }
}
