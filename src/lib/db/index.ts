import "server-only";
import { env } from "@/lib/env";
import type { Db } from "./db";
import { createLocalDb } from "./local";
import { createSupabaseDb } from "./supabase";

let instance: Db | null = null;
export function db(): Db {
  if (!instance) {
    instance = env.useSupabaseData ? createSupabaseDb(env.supabaseUrl, env.serviceRoleKey) : createLocalDb();
  }
  return instance;
}
export { DuplicateError } from "./db";
export type * from "./types";
