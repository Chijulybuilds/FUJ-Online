"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Channel, StaffRole } from "@/lib/db/types";
import { requireAdmin } from "@/lib/auth/session";
import type { Area } from "@/lib/auth/roles";
import { createPerson, findByUsername, FriendlyError, updatePerson } from "@/lib/repo/people";
import { closeCheckIn, createService, openCheckIn, recordAttendance, updateService } from "@/lib/repo/services";
import { createTask, logContact, runFollowUpAnalysis, updateTask } from "@/lib/repo/care";
import { sendBroadcast, sendTestMessage, smsUndelivered, tasksForNonResponders } from "@/lib/repo/messaging";
import { saveAnnouncement, setAnnouncementStatus, updatePrayer, moderateTestimony } from "@/lib/repo/content";
import { recordDonation } from "@/lib/repo/giving";
import { saveSettings } from "@/lib/repo/settings";
import { addLeader, removeLeader, updateLeader } from "@/lib/repo/leaders";
import { audit } from "@/lib/repo/audit";
import { isOurFlyerUrl } from "@/lib/storage";
import { nowIso, uid } from "@/lib/utils";

type State = { ok?: boolean; message?: string; redirectTo?: string } | null;
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const opt = (fd: FormData, key: string) => str(fd, key) || null;
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

async function guarded(area: Area, fn: (actor: string) => Promise<State>): Promise<State> {
  const admin = await requireAdmin(area);
  try {
    return await fn(admin.name);
  } catch (error) {
    if (error instanceof FriendlyError) return { ok: false, message: error.message };
    if (error instanceof Error && /consent|prayer wall/i.test(error.message)) return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Lagos is UTC+1 all year; datetime-local inputs are interpreted as Lagos time. */
function lagosToIso(local: string) {
  if (!local) return null;
  const d = new Date(`${local}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ---------------- People ---------------- */
export async function createPersonAction(_: State, fd: FormData): Promise<State> {
  let newId = "";
  const result = await guarded("members", async (actor) => {
    const fullName = str(fd, "full_name");
    if (fullName.length < 2) return { ok: false, message: "Enter the person's full name." };
    const person = await createPerson({
      full_name: fullName, phone: str(fd, "phone"), email: opt(fd, "email"), status: "member",
      gender: opt(fd, "gender"), birthday: opt(fd, "birthday"), address: opt(fd, "address"), how_heard: opt(fd, "how_heard"), notes: opt(fd, "notes"),
      verified_via: "admin"
    });
    await audit(actor, "person.create", "people", person.id);
    newId = person.id;
    return { ok: true };
  });
  return newId ? { ok: true, redirectTo: `/admin/members/${newId}?created=1` } : result;
}

export async function updatePersonAction(_: State, fd: FormData): Promise<State> {
  return guarded("members", async (actor) => {
    const id = str(fd, "id");
    await updatePerson(id, {
      full_name: str(fd, "full_name"), phone: str(fd, "phone"), email: opt(fd, "email"),
      status: z.enum(["member", "inactive", "transferred", "left_ministry"]).parse(str(fd, "status")),
      gender: opt(fd, "gender"), birthday: opt(fd, "birthday"), address: opt(fd, "address"), notes: opt(fd, "notes"),
      ...(fd.has("whatsapp") ? { whatsapp: z.enum(["unknown", "yes", "no"]).parse(str(fd, "whatsapp")) } : {})
    });
    await audit(actor, "person.update", "people", id);
    revalidatePath(`/admin/members/${id}`);
    return { ok: true, message: "Record updated." };
  });
}

/* ---------------- Services & attendance ---------------- */
export async function createServiceAction(_: State, fd: FormData): Promise<State> {
  let id = "";
  const result = await guarded("services", async (actor) => {
    const starts = lagosToIso(str(fd, "starts_at"));
    if (!str(fd, "title") || !starts) return { ok: false, message: "Enter a service name and start time." };
    const ends = lagosToIso(str(fd, "ends_at"));
    if (ends && ends <= starts) return { ok: false, message: "End time must be after the start time." };
    const service = await createService({ title: str(fd, "title"), category: str(fd, "category") || "Sunday worship", starts_at: starts, ends_at: ends, location: opt(fd, "location"), description: opt(fd, "description") });
    await audit(actor, "service.create", "services", service.id);
    id = service.id;
    return { ok: true };
  });
  return id ? { ok: true, redirectTo: `/admin/services/${id}` } : result;
}

export async function openCheckInAction(_: State, fd: FormData): Promise<State> {
  const serviceId = str(fd, "service_id");
  const result = await guarded("attendance", async (actor) => {
    await openCheckIn(serviceId, Number(str(fd, "minutes")) || 240);
    await audit(actor, "checkin.open", "services", serviceId);
    return { ok: true };
  });
  if (!result?.ok) return result;
  // Going straight to the QR display: navigate client-side (ActionForm has a hard-navigation fallback).
  // Don't revalidate first — that would re-render this page and unmount the form before it navigates.
  if (str(fd, "then") === "display") return { ok: true, redirectTo: `/admin/attendance/display?service=${serviceId}` };
  revalidatePath(`/admin/services/${serviceId}`);
  return { ok: true, message: "Check-in is open." };
}

export async function closeCheckInAction(fd: FormData) {
  const serviceId = str(fd, "service_id");
  await guarded("attendance", async (actor) => {
    await closeCheckIn(serviceId);
    await runFollowUpAnalysis();
    await audit(actor, "checkin.close", "services", serviceId);
    return null;
  });
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/pastoral-care");
}

export async function cancelServiceAction(fd: FormData) {
  const serviceId = str(fd, "service_id");
  await guarded("services", async (actor) => {
    await closeCheckIn(serviceId);
    await updateService(serviceId, { status: "cancelled" });
    await audit(actor, "service.cancel", "services", serviceId);
    return null;
  });
  revalidatePath(`/admin/services/${serviceId}`);
}

export async function manualCheckInAction(_: State, fd: FormData): Promise<State> {
  return guarded("attendance", async (actor) => {
    const serviceId = str(fd, "service_id");
    const key = str(fd, "person");
    const person = (await db().get("people", { id: key }).catch(() => null)) ?? (await findByUsername(key)) ??
      (await db().list("people")).find((p) => p.full_name.toLowerCase() === key.toLowerCase() || p.normalized_phone.endsWith(key.replace(/\D/g, "").slice(-10)) && key.replace(/\D/g, "").length >= 7) ?? null;
    if (!person) return { ok: false, message: "No person matches that username, name or phone." };
    const result = await recordAttendance({ person, serviceId, method: "manual", recordedBy: actor });
    revalidatePath(`/admin/services/${serviceId}`);
    return { ok: true, message: result.status === "already" ? `${person.full_name} was already checked in.` : `${person.full_name} checked in.` };
  });
}

/* ---------------- Pastoral care ---------------- */
export async function runAnalysisAction(): Promise<State> {
  return guarded("care", async () => {
    const r = await runFollowUpAnalysis();
    revalidatePath("/admin/pastoral-care");
    return { ok: true, message: `Created ${r.absentees} absentee and ${r.newMembers} new-member follow-up${r.absentees + r.newMembers === 1 ? "" : "s"}.` };
  });
}

export async function createTaskAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async () => {
    await createTask({ person_id: str(fd, "person_id"), reason: str(fd, "reason") || "Pastoral check-in", category: "general", priority: (str(fd, "priority") as "low" | "normal" | "high") || "normal", assignee: opt(fd, "assignee") });
    revalidatePath("/admin/pastoral-care");
    return { ok: true, message: "Follow-up task created." };
  });
}

export async function updateTaskAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async (actor) => {
    const id = str(fd, "id");
    await updateTask(id, {
      status: z.enum(["open", "in_progress", "completed", "dismissed"]).parse(str(fd, "status")),
      priority: z.enum(["low", "normal", "high"]).parse(str(fd, "priority")), assignee: opt(fd, "assignee"), notes: opt(fd, "notes")
    });
    await audit(actor, "care.update", "follow_up_tasks", id);
    revalidatePath(`/admin/pastoral-care/${id}`);
    return { ok: true, message: "Task updated." };
  });
}

export async function quickTaskStatusAction(fd: FormData) {
  await guarded("care", async () => { await updateTask(str(fd, "id"), { status: str(fd, "status") as "completed" }); return null; });
  revalidatePath("/admin/pastoral-care");
}

export async function logContactAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async (actor) => {
    const id = str(fd, "task_id");
    await logContact(id, { channel: z.enum(["call", "sms", "whatsapp", "visit", "email", "in_app", "note"]).parse(str(fd, "channel")), outcome: str(fd, "outcome") || "Contacted", note: opt(fd, "note"), author: actor });
    revalidatePath(`/admin/pastoral-care/${id}`);
    return { ok: true, message: "Contact logged." };
  });
}

/* ---------------- Broadcasts ---------------- */
function channelsFrom(fd: FormData): Channel[] {
  return fd.getAll("channels").map(String).filter((c): c is Channel => ["in_app", "whatsapp", "sms", "email"].includes(c));
}

export async function smsUndeliveredAction(_: State, fd: FormData): Promise<State> {
  return guarded("messaging", async () => {
    const id = str(fd, "broadcast_id");
    const n = await smsUndelivered(id);
    revalidatePath(`/admin/messaging/${id}`);
    return { ok: true, message: n ? `Sent ${n} SMS.` : "No messages are waiting for a WhatsApp receipt (or SMS isn't configured)." };
  });
}

export async function sendBroadcastAction(_: State, fd: FormData): Promise<State> {
  let id = "";
  const result = await guarded("messaging", async (actor) => {
    const title = str(fd, "title"); const body = str(fd, "body");
    if (title.length < 2 || body.length < 2) return { ok: false, message: "Add a title and a message." };
    const image = str(fd, "image_url");
    if (image && !isOurFlyerUrl(image)) return { ok: false, message: "Upload the flyer again." };
    const broadcast = await sendBroadcast({
      image_url: image || null,
      title, body, kind: (str(fd, "kind") as "announcement" | "follow_up" | "general") || "general", audience: str(fd, "audience") || "all",
      channels: channelsFrom(fd), request_response: bool(fd, "request_response"), parent_id: opt(fd, "parent_id"), created_by: actor
    });
    if (!broadcast.recipient_count) return { ok: false, message: "Sent, but no one matched this audience." };
    await audit(actor, "broadcast.send", "broadcasts", broadcast.id, { audience: broadcast.audience, recipients: broadcast.recipient_count });
    id = broadcast.id;
    return { ok: true };
  });
  return id ? { ok: true, redirectTo: `/admin/messaging/${id}?sent=1` } : result;
}

export async function nonResponderTasksAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async () => {
    const created = await tasksForNonResponders(str(fd, "broadcast_id"));
    revalidatePath("/admin/pastoral-care");
    return { ok: true, message: created ? `Created ${created} follow-up task${created === 1 ? "" : "s"} for the pastoral team.` : "Everyone already has a task or has responded." };
  });
}

export async function replyToPersonAction(_: State, fd: FormData): Promise<State> {
  return guarded("inbox", async (actor) => {
    const personId = str(fd, "person_id"); const body = str(fd, "body");
    if (body.length < 2) return { ok: false, message: "Write a reply first." };
    await sendBroadcast({ title: str(fd, "title") || "Message from the church", body, kind: "direct", audience: `person:${personId}`, channels: channelsFrom(fd), request_response: true, created_by: actor });
    revalidatePath(`/admin/inbox/${personId}`);
    return { ok: true, message: "Reply sent." };
  });
}

export async function sendTestMessageAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    const channel = str(fd, "channel");
    if (!["whatsapp", "sms", "email"].includes(channel)) return { ok: false, message: "Choose a channel." };
    const result = await sendTestMessage(channel, str(fd, "to"));
    await audit(actor, "messaging.test", "settings", null, { channel, ok: result.ok });
    return result;
  });
}

/* ---------------- Leaders ---------------- */
const leaderInput = (fd: FormData) => ({ full_name: str(fd, "full_name"), unit: str(fd, "unit"), phone: str(fd, "phone"), email: opt(fd, "email") });

export async function addLeaderAction(_: State, fd: FormData): Promise<State> {
  return guarded("leaders", async (actor) => {
    const { leader, person, linked } = await addLeader(leaderInput(fd), actor);
    await audit(actor, "leader.add", "leaders", leader.id, { unit: leader.unit, linked });
    revalidatePath("/admin/leaders");
    return { ok: true, message: linked ? `${person.full_name} was already registered — added to the leaders list (${leader.unit}).` : `${person.full_name} added to the leaders list (${leader.unit}).` };
  });
}

export async function updateLeaderAction(_: State, fd: FormData): Promise<State> {
  return guarded("leaders", async (actor) => {
    const id = str(fd, "id");
    await updateLeader(id, leaderInput(fd));
    await audit(actor, "leader.update", "leaders", id);
    revalidatePath("/admin/leaders");
    return { ok: true, message: "Leader updated." };
  });
}

export async function removeLeaderAction(_: State, fd: FormData): Promise<State> {
  return guarded("leaders", async (actor) => {
    const removed = await removeLeader(str(fd, "id"));
    if (!removed) return { ok: false, message: "That leader was already removed — refresh the page." };
    await audit(actor, "leader.remove", "leaders", removed.id, { unit: removed.unit });
    // The row (and this form) disappears, so confirm with a banner on the reloaded page.
    return { ok: true, redirectTo: `/admin/leaders?removed=${encodeURIComponent(removed.name)}` };
  });
}

/* ---------------- Announcements, prayer, testimonies ---------------- */
export async function saveAnnouncementAction(_: State, fd: FormData): Promise<State> {
  return guarded("announcements", async (actor) => {
    const title = str(fd, "title"); const body = str(fd, "body");
    if (!title || !body) return { ok: false, message: "Add a title and body." };
    const status = str(fd, "intent") === "publish" ? "published" : "draft";
    const row = await saveAnnouncement({ id: opt(fd, "id") ?? undefined, title, body, audience: "all", status, pinned: bool(fd, "pinned"), is_public: bool(fd, "is_public") }, actor);
    let note = "";
    if (status === "published" && bool(fd, "broadcast")) {
      const b = await sendBroadcast({ title, body, kind: "announcement", audience: "all", channels: channelsFrom(fd), request_response: false, created_by: actor });
      note = ` Broadcast to ${b.recipient_count} people.`;
    }
    await audit(actor, `announcement.${status}`, "announcements", row.id);
    revalidatePath("/admin/announcements");
    revalidatePath("/");
    return { ok: true, message: (status === "published" ? "Announcement published." : "Draft saved.") + note };
  });
}

export async function announcementStatusAction(fd: FormData) {
  await guarded("announcements", async () => { await setAnnouncementStatus(str(fd, "id"), str(fd, "status") as "published"); return null; });
  revalidatePath("/admin/announcements");
}

export async function updatePrayerAction(_: State, fd: FormData): Promise<State> {
  return guarded("prayer", async (actor) => {
    const id = str(fd, "id");
    await updatePrayer(id, {
      status: z.enum(["pending", "praying", "answered", "closed"]).parse(str(fd, "status")),
      assignee: opt(fd, "assignee"), admin_note: opt(fd, "admin_note"), on_wall: bool(fd, "on_wall")
    });
    if (bool(fd, "create_task")) {
      const pr = await db().get("prayer_requests", { id });
      if (pr?.person_id) await createTask({ person_id: pr.person_id, category: "prayer", reason: `Prayer follow-up: “${pr.request_text.slice(0, 60)}”`, assignee: opt(fd, "assignee") });
    }
    await audit(actor, "prayer.update", "prayer_requests", id);
    revalidatePath("/admin/prayer-requests");
    return { ok: true, message: "Prayer request updated." };
  });
}

export async function moderateTestimonyAction(_: State, fd: FormData): Promise<State> {
  return guarded("testimonies", async (actor) => {
    const id = str(fd, "id"); const status = z.enum(["pending", "approved", "declined", "published"]).parse(str(fd, "status"));
    await moderateTestimony(id, { status, featured: bool(fd, "featured") }, actor);
    await audit(actor, `testimony.${status}`, "testimonies", id);
    revalidatePath("/admin/testimonies");
    revalidatePath("/");
    return { ok: true, message: `Testimony ${status}.` };
  });
}

/* ---------------- Giving ---------------- */
export async function recordDonationAction(_: State, fd: FormData): Promise<State> {
  return guarded("giving", async (actor) => {
    const amount = Number(str(fd, "amount").replace(/[,₦\s]/g, ""));
    if (!amount || amount <= 0) return { ok: false, message: "Enter a valid amount." };
    const who = str(fd, "person");
    const person = who ? await findByUsername(who) : null;
    if (who && !person) return { ok: false, message: "Username not found. Leave blank and enter a donor name instead." };
    await recordDonation({ person_id: person?.id ?? null, donor_name: opt(fd, "donor_name"), amount, fund_name: str(fd, "fund_name") || "Offering", method: str(fd, "method") || "cash", note: opt(fd, "note"), paid_at: str(fd, "paid_at") ? new Date(str(fd, "paid_at")).toISOString() : null }, actor);
    await audit(actor, "donation.record", "donations", null, { amount });
    revalidatePath("/admin/giving");
    return { ok: true, message: "Donation recorded." };
  });
}

/* ---------------- Settings & staff ---------------- */
export async function saveSettingsAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    await saveSettings({
      church_name: str(fd, "church_name") || "FlagUpJesus Global Ministry", tagline: opt(fd, "tagline"), contact_email: opt(fd, "contact_email"),
      contact_phone: opt(fd, "contact_phone"), address: opt(fd, "address"), service_times: opt(fd, "service_times"), livestream_url: opt(fd, "livestream_url"),
      bank_name: opt(fd, "bank_name"), account_name: opt(fd, "account_name"), account_number: opt(fd, "account_number"),
      absence_threshold: Math.min(8, Math.max(1, Number(str(fd, "absence_threshold")) || 2))
    });
    await audit(actor, "settings.update", "church_settings", null);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

const ROLES = ["super_admin", "admin", "pastor", "pastoral_worker", "finance_admin", "department_leader"] as const;
export async function addStaffAction(_: State, fd: FormData): Promise<State> {
  return guarded("staff", async (actor) => {
    const email = str(fd, "email").toLowerCase();
    if (!z.string().email().safeParse(email).success) return { ok: false, message: "Enter a valid email (their Google account)." };
    const role = z.enum(ROLES).parse(str(fd, "role")) as StaffRole;
    const existing = await db().get("admin_users", { email });
    if (existing) await db().update("admin_users", { id: existing.id }, { role, active: true, full_name: str(fd, "full_name") || existing.full_name });
    else await db().insert("admin_users", { id: uid(), email, full_name: str(fd, "full_name") || email, role, active: true, last_login_at: null, created_at: nowIso() });
    await audit(actor, "staff.upsert", "admin_users", null, { email, role });
    revalidatePath("/admin/settings");
    return { ok: true, message: `${email} can now sign in as ${role.replace("_", " ")}.` };
  });
}

export async function toggleStaffAction(fd: FormData) {
  const admin = await requireAdmin("staff");
  const staff = await db().get("admin_users", { id: str(fd, "id") });
  if (staff && staff.id !== admin.uid) {
    await db().update("admin_users", { id: staff.id }, { active: !staff.active });
    await audit(admin.name, staff.active ? "staff.disable" : "staff.enable", "admin_users", staff.id);
  }
  revalidatePath("/admin/settings");
}
