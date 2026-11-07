import { env, runtimeEnv, PLACEHOLDER_SECRET } from "@/lib/env";
import { emailFromProblem } from "@/lib/messaging/providers";

/**
 * Configuration problems, described by variable NAME only (never values), so /api/health can say
 * exactly what to fix in the hosting dashboard.
 */
export function configProblems(): string[] {
  const problems: string[] = [];
  const has = (name: string) => Boolean(runtimeEnv(name));
  const production = process.env.NODE_ENV === "production";

  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_LOGIN_EMAIL", "ADMIN_LOGIN_PASSWORD", "NEXT_PUBLIC_APP_URL"]) {
    if (!has(name)) problems.push(`${name} is missing`);
  }
  const secret = process.env.SESSION_SECRET || process.env.QR_SIGNING_SECRET;
  if (!secret) problems.push("QR_SIGNING_SECRET is missing");
  else if (secret === PLACEHOLDER_SECRET) problems.push("QR_SIGNING_SECRET still has the example placeholder value");
  else if (secret.length < 32) problems.push("QR_SIGNING_SECRET must be at least 32 characters");

  const url = runtimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url.replace(/\/+$/, ""))) problems.push("NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co (no path)");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (key && /^sb_publishable_/.test(key)) problems.push("SUPABASE_SERVICE_ROLE_KEY is the publishable key — use the service_role / secret key");
  else if (key && key === runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) problems.push("SUPABASE_SERVICE_ROLE_KEY equals the anon key — use the service_role / secret key");
  else if (key && jwtRole(key) === "anon") problems.push("SUPABASE_SERVICE_ROLE_KEY is the anon key — use the service_role / secret key");
  const pass = runtimeEnv("ADMIN_LOGIN_PASSWORD");
  if (production && pass && pass.length < 12) problems.push("ADMIN_LOGIN_PASSWORD must be at least 12 characters in production");
  const email = runtimeEnv("ADMIN_LOGIN_EMAIL");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("ADMIN_LOGIN_EMAIL is not a valid email address");
  const app = runtimeEnv("NEXT_PUBLIC_APP_URL");
  if (production && app && !app.startsWith("https://")) problems.push("NEXT_PUBLIC_APP_URL should start with https:// (e.g. https://www.flagupjesus.org)");
  if (!env.googleEnabled) problems.push("CLIENT_ID / CLIENT_SECRET (Google sign-in) are missing");

  // Messaging channels are optional, but each needs ALL of its keys.
  const pairs: [string, string][] = [["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], ["TERMII_API_KEY", "TERMII_SENDER_ID"], ["RESEND_API_KEY", "EMAIL_FROM"]];
  for (const [a, b] of pairs) {
    if (has(a) !== has(b)) problems.push(`${has(a) ? b : a} is missing (${a} and ${b} work together)`);
  }
  if (has("WHATSAPP_PHONE_NUMBER_ID") && !/^\d{10,20}$/.test(runtimeEnv("WHATSAPP_PHONE_NUMBER_ID"))) problems.push("WHATSAPP_PHONE_NUMBER_ID should be the long numeric Phone number ID from Meta (not the phone number)");
  if (has("WHATSAPP_TOKEN") && !has("WHATSAPP_TEMPLATE_NAME")) problems.push("WHATSAPP_TEMPLATE_NAME is missing — without an approved template WhatsApp only reaches people who messaged the church number in the last 24 hours");
  if (production && has("WHATSAPP_TOKEN") && !has("WHATSAPP_APP_SECRET")) problems.push("WHATSAPP_APP_SECRET is missing — needed to accept WhatsApp delivery receipts and replies");
  const fromProblem = emailFromProblem(runtimeEnv("EMAIL_FROM"));
  if (fromProblem) problems.push(fromProblem);
  if (production && !has("CRON_SECRET")) problems.push("CRON_SECRET is missing — the daily automatic follow-up messages can't run (any long random text)");
  return problems;
}

/** The `role` claim of a legacy Supabase JWT key (anon / service_role), or null for other key formats. */
function jwtRole(key: string): string | null {
  const part = key.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
