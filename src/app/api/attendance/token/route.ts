import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createQrToken } from "@/lib/security/qr-token";
import { activeSessionForService, activeSessions, attendanceForService, getService } from "@/lib/repo/services";
import { QR_ROTATE_SECONDS } from "@/lib/constants";
import { firstName } from "@/lib/identity-utils";

/** Issues the rotating QR token for the display screen (staff only) plus a live attendance tally. */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, "attendance")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const session = serviceId ? await activeSessionForService(serviceId) : (await activeSessions())[0] ?? null;
  if (!session) return NextResponse.json({ error: "Check-in is not open for this service.", code: "no_session" }, { status: 404 });
  const remaining = Math.floor((new Date(session.closes_at).getTime() - Date.now()) / 1000);
  const expiresIn = Math.min(QR_ROTATE_SECONDS, remaining);
  if (expiresIn < 1) return NextResponse.json({ error: "Check-in is closing." }, { status: 409 });
  const [service, rows] = await Promise.all([getService(session.service_id), attendanceForService(session.service_id)]);
  return NextResponse.json(
    {
      token: createQrToken(session.id, expiresIn), expiresIn, serviceId: session.service_id, service: service?.title,
      closesAt: session.closes_at, count: rows.length,
      recent: rows.slice(0, 6).map((r) => ({ name: r.person ? firstName(r.person.full_name) : "Guest", at: r.checked_in_at }))
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
