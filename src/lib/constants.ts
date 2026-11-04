export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FlagUpJesus";
export const CHURCH_NAME = process.env.NEXT_PUBLIC_CHURCH_NAME ?? "Flag of Jesus Global Ministry";
export const IS_DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
