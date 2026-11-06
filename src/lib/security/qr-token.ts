import { randomBytes } from "node:crypto";
import { signPayload, verifyPayload } from "./signed";

type Payload = { sessionId: string; nonce: string; issuedAt: number; expiresAt: number; exp: number };

/** Short-lived token shown in the rotating QR code. */
export function createQrToken(sessionId: string, ttlSeconds = 20) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { sessionId, nonce: randomBytes(8).toString("hex"), issuedAt: now, expiresAt: now + ttlSeconds, exp: now + ttlSeconds };
  return signPayload(payload, "qr");
}

/** A small grace (default 10s) absorbs camera + network latency right at rotation time. */
export function verifyQrToken(token: string, graceSeconds = 10): Payload | null {
  const payload = verifyPayload<Payload>(token, "qr", graceSeconds);
  if (!payload?.sessionId || payload.issuedAt > Math.floor(Date.now() / 1000) + 5) return null;
  return payload;
}

export type CheckInTicket = { sid: string; svc: string; exp: number };
/** Issued after a successful scan so the member has time to type their username or register. */
export function createTicket(sessionId: string, serviceId: string, ttlSeconds = 15 * 60) {
  return signPayload({ sid: sessionId, svc: serviceId, exp: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies CheckInTicket, "ticket");
}
export function verifyTicket(token: string | undefined | null) {
  return verifyPayload<CheckInTicket>(token, "ticket");
}
