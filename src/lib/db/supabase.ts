import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DuplicateError, type Db, type ListOptions, type Where } from "./db";
import type { TableName, Tables } from "./types";

type Query = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function applyWhere(query: Query, where?: Where<unknown>) {
  let q = query;
  for (const [key, value] of Object.entries(where ?? {})) {
    if (value === undefined) continue;
    if (value === null) q = q.is(key, null);
    else if (Array.isArray(value)) q = q.in(key, value as unknown[]);
    else q = q.eq(key, value as string);
  }
  return q;
}

function fail(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new DuplicateError(error.message);
  throw new Error(`Database error: ${error.message}`);
}

/** Server-only store backed by Supabase using the service-role key. Authorization is enforced in the app layer. */
export function createSupabaseDb(url: string, serviceKey: string): Db {
  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return {
    kind: "supabase",
    async list<N extends TableName>(table: N, options: ListOptions<Tables[N]> = {}) {
      const pageSize = 1000;
      const out: Tables[N][] = [];
      for (let from = 0; ; from += pageSize) {
        let q = applyWhere(client.from(table).select("*"), options.where as Where<unknown>);
        if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
        const to = options.limit ? Math.min(from + pageSize, options.limit) - 1 : from + pageSize - 1;
        const { data, error } = await q.range(from, to);
        if (error) fail(error);
        out.push(...((data ?? []) as Tables[N][]));
        if (!data || data.length < pageSize || (options.limit && out.length >= options.limit)) break;
      }
      return out;
    },
    async get<N extends TableName>(table: N, where: Where<Tables[N]>) {
      const { data, error } = await applyWhere(client.from(table).select("*"), where as Where<unknown>).limit(1).maybeSingle();
      if (error) fail(error);
      return (data as Tables[N] | null) ?? null;
    },
    async insert<N extends TableName>(table: N, row: Tables[N]) {
      const { data, error } = await client.from(table).insert(row as never).select("*").single();
      if (error) fail(error);
      return data as Tables[N];
    },
    async update<N extends TableName>(table: N, where: Where<Tables[N]>, patch: Partial<Tables[N]>) {
      let q = client.from(table).update(patch as never);
      for (const [key, value] of Object.entries(where)) {
        if (value === undefined) continue;
        if (value === null) q = q.is(key, null);
        else if (Array.isArray(value)) q = q.in(key, value as unknown[]);
        else q = q.eq(key, value as string);
      }
      const { data, error } = await q.select("*");
      if (error) fail(error);
      return (data ?? []) as Tables[N][];
    },
    async remove<N extends TableName>(table: N, where: Where<Tables[N]>) {
      let q = client.from(table).delete();
      for (const [key, value] of Object.entries(where)) {
        if (value === undefined) continue;
        if (value === null) q = q.is(key, null);
        else if (Array.isArray(value)) q = q.in(key, value as unknown[]);
        else q = q.eq(key, value as string);
      }
      const { error } = await q;
      if (error) fail(error);
    }
  };
}
