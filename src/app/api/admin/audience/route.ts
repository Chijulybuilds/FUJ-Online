import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { resolveAudience } from "@/lib/repo/messaging";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, "messaging")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const people = await resolveAudience(request.nextUrl.searchParams.get("audience") ?? "all");
  return NextResponse.json({ count: people.length, sample: people.slice(0, 5).map((p) => p.full_name) });
}
