import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { StaffRole } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { findByEmail } from "@/lib/repo/people";
import { recordAttendance } from "@/lib/repo/services";
import { verifyTicket } from "@/lib/security/qr-token";
import { audit } from "@/lib/repo/audit";
import { COOKIE, adminToken, cookieOptions, identityToken, memberToken, ADMIN_TTL, MEMBER_TTL, type Identity } from "./session";

export type Intent = "admin" | "member" | "register";
export const parseIntent = (v: string | null | undefined): Intent => (v === "admin" || v === "register" ? v : "member");

/** Returns a stable per-device id (httpOnly cookie) used to stop one phone checking in many people. */
export async function deviceId() {
  const store = await cookies();
  let id = store.get(COOKIE.device)?.value;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    id = randomBytes(16).toString("hex");
    store.set(COOKIE.device, id, cookieOptions(400 * 86400));
  }
  return id;
}

/** Signs in with the shared FUJ admin account. `displayName` is recorded on actions (audit, broadcasts). */
export async function signInSharedAdmin(displayName: string) {
  const shared = env.sharedAdmin;
  if (!shared) return null;
  const role = (["super_admin", "admin", "pastor", "pastoral_worker", "finance_admin", "department_leader"].includes(shared.role) ? shared.role : "super_admin") as StaffRole;
  let staff = await db().get("admin_users", { email: shared.email });
  if (!staff) staff = await db().insert("admin_users", { id: uid(), email: shared.email, full_name: "FUJ Admin", role, active: true, last_login_at: null, created_at: nowIso() });
  else if (staff.role !== role) staff = (await db().update("admin_users", { id: staff.id }, { role }))[0] ?? staff;
  if (!staff.active) return null;
  await db().update("admin_users", { id: staff.id }, { last_login_at: nowIso() });
  const name = displayName.trim() ? `${displayName.trim().slice(0, 60)} (FUJ Admin)` : "FUJ Admin";
  const store = await cookies();
  store.set(COOKIE.admin, adminToken({ uid: staff.id, email: staff.email, name, role: staff.role, shared: true }), cookieOptions(ADMIN_TTL));
  await audit(name, "staff.sign_in_shared", "admin_users", staff.id);
  return staff;
}

export async function signInStaff(email: string, fallbackName: string) {
  const normalized = email.trim().toLowerCase();
  let staff = await db().get("admin_users", { email: normalized });
  if (!staff && env.adminEmails.includes(normalized)) {
    staff = await db().insert("admin_users", { id: uid(), email: normalized, full_name: fallbackName || normalized, role: "super_admin", active: true, last_login_at: null, created_at: nowIso() });
  }
  if (!staff || !staff.active) return null;
  await db().update("admin_users", { id: staff.id }, { last_login_at: nowIso() });
  const store = await cookies();
  store.set(COOKIE.admin, adminToken({ uid: staff.id, email: staff.email, name: staff.full_name, role: staff.role }), cookieOptions(ADMIN_TTL));
  await audit(staff.email, "staff.sign_in", "admin_users", staff.id);
  return staff;
}

export async function setMemberSession(person: { id: string; full_name: string }) {
  const store = await cookies();
  store.set(COOKIE.member, memberToken({ pid: person.id, name: person.full_name }), cookieOptions(MEMBER_TTL));
}

/** Check in the signed-in member if they arrived from a scanned QR (valid ticket cookie). */
export async function checkInFromTicket(personId: string) {
  const store = await cookies();
  const ticket = verifyTicket(store.get(COOKIE.ticket)?.value);
  if (!ticket) return null;
  const person = await db().get("people", { id: personId });
  const session = await db().get("qr_sessions", { id: ticket.sid, status: "active" });
  if (!person || !session) return null;
  return recordAttendance({ person, serviceId: ticket.svc, method: "qr", deviceId: await deviceId() });
}

/** Shared tail of every sign-in method: decides where a verified identity lands. */
export async function completeIdentity(identity: Omit<Identity, "exp">, intent: Intent): Promise<string> {
  if (intent === "admin") {
    if (!identity.email) return "/admin/login?error=no_email";
    const staff = await signInStaff(identity.email, identity.name);
    return staff ? "/admin" : "/admin/login?error=not_staff";
  }
  const subject = `${identity.provider}:${identity.sub}`;
  let person = await db().get("people", { auth_subject: subject });
  if (!person && identity.email) {
    person = await findByEmail(identity.email);
    if (person && !person.auth_subject) await db().update("people", { id: person.id }, { auth_subject: subject, avatar_url: person.avatar_url ?? identity.avatar, updated_at: nowIso() });
  }
  if (person) {
    await setMemberSession(person);
    const checkedIn = await checkInFromTicket(person.id).catch(() => null);
    return checkedIn ? "/check-in" : "/member";
  }
  const store = await cookies();
  store.set(COOKIE.identity, identityToken(identity), cookieOptions(30 * 60));
  return "/register/complete";
}
