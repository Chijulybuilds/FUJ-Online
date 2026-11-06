import type { TableName, Tables } from "./types";

export type Where<T> = { [K in keyof T]?: T[K] | readonly T[K][] | null };
export type ListOptions<T> = {
  where?: Where<T>;
  order?: { column: keyof T & string; ascending?: boolean };
  limit?: number;
};

export class DuplicateError extends Error {
  constructor(message = "Duplicate record") { super(message); this.name = "DuplicateError"; }
}

/** Minimal storage contract implemented by both the Supabase and the local JSON stores. */
export interface Db {
  readonly kind: "supabase" | "local";
  list<N extends TableName>(table: N, options?: ListOptions<Tables[N]>): Promise<Tables[N][]>;
  get<N extends TableName>(table: N, where: Where<Tables[N]>): Promise<Tables[N] | null>;
  insert<N extends TableName>(table: N, row: Tables[N]): Promise<Tables[N]>;
  update<N extends TableName>(table: N, where: Where<Tables[N]>, patch: Partial<Tables[N]>): Promise<Tables[N][]>;
  remove<N extends TableName>(table: N, where: Where<Tables[N]>): Promise<void>;
}

export function matches<T>(row: T, where?: Where<T>) {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (expected === undefined) return true;
    if (expected === null) return actual === null || actual === undefined;
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  });
}
