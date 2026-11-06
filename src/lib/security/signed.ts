import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/env";

/** Compact HMAC-signed JSON token: base64url(payload).base64url(sig). Payload must carry `exp` (unix seconds). */
export function signPayload(payload: object, purpose: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", `${signingSecret()}:${purpose}`).update(encoded).digest("base64url")}`;
}

export function verifyPayload<T extends { exp: number }>(token: string | undefined | null, purpose: string, graceSeconds = 0): T | null {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  const expected = Buffer.from(createHmac("sha256", `${signingSecret()}:${purpose}`).update(encoded).digest("base64url"));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
    if (typeof payload.exp !== "number" || payload.exp + graceSeconds < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
