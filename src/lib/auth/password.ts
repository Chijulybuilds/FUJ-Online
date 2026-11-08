import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { signingSecret } from "@/lib/env";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const PASSWORD_MIN = 8;

/** Plain-English problem with a new password, or null. */
export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > 128) return "That password is too long (128 characters at most).";
  if (/^(.)\1+$/.test(password)) return "Choose a password that isn't the same character repeated.";
  if (["password", "12345678", "123456789", "qwertyui", "flagupjesus"].includes(password.toLowerCase())) return "That password is too easy to guess.";
  return null;
}

/** scrypt hash: "scrypt$N$r$p$saltB64$hashB64". */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Signed "set your password" link token: person id + expiry + a version (when the password was last set), so a
 * link stops working once it has been used. No database table needed.
 */
type LinkPayload = { p: string; e: number; v: string; k: "welcome" | "reset" };
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", `${signingSecret()}:password-link`).update(body).digest("base64url");

export function createPasswordToken(personId: string, version: string, kind: LinkPayload["k"], ttlMs: number) {
  const body = b64(JSON.stringify({ p: personId, e: Date.now() + ttlMs, v: version, k: kind } satisfies LinkPayload));
  return `${body}.${sign(body)}`;
}

export function readPasswordToken(token: string | null | undefined): LinkPayload | null {
  if (!token || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as LinkPayload;
    return typeof payload.p === "string" && typeof payload.e === "number" ? payload : null;
  } catch {
    return null;
  }
}
