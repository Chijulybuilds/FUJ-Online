import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-termii-wa-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];
let templateReply: { status: number; json: Record<string, unknown> } = { status: 200, json: {} };
let nextId = 100;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
  if (url.includes("/api/send/template")) {
    if (templateReply.status !== 200) return new Response(JSON.stringify(templateReply.json), { status: templateReply.status });
    const id = String(++nextId);
    return new Response(JSON.stringify({ code: "ok", balance: 5000, message_id: id, message: "Successfully Sent", message_id_str: id }), { status: 200 });
  }
  if (url.includes("/api/sms/send")) return new Response(JSON.stringify({ code: "ok", message_id: "sms1" }), { status: 200 });
  if (url.includes("/api/get-balance")) return new Response(JSON.stringify({ application: "FUJ", balance: 785.57, currency: "NGN", user: "FlagUpJesus" }), { status: 200 });
  if (url.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: "wamid.meta" }] }), { status: 200 });
  return new Response("{}", { status: 404 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const messaging = await import("../../src/lib/repo/messaging");
const providers = await import("../../src/lib/messaging/providers");
const { POST } = await import("../../src/app/api/webhooks/termii/route");

const termiiTemplate = () => calls.filter((c) => c.url.includes("/api/send/template"));
const sms = () => calls.filter((c) => c.url.includes("/api/sms/send"));
const SECRET = "termii-secret-key-for-tests";
const sign = (raw: string) => createHmac("sha512", SECRET).update(raw).digest("hex");
const webhook = (event: Record<string, unknown>, signature?: string) => {
  const raw = JSON.stringify(event);
  return POST(new NextRequest("https://www.flagupjesus.org/api/webhooks/termii", { method: "POST", body: raw, headers: { "content-type": "application/json", "x-termii-signature": signature ?? sign(raw) } }));
};

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, {
    TERMII_API_KEY: "tk", TERMII_SENDER_ID: "FlagUpJesus", TERMII_BASE_URL: "https://v3.api.termii.com/",
    TERMII_WHATSAPP_DEVICE_ID: "dev-123", TERMII_WHATSAPP_TEMPLATE_ID: "tpl-broadcast", TERMII_SECRET_KEY: SECRET,
    // Meta is set up too: Termii wins.
    WHATSAPP_TOKEN: "meta-token", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast"
  });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { calls.length = 0; templateReply = { status: 200, json: {} }; delete process.env.TERMII_WHATSAPP_FLYER_TEMPLATE_ID; delete process.env.TERMII_WHATSAPP_VARIABLES; });

describe("WhatsApp through Termii", () => {
  it("sends broadcasts as the approved Termii template (title → {{1}}, message → {{2}}), not through Meta", async () => {
    expect(providers.providers.whatsappVia).toBe("termii");
    const p = await people.createPerson({ full_name: "Ada Termii", phone: "08031110010", status: "member" });
    const b = await messaging.sendBroadcast({ title: "Sunday Service", body: "Hi {first_name},\nsee you at 4:30!", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    expect(calls.some((c) => c.url.includes("graph.facebook.com"))).toBe(false);
    expect(termiiTemplate()).toHaveLength(1);
    expect(termiiTemplate()[0].url).toBe("https://v3.api.termii.com/api/send/template");
    expect(termiiTemplate()[0].body).toEqual({
      api_key: "tk", device_id: "dev-123", phone_number: "2348031110010", template_id: "tpl-broadcast",
      data: { 1: "Sunday Service", 2: "Hi Ada, · see you at 4:30!" }
    });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    expect(row).toMatchObject({ whatsapp_status: "sent", channel_used: "whatsapp", whatsapp_message_id: "101", sms_status: null });
  });

  it("sends a flyer as the picture with the flyer template, or as a link without one", async () => {
    const p = await people.createPerson({ full_name: "Bola Flyer", phone: "08031110011", status: "member" });
    const flyer = "/api/media/123e4567-e89b-12d3-a456-426614174000.jpg";
    await messaging.sendBroadcast({ title: "Jesus Festival", body: "Come!", kind: "announcement", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t", image_url: flyer });
    expect(termiiTemplate()[0].url).toMatch(/\/api\/send\/template$/);
    expect(JSON.stringify(termiiTemplate()[0].body)).toContain("Flyer: http://localhost:3000/api/media/");
    calls.length = 0;
    process.env.TERMII_WHATSAPP_FLYER_TEMPLATE_ID = "tpl-flyer";
    await messaging.sendBroadcast({ title: "Jesus Festival", body: "Come!", kind: "announcement", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t", image_url: flyer });
    const call = termiiTemplate()[0];
    expect(call.url).toMatch(/\/api\/send\/template\/media$/);
    expect(call.body).toMatchObject({ template_id: "tpl-flyer", data: { 1: "Jesus Festival", 2: "Come!" }, media: { caption: "Jesus Festival" } });
    expect((call.body.media as { url: string }).url).toMatch(/^http:\/\/localhost:3000\/api\/media\/.+\.jpg$/);
  });

  it("uses the variable names Termii shows when they aren't 1 and 2", async () => {
    process.env.TERMII_WHATSAPP_VARIABLES = "title, message";
    const r = await providers.sendWhatsApp("+2348031110012", "Hello", "World");
    expect(r.status).toBe("sent");
    expect(termiiTemplate()[0].body.data).toEqual({ title: "Hello", message: "World" });
  });

  it("explains a Termii failure in plain English and falls back to SMS", async () => {
    templateReply = { status: 400, json: { message: "Device not found" } };
    const p = await people.createPerson({ full_name: "Chidi Fail", phone: "08031110013", status: "member" });
    const b = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    expect(row).toMatchObject({ whatsapp_status: "failed", sms_status: "sent", channel_used: "sms" });
    expect(row.whatsapp_error).toContain("Termii doesn't recognise the WhatsApp device");
    expect(row.whatsapp_error).toContain("Device not found");
    expect((sms()[0].body as { from: string; channel: string }).from).toBe("FlagUpJesus");
  });

  it("the Settings test message goes through Termii too", async () => {
    const r = await messaging.sendTestMessage("whatsapp", "08031110014");
    expect(r.ok).toBe(true);
    expect(termiiTemplate()[0].body).toMatchObject({ phone_number: "2348031110014", template_id: "tpl-broadcast" });
  });
});

describe("Termii webhook: delivery reports and replies", () => {
  it("refuses events without a valid signature", async () => {
    expect((await webhook({ message_id: "x", status: "Delivered", channel: "whatsapp" }, "bad")).status).toBe(401);
  });

  it("marks WhatsApp messages delivered, and on failure records why and sends the SMS", async () => {
    const p = await people.createPerson({ full_name: "Efe Receipt", phone: "08031110015", status: "member" });
    const b = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    const ok = await webhook({ type: "outbound", id: "req-1", message_id: row.whatsapp_message_id, receiver: "2348031110015", sender: "dev-123", status: "Delivered", channel: "whatsapp" });
    expect(await ok.json()).toMatchObject({ ok: true, statuses: 1 });
    expect((await db().get("broadcast_recipients", { id: row.id }))!.whatsapp_status).toBe("delivered");
    expect((await db().get("people", { id: p.id }))!.whatsapp).toBe("yes");

    const q = await people.createPerson({ full_name: "Funmi Failed", phone: "08031110016", status: "member" });
    const b2 = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${q.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    const row2 = (await db().list("broadcast_recipients", { where: { broadcast_id: b2.id } }))[0];
    calls.length = 0;
    await webhook({ type: "outbound", message_id: row2.whatsapp_message_id, receiver: "2348031110016", status: "Message Failed", channel: "whatsapp" });
    const after = (await db().get("broadcast_recipients", { id: row2.id }))!;
    expect(after).toMatchObject({ whatsapp_status: "failed", sms_status: "sent", channel_used: "sms", whatsapp_error: "Message Failed" });
    expect(sms()).toHaveLength(1);
  });

  it("ignores SMS reports and device notices, and puts members' WhatsApp replies in the Inbox", async () => {
    expect(await (await webhook({ message_id: "sms1", status: "Delivered", channel: "dnd" })).json()).toMatchObject({ statuses: 0 });
    expect((await webhook({ type: "device_status", status: "disconnected", device_id: "dev-123", name: "FUJ" })).status).toBe(200);
    const reply = await webhook({ type: "inbound", sender: "2348031110015", receiver: "dev-123", message: "Amen, I'll be there!", status: "Received", channel: "whatsapp" });
    expect(await reply.json()).toMatchObject({ inbound: 1 });
    const efe = (await db().get("people", { normalized_phone: "+2348031110015" }))!;
    const latest = (await db().list("broadcast_recipients", { where: { person_id: efe.id }, order: { column: "created_at", ascending: false } }))[0];
    expect(latest.response).toContain("[WhatsApp] Amen, I'll be there!");
  });
});

describe("Check WhatsApp setup (Termii)", () => {
  it("checks the API key and wallet, lists the device and templates, and flags a missing webhook secret", async () => {
    let r = await providers.checkWhatsAppSetup();
    const text = r.lines.map((l) => `${l.ok}|${l.text}`).join("\n");
    expect(calls.some((c) => c.url === "https://v3.api.termii.com/api/get-balance?api_key=tk")).toBe(true);
    expect(text).toContain("true|Termii API key works (account “FlagUpJesus”) · wallet balance NGN 785.57.");
    expect(text).toContain("WhatsApp device: dev-123. Broadcast template ID: tpl-broadcast");
    expect(r.ok).toBe(true);
    delete process.env.TERMII_SECRET_KEY;
    r = await providers.checkWhatsAppSetup();
    expect(r.lines.some((l) => l.ok === null && l.text.includes("TERMII_SECRET_KEY isn't set"))).toBe(true);
    process.env.TERMII_SECRET_KEY = SECRET;
  });

  it("config check names whatever is missing for WhatsApp through Termii", async () => {
    const { configProblems } = await import("../../src/lib/env-check");
    const saved = process.env.TERMII_WHATSAPP_TEMPLATE_ID;
    delete process.env.TERMII_WHATSAPP_TEMPLATE_ID;
    expect(configProblems().some((p) => p.startsWith("TERMII_WHATSAPP_TEMPLATE_ID is missing"))).toBe(true);
    expect(providers.providers.whatsappVia).toBe("meta"); // half-set Termii → falls back to Meta
    process.env.TERMII_WHATSAPP_TEMPLATE_ID = saved;
  });
});
