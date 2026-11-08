import "server-only";
import { db, DuplicateError } from "@/lib/db";
import type { ChurchSettings, ContactLog, Donation, Partner, PartnerFrequency, PartnerStatus, Person } from "@/lib/db/types";
import { formatCurrency, nowIso, uid } from "@/lib/utils";
import { createPerson, findByPhone, FriendlyError, peopleById, updatePerson } from "./people";
import { getSettings } from "./settings";
import { followUpChannels } from "./auto-follow-up";
import { addContactLog, contactLogsFor, sendAutomaticMessage } from "./contact-logs";

/**
 * FUJ Partners: people who support the ministry with (regular) giving. They sign up at registration, from their
 * member portal, or an admin adds them. Statuses: interested → contacted → committed (pledged) → active (giving),
 * or paused / declined. Recording a gift for a partner (Admin → Giving) marks them active automatically.
 * Automatically: a thank-you message when they sign up and — once the church turns it on — a monthly reminder
 * with the ministry's bank details on a chosen day, for committed and active partners who haven't given yet.
 */

export const PARTNER_AUTHOR = "Automatic partner follow-up";
export const PARTNER_STATUSES: { value: PartnerStatus; label: string; hint: string }[] = [
  { value: "interested", label: "Interested", hint: "Asked to partner — reach out to them" },
  { value: "contacted", label: "Contacted", hint: "Someone has spoken with them" },
  { value: "committed", label: "Committed", hint: "Pledged to give" },
  { value: "active", label: "Active", hint: "Giving as a partner" },
  { value: "paused", label: "Paused", hint: "Taking a break" },
  { value: "declined", label: "Declined", hint: "Not partnering for now" }
];
export const partnerStatusLabel = (s: PartnerStatus) => PARTNER_STATUSES.find((x) => x.value === s)?.label ?? s;
export const FREQUENCIES: { value: PartnerFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }, { value: "one_off", label: "One-off" }
];
export const frequencyLabel = (f: PartnerFrequency | null) => FREQUENCIES.find((x) => x.value === f)?.label ?? "—";
export const PARTNER_OUTCOMES = ["Reached — will partner", "Reached — pledged", "Reached — thinking about it", "Reached — prayed together", "No answer", "Wrong number", "Not able to partner now", "Other"];

export const THANKS_TITLE = "Thank you for partnering with us";
export const REMINDER_TITLE = "Your FlagUpJesus partnership";
export const DEFAULT_THANKS_MESSAGE =
  "Hi {first_name}, thank you for choosing to partner with FlagUpJesus Global Ministry! Your support helps us take the gospel, medical outreaches and the love of God to many more people. Someone from our partnership team will reach out to you soon. God bless you!";
export const DEFAULT_REMINDER_MESSAGE =
  "Hi {first_name}, thank you for standing with FlagUpJesus Global Ministry as a partner. This is a gentle reminder of your {frequency} partnership{amount}. May God bless you and all that you do!";

const DAY = 86400000;
const inLagos = (d: Date) => new Date(d.getTime() + 3600000);

/** A pledge expressed per month, for totals (one-off pledges aren't recurring). */
export function monthlyEquivalent(p: Pick<Partner, "pledge_amount" | "frequency">) {
  const amount = Number(p.pledge_amount ?? 0);
  return p.frequency === "monthly" ? amount : p.frequency === "quarterly" ? amount / 3 : p.frequency === "yearly" ? amount / 12 : 0;
}

export type PartnerRow = Partner & { person: Person; given: number; givenThisYear: number; gifts: number };

function giving(donations: Donation[], personId: string, now = new Date()) {
  const mine = donations.filter((d) => d.person_id === personId && d.status === "paid");
  const yearStart = new Date(Date.UTC(inLagos(now).getUTCFullYear(), 0, 1)).getTime() - 3600000;
  return {
    given: mine.reduce((s, d) => s + Number(d.amount), 0),
    givenThisYear: mine.filter((d) => d.paid_at && new Date(d.paid_at).getTime() >= yearStart).reduce((s, d) => s + Number(d.amount), 0),
    gifts: mine.length
  };
}

export async function listPartners(): Promise<PartnerRow[]> {
  const rows = await db().list("partners", { order: { column: "created_at", ascending: false } });
  if (!rows.length) return [];
  const [people, donations] = await Promise.all([peopleById(rows.map((r) => r.person_id)), db().list("donations", { where: { person_id: rows.map((r) => r.person_id) } })]);
  return rows.flatMap((r) => {
    const person = people.get(r.person_id);
    return person ? [{ ...r, pledge_amount: r.pledge_amount === null ? null : Number(r.pledge_amount), person, ...giving(donations, r.person_id) }] : [];
  });
}

export async function getPartner(id: string) {
  const partner = await db().get("partners", { id });
  if (!partner) return null;
  const [person, logs, donations] = await Promise.all([
    db().get("people", { id: partner.person_id }),
    contactLogsFor("partner", id),
    db().list("donations", { where: { person_id: partner.person_id }, order: { column: "paid_at", ascending: false } })
  ]);
  if (!person) return null;
  return { ...partner, pledge_amount: partner.pledge_amount === null ? null : Number(partner.pledge_amount), person, logs, donations: donations.map((d) => ({ ...d, amount: Number(d.amount) })), ...giving(donations, partner.person_id) };
}

export async function partnerForPerson(personId: string) {
  return db().get("partners", { person_id: personId });
}

/**
 * Adds someone as a partner. Pass `personId` for an existing member, or name + phone (+ email) and the
 * person is linked by phone number — or created as a member if they're not in the system yet.
 * Signing up again from registration / the portal just returns their existing partner record.
 */
export async function addPartner(input: {
  personId?: string; full_name?: string; phone?: string; email?: string | null; source: Partner["source"];
  pledge_amount?: number | null; frequency?: PartnerFrequency | null; notes?: string | null; assignee?: string | null; next_follow_up_at?: string | null;
}): Promise<{ partner: Partner; person: Person; created: boolean }> {
  let person: Person | null = input.personId ? await db().get("people", { id: input.personId }) : null;
  if (!person && input.phone) {
    person = await findByPhone(input.phone);
    if (person && input.email && !person.email) person = (await updatePerson(person.id, { email: input.email.trim().toLowerCase() })) ?? person;
    if (!person) {
      if (!input.full_name || input.full_name.trim().length < 2) throw new FriendlyError("Enter the partner's full name.");
      person = await createPerson({ full_name: input.full_name, phone: input.phone, email: input.email ?? null, status: "member", verified_via: "admin" });
    }
  }
  if (!person) throw new FriendlyError("Enter the partner's name and phone number.");
  const existing = await partnerForPerson(person.id);
  if (existing) {
    // Someone who had paused or declined and asks again is interested again.
    if (input.source !== "admin" && (existing.status === "declined" || existing.status === "paused")) {
      const [row] = await db().update("partners", { id: existing.id }, { status: "interested", updated_at: nowIso() });
      return { partner: row ?? existing, person, created: false };
    }
    if (input.source === "admin") throw new FriendlyError(`${person.full_name} is already on the partners list.`);
    return { partner: existing, person, created: false };
  }
  const now = nowIso();
  const pledged = input.pledge_amount && input.pledge_amount > 0 ? input.pledge_amount : null;
  try {
    const partner = await db().insert("partners", {
      id: uid(), person_id: person.id, status: pledged ? "committed" : "interested", source: input.source, pledge_amount: pledged,
      frequency: input.frequency ?? null, assignee: input.assignee ?? null,
      // Reach out within 3 days of someone asking to partner.
      next_follow_up_at: input.next_follow_up_at ?? new Date(Date.now() + 3 * DAY).toISOString(),
      last_contacted_at: null, last_gift_at: null, thanks_sent_at: null, last_reminder_at: null, notes: input.notes ?? null, created_at: now, updated_at: now
    });
    return { partner, person, created: true };
  } catch (error) {
    const again = error instanceof DuplicateError ? await partnerForPerson(person.id) : null;
    if (again) return { partner: again, person, created: false };
    throw error;
  }
}

export async function updatePartner(id: string, patch: Partial<Pick<Partner, "status" | "pledge_amount" | "frequency" | "assignee" | "notes" | "next_follow_up_at">>, actor: string) {
  const current = await db().get("partners", { id });
  if (!current) return null;
  if (patch.status && patch.status !== current.status) {
    await addContactLog({ subject: "partner", subject_id: id, channel: "note", outcome: `Moved to ${partnerStatusLabel(patch.status)}`, author: actor });
  }
  const [row] = await db().update("partners", { id }, { ...patch, updated_at: nowIso() });
  return row;
}

export async function logPartnerContact(id: string, input: { channel: ContactLog["channel"]; outcome: string; note?: string | null; author: string; next_follow_up_at?: string | null }) {
  const partner = await db().get("partners", { id });
  if (!partner) return null;
  const log = await addContactLog({ subject: "partner", subject_id: id, channel: input.channel, outcome: input.outcome, note: input.note ?? null, author: input.author });
  const now = nowIso();
  const reached = /^reached/i.test(input.outcome);
  await db().update("partners", { id }, {
    last_contacted_at: now, updated_at: now,
    next_follow_up_at: input.next_follow_up_at !== undefined ? input.next_follow_up_at : partner.next_follow_up_at && new Date(partner.next_follow_up_at).getTime() <= Date.now() ? null : partner.next_follow_up_at,
    ...(reached && partner.status === "interested" ? { status: /pledged/i.test(input.outcome) ? "committed" as const : "contacted" as const } : {})
  });
  return log;
}

/** Called when giving is recorded: a gift from a partner makes them active and updates "last gift". */
export async function notePartnerGift(personId: string, paidAt: string) {
  const partner = await partnerForPerson(personId);
  if (!partner) return null;
  const now = nowIso();
  const last = !partner.last_gift_at || paidAt > partner.last_gift_at ? paidAt : partner.last_gift_at;
  const activate = partner.status === "interested" || partner.status === "contacted" || partner.status === "committed" || partner.status === "paused";
  await db().update("partners", { id: partner.id }, { last_gift_at: last, updated_at: now, ...(activate ? { status: "active" as const } : {}) });
  if (activate) await addContactLog({ subject: "partner", subject_id: partner.id, channel: "note", outcome: "Gift received", author: "Giving", note: `Marked active — gift recorded on ${paidAt.slice(0, 10)}.` });
  return activate;
}

const reminderVars = (settings: ChurchSettings, partners: Map<string, Partner>) => (text: string, person: Person) => {
  const p = partners.get(person.id);
  const amount = p?.pledge_amount ? ` of ${formatCurrency(Number(p.pledge_amount))}` : "";
  const bank = settings.account_number ? `\n\n${settings.bank_name ?? "Bank"}: ${settings.account_number} (${settings.account_name ?? settings.church_name}). Please use your username ${person.username ?? ""} as the narration.` : "";
  const body = text.replaceAll("{amount}", amount).replaceAll("{frequency}", p?.frequency && p.frequency !== "one_off" ? p.frequency : "").replace(/ {2,}/g, " ");
  return `${body}${bank}`;
};

/** Sends the thank-you message to new partners (skips anyone already thanked, or when turned off). */
export async function sendPartnerThanks(items: { partner: Partner; person: Person }[], settings?: ChurchSettings) {
  const s = settings ?? await getSettings();
  const due = items.filter((i) => !i.partner.thanks_sent_at && i.partner.status !== "declined");
  if (!s.partner_auto || !due.length) return 0;
  await sendAutomaticMessage({
    subject: "partner", items: due.map((i) => ({ id: i.partner.id, person: i.person })), title: THANKS_TITLE,
    body: s.partner_thanks_message?.trim() || DEFAULT_THANKS_MESSAGE, audience: "auto_partner:thanks", channels: followUpChannels(s),
    author: PARTNER_AUTHOR, outcome: "auto_thanks", note: () => "Thank-you message."
  });
  const now = nowIso();
  for (const i of due) await db().update("partners", { id: i.partner.id }, { thanks_sent_at: now, updated_at: now });
  return due.length;
}

/** Whether a committed/active partner should get this month's reminder. */
export function reminderDue(p: Pick<Partner, "status" | "frequency" | "last_reminder_at" | "last_gift_at">, now = new Date()) {
  if (p.status !== "committed" && p.status !== "active") return false;
  if (!p.frequency || p.frequency === "one_off") return false;
  const local = inLagos(now);
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 3600000;
  const period = p.frequency === "monthly" ? 25 * DAY : p.frequency === "quarterly" ? 85 * DAY : 360 * DAY;
  if (p.last_reminder_at && (new Date(p.last_reminder_at).getTime() >= monthStart || now.getTime() - new Date(p.last_reminder_at).getTime() < period)) return false;
  // Already gave in this period — no reminder needed.
  const since = p.frequency === "monthly" ? monthStart : now.getTime() - period;
  if (p.last_gift_at && new Date(p.last_gift_at).getTime() >= since) return false;
  return true;
}

export type PartnerRun = { thanked: number; reminded: number; reminderDay: boolean; remindersOn: boolean };

/**
 * Daily job: thank new partners; and on the chosen day of the month (when partner reminders are on — or when an
 * admin clicks "Send reminders now") remind committed and active partners who haven't given yet this period.
 */
export async function runPartnerFollowUps(now = new Date(), opts: { forceReminders?: boolean } = {}): Promise<PartnerRun> {
  const settings = await getSettings();
  const result: PartnerRun = { thanked: 0, reminded: 0, reminderDay: inLagos(now).getUTCDate() === settings.partner_reminder_day, remindersOn: settings.partner_reminders };
  const partners = (await db().list("partners")).filter((p) => p.status !== "declined");
  if (!partners.length) return result;
  const people = await peopleById(partners.map((p) => p.person_id));
  const withPerson = partners.flatMap((p) => { const person = people.get(p.person_id); return person && person.status === "member" ? [{ partner: p, person }] : []; });

  // People who signed up themselves (registration / portal) get the thank-you; admins choose when they add someone.
  result.thanked = await sendPartnerThanks(withPerson.filter((i) => i.partner.source !== "admin" && !i.partner.thanks_sent_at && now.getTime() - new Date(i.partner.created_at).getTime() <= 7 * DAY), settings);

  if (opts.forceReminders || (settings.partner_reminders && result.reminderDay)) {
    const due = withPerson.filter((i) => reminderDue(i.partner, now));
    if (due.length) {
      await sendAutomaticMessage({
        subject: "partner", items: due.map((i) => ({ id: i.partner.id, person: i.person })), title: REMINDER_TITLE,
        body: settings.partner_reminder_message?.trim() || DEFAULT_REMINDER_MESSAGE, audience: "auto_partner:reminder", channels: followUpChannels(settings),
        author: PARTNER_AUTHOR, outcome: "auto_reminder", note: () => "Partnership reminder with the bank details.",
        personalize: reminderVars(settings, new Map(due.map((i) => [i.person.id, i.partner])))
      });
      const stamp = now.toISOString();
      for (const i of due) await db().update("partners", { id: i.partner.id }, { last_reminder_at: stamp, updated_at: nowIso() });
      result.reminded = due.length;
    }
  }
  return result;
}

export function describePartnerRun(r: PartnerRun) {
  const parts = [`${r.thanked} thank-you message${r.thanked === 1 ? "" : "s"} sent`];
  if (r.reminded) parts.push(`${r.reminded} partnership reminder${r.reminded === 1 ? "" : "s"} sent`);
  else if (!r.remindersOn) parts.push("monthly reminders are off");
  else if (!r.reminderDay) parts.push("reminders go out on the chosen day of the month");
  else parts.push("no partner is due a reminder");
  return parts.join(" · ") + ".";
}
