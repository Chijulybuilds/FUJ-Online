import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-auto-")), "db.json");
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
const auto = await import("../../src/lib/repo/auto-follow-up");
const { nowIso, uid } = await import("../../src/lib/utils");

const DAY = 86400000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);
const hosts = () => ({ wa: calls.filter((c) => c.url.includes("graph.facebook.com")).length, sms: calls.filter((c) => c.url.includes("termii")).length, email: calls.filter((c) => c.url.includes("resend")).length });

async function sunday(daysAgo: number, attendees: string[], title = `Sunday -${daysAgo}d`) {
  const svc = await services.createService({ title, category: "Sunday worship", starts_at: at(-daysAgo).toISOString() });
  for (const personId of attendees) {
    await db().insert("attendance", { id: uid(), person_id: personId, service_id: svc.id, checked_in_at: at(-daysAgo).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: nowIso() });
  }
  return svc;
}
const absenteeTask = async (personId: string) => (await db().list("follow_up_tasks", { where: { person_id: personId, category: "absentee" } }))[0];

let ada = "", bola = "", chi = "", dayo = "";
beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ", RESEND_API_KEY: "re", EMAIL_FROM: "FUJ <news@flagupjesus.org>" });
  ada = (await people.createPerson({ full_name: "Ada Away", phone: "08040000001", email: "ada@example.com" })).id;
  bola = (await people.createPerson({ full_name: "Bola Faithful", phone: "08040000002" })).id;
  chi = (await people.createPerson({ full_name: "Chi New", phone: "08040000003" })).id;
  dayo = (await people.createPerson({ full_name: "Dayo Away", phone: "08040000004" })).id;
  await sunday(21, [ada, bola, dayo]);
  await sunday(14, [bola]);
  await sunday(7, [bola, chi]);
  // A Sunday where nobody opened check-in must not make everyone look absent.
  await services.createService({ title: "Sunday not recorded", category: "Sunday worship", starts_at: at(-0.5).toISOString() });
});
afterAll(() => vi.unstubAllGlobals());

describe("automatic absence follow-up", () => {
  it("flags members who missed 2 consecutive Sundays and messages them on WhatsApp, SMS, email and in the app", async () => {
    calls.length = 0;
    const r = await auto.runAbsenteeFollowUps(at(0));
    expect(r).toMatchObject({ enabled: true, detected: 2, firstSent: 2, remindersSent: 0 });
    expect((await absenteeTask(ada)).reason).toBe("Missed 2 consecutive Sundays — check in on Ada");
    expect(await absenteeTask(bola)).toBeUndefined(); // came every week
    expect(await absenteeTask(chi)).toBeUndefined(); // only ever came last Sunday
    expect(hosts()).toEqual({ wa: 2, sms: 2, email: 1 }); // Dayo has no email
    const b = (await db().list("broadcasts", { where: { audience: "auto_follow_up" } }))[0];
    expect(b).toMatchObject({ title: "We missed you", kind: "follow_up", recipient_count: 2, created_by: "Automatic follow-up" });
    expect((await db().list("broadcast_recipients", { where: { broadcast_id: b.id } })).map((x) => x.person_id).sort()).toEqual([ada, dayo].sort());
    const task = await absenteeTask(ada);
    expect(task).toMatchObject({ auto_messages_sent: 1 });
    const logs = await db().list("follow_up_logs", { where: { task_id: task.id } });
    expect(logs[0].note).toMatch(/First automatic message sent via app inbox, WhatsApp, SMS, email/);
  });

  it("does not repeat before the interval, then reminds every 3 days while they stay away", async () => {
    calls.length = 0;
    expect(await auto.runAbsenteeFollowUps(at(0.1))).toMatchObject({ firstSent: 0, remindersSent: 0 });
    expect(await auto.runAbsenteeFollowUps(at(2))).toMatchObject({ firstSent: 0, remindersSent: 0 });
    expect(hosts()).toEqual({ wa: 0, sms: 0, email: 0 });
    // Pretend the first message went out 3 days ago (slightly later in the day than this run).
    for (const id of [ada, dayo]) await db().update("follow_up_tasks", { id: (await absenteeTask(id)).id }, { last_auto_message_at: new Date(Date.now() - 3 * 86400000 + 3600000).toISOString() });
    const r = await auto.runAbsenteeFollowUps(at(0));
    expect(r).toMatchObject({ firstSent: 0, remindersSent: 2 });
    expect((await db().list("broadcasts", { where: { audience: "auto_follow_up:reminder" } }))[0].title).toBe("We're still thinking of you");
    expect((await absenteeTask(ada)).auto_messages_sent).toBe(2);
    expect(auto.nextAutoMessageAt(await absenteeTask(ada), await settingsRepo.getSettings())!.getTime()).toBeGreaterThan(Date.now() + 2.9 * 86400000);
  });

  it("stops when the member checks in again", async () => {
    const svc = await services.createService({ title: "Wednesday prayers", category: "Prayer meeting", starts_at: new Date().toISOString() });
    await services.recordAttendance({ person: (await db().get("people", { id: ada }))!, serviceId: svc.id, method: "manual", recordedBy: "usher" });
    const task = await absenteeTask(ada);
    expect(task.status).toBe("completed");
    const logs = await db().list("follow_up_logs", { where: { task_id: task.id } });
    expect(logs.some((l) => l.outcome === "returned" && /Wednesday prayers/.test(l.note ?? ""))).toBe(true);
    calls.length = 0;
    await db().update("follow_up_tasks", { id: (await absenteeTask(dayo)).id }, { last_auto_message_at: new Date(Date.now() - 4 * 86400000).toISOString() });
    const r = await auto.runAbsenteeFollowUps(at(0));
    expect(r.remindersSent).toBe(1); // only Dayo
    expect(calls.some((c) => JSON.stringify(c.body).includes("2348040000001"))).toBe(false);
  });

  it("stops when staff dismiss the task, and doesn't recreate it for the same absence", async () => {
    await care.updateTask((await absenteeTask(dayo)).id, { status: "dismissed" });
    await db().update("follow_up_tasks", { id: (await absenteeTask(dayo)).id }, { last_auto_message_at: new Date(Date.now() - 9 * 86400000).toISOString() });
    calls.length = 0;
    const r = await auto.runAbsenteeFollowUps(at(0));
    expect(r).toMatchObject({ detected: 0, firstSent: 0, remindersSent: 0 });
    expect(calls).toHaveLength(0);
    expect(await db().list("follow_up_tasks", { where: { person_id: dayo, category: "absentee" } })).toHaveLength(1);
  });

  it("respects the message limit, the chosen channels and the on/off switch", async () => {
    const eve = (await people.createPerson({ full_name: "Eve Limit", phone: "08040000005", email: "eve@example.com" })).id;
    await db().insert("attendance", { id: uid(), person_id: eve, service_id: (await db().list("services", { where: { title: "Sunday -21d" } }))[0].id, checked_in_at: at(-21).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: nowIso() });
    await settingsRepo.saveSettings({ follow_up_max_messages: 1, follow_up_channels: ["email"] });
    calls.length = 0;
    expect(await auto.runAbsenteeFollowUps(at(0))).toMatchObject({ detected: 1, firstSent: 1 });
    expect(hosts()).toEqual({ wa: 0, sms: 0, email: 1 }); // email only
    await db().update("follow_up_tasks", { id: (await absenteeTask(eve)).id }, { last_auto_message_at: new Date(Date.now() - 10 * 86400000).toISOString() });
    expect(await auto.runAbsenteeFollowUps(at(0))).toMatchObject({ remindersSent: 0 }); // limit of 1 reached
    await settingsRepo.saveSettings({ follow_up_max_messages: 0, auto_follow_up: false });
    calls.length = 0;
    const off = await auto.runAbsenteeFollowUps(at(0));
    expect(off).toMatchObject({ enabled: false, firstSent: 0, remindersSent: 0 });
    expect(calls).toHaveLength(0);
    expect(auto.describeRun(off)).toMatch(/automatic messages are off/);
  });
});
