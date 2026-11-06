import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleWhatsAppInbound, handleWhatsAppStatus } from "@/lib/repo/messaging";

/**
 * WhatsApp Business Cloud API webhook.
 * - GET: Meta's subscription verification (hub.verify_token must equal WHATSAPP_VERIFY_TOKEN).
 * - POST: delivery receipts (sent/delivered/read/failed → SMS fallback) and inbound replies (→ Inbox).
 * Signatures are verified with WHATSAPP_APP_SECRET (required in production).
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type Payload = {
  entry?: { changes?: { value?: {
    statuses?: { id: string; status: string; errors?: { code?: number }[] }[];
    messages?: { from: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }[];
  } }[] }[];
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: Payload;
  try { payload = JSON.parse(raw) as Payload; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  let statuses = 0, inbound = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) { await handleWhatsAppStatus(s); statuses++; }
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title;
        if (text) { await handleWhatsAppInbound(m.from, text); inbound++; }
      }
    }
  }
  // Always 200 quickly so Meta doesn't retry endlessly.
  return NextResponse.json({ ok: true, statuses, inbound });
}
