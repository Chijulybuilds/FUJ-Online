import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-ftp-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const calls: { url: string; body: Record<string, unknown> }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
  if (url.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
  return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const services = await import("../../src/lib/repo/services");
const care = await import("../../src/lib/repo/care");
const settingsRepo = await import("../../src/lib/repo/settings");
const ft = await import("../../src/lib/repo/first-timers");
const partners = await import("../../src/lib/repo/partners");
const giving = await import("../../src/lib/repo/giving");
const messaging = await import("../../src/lib/repo/messaging");

const DAY = 86400000;
/** The next Saturday 10:00 Lagos (09:00 UTC) at least `minDays` from now. */
function saturdayAfter(minDays: number) {
  const d = new Date(Date.now() + minDays * DAY);
  d.setUTCHours(9, 0, 0, 0);
  while (d.getUTCDay() !== 6) d.setTime(d.getTime() + DAY);
  return d;
}
const sentTo = (digits: string) => calls.some((c) => JSON.stringify(c.body).includes(digits));
const logs = (subject: "first_timer" | "partner", id: string) => db().list("contact_logs", { where: { subject, subject_id: id } });

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ", RESEND_API_KEY: "re", EMAIL_FROM: "FUJ <news@flagupjesus.org>" });
});
afterAll(() => vi.unstubAllGlobals());

describe("first timers", () => {
  let journeyId = "", personId = "";

  it("starts a journey only for people who say it's their first time; existing members registering online are not 'new'", async () => {
    const newcomer = await people.createPerson({ full_name: "Ngozi Newcomer", phone: "08050000001", email: "ngozi@example.com", first_timer: true });
    const oldMember = await people.createPerson({ full_name: "Olu Oldmember", phone: "08050000002", first_timer: false });
    expect(oldMember.first_visit_at).toBeNull();
    const { journey, created } = await ft.startFirstTimer(newcomer, { source: "registration" });
    expect(created).toBe(true);
    expect(journey).toMatchObject({ stage: "new", visits: 1, invites_sent: 0, welcome_sent_at: null });
    expect((await ft.startFirstTimer(newcomer, { source: "registration" })).created).toBe(false);
    journeyId = journey.id; personId = newcomer.id;

    // Both check in to today's service: the old member isn't counted as "first time in church".
    const svc = await services.createService({ title: "Sunday Word Experience", category: "Sunday worship", starts_at: new Date().toISOString() });
    await services.recordAttendance({ person: oldMember, serviceId: svc.id, method: "qr" });
    const rows = await services.attendanceForService(svc.id);
    expect(rows.find((r) => r.person_id === oldMember.id)?.firstTime).toBe(false);
    // The absence analysis no longer turns recent check-ins into "new member" tasks.
    await care.runFollowUpAnalysis();
    expect(await db().list("follow_up_tasks", { where: { category: "first_timer" } })).toHaveLength(0);
    expect(await db().get("first_timers", { person_id: oldMember.id })).toBeNull();
  });

  it("sends the welcome message once, on every channel, and logs it", async () => {
    calls.length = 0;
    const journey = (await db().get("first_timers", { id: journeyId }))!;
    const person = (await db().get("people", { id: personId }))!;
    expect(await ft.sendFirstTimerWelcome([{ journey, person }])).toBe(1);
    expect(sentTo("2348050000001")).toBe(true);
    expect(calls.some((c) => c.url.includes("resend"))).toBe(true);
    const b = (await db().list("broadcasts", { where: { audience: "auto_first_timer:welcome" } }))[0];
    expect(b).toMatchObject({ title: "Welcome to FlagUpJesus", recipient_count: 1, kind: "follow_up" });
    expect((await db().get("first_timers", { id: journeyId }))!.welcome_sent_at).not.toBeNull();
    expect((await logs("first_timer", journeyId)).some((l) => l.outcome === "auto_welcome" && /Sent via app inbox, WhatsApp, SMS, email/.test(l.note ?? ""))).toBe(true);
    expect(await ft.sendFirstTimerWelcome([{ journey: (await db().get("first_timers", { id: journeyId }))!, person }])).toBe(0);
  });

  it("invites them back on Saturdays — at most once a week, up to the limit, and only after a few days", async () => {
    const sat = saturdayAfter(0);
    // Pretend their first visit was last Sunday.
    await db().update("first_timers", { id: journeyId }, { first_visit_at: new Date(sat.getTime() - 6 * DAY).toISOString() });
    const notSaturday = new Date(sat.getTime() - DAY);
    expect(await ft.runFirstTimerFollowUps(notSaturday)).toMatchObject({ invited: 0, inviteDay: false });
    calls.length = 0;
    const first = await ft.runFirstTimerFollowUps(sat);
    expect(first).toMatchObject({ invited: 1, inviteDay: true, welcomed: 0 });
    expect(sentTo("2348050000001")).toBe(true);
    const invite = (await db().list("broadcasts", { where: { audience: "auto_first_timer:invite" } }))[0];
    expect(invite.title).toBe("See you this Sunday?");
    const recipient = (await db().list("broadcast_recipients", { where: { broadcast_id: invite.id } }))[0];
    expect(recipient.person_id).toBe(personId);
    expect(await ft.runFirstTimerFollowUps(new Date(sat.getTime() + 3600000))).toMatchObject({ invited: 0 }); // same Saturday
    expect(await ft.runFirstTimerFollowUps(new Date(sat.getTime() + 7 * DAY))).toMatchObject({ invited: 1 }); // next Saturday
    expect((await db().get("first_timers", { id: journeyId }))!.invites_sent).toBe(2);
    // Someone who only registered yesterday waits until the following Saturday.
    const fresh = await people.createPerson({ full_name: "Femi Fresh", phone: "08050000003", first_timer: true });
    await ft.startFirstTimer(fresh, { source: "registration", firstVisitAt: new Date(sat.getTime() - DAY).toISOString() });
    const r = await ft.runFirstTimerFollowUps(new Date(sat.getTime() + 14 * DAY - 13 * DAY));
    expect(r.invited).toBe(0);
  });

  it("notices when they come back at check-in, stops the invitations and counts visits", async () => {
    // Their first visit was a week ago.
    await db().update("first_timers", { id: journeyId }, { first_visit_at: new Date(Date.now() - 7 * DAY).toISOString() });
    const journey = (await db().get("first_timers", { id: journeyId }))!;
    const svc = await services.createService({ title: "Sunday Celebration", category: "Sunday worship", starts_at: new Date().toISOString() });
    await services.recordAttendance({ person: (await db().get("people", { id: personId }))!, serviceId: svc.id, method: "qr" });
    const after = (await db().get("first_timers", { id: journeyId }))!;
    expect(after).toMatchObject({ stage: "returned", visits: 1 });
    expect(after.returned_at).not.toBeNull();
    expect((await logs("first_timer", journeyId)).some((l) => l.outcome === "Came back to church" && /Sunday Celebration/.test(l.note ?? ""))).toBe(true);
    expect(ft.nextStep(after, await settingsRepo.getSettings()).text).toMatch(/help them join a unit/);
    calls.length = 0;
    expect(await ft.runFirstTimerFollowUps(saturdayAfter(15))).toMatchObject({ invited: 1 }); // only Femi now
    expect(sentTo("2348050000001")).toBe(false);
    expect(journey.stage).not.toBe("returned"); // (was not returned before)
  });

  it("checking in to the same service they registered at isn't 'coming back'", async () => {
    const p = await people.createPerson({ full_name: "Sade Same", phone: "08050000004", first_timer: true });
    const svc = await services.createService({ title: "Sunday same day", category: "Sunday worship", starts_at: new Date().toISOString() });
    const checkIn = await services.recordAttendance({ person: p, serviceId: svc.id, method: "qr" });
    const { journey } = await ft.startFirstTimer(p, { source: "registration", serviceId: svc.id, firstVisitAt: checkIn.attendance.checked_in_at });
    await ft.noteFirstTimerCheckIn(p.id, new Date(Date.now() + 3600000).toISOString(), "Evening service");
    expect((await db().get("first_timers", { id: journey.id }))!.stage).toBe("new");
  });

  it("staff contact moves them along; closing records the reason", async () => {
    const p = await people.createPerson({ full_name: "Tolu Team", phone: "08050000005", first_timer: true });
    const { journey } = await ft.startFirstTimer(p, { source: "desk" });
    await ft.logFirstTimerContact(journey.id, { channel: "call", outcome: "Reached — welcomed them", author: "Pastor Grace" });
    expect((await db().get("first_timers", { id: journey.id }))!).toMatchObject({ stage: "welcomed" });
    await ft.logFirstTimerContact(journey.id, { channel: "whatsapp", outcome: "Reached — joined a unit / TFT", author: "Pastor Grace" });
    expect((await db().get("first_timers", { id: journey.id }))!.stage).toBe("settled");
    await ft.updateFirstTimer(journey.id, { stage: "closed", close_reason: "Moved to Abuja" }, "Admin");
    const closed = (await db().get("first_timers", { id: journey.id }))!;
    expect(closed.closed_at).not.toBeNull();
    expect((await logs("first_timer", journey.id)).some((l) => l.outcome === "Moved to Closed" && l.note === "Moved to Abuja")).toBe(true);
  });

  it("the 'First timers' broadcast audience is everyone still on the journey", async () => {
    const audience = (await messaging.resolveAudience("first_timers")).map((p) => p.full_name).sort();
    expect(audience).toEqual(["Femi Fresh", "Ngozi Newcomer", "Sade Same"]);
  });
});

describe("FUJ partners", () => {
  let interestedId = "", partnerPerson = "";

  it("signing up at registration makes them 'interested' with a follow-up in 3 days; signing up again doesn't duplicate", async () => {
    const p = await people.createPerson({ full_name: "Pat Partner", phone: "08060000001", email: "pat@example.com" });
    const { partner, created } = await partners.addPartner({ personId: p.id, source: "registration" });
    expect(created).toBe(true);
    expect(partner).toMatchObject({ status: "interested", pledge_amount: null, source: "registration" });
    expect(new Date(partner.next_follow_up_at!).getTime()).toBeGreaterThan(Date.now() + 2.9 * DAY);
    expect((await partners.addPartner({ personId: p.id, source: "portal" })).created).toBe(false);
    await expect(partners.addPartner({ personId: p.id, source: "admin" })).rejects.toThrow(/already on the partners list/);
    interestedId = partner.id; partnerPerson = p.id;
  });

  it("thanks people who signed up themselves (not ones staff added)", async () => {
    const added = await partners.addPartner({ full_name: "Kemi Known", phone: "08060000002", source: "admin", pledge_amount: 50000, frequency: "monthly" });
    expect(added.created).toBe(true);
    expect(added.partner.status).toBe("committed"); // a pledge = committed
    expect(added.person.full_name).toBe("Kemi Known"); // created as a member
    calls.length = 0;
    const r = await partners.runPartnerFollowUps(new Date());
    expect(r.thanked).toBe(1);
    expect(sentTo("2348060000001")).toBe(true);
    expect(sentTo("2348060000002")).toBe(false);
    expect((await db().get("partners", { id: interestedId }))!.thanks_sent_at).not.toBeNull();
    expect((await partners.runPartnerFollowUps(new Date())).thanked).toBe(0);
  });

  it("a logged call moves them on; a recorded gift makes them active", async () => {
    await partners.logPartnerContact(interestedId, { channel: "call", outcome: "Reached — pledged", author: "Finance team", next_follow_up_at: null });
    const pledged = (await db().get("partners", { id: interestedId }))!;
    expect(pledged).toMatchObject({ status: "committed", next_follow_up_at: null });
    await partners.updatePartner(interestedId, { pledge_amount: 20000, frequency: "monthly" }, "Finance team");
    await giving.recordDonation({ person_id: partnerPerson, donor_name: null, amount: 20000, fund_name: "Partnership", method: "transfer", note: null, paid_at: new Date().toISOString() }, "Finance team");
    const active = (await db().get("partners", { id: interestedId }))!;
    expect(active.status).toBe("active");
    expect(active.last_gift_at).not.toBeNull();
    const row = (await partners.listPartners()).find((x) => x.id === interestedId)!;
    expect(row.given).toBe(20000);
    expect(partners.monthlyEquivalent({ pledge_amount: 30000, frequency: "quarterly" })).toBe(10000);
  });

  it("knows who is due a monthly reminder", () => {
    const now = new Date("2026-11-15T09:00:00Z");
    const base = { status: "active" as const, frequency: "monthly" as const, last_reminder_at: null, last_gift_at: null };
    expect(partners.reminderDue(base, now)).toBe(true);
    expect(partners.reminderDue({ ...base, last_gift_at: "2026-11-03T10:00:00Z" }, now)).toBe(false); // already gave this month
    expect(partners.reminderDue({ ...base, last_gift_at: "2026-10-20T10:00:00Z" }, now)).toBe(true);
    expect(partners.reminderDue({ ...base, last_reminder_at: "2026-11-01T09:00:00Z" }, now)).toBe(false); // reminded this month
    expect(partners.reminderDue({ ...base, frequency: "one_off" }, now)).toBe(false);
    expect(partners.reminderDue({ ...base, status: "interested" }, now)).toBe(false);
    expect(partners.reminderDue({ ...base, frequency: "quarterly", last_reminder_at: "2026-10-01T09:00:00Z" }, now)).toBe(false);
    expect(partners.reminderDue({ ...base, frequency: "quarterly", last_reminder_at: "2026-08-01T09:00:00Z" }, now)).toBe(true);
  });

  it("sends monthly reminders (with pledge and bank details) only when turned on, on the chosen day", async () => {
    const now = new Date();
    const lagosDay = new Date(now.getTime() + 3600000).getUTCDate();
    await settingsRepo.saveSettings({ partner_reminders: false, partner_reminder_day: Math.min(28, lagosDay) });
    expect((await partners.runPartnerFollowUps(now)).reminded).toBe(0); // off
    await settingsRepo.saveSettings({ partner_reminders: true, partner_reminder_day: lagosDay === 1 ? 2 : 1 });
    expect((await partners.runPartnerFollowUps(now)).reminded).toBe(0); // not the day
    calls.length = 0;
    const forced = await partners.runPartnerFollowUps(now, { forceReminders: true });
    expect(forced.reminded).toBe(1); // Kemi (committed, monthly, hasn't given); Pat gave this month
    const sms = calls.find((c) => c.url.includes("termii") && JSON.stringify(c.body).includes("2348060000002"));
    expect(JSON.stringify(sms?.body)).toContain("monthly partnership of ₦50,000");
    expect(JSON.stringify(sms?.body)).toContain("5600605313");
    expect((await partners.runPartnerFollowUps(now, { forceReminders: true })).reminded).toBe(0); // once a month
  });

  it("partner broadcast audiences leave out declined partners", async () => {
    const q = await partners.addPartner({ full_name: "Quinn Quiet", phone: "08060000003", source: "admin" });
    await partners.updatePartner(q.partner.id, { status: "declined" }, "Admin");
    expect((await messaging.resolveAudience("partners")).map((p) => p.full_name).sort()).toEqual(["Kemi Known", "Pat Partner"]);
    expect((await messaging.resolveAudience("partners_active")).map((p) => p.full_name).sort()).toEqual(["Kemi Known", "Pat Partner"]);
  });
});
