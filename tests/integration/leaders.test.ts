import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-leaders-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
  if (url.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
  if (url.includes("termii")) return new Response("{}", { status: 200 });
  if (url.includes("resend")) return new Response(JSON.stringify({ id: "e1" }), { status: 200 });
  return new Response("{}", { status: 404 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const leaders = await import("../../src/lib/repo/leaders");
const messaging = await import("../../src/lib/repo/messaging");

const to = (host: string) => calls.filter((c) => c.url.includes(host));

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ", RESEND_API_KEY: "re_x", EMAIL_FROM: "FlagUpJesus <news@flagupjesus.org>" });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { calls.length = 0; });

describe("leaders list (added by admins)", () => {
  it("adds a new leader as a member record with a flag username", async () => {
    const { leader, person, linked } = await leaders.addLeader({ full_name: "Ngozi  Choir", unit: " choir ", phone: "0803 100 0001", email: "Ngozi@Example.com" }, "Admin Ada");
    expect(linked).toBe(false);
    expect(leader.unit).toBe("Choir");
    expect(person).toMatchObject({ full_name: "Ngozi Choir", status: "member", normalized_phone: "+2348031000001", email: "ngozi@example.com" });
    expect(person.username).toMatch(/^flagngozi\d{3}$/);
  });

  it("links someone who already registered with that number instead of duplicating them", async () => {
    const existing = await people.createPerson({ full_name: "Tunde Media", phone: "08031000002" });
    const { person, linked } = await leaders.addLeader({ full_name: "Tunde M.", unit: "Media", phone: "+234 803 100 0002", email: "tunde@example.com" }, "Admin");
    expect(linked).toBe(true);
    expect(person.id).toBe(existing.id);
    expect(person.full_name).toBe("Tunde Media"); // keeps their registered name
    expect(person.email).toBe("tunde@example.com"); // fills a missing email
    expect((await db().list("people")).filter((p) => p.normalized_phone === "+2348031000002")).toHaveLength(1);
  });

  it("refuses duplicates and bad input with friendly messages", async () => {
    await expect(leaders.addLeader({ full_name: "Ngozi Again", unit: "Ushering", phone: "08031000001" }, "a")).rejects.toThrow(/already on the leaders list \(Choir\)/);
    await expect(leaders.addLeader({ full_name: "X", unit: "Choir", phone: "08031000009" }, "a")).rejects.toThrow(/full name/);
    await expect(leaders.addLeader({ full_name: "No Unit", unit: "  ", phone: "08031000009" }, "a")).rejects.toThrow(/unit/);
    await expect(leaders.addLeader({ full_name: "Bad Phone", unit: "Choir", phone: "12" }, "a")).rejects.toThrow(/WhatsApp number/);
  });

  it("groups units case-insensitively and resolves leader audiences", async () => {
    await leaders.addLeader({ full_name: "Chioma Choir", unit: "CHOIR", phone: "08031000003" }, "a");
    await people.createPerson({ full_name: "Regular Member", phone: "08031000004" });
    expect(await leaders.leaderUnits()).toEqual([{ unit: "Choir", count: 2 }, { unit: "Media", count: 1 }]);
    expect((await messaging.resolveAudience("leaders")).map((p) => p.full_name).sort()).toEqual(["Chioma Choir", "Ngozi Choir", "Tunde Media"]);
    expect((await messaging.resolveAudience("leaders:choir")).map((p) => p.full_name).sort()).toEqual(["Chioma Choir", "Ngozi Choir"]);
    expect(await messaging.audienceLabel("leaders:Choir")).toBe("Leaders — Choir");
    expect((await messaging.resolveAudience("all")).length).toBe(4); // everyone, leaders included
  });

  it("broadcasts to leaders on WhatsApp + SMS + email (HTML with reply-to) and the app inbox", async () => {
    const bc = await messaging.sendBroadcast({ title: "Leaders meeting", body: "Hi {first_name}, we meet Saturday 4pm.", kind: "general", audience: "leaders:Media", channels: ["whatsapp", "sms", "email"], request_response: true, created_by: "Admin" });
    expect(bc.recipient_count).toBe(1);
    expect(to("graph.facebook.com")).toHaveLength(1);
    expect(to("termii")).toHaveLength(1); // SMS ticked too → texted as well as WhatsApp
    const email = to("resend")[0].body as { to: string; subject: string; html: string; reply_to: string };
    expect(email).toMatchObject({ to: "tunde@example.com", subject: "Leaders meeting", reply_to: "flagupjesusglobal@gmail.com" });
    expect(email.html).toContain("Hi Tunde, we meet Saturday 4pm.");
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: bc.id } }))[0];
    expect(row).toMatchObject({ whatsapp_status: "sent", sms_status: "sent", email_status: "sent", channel_used: "whatsapp" });
  });

  it("edits and removes leaders; removing keeps the member record", async () => {
    const row = (await leaders.listLeaders()).find((l) => l.person.full_name === "Chioma Choir")!;
    await leaders.updateLeader(row.id, { full_name: "Chioma Okafor", unit: "Ushering", phone: "08031000013", email: null });
    const updated = (await leaders.listLeaders()).find((l) => l.id === row.id)!;
    expect(updated).toMatchObject({ unit: "Ushering", person: { full_name: "Chioma Okafor", normalized_phone: "+2348031000013" } });
    await expect(leaders.updateLeader(row.id, { full_name: "Chioma Okafor", unit: "Ushering", phone: "08031000004" })).rejects.toThrow(/Another person already uses this phone number/);
    await leaders.removeLeader(row.id);
    expect((await leaders.listLeaders()).some((l) => l.id === row.id)).toBe(false);
    expect(await db().get("people", { id: row.person_id })).not.toBeNull();
  });
});

describe("Settings → Messaging channels test", () => {
  it("explains WhatsApp errors in plain English", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { code: 131030, message: "Recipient phone number not in allowed list" } }), { status: 400 }));
    const r = await messaging.sendTestMessage("whatsapp", "08031000099");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Error 131030: You're on Meta's test number.*allowed list/);
    expect((await messaging.sendTestMessage("sms", "08031000099")).ok).toBe(true);
    expect((await messaging.sendTestMessage("email", "not-an-email")).ok).toBe(false);
  });
});
