import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const who = request.nextUrl.searchParams.get("who");
  const store = await cookies();
  if (who !== "member") store.delete(COOKIE.admin);
  if (who !== "admin") { store.delete(COOKIE.member); store.delete(COOKIE.identity); }
  return NextResponse.redirect(new URL(who === "admin" ? "/admin/login" : "/", request.url), 303);
}
