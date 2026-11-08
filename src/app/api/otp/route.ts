import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/repo/otp";
import { FriendlyError } from "@/lib/repo/people";
import { normalizePhone } from "@/lib/identity-utils";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** POST { phone, parentsPhone? } → sends a registration code by SMS (parentsPhone: an under-18 using a parent's number). */
export async function POST(request: NextRequest) {
  const parsed = z.object({ phone: z.string().trim().min(7).max(24), parentsPhone: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!rateLimit(`otp-phone:${phone}`, 3, 10 * 60000) || !rateLimit(`otp-ip:${clientIp(request.headers)}`, 10, 10 * 60000)) {
    return NextResponse.json({ error: "Too many codes requested. Please wait a few minutes." }, { status: 429 });
  }
  try {
    const result = await requestOtp(parsed.data.phone, { parentsPhone: parsed.data.parentsPhone });
    return NextResponse.json({ sent: true, ...(result.devCode ? { devCode: result.devCode } : {}) });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 500 });
  }
}
