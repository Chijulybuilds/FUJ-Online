import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DuplicateError, matches, type Db, type ListOptions, type Where } from "./db";
import type { TableName, Tables } from "./types";
import { buildSeed } from "./seed";
import { cleanLegacyDemoData } from "./legacy-cleanup";

type Store = { [N in TableName]: Tables[N][] };

/** Unique keys enforced by the local store (mirrors the Postgres constraints). */
const UNIQUE: Partial<Record<TableName, string[][]>> = {
  people: [["id"], ["username"], ["normalized_phone"], ["auth_subject"]],
  attendance: [["id"], ["person_id", "service_id"]],
  admin_users: [["id"], ["email"]],
  broadcast_recipients: [["id"], ["broadcast_id", "person_id"]],
  leaders: [["id"], ["person_id"]],
  first_timers: [["id"], ["person_id"]],
  partners: [["id"], ["person_id"]],
  church_settings: [["id"]]
};

const g = globalThis as unknown as { __fujLocalStore?: { path: string; data: Store } };

function emptyStore(): Store {
  return {
    people: [], otp_codes: [], services: [], qr_sessions: [], attendance: [], follow_up_tasks: [], follow_up_logs: [],
    announcements: [], prayer_requests: [], testimonies: [], donations: [], broadcasts: [], broadcast_recipients: [],
    admin_users: [], leaders: [], first_timers: [], partners: [], contact_logs: [], church_settings: [], audit_logs: []
  };
}

function load(path: string): Store {
  if (g.__fujLocalStore?.path === path) return g.__fujLocalStore.data;
  let data: Store;
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const removed = cleanLegacyDemoData(raw);
    data = { ...emptyStore(), ...raw };
    if (removed) {
      persist(path, data);
      console.info(`[FlagUpJesus] Updated ${removed} old records/settings in the local database.`);
    }
  } else {
    data = { ...emptyStore(), ...buildSeed() };
    persist(path, data);
  }
  g.__fujLocalStore = { path, data };
  return data;
}

function persist(path: string, data: Store) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1));
  renameSync(tmp, path);
}

/** Partial unique keys (Postgres "where …"): children share their parent's phone number. */
const ONLY_WHEN: Partial<Record<TableName, Record<string, (row: Record<string, unknown>) => boolean>>> = {
  people: { normalized_phone: (row) => !row.is_child }
};

function violates<N extends TableName>(rows: Tables[N][], table: N, candidate: Tables[N], ignore?: Tables[N]) {
  for (const keys of UNIQUE[table] ?? []) {
    const values = keys.map((k) => (candidate as unknown as Record<string, unknown>)[k]);
    if (values.some((v) => v === null || v === undefined)) continue;
    const when = keys.length === 1 ? ONLY_WHEN[table]?.[keys[0]] : undefined;
    if (when && !when(candidate as unknown as Record<string, unknown>)) continue;
    const clash = rows.some((row) => row !== ignore && (!when || when(row as unknown as Record<string, unknown>)) && keys.every((k, i) => (row as unknown as Record<string, unknown>)[k] === values[i]));
    if (clash) return keys.join(",");
  }
  return null;
}

export function createLocalDb(): Db {
  const path = resolve(process.cwd(), process.env.LOCAL_DB_PATH ?? ".data/flagupjesus-db.json");
  const store = () => load(path);
  const save = () => persist(path, store());
  const clone = <T,>(v: T): T => structuredClone(v);
  return {
    kind: "local",
    async list<N extends TableName>(table: N, options: ListOptions<Tables[N]> = {}) {
      let rows = store()[table].filter((row) => matches(row, options.where));
      if (options.order) {
        const { column, ascending = true } = options.order;
        rows = [...rows].sort((a, b) => {
          const x = a[column] as unknown as string | number; const y = b[column] as unknown as string | number;
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        });
      }
      if (options.limit) rows = rows.slice(0, options.limit);
      return clone(rows);
    },
    async get<N extends TableName>(table: N, where: Where<Tables[N]>) {
      const row = store()[table].find((r) => matches(r, where));
      return row ? clone(row) : null;
    },
    async insert<N extends TableName>(table: N, row: Tables[N]) {
      const rows = store()[table];
      const clash = violates(rows, table, row);
      if (clash) throw new DuplicateError(`${table}.${clash} already exists`);
      rows.push(clone(row));
      save();
      return clone(row);
    },
    async update<N extends TableName>(table: N, where: Where<Tables[N]>, patch: Partial<Tables[N]>) {
      const rows = store()[table];
      const updated: Tables[N][] = [];
      for (let i = 0; i < rows.length; i++) {
        if (!matches(rows[i], where)) continue;
        const next = { ...rows[i], ...patch } as Tables[N];
        const clash = violates(rows, table, next, rows[i]);
        if (clash) throw new DuplicateError(`${table}.${clash} already exists`);
        rows[i] = next;
        updated.push(clone(next));
      }
      if (updated.length) save();
      return updated;
    },
    async remove<N extends TableName>(table: N, where: Where<Tables[N]>) {
      const s = store();
      (s[table] as Tables[N][]) = s[table].filter((r) => !matches(r, where)) as Tables[N][];
      save();
    }
  };
}
