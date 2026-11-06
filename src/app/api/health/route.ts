import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env, PLACEHOLDER_SECRET } from "@/lib/env";
import { providers } from "@/lib/messaging/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    app: "FlagUpJesus", mode: env.useSupabaseData ? "supabase" : "local", googleAuth: env.googleEnabled,
    adminLogin: Boolean(env.sharedAdmin), registrationOtp: env.registrationOtp, sms: providers.sms, whatsapp: providers.whatsapp, whatsappTemplate: Boolean(providers.whatsappTemplate),
    devLogin: env.devLoginEnabled,
    signingSecret: !process.env.QR_SIGNING_SECRET && !process.env.SESSION_SECRET ? "missing" : (process.env.SESSION_SECRET || process.env.QR_SIGNING_SECRET) === PLACEHOLDER_SECRET ? "placeholder" : "set",
    timestamp: new Date().toISOString()
  };
  try {
    await db().list("church_settings", { limit: 1 });
    return NextResponse.json({ ok: true, ...base, database: "ready" });
  } catch (error) {
    return NextResponse.json({ ok: false, ...base, database: "unavailable", detail: error instanceof Error ? error.message.slice(0, 200) : "unknown" }, { status: 503 });
  }
}
