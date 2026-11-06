import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createTicket, verifyQrToken } from "@/lib/security/qr-token";
import { COOKIE, cookieOptions } from "@/lib/auth/session";
import { deviceId } from "@/lib/auth/identity";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** Exchanges a fresh QR token (valid ~20s) for a 15-minute check-in ticket bound to this device. */
export async function POST(request: NextRequest) {
  if (!rateLimit(`scan:${clientIp(request.headers)}`, 60, 60000)) return NextResponse.json({ error: "Too many scans. Please wait a moment." }, { status: 429 });
  const parsed = z.object({ token: z.string().min(10).max(600) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid QR code." }, { status: 400 });
  const payload = verifyQrToken(parsed.data.token);
  if (!payload) return NextResponse.json({ error: "This QR code has expired. Please scan the code currently on the screen.", code: "expired" }, { status: 410 });
  const session = await db().get("qr_sessions", { id: payload.sessionId });
  const now = Date.now();
  if (!session || session.status !== "active" || now < new Date(session.opens_at).getTime() || now > new Date(session.closes_at).getTime()) {
    return NextResponse.json({ error: "Check-in for this service is closed.", code: "closed" }, { status: 409 });
  }
  const service = await db().get("services", { id: session.service_id });
  const ttl = Math.max(60, Math.min(15 * 60, Math.floor((new Date(session.closes_at).getTime() - now) / 1000)));
  const store = await cookies();
  store.set(COOKIE.ticket, createTicket(session.id, session.service_id, ttl), cookieOptions(ttl));
  await deviceId();
  return NextResponse.json({ ok: true, service: service ? { title: service.title, starts_at: service.starts_at } : null, expiresIn: ttl });
}
