"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Channel, FirstTimer, Partner, Person, StaffRole } from "@/lib/db/types";
import { requireAdmin } from "@/lib/auth/session";
import type { Area } from "@/lib/auth/roles";
import { createPerson, findByUsername, FriendlyError, updatePerson } from "@/lib/repo/people";
import { closeCheckIn, createService, openCheckIn, recordAttendance, updateService } from "@/lib/repo/services";
import { createTask, logContact, updateTask } from "@/lib/repo/care";
import { describeRun, runAbsenteeFollowUps } from "@/lib/repo/auto-follow-up";
import { describeFirstTimerRun, logFirstTimerContact, runFirstTimerFollowUps, sendFirstTimerWelcome, startFirstTimer, updateFirstTimer } from "@/lib/repo/first-timers";
import { addPartner, describePartnerRun, logPartnerContact, runPartnerFollowUps, sendPartnerThanks, updatePartner } from "@/lib/repo/partners";
import { sendBroadcast, sendTestMessage, smsUndelivered, tasksForNonResponders } from "@/lib/repo/messaging";
import { checkWhatsAppSetup } from "@/lib/messaging/providers";
import { saveAnnouncement, setAnnouncementStatus, updatePrayer, moderateTestimony } from "@/lib/repo/content";
import { recordDonation } from "@/lib/repo/giving";
import { saveSettings } from "@/lib/repo/settings";
import { addLeader, removeLeader, updateLeader } from "@/lib/repo/leaders";
import { describeBacklog, sendWelcomeBacklog, sendWelcomeEmail } from "@/lib/repo/accounts";
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
    const firstTimer = bool(fd, "first_timer");
    const person = await createPerson({
      full_name: fullName, phone: str(fd, "phone"), email: opt(fd, "email"), status: "member",
      gender: opt(fd, "gender"), birthday: opt(fd, "birthday"), address: opt(fd, "address"), how_heard: opt(fd, "how_heard"), notes: opt(fd, "notes"),
      verified_via: "admin", first_timer: firstTimer ? true : null
    });
    await audit(actor, "person.create", "people", person.id, { first_timer: firstTimer });
    // Their flag username + a set-a-password link, by email.
    after(() => sendWelcomeEmail(person).then(() => undefined, (error) => console.error("welcome email failed", error)));
    if (firstTimer) {
      const { journey } = await startFirstTimer(person, { source: "admin" });
      welcomeLater(journey, person);
    }
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
      ...(fd.has("whatsapp") ? { whatsapp: z.enum(["unknown", "yes", "no"]).parse(str(fd, "whatsapp")) } : {}),
      ...(fd.has("care_notes") ? { care_notes: opt(fd, "care_notes"), guardian_name: opt(fd, "guardian_name"), guardian_relationship: opt(fd, "guardian_relationship") } : {})
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
    await audit(actor, "checkin.close", "services", serviceId);
    // Right after the service: flag members who've now missed 2 Sundays and send their first follow-up message.
    after(async () => {
      try {
        const r = await runAbsenteeFollowUps();
        if (r.detected || r.firstSent || r.remindersSent) await audit("Automatic follow-up", "follow_up.auto_run", "follow_up_tasks", null, r as unknown as Record<string, unknown>);
      } catch (error) {
        console.error("automatic follow-up after closing check-in failed", error);
      }
      // First timers added at the desk during the service get their welcome message now.
      await runFirstTimerFollowUps().catch((error) => console.error("first-timer follow-up after closing check-in failed", error));
    });
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
  return guarded("care", async (actor) => {
    const r = await runAbsenteeFollowUps();
    await audit(actor, "follow_up.manual_run", "follow_up_tasks", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/pastoral-care");
    return { ok: true, message: describeRun(r) };
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

/** Settings → Messaging channels → "Check WhatsApp setup": reads Meta's view of the setup (sends nothing). */
export async function checkWhatsAppAction(): Promise<State> {
  return guarded("settings", async (actor) => {
    const result = await checkWhatsAppSetup();
    await audit(actor, "messaging.whatsapp_check", "settings", null, { ok: result.ok });
    return { ok: result.ok, message: result.lines.map((l) => `${l.ok === true ? "✅" : l.ok === false ? "❌" : "⚠️"} ${l.text}`).join("\n") };
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

/* ---------------- First timers ---------------- */
function welcomeLater(journey: FirstTimer, person: Person) {
  after(() => sendFirstTimerWelcome([{ journey, person }]).then(() => undefined, (error) => console.error("first-timer welcome failed", error)));
}
function thankLater(partner: Partner, person: Person) {
  after(() => sendPartnerThanks([{ partner, person }]).then(() => undefined, (error) => console.error("partner thank-you failed", error)));
}
const CONTACT_CHANNEL = z.enum(["call", "sms", "whatsapp", "visit", "email", "in_app", "note"]);
/** A date input (YYYY-MM-DD) as 9:00 in Lagos. */
const lagosDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T09:00:00+01:00`).toISOString() : null);

export async function startFirstTimerAction(_: State, fd: FormData): Promise<State> {
  let id = "";
  const result = await guarded("care", async (actor) => {
    const person = await db().get("people", { id: str(fd, "person_id") });
    if (!person) return { ok: false, message: "Person not found." };
    const { journey, created } = await startFirstTimer(person, { source: "admin", assignee: opt(fd, "assignee") });
    if (created) { welcomeLater(journey, person); await audit(actor, "first_timer.start", "first_timers", journey.id); }
    id = journey.id;
    return { ok: true };
  });
  return id ? { ok: true, redirectTo: `/admin/first-timers/${id}` } : result;
}

export async function updateFirstTimerAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async (actor) => {
    const id = str(fd, "id");
    const stage = z.enum(["new", "welcomed", "returned", "settled", "closed"]).parse(str(fd, "stage"));
    await updateFirstTimer(id, { stage, assignee: opt(fd, "assignee"), notes: opt(fd, "notes"), close_reason: stage === "closed" ? opt(fd, "close_reason") : null }, actor);
    await audit(actor, "first_timer.update", "first_timers", id, { stage });
    revalidatePath(`/admin/first-timers/${id}`);
    revalidatePath("/admin/first-timers");
    return { ok: true, message: "Saved." };
  });
}

export async function logFirstTimerContactAction(_: State, fd: FormData): Promise<State> {
  return guarded("care", async (actor) => {
    const id = str(fd, "id");
    await logFirstTimerContact(id, { channel: CONTACT_CHANNEL.parse(str(fd, "channel")), outcome: str(fd, "outcome") || "Contacted", note: opt(fd, "note"), author: actor });
    revalidatePath(`/admin/first-timers/${id}`);
    revalidatePath("/admin/first-timers");
    return { ok: true, message: "Contact logged." };
  });
}

export async function runFirstTimerAction(): Promise<State> {
  return guarded("care", async (actor) => {
    const r = await runFirstTimerFollowUps();
    await audit(actor, "first_timers.manual_run", "first_timers", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/first-timers");
    return { ok: true, message: describeFirstTimerRun(r) };
  });
}

/* ---------------- Partners ---------------- */
const amountFrom = (v: string) => { const n = Number(v.replace(/[,₦\s]/g, "")); return v.trim() && Number.isFinite(n) && n >= 0 ? n : null; };
const FREQUENCY = z.enum(["monthly", "quarterly", "yearly", "one_off"]);

export async function addPartnerAction(_: State, fd: FormData): Promise<State> {
  let id = "";
  const result = await guarded("partners", async (actor) => {
    const frequency = str(fd, "frequency");
    const { partner, person, created } = await addPartner({
      personId: opt(fd, "person_id") ?? undefined, full_name: str(fd, "full_name"), phone: str(fd, "phone"), email: opt(fd, "email"), source: "admin",
      pledge_amount: amountFrom(str(fd, "pledge_amount")), frequency: frequency ? FREQUENCY.parse(frequency) : null, notes: opt(fd, "notes"), assignee: opt(fd, "assignee")
    });
    if (created && bool(fd, "send_thanks")) thankLater(partner, person);
    await audit(actor, "partner.add", "partners", partner.id);
    id = partner.id;
    return { ok: true };
  });
  return id ? { ok: true, redirectTo: `/admin/partners/${id}?added=1` } : result;
}

export async function updatePartnerAction(_: State, fd: FormData): Promise<State> {
  return guarded("partners", async (actor) => {
    const id = str(fd, "id");
    const frequency = str(fd, "frequency");
    await updatePartner(id, {
      status: z.enum(["interested", "contacted", "committed", "active", "paused", "declined"]).parse(str(fd, "status")),
      pledge_amount: amountFrom(str(fd, "pledge_amount")), frequency: frequency ? FREQUENCY.parse(frequency) : null,
      next_follow_up_at: lagosDate(str(fd, "next_follow_up_at")), assignee: opt(fd, "assignee"), notes: opt(fd, "notes")
    }, actor);
    await audit(actor, "partner.update", "partners", id);
    revalidatePath(`/admin/partners/${id}`);
    revalidatePath("/admin/partners");
    return { ok: true, message: "Partner saved." };
  });
}

export async function logPartnerContactAction(_: State, fd: FormData): Promise<State> {
  return guarded("partners", async (actor) => {
    const id = str(fd, "id");
    const next = str(fd, "next_follow_up_at");
    await logPartnerContact(id, { channel: CONTACT_CHANNEL.parse(str(fd, "channel")), outcome: str(fd, "outcome") || "Contacted", note: opt(fd, "note"), author: actor, ...(next ? { next_follow_up_at: lagosDate(next) } : {}) });
    revalidatePath(`/admin/partners/${id}`);
    revalidatePath("/admin/partners");
    return { ok: true, message: "Contact logged." };
  });
}

export async function runPartnerAction(_: State, fd: FormData): Promise<State> {
  return guarded("partners", async (actor) => {
    const r = await runPartnerFollowUps(new Date(), { forceReminders: str(fd, "mode") === "reminders" });
    await audit(actor, "partners.manual_run", "partners", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/partners");
    return { ok: true, message: describePartnerRun(r) };
  });
}

/* ---------------- Settings & staff ---------------- */
export async function saveSettingsAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    await saveSettings({
      church_name: str(fd, "church_name") || "FlagUpJesus Global Ministry", tagline: opt(fd, "tagline"), contact_email: opt(fd, "contact_email"),
      contact_phone: opt(fd, "contact_phone"), address: opt(fd, "address"), service_times: opt(fd, "service_times"), livestream_url: opt(fd, "livestream_url"),
      bank_name: opt(fd, "bank_name"), account_name: opt(fd, "account_name"), account_number: opt(fd, "account_number")
    });
    await audit(actor, "settings.update", "church_settings", null);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

const clampInt = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" ? Math.min(max, Math.max(min, n)) : fallback;
};
export async function saveFollowUpSettingsAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    const channels = fd.getAll("follow_up_channels").map(String).filter((c): c is "whatsapp" | "sms" | "email" => ["whatsapp", "sms", "email"].includes(c));
    const first = str(fd, "follow_up_first_message"); const reminder = str(fd, "follow_up_reminder_message");
    if (first.length > 900 || reminder.length > 900) return { ok: false, message: "Keep each message under 900 characters (WhatsApp and SMS limits)." };
    await saveSettings({
      auto_follow_up: bool(fd, "auto_follow_up"),
      absence_threshold: clampInt(str(fd, "absence_threshold"), 1, 8, 2),
      follow_up_every_days: clampInt(str(fd, "follow_up_every_days"), 1, 30, 3),
      follow_up_max_messages: clampInt(str(fd, "follow_up_max_messages"), 0, 100, 0),
      follow_up_channels: channels, follow_up_first_message: first || null, follow_up_reminder_message: reminder || null
    });
    await audit(actor, "settings.follow_up", "church_settings", null, { auto: bool(fd, "auto_follow_up"), channels });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/pastoral-care");
    return { ok: true, message: "Automatic follow-up settings saved." };
  });
}

export async function saveFirstTimerPartnerSettingsAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    const texts = ["first_timer_welcome_message", "first_timer_invite_message", "partner_thanks_message", "partner_reminder_message"].map((k) => str(fd, k));
    if (texts.some((t) => t.length > 900)) return { ok: false, message: "Keep each message under 900 characters (WhatsApp and SMS limits)." };
    const [welcome, invite, thanks, reminder] = texts;
    await saveSettings({
      first_timer_auto: bool(fd, "first_timer_auto"), first_timer_max_invites: clampInt(str(fd, "first_timer_max_invites"), 0, 8, 3),
      first_timer_welcome_message: welcome || null, first_timer_invite_message: invite || null,
      partner_auto: bool(fd, "partner_auto"), partner_reminders: bool(fd, "partner_reminders"), partner_reminder_day: clampInt(str(fd, "partner_reminder_day"), 1, 28, 1),
      partner_thanks_message: thanks || null, partner_reminder_message: reminder || null
    });
    await audit(actor, "settings.first_timers_partners", "church_settings", null);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/first-timers");
    revalidatePath("/admin/partners");
    return { ok: true, message: "First-timer and partner settings saved." };
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


/* ---------------- Welcome emails ---------------- */
/** Settings → Welcome emails → "Send now": a paced batch to everyone who hasn't had it yet. */
export async function sendWelcomeBacklogAction(): Promise<State> {
  return guarded("settings", async (actor) => {
    const r = await sendWelcomeBacklog();
    await audit(actor, "welcome_email.backlog", "people", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/settings");
    return { ok: r.emailReady && !r.stoppedBecause, message: describeBacklog(r) };
  });
}

/** Member record → "Send welcome email" (again). */
export async function sendWelcomeToPersonAction(_: State, fd: FormData): Promise<State> {
  return guarded("members", async (actor) => {
    const person = await db().get("people", { id: str(fd, "id") });
    if (!person) return { ok: false, message: "Person not found." };
    if (!person.email) return { ok: false, message: "Add their email address first." };
    const r = await sendWelcomeEmail(person, { force: true });
    await audit(actor, "welcome_email.send", "people", person.id, { status: r.status });
    revalidatePath(`/admin/members/${person.id}`);
    return r.status === "sent" ? { ok: true, message: `Welcome email sent to ${person.email}.` } : { ok: false, message: r.detail ?? "The email couldn't be sent." };
  });
}
