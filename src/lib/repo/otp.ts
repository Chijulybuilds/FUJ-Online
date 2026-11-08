import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { signingSecret, env } from "@/lib/env";
import { normalizePhone } from "@/lib/identity-utils";
import { providers, sendSms } from "@/lib/messaging/providers";
import { nowIso, uid } from "@/lib/utils";
import { findByPhone, FriendlyError } from "./people";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const hash = (phone: string, code: string) => createHmac("sha256", `${signingSecret()}:otp`).update(`${phone}:${code}`).digest("hex");

/** Sends a 6-digit registration code by SMS. In local development without SMS the code is returned for display. */
export async function requestOtp(rawPhone: string): Promise<{ phone: string; devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone || phone.length < 11) throw new FriendlyError("Enter a valid phone number.");
  if (await findByPhone(phone)) throw new FriendlyError("This phone number is already registered. Sign in with your username instead.");
  if (!providers.sms && !env.devLoginEnabled) throw new FriendlyError("SMS verification isn't available right now. Please continue with Google or ask an usher to register you.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  await db().update("otp_codes", { phone, consumed_at: null }, { consumed_at: nowIso() }); // invalidate older codes
  await db().insert("otp_codes", { id: uid(), phone, code_hash: hash(phone, code), purpose: "register", attempts: 0, expires_at: new Date(now + TTL_MS).toISOString(), consumed_at: null, created_at: nowIso() });
  if (providers.sms) {
    const status = await sendSms(phone, `Your FlagUpJesus verification code is ${code}. It expires in 10 minutes. Don't share it with anyone.`);
    if (status !== "sent") throw new FriendlyError("We couldn't send the SMS. Check the number and try again.");
    return { phone };
  }
  return { phone, devCode: code };
}

/** Verifies and consumes the latest code for the phone. */
export async function verifyOtp(rawPhone: string, code: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  const rows = await db().list("otp_codes", { where: { phone, consumed_at: null }, order: { column: "created_at", ascending: false }, limit: 1 });
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) return false;
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(hash(phone, code)), Buffer.from(row.code_hash));
  await db().update("otp_codes", { id: row.id }, ok ? { consumed_at: nowIso() } : { attempts: row.attempts + 1 });
  return ok;
}
