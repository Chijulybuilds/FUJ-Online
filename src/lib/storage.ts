import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const FLYER_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as const;
export type FlyerMime = keyof typeof FLYER_TYPES;
export const MAX_FLYER_BYTES = 5 * 1024 * 1024;
const BUCKET = "flyers";

/** Detects the real image type from the file's first bytes (never trust the browser's content-type). */
export function sniffImage(buf: Buffer): FlyerMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  return null;
}

export const localUploadDir = () => resolve(process.cwd(), dirname(env.localDbPath), "uploads");
export const LOCAL_MEDIA_PREFIX = "/api/media/";
const supabasePublicPrefix = () => `${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/`;

/** Saves a flyer and returns its public URL (Supabase Storage in production, a local folder in development). */
export async function saveFlyer(buf: Buffer): Promise<string> {
  const mime = sniffImage(buf);
  if (!mime) throw new Error("unsupported");
  const name = `${crypto.randomUUID()}.${FLYER_TYPES[mime]}`;
  if (env.useSupabaseData) {
    const client = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
    let { error } = await client.storage.from(BUCKET).upload(name, buf, { contentType: mime, cacheControl: "31536000", upsert: false });
    if (error && /bucket.*not.*found/i.test(error.message)) {
      await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FLYER_BYTES, allowedMimeTypes: Object.keys(FLYER_TYPES) });
      ({ error } = await client.storage.from(BUCKET).upload(name, buf, { contentType: mime, cacheControl: "31536000", upsert: false }));
    }
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return client.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
  }
  await mkdir(localUploadDir(), { recursive: true });
  await writeFile(resolve(localUploadDir(), name), buf);
  return `${LOCAL_MEDIA_PREFIX}${name}`;
}

export async function readLocalFlyer(name: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(name)) return null;
  try { return await readFile(resolve(localUploadDir(), name)); } catch { return null; }
}

/** Only URLs produced by saveFlyer are accepted on broadcasts. */
export function isOurFlyerUrl(url: string) {
  return (url.startsWith(LOCAL_MEDIA_PREFIX) && /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(url.slice(LOCAL_MEDIA_PREFIX.length)))
    || (Boolean(env.supabaseUrl) && url.startsWith(supabasePublicPrefix()));
}

/** Absolute URL for external services (WhatsApp needs a public https link). */
export function absoluteUrl(url: string) {
  return url.startsWith("http") ? url : `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${url}`;
}
