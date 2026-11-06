import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signPayload, verifyPayload } from "@/lib/security/signed";
import type { StaffRole } from "@/lib/db/types";
import { can, type Area } from "./roles";
import { db } from "@/lib/db";

export const COOKIE = { admin: "fuj_admin", member: "fuj_member", identity: "fuj_identity", ticket: "fuj_ticket", device: "fuj_device", oauth: "fuj_oauth" } as const;

export type AdminSession = { uid: string; email: string; name: string; role: StaffRole; exp: number };
export type MemberSession = { pid: string; name: string; exp: number };
/** A verified external identity (Google / dev) that has not yet been linked to a church person record. */
export type Identity = { sub: string; email: string | null; name: string; avatar: string | null; provider: "google" | "dev"; exp: number };

const secure = process.env.NODE_ENV === "production";
export const cookieOptions = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge });

export const ADMIN_TTL = 12 * 3600;
export const MEMBER_TTL = 60 * 86400;
const exp = (ttl: number) => Math.floor(Date.now() / 1000) + ttl;

export function adminToken(s: Omit<AdminSession, "exp">) { return signPayload({ ...s, exp: exp(ADMIN_TTL) }, "admin"); }
export function memberToken(s: Omit<MemberSession, "exp">) { return signPayload({ ...s, exp: exp(MEMBER_TTL) }, "member"); }
export function identityToken(s: Omit<Identity, "exp">) { return signPayload({ ...s, exp: exp(30 * 60) }, "identity"); }

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const session = verifyPayload<AdminSession>(store.get(COOKIE.admin)?.value, "admin");
  if (!session) return null;
  // Re-check the staff record so revoked access takes effect immediately.
  const staff = await db().get("admin_users", { id: session.uid });
  if (!staff || !staff.active) return null;
  return { ...session, role: staff.role, name: staff.full_name };
}

export async function getMemberSession(): Promise<MemberSession | null> {
  const store = await cookies();
  return verifyPayload<MemberSession>(store.get(COOKIE.member)?.value, "member");
}

export async function getIdentity(): Promise<Identity | null> {
  const store = await cookies();
  return verifyPayload<Identity>(store.get(COOKIE.identity)?.value, "identity");
}

/** For server components and server actions: redirect when not signed in or not permitted. */
export async function requireAdmin(area: Area = "dashboard"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/login?as=staff");
  if (!can(session.role, area)) redirect("/admin?denied=" + area);
  return session;
}

export async function requireMember(): Promise<MemberSession & { personId: string }> {
  const session = await getMemberSession();
  if (!session) redirect("/login");
  const person = await db().get("people", { id: session.pid });
  if (!person) redirect("/login");
  return { ...session, personId: person.id };
}
