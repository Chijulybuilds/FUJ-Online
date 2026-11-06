export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FlagUpJesus";
export const CHURCH_NAME = process.env.NEXT_PUBLIC_CHURCH_NAME ?? "Flag of Jesus Global Ministry";
/** True when no Supabase project is configured: data is kept in a local JSON file. */
export const IS_DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const QR_ROTATE_SECONDS = 20;
export const USERNAME_PREFIX = "flag";
