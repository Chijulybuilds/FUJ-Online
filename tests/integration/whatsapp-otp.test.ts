import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-wa-")), "db.json");
process.env.SEED_DEMO_DATA = "false";
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];
let waBehaviour: "ok" | "reject" = "ok";
let nextId = 0;

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  calls.push({ url, body });
  if (url.includes("graph.facebook.com")) {
    if (waBehaviour === "reject") return new Response(JSON.stringify({ error: { code: 131026, message: "undeliverable" } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${++nextId}` }] }), { status: 200 });
  }
  if (url.includes("termii")) return new Response(JSON.stringify({ message_id: "t1" }), { status: 200 });
  return new Response("{}", { status: 404 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const messaging = await import("../../src/lib/repo/messaging");
const otp = await import("../../src/lib/repo/otp");

const wa = () => calls.filter((c) => c.url.includes("graph.facebook.com"));
const sms = () => calls.filter((c) => c.url.includes("termii"));

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_TEMPLATE_NAME: "church_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ" });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { calls.length = 0; waBehaviour = "ok"; });

describe("broadcast delivery: WhatsApp first, SMS fallback", () => {
  it("sends an approved template on WhatsApp to unknown/yes numbers and SMS to known non-WhatsApp numbers", async () => {
    const a = await people.createPerson({ full_name: "Ada WhatsApp", phone: "08030000001", status: "member" });
    const b = await people.createPerson({ full_name: "Bayo NoWhatsApp", phone: "08030000002", status: "member" });
    await db().update("people", { id: b.id }, { whatsapp: "no" });
    const bc = await messaging.sendBroadcast({ title: "Sunday", body: "Hi {first_name},\nsee you!", kind: "general", audience: "members", channels: ["whatsapp"], request_response: false, created_by: "test" });
    expect(wa()).toHaveLength(1);
    const tpl = wa()[0].body as { to: string; type: string; template: { name: string; components: { parameters: { text: string }[] }[] } };
    expect(tpl.to).toBe("2348030000001");
    expect(tpl.type).toBe("template");
    expect(tpl.template.name).toBe("church_broadcast");
    expect(tpl.template.components[0].parameters[1].text).toBe("Hi Ada, · see you!"); // personalised, newline-safe
    expect(sms()).toHaveLength(1);
    expect((sms()[0].body as { to: string }).to).toBe("2348030000002");
    const rows = await db().list("broadcast_recipients", { where: { broadcast_id: bc.id } });
    const ra = rows.find((r) => r.person_id === a.id)!;
    const rb = rows.find((r) => r.person_id === b.id)!;
    expect(ra).toMatchObject({ channel_used: "whatsapp", whatsapp_status: "sent", sms_status: null });
    expect(rb).toMatchObject({ channel_used: "sms", whatsapp_status: "not_on_whatsapp", sms_status: "sent" });
  });

  it("falls back to SMS when the WhatsApp webhook reports 'not on WhatsApp', and remembers it", async () => {
    const c = await people.createPerson({ full_name: "Chidi Unknown", phone: "08030000003", status: "visitor" });
    const bc = await messaging.sendBroadcast({ title: "Welcome", body: "Glad you came", kind: "general", audience: `person:${c.id}`, channels: ["whatsapp"], request_response: false, created_by: "test" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: bc.id } }))[0];
    calls.length = 0;
    const out = await messaging.handleWhatsAppStatus({ id: row.whatsapp_message_id!, status: "failed", errors: [{ code: 131026 }] });
    expect(out).toEqual({ matched: true, fellBack: true });
    expect(sms()).toHaveLength(1);
    const after = (await db().get("broadcast_recipients", { id: row.id }))!;
    expect(after).toMatchObject({ whatsapp_status: "not_on_whatsapp", sms_status: "sent", channel_used: "sms" });
    expect((await db().get("people", { id: c.id }))!.whatsapp).toBe("no");
    // next broadcast skips WhatsApp entirely
    calls.length = 0;
    await messaging.sendBroadcast({ title: "Again", body: "x", kind: "general", audience: `person:${c.id}`, channels: ["whatsapp"], request_response: false, created_by: "test" });
    expect(wa()).toHaveLength(0);
    expect(sms()).toHaveLength(1);
  });

  it("falls back immediately when WhatsApp rejects synchronously", async () => {
    const d = await people.createPerson({ full_name: "Dayo Reject", phone: "08030000004", status: "visitor" });
    waBehaviour = "reject";
    const bc = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${d.id}`, channels: ["whatsapp"], request_response: false, created_by: "test" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: bc.id } }))[0];
    expect(row).toMatchObject({ whatsapp_status: "failed", sms_status: "sent", channel_used: "sms" });
    expect((await db().get("people", { id: d.id }))!.whatsapp).toBe("no");
  });

  it("delivered/read receipts mark the person as on WhatsApp and count as read; out-of-order receipts don't downgrade", async () => {
    const e = await people.createPerson({ full_name: "Efe Reader", phone: "08030000005", status: "member" });
    const bc = await messaging.sendBroadcast({ title: "Read me", body: "x", kind: "general", audience: `person:${e.id}`, channels: ["whatsapp"], request_response: false, created_by: "test" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: bc.id } }))[0];
    await messaging.handleWhatsAppStatus({ id: row.whatsapp_message_id!, status: "read" });
    await messaging.handleWhatsAppStatus({ id: row.whatsapp_message_id!, status: "delivered" });
    const after = (await db().get("broadcast_recipients", { id: row.id }))!;
    expect(after.whatsapp_status).toBe("read");
    expect(after.read_at).not.toBeNull();
    expect((await db().get("people", { id: e.id }))!.whatsapp).toBe("yes");
  });

  it("an inbound WhatsApp reply is recorded as a response to the latest broadcast", async () => {
    const out = await messaging.handleWhatsAppInbound("2348030000005", "Amen, I'll be there");
    expect(out.matched).toBe(true);
    const person = (await db().get("people", { normalized_phone: "+2348030000005" }))!;
    const latest = (await db().list("broadcast_recipients", { where: { person_id: person.id }, order: { column: "created_at", ascending: false } }))[0];
    expect(latest.response).toContain("[WhatsApp] Amen");
  });
});

describe("flyers on automatic WhatsApp / SMS", () => {
  it("sends the flyer as the image header of the flyer template, and as a link by SMS", async () => {
    process.env.WHATSAPP_FLYER_TEMPLATE_NAME = "church_flyer";
    await people.createPerson({ full_name: "Funke Flyer", phone: "08030000006", status: "member" });
    const g = await people.createPerson({ full_name: "Gbenga Sms", phone: "08030000007", status: "member" });
    await db().update("people", { id: g.id }, { whatsapp: "no" });
    calls.length = 0;
    await messaging.sendBroadcast({ title: "Youth Night", body: "Come!", kind: "announcement", audience: "members", channels: ["whatsapp"], request_response: false, created_by: "t", image_url: "/api/media/123e4567-e89b-12d3-a456-426614174000.jpg" });
    const toF = wa().find((c) => (c.body as { to: string }).to === "2348030000006")!.body as { template: { name: string; components: { type: string; parameters: { image?: { link: string } }[] }[] } };
    expect(toF.template.name).toBe("church_flyer");
    expect(toF.template.components[0]).toMatchObject({ type: "header" });
    expect(toF.template.components[0].parameters[0].image!.link).toMatch(/^http:\/\/localhost:3000\/api\/media\/.+\.jpg$/);
    const toG = sms().find((c) => (c.body as { to: string }).to === "2348030000007")!.body as { sms: string };
    expect(toG.sms).toContain("Flyer: http://localhost:3000/api/media/");
    delete process.env.WHATSAPP_FLYER_TEMPLATE_NAME;
  });
});

describe("free verification (no OTP)", () => {
  it("a self-registered person is unverified until their first in-person check-in", async () => {
    const services = await import("../../src/lib/repo/services");
    const p = await people.createPerson({ full_name: "Halima Selfreg", phone: "08030000008" });
    expect(p.verified_via).toBeNull();
    const svc = await services.createService({ title: "Sunday", category: "Sunday worship", starts_at: new Date().toISOString() });
    await services.recordAttendance({ person: p, serviceId: svc.id, method: "manual", recordedBy: "usher" });
    const after = (await db().get("people", { id: p.id }))!;
    expect(after.verified_via).toBe("in_person");
    expect(after.verified_at).not.toBeNull();
    // never downgraded
    await people.markVerified(p.id, "admin");
    expect((await db().get("people", { id: p.id }))!.verified_via).toBe("in_person");
  });
});

describe("registration OTP (optional, REGISTRATION_OTP=true)", () => {
  it("sends a 6-digit code by SMS and verifies it exactly once", async () => {
    await otp.requestOtp("0809 111 2222");
    const text = (sms().at(-1)!.body as { sms: string }).sms;
    const code = text.match(/\d{6}/)![0];
    expect(await otp.verifyOtp("08091112222", "000000" === code ? "111111" : "000000")).toBe(false);
    expect(await otp.verifyOtp("+2348091112222", code)).toBe(true);
    expect(await otp.verifyOtp("+2348091112222", code)).toBe(false); // consumed
  });

  it("locks the code after 5 wrong attempts", async () => {
    await otp.requestOtp("08092223333");
    const code = (sms().at(-1)!.body as { sms: string }).sms.match(/\d{6}/)![0];
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect(await otp.verifyOtp("08092223333", wrong)).toBe(false);
    expect(await otp.verifyOtp("08092223333", code)).toBe(false);
  });

  it("refuses to send a code to an already-registered number", async () => {
    await expect(otp.requestOtp("08030000001")).rejects.toThrow(/already registered/);
  });
});
