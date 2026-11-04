import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

type Payload = { sessionId: string; nonce: string; issuedAt: number; expiresAt: number };
function secret() {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("QR_SIGNING_SECRET must contain at least 32 characters.");
  return value;
}
function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}
export function createQrToken(sessionId: string, ttlSeconds = 20) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { sessionId, nonce: randomBytes(16).toString("hex"), issuedAt: now, expiresAt: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}
export function verifyQrToken(token: string): Payload | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Payload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sessionId || !payload.nonce || payload.issuedAt > now + 5 || payload.expiresAt < now) return null;
    return payload;
  } catch { return null; }
}
