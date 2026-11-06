import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { submitPrayer, prayedFor } from "@/lib/repo/content";
import { getMemberSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** Public + member prayer request submission (from the landing page or the member portal). */
export async function POST(request: NextRequest) {
  if (!rateLimit(`prayer:${clientIp(request.headers)}`, 8, 10 * 60000)) return NextResponse.json({ error: "Please wait a little before sending another request." }, { status: 429 });
  const parsed = z.object({
    request: z.string().trim().min(5, "Tell us a little more so we can pray with you.").max(2000),
    name: z.string().trim().max(120).optional(), contact: z.string().trim().max(120).optional(),
    visibility: z.enum(["private", "pastoral", "public"]).default("pastoral"), anonymous: z.boolean().optional()
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your request." }, { status: 400 });
  const member = await getMemberSession();
  await submitPrayer({
    person_id: member?.pid ?? null, request_text: parsed.data.request, visibility: parsed.data.visibility,
    is_anonymous: parsed.data.anonymous, requester_name: member ? null : parsed.data.name || null, requester_contact: member ? null : parsed.data.contact || null
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!rateLimit(`prayed:${clientIp(request.headers)}:${parsed.data.id}`, 1, 3600000)) return NextResponse.json({ ok: true, repeated: true });
  await prayedFor(parsed.data.id);
  return NextResponse.json({ ok: true });
}
