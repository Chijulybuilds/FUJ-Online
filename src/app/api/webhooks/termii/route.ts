import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleWhatsAppInbound, handleWhatsAppStatus } from "@/lib/repo/messaging";
import { runtimeEnv } from "@/lib/env";

/**
 * Termii webhook (set it in the Termii dashboard): delivery reports for WhatsApp messages sent through Termii
 * (delivered / failed → SMS fallback), members' WhatsApp replies (→ Inbox), and device status notices.
 * Every event carries `X-Termii-Signature` = HMAC-SHA512 of the body with the account's secret key
 * (TERMII_SECRET_KEY, required in production).
 */
export const dynamic = "force-dynamic";

type TermiiEvent = {
  type?: string; id?: string; message_id?: string; receiver?: string; sender?: string; message?: string;
  sent_at?: string; status?: string; channel?: string; device_id?: string; name?: string;
};

function validSignature(raw: string, header: string | null) {
  const secret = runtimeEnv("TERMII_SECRET_KEY");
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header) return false;
  const given = header.trim().replace(/^sha512=/i, "");
  // Hex (as documented); base64 accepted too, in case the dashboard sends it that way.
  return ["hex", "base64"].some((enc) => {
    const expected = Buffer.from(createHmac("sha512", secret).update(raw).digest(enc as "hex" | "base64"));
    const got = Buffer.from(enc === "hex" ? given.toLowerCase() : given);
    return expected.length === got.length && timingSafeEqual(expected, got);
  });
}

const looksLikePhone = (v?: string) => Boolean(v && /^\+?\d{8,15}$/.test(v.replace(/[\s-]/g, "")));

/** Termii's words → the delivery states the app tracks. */
function deliveryState(status: string) {
  if (/deliver/i.test(status)) return "delivered";
  if (/fail|reject|expired|dnd/i.test(status)) return "failed";
  if (/^message sent$|^sent$/i.test(status.trim())) return "sent";
  return null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-termii-signature"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: TermiiEvent | TermiiEvent[];
  try { payload = JSON.parse(raw) as TermiiEvent | TermiiEvent[]; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  let statuses = 0, inbound = 0;
  for (const e of Array.isArray(payload) ? payload : [payload]) {
    const status = e.status ?? "";
    if (e.type === "device_status") {
      if (/disconnect|offline/i.test(status)) console.warn(`Termii WhatsApp device "${e.name ?? e.device_id}" is ${status} — reconnect it in the Termii dashboard.`);
      continue;
    }
    // A member's reply: Termii reports incoming messages as "Received".
    if (/^received$/i.test(status.trim()) || /inbound/i.test(e.type ?? "")) {
      const from = looksLikePhone(e.sender) ? e.sender! : looksLikePhone(e.receiver) ? e.receiver! : null;
      if (from && e.message) { await handleWhatsAppInbound(from.replace(/[^\d]/g, ""), e.message); inbound++; }
      continue;
    }
    // Delivery reports for WhatsApp messages (SMS reports are ignored: SMS isn't tracked per message).
    if (e.channel && !/whatsapp/i.test(e.channel)) continue;
    const state = deliveryState(status);
    if (!state) continue;
    for (const id of [e.message_id, e.id].filter((v): v is string => Boolean(v))) {
      const r = await handleWhatsAppStatus({ id, status: state, errors: state === "failed" ? [{ message: status }] : undefined });
      if (r.matched) { statuses++; break; }
    }
  }
  return NextResponse.json({ ok: true, statuses, inbound });
}
