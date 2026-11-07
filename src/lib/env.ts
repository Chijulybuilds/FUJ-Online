/** Server-side configuration derived from environment variables. */

/** Trims whitespace and stray wrapping quotes that often sneak in when pasting values into a host's dashboard. */
export function cleanEnvValue(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
}
/**
 * Reads a variable at RUNTIME. Next.js bakes `process.env.NEXT_PUBLIC_*` in at build time, so a value added
 * in the hosting dashboard after the last build would otherwise be invisible to the server until a rebuild.
 */
export function runtimeEnv(name: string): string {
  return cleanEnvValue((process.env as Record<string, string | undefined>)[name]);
}

const pub = {
  appUrl: cleanEnvValue(process.env.NEXT_PUBLIC_APP_URL) || runtimeEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  supabaseUrl: (cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) || runtimeEnv("NEXT_PUBLIC_SUPABASE_URL")).replace(/\/+$/, ""),
  supabaseAnonKey: cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
};

export const env = {
  ...pub,
  isProduction: process.env.NODE_ENV === "production",
  get serviceRoleKey() { return runtimeEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  /** Data lives in Supabase when the URL and the server-only service-role key are present. */
  get useSupabaseData() { return Boolean(pub.supabaseUrl && runtimeEnv("SUPABASE_SERVICE_ROLE_KEY")); },
  /** Google OAuth client — accepts GOOGLE_CLIENT_ID or CLIENT_ID (as in .env.local). */
  get googleClientId() { return runtimeEnv("GOOGLE_CLIENT_ID") || runtimeEnv("CLIENT_ID"); },
  get googleClientSecret() { return runtimeEnv("GOOGLE_CLIENT_SECRET") || runtimeEnv("CLIENT_SECRET"); },
  get googleEnabled(): boolean { return Boolean(this.googleClientId && this.googleClientSecret); },
  /**
   * Development sign-in without Google (no identity verification!). Only on automatically for local
   * development against the local JSON store; real Supabase data or production requires ALLOW_DEV_LOGIN=true.
   */
  get devLoginEnabled(): boolean {
    if (process.env.ALLOW_DEV_LOGIN === "true") return true;
    if (process.env.ALLOW_DEV_LOGIN === "false") return false;
    return process.env.NODE_ENV !== "production" && !this.useSupabaseData;
  },
  get adminEmails() {
    return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  },
  /** Shared FUJ admin login (one email + password every admin can use). */
  get sharedAdmin(): { email: string; password: string; role: string } | null {
    const email = runtimeEnv("ADMIN_LOGIN_EMAIL").toLowerCase();
    const password = runtimeEnv("ADMIN_LOGIN_PASSWORD");
    const role = runtimeEnv("ADMIN_LOGIN_ROLE") || "super_admin";
    // Production refuses weak shared passwords (the account usually has full admin rights).
    if (email && password && (password.length >= 12 || process.env.NODE_ENV !== "production")) return { email, password, role };
    return null;
  },
  /** SMS OTP at registration is off by default (it costs money per SMS). Set REGISTRATION_OTP=true to turn it on. */
  get registrationOtp(): boolean { return process.env.REGISTRATION_OTP === "true"; },
  get localDbPath() { return process.env.LOCAL_DB_PATH ?? ".data/flagupjesus-db.json"; }
};

export const PLACEHOLDER_SECRET = "replace-with-at-least-32-random-bytes";
/** HMAC key for sessions, QR tokens and check-in tickets. */
export function signingSecret(): string {
  const value = process.env.SESSION_SECRET || process.env.QR_SIGNING_SECRET;
  const usable = Boolean(value && value.length >= 32 && value !== PLACEHOLDER_SECRET);
  if (usable) return value!;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set QR_SIGNING_SECRET (or SESSION_SECRET) to a random value of at least 32 characters.");
  }
  return value && value.length >= 32 ? value : "flagupjesus-development-only-secret-change-me-0000";
}
