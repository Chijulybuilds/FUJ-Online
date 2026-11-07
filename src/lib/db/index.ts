import "server-only";
import { env } from "@/lib/env";
import type { Db } from "./db";
import { createLocalDb } from "./local";
import { createSupabaseDb } from "./supabase";

let instance: Db | null = null;
export function db(): Db {
  if (!instance) {
    // Hosted platforms (Vercel, Netlify…) have a read-only / temporary disk, so the local JSON store
    // can't work there. Fail with a clear message instead of confusing write errors.
    if (!env.useSupabaseData && (process.env.VERCEL || process.env.NETLIFY)) {
      throw new Error("Supabase is required in production: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the hosting environment variables, then redeploy.");
    }
    instance = env.useSupabaseData ? createSupabaseDb(env.supabaseUrl, env.serviceRoleKey) : createLocalDb();
  }
  return instance;
}
export { DuplicateError } from "./db";
export type * from "./types";
