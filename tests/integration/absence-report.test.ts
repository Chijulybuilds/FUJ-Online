import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-absence-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const sms: Record<string, unknown>[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/api/sms/send")) sms.push(JSON.parse(String(init?.body)));
  return new Response(JSON.stringify({ code: "ok", message_id: "1" }), { status: 200 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const services = await import("../../src/lib/repo/services");
const settings = await import("../../src/lib/repo/settings");
const absence = await import("../../src/lib/repo/absence");
const messaging = await import("../../src/lib/repo/messaging");

const DAY = 86400000;
const nextMonday = () => { const d = new Date(); d.setUTCHours(9, 0, 0, 0); while (new Date(d.getTime() + 3600000).getUTCDay() !== 1) d.setTime(d.getTime() + DAY); return d; };

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { TERMII_API_KEY: "k", TERMII_SENDER_ID: "OE Alert" });
  // Three past Sundays. Ada came only to the first; Bayo to all; Chi came to a Wednesday service since; Dayo never came.
  const ada = await people.createPerson({ full_name: "Ada Away", phone: "08030000101" });
  const bayo = await people.createPerson({ full_name: "Bayo Faithful", phone: "08030000102" });
  const chi = await people.createPerson({ full_name: "Chi Midweek", phone: "08030000103" });
  await people.createPerson({ full_name: "Dayo Never", phone: "08030000104" });
  const kid = await people.createPerson({ full_name: "Kid Away", phone: "08030000101", is_child: true });
  const sundays = [];
  for (const w of [3, 2, 1]) sundays.push(await services.createService({ title: `Sunday -${w}`, category: "Sunday worship", starts_at: new Date(Date.now() - w * 7 * DAY).toISOString() }));
  const at = async (personId: string, serviceId: string, daysAgo: number) => db().insert("attendance", { id: crypto.randomUUID(), person_id: personId, service_id: serviceId, checked_in_at: new Date(Date.now() - daysAgo * DAY).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: new Date().toISOString() });
  await at(ada.id, sundays[0].id, 21); await at(kid.id, sundays[0].id, 21); await at(chi.id, sundays[0].id, 21);
  for (const [i, d] of [[0, 21], [1, 14], [2, 7]] as const) await at(bayo.id, sundays[i].id, d);
  const wed = await services.createService({ title: "Midweek", category: "Bible study", starts_at: new Date(Date.now() - 4 * DAY).toISOString() });
  await at(chi.id, wed.id, 4);
});
afterAll(() => vi.unstubAllGlobals());

describe("missed-Sundays follow-up list", () => {
  it("lists members who came before but missed the last 2 Sundays (not children, not people who came midweek or never came)", async () => {
    const r = await absence.absentMembers(2);
    expect(r.absentees.map((a) => [a.person.full_name, a.missed])).toEqual([["Ada Away", 2]]);
    expect((await messaging.resolveAudience("absentees")).map((p) => p.full_name)).toEqual(["Ada Away"]);
  });

  it("the SMS lists names and numbers in plain characters, with a link when the list is long", () => {
    const mk = (i: number) => ({ person: { full_name: `Member Number ${i} Okafor’s`, phone: `0803000${String(i).padStart(4, "0")}` }, lastSeen: "", missed: 2 }) as never;
    const short = absence.reportText([mk(1)], 2, "https://www.flagupjesus.org");
    expect(short).toBe("FUJ follow-up: 1 member missed the last 2 Sundays:\nMember Number 1 Okafors 08030000001");
    const long = absence.reportText(Array.from({ length: 40 }, (_, i) => mk(i)), 2, "https://www.flagupjesus.org");
    expect(long.length).toBeLessThanOrEqual(600);
    expect(long).toMatch(/\n\+\d+ more: https:\/\/www\.flagupjesus\.org\/admin\/absent$/);
  });

  it("sends the report to the pastor and admins on Mondays only, once a week, when turned on", async () => {
    await settings.saveSettings({ absence_report: false, absence_report_numbers: "0805 111 2222\n08031112223, 0805 111 2222" });
    expect(absence.reportNumbers(await settings.getSettings())).toEqual(["+2348051112222", "+2348031112223"]);
    expect((await absence.sendAbsenceReport({ now: nextMonday() })).skipped).toBe("the report is turned off");
    await settings.saveSettings({ absence_report: true });
    expect((await absence.sendAbsenceReport({ now: new Date(nextMonday().getTime() + DAY) })).skipped).toBe("it goes out on Mondays");
    const r = await absence.sendAbsenceReport({ now: nextMonday() });
    expect(r).toEqual({ sent: 2, failed: 0, absentees: 1 });
    expect(sms.map((m) => m.to)).toEqual(["2348051112222", "2348031112223"]);
    expect(sms[0]).toMatchObject({ from: "OE Alert", type: "plain" });
    expect(String(sms[0].sms)).toContain("Ada Away 08030000101");
    expect((await absence.sendAbsenceReport({ now: nextMonday() })).skipped).toBe("already sent this week");
    expect((await absence.sendAbsenceReport({ force: true })).sent).toBe(2); // "Send the report now"
  });
});
