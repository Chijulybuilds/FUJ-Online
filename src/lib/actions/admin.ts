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
import { describeFirstTimerRun, firstTimerQuickAction as firstTimerQuickAction_, runFirstTimerFollowUps, sendFirstTimerWelcome, startFirstTimer, updateFirstTimer } from "@/lib/repo/first-timers";
import { addPartner, CURRENCIES, describePartnerRun, logPartnerContact, runPartnerFollowUps, sendPartnerThanks, updatePartner } from "@/lib/repo/partners";
import { sendBroadcast, sendTestMessage, smsUndelivered } from "@/lib/repo/messaging";
import { checkWhatsAppSetup } from "@/lib/messaging/providers";
import { describeAbsenceReport, reportNumbers, sendAbsenceReport } from "@/lib/repo/absence";
import { saveAnnouncement, setAnnouncementStatus, updatePrayer, moderateTestimony } from "@/lib/repo/content";
import { recordDonation } from "@/lib/repo/giving";
import { getSettings, saveSettings } from "@/lib/repo/settings";
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
    // First timers added at the desk during the service get their welcome message now.
    after(() => runFirstTimerFollowUps().then(() => undefined, (error) => console.error("first-timer follow-up after closing check-in failed", error)));
    return null;
  });
  revalidatePath(`/admin/services/${serviceId}`);
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
    const amount = Number(str(fd, "amount").replace(/[,₦$£€\s]/g, ""));
    const currency = (CURRENCIES as readonly string[]).includes(str(fd, "currency")) ? str(fd, "currency") : "NGN";
    if (!amount || amount <= 0) return { ok: false, message: "Enter a valid amount." };
    const who = str(fd, "person");
    const person = who ? await findByUsername(who) : null;
    if (who && !person) return { ok: false, message: "Username not found. Leave blank and enter a donor name instead." };
    await recordDonation({ person_id: person?.id ?? null, donor_name: opt(fd, "donor_name"), amount, currency, fund_name: str(fd, "fund_name") || "Offering", method: str(fd, "method") || "cash", note: opt(fd, "note"), paid_at: str(fd, "paid_at") ? new Date(str(fd, "paid_at")).toISOString() : null }, actor);
    await audit(actor, "donation.record", "donations", null, { amount, currency });
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
  const result = await guarded("first_timers", async (actor) => {
    const person = await db().get("people", { id: str(fd, "person_id") });
    if (!person) return { ok: false, message: "Person not found." };
    const { journey, created } = await startFirstTimer(person, { source: "admin", assignee: opt(fd, "assignee") });
    if (created) { welcomeLater(journey, person); await audit(actor, "first_timer.start", "first_timers", journey.id); }
    id = journey.id;
    return { ok: true };
  });
  return id ? { ok: true, redirectTo: `/admin/first-timers/${id}` } : result;
}

const QUICK = z.enum(["reached", "no_answer", "came_back", "remove", "restore"]);
const QUICK_DONE: Record<z.infer<typeof QUICK>, string> = {
  reached: "Marked as called. 🙌", no_answer: "Noted — try again later.", came_back: "Marked as came back. 🙌", remove: "Removed from the list.", restore: "Back on the list."
};

/** One-click buttons on the first-timers list (Reached / No answer / Came back). */
export async function firstTimerQuickAction(fd: FormData) {
  await guarded("first_timers", async (actor) => {
    const id = str(fd, "id");
    const action = QUICK.parse(str(fd, "do"));
    await firstTimerQuickAction_(id, action, actor, opt(fd, "note"));
    await audit(actor, `first_timer.${action}`, "first_timers", id);
    return null;
  });
  revalidatePath("/admin/first-timers");
}

/** The same buttons on a first timer's page, with an optional note and a confirmation. */
export async function firstTimerStepAction(_: State, fd: FormData): Promise<State> {
  return guarded("first_timers", async (actor) => {
    const id = str(fd, "id");
    const action = QUICK.parse(str(fd, "do"));
    await firstTimerQuickAction_(id, action, actor, opt(fd, "note"));
    await audit(actor, `first_timer.${action}`, "first_timers", id);
    revalidatePath(`/admin/first-timers/${id}`);
    revalidatePath("/admin/first-timers");
    return { ok: true, message: QUICK_DONE[action] };
  });
}

export async function saveFirstTimerNotesAction(_: State, fd: FormData): Promise<State> {
  return guarded("first_timers", async (actor) => {
    const id = str(fd, "id");
    await updateFirstTimer(id, { notes: opt(fd, "notes") }, actor);
    revalidatePath(`/admin/first-timers/${id}`);
    return { ok: true, message: "Notes saved." };
  });
}

export async function runFirstTimerAction(): Promise<State> {
  return guarded("first_timers", async (actor) => {
    const r = await runFirstTimerFollowUps();
    await audit(actor, "first_timers.manual_run", "first_timers", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/first-timers");
    return { ok: true, message: describeFirstTimerRun(r) };
  });
}

/* ---------------- Partners ---------------- */
const amountFrom = (v: string) => { const n = Number(v.replace(/[,₦$£€\s]/g, "")); return v.trim() && Number.isFinite(n) && n >= 0 ? n : null; };
const FREQUENCY = z.enum(["monthly", "quarterly", "yearly", "one_off"]);
const STREAM = z.enum(["outreach", "associate"]);
const currencyFrom = (fd: FormData) => ((CURRENCIES as readonly string[]).includes(str(fd, "currency")) ? str(fd, "currency") : "NGN");

export async function addPartnerAction(_: State, fd: FormData): Promise<State> {
  let id = "";
  const result = await guarded("partners", async (actor) => {
    const frequency = str(fd, "frequency");
    const stream = STREAM.parse(str(fd, "stream") || "outreach");
    const { partner, person, created } = await addPartner({
      personId: opt(fd, "person_id") ?? undefined, full_name: str(fd, "full_name"), phone: str(fd, "phone"), email: opt(fd, "email"), source: "admin",
      pledge_amount: amountFrom(str(fd, "pledge_amount")), frequency: frequency ? FREQUENCY.parse(frequency) : null, notes: opt(fd, "notes"), assignee: opt(fd, "assignee"),
      stream, country: opt(fd, "country"), organisation: opt(fd, "organisation"), currency: currencyFrom(fd)
    });
    if (created && bool(fd, "send_thanks")) thankLater(partner, person);
    await audit(actor, "partner.add", "partners", partner.id, { stream });
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
      next_follow_up_at: lagosDate(str(fd, "next_follow_up_at")), assignee: opt(fd, "assignee"), notes: opt(fd, "notes"),
      ...(fd.has("stream") ? { stream: STREAM.parse(str(fd, "stream")), currency: currencyFrom(fd), country: opt(fd, "country"), organisation: opt(fd, "organisation") } : {})
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
/** Settings → Missed-Sundays report: on/off, after how many Sundays, and who gets the SMS. */
export async function saveAbsenceReportAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    const raw = str(fd, "absence_report_numbers");
    const numbers = reportNumbers({ absence_report_numbers: raw });
    if (bool(fd, "absence_report") && !numbers.length) return { ok: false, message: "Add at least one phone number for the report (the pastor's, for example)." };
    if (numbers.length > 20) return { ok: false, message: "Up to 20 numbers — each one is a paid SMS every week." };
    await saveSettings({ absence_report: bool(fd, "absence_report"), absence_threshold: clampInt(str(fd, "absence_threshold"), 1, 8, 2), absence_report_numbers: numbers.join("\n") || null });
    await audit(actor, "settings.absence_report", "church_settings", null, { on: bool(fd, "absence_report"), numbers: numbers.length });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/absent");
    return { ok: true, message: `Saved. ${bool(fd, "absence_report") ? `The report goes to ${numbers.length} number${numbers.length === 1 ? "" : "s"} every Monday morning.` : "The weekly report is off."}` };
  });
}

export async function sendAbsenceReportAction(): Promise<State> {
  return guarded("settings", async (actor) => {
    const r = await sendAbsenceReport({ force: true });
    await audit(actor, "absence_report.manual_run", "people", null, r as unknown as Record<string, unknown>);
    revalidatePath("/admin/settings");
    return { ok: !r.failed && !r.skipped?.includes("numbers"), message: describeAbsenceReport(r) };
  });
}

export async function saveFirstTimerPartnerSettingsAction(_: State, fd: FormData): Promise<State> {
  return guarded("settings", async (actor) => {
    const texts = ["first_timer_welcome_message", "first_timer_invite_message", "partner_thanks_message", "partner_reminder_message"].map((k) => str(fd, k));
    if (texts.some((t) => t.length > 900)) return { ok: false, message: "Keep each message under 900 characters (WhatsApp and SMS limits)." };
    const [welcome, invite, thanks, reminder] = texts;
    const abroad = str(fd, "associate_giving_details");
    if (abroad.length > 600) return { ok: false, message: "Keep the giving details for associate partners under 600 characters." };
    // Only written when set (or being cleared), so this form still saves on a database before migration 0017.
    const current = await getSettings();
    const channels = fd.getAll("follow_up_channels").map(String).filter((c): c is "whatsapp" | "sms" | "email" => ["whatsapp", "sms", "email"].includes(c));
    await saveSettings({
      ...(fd.has("channels_shown") ? { follow_up_channels: channels } : {}),
      first_timer_auto: bool(fd, "first_timer_auto"), first_timer_max_invites: clampInt(str(fd, "first_timer_max_invites"), 0, 8, 3),
      first_timer_welcome_message: welcome || null, first_timer_invite_message: invite || null,
      partner_auto: bool(fd, "partner_auto"), partner_reminders: bool(fd, "partner_reminders"), partner_reminder_day: clampInt(str(fd, "partner_reminder_day"), 1, 28, 1),
      partner_thanks_message: thanks || null, partner_reminder_message: reminder || null,
      ...(abroad || current.associate_giving_details ? { associate_giving_details: abroad || null } : {})
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
