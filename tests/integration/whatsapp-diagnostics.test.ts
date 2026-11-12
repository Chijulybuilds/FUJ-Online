import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-wadiag-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type Sent = { url: string; method: string; body: Record<string, unknown> | null; auth: string | null };
const calls: Sent[] = [];
/** What the fake Meta API answers. */
const meta = {
  approvedLanguage: "en_US",
  sendError: null as null | { code: number; message: string; details?: string },
  phone: {} as Record<string, unknown>,
  token: { data: { is_valid: true, type: "SYSTEM_USER", application: "FUJ Online", expires_at: 0, scopes: ["whatsapp_business_messaging", "whatsapp_business_management"] } } as Record<string, unknown>,
  templates: [] as Record<string, unknown>[]
};
let nextId = 0;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method: init?.method ?? "GET", body, auth: new Headers(init?.headers).get("authorization") });
  if (!url.includes("graph.facebook.com")) return json({}, 404);
  if (url.includes("/messages")) {
    if (meta.sendError) return json({ error: { code: meta.sendError.code, message: meta.sendError.message, error_data: meta.sendError.details ? { details: meta.sendError.details } : undefined } }, 400);
    const lang = (body as { template?: { language?: { code?: string } } }).template?.language?.code;
    if (lang && lang !== meta.approvedLanguage) return json({ error: { code: 132001, message: "(#132001) Template name does not exist in the translation", error_data: { details: `template name (fuj_broadcast) does not exist in ${lang}` } } }, 404);
    return json({ messages: [{ id: `wamid.${++nextId}` }] });
  }
  if (url.includes("/message_templates")) return json({ data: meta.templates });
  if (url.includes("/debug_token")) return json(meta.token);
  return json(meta.phone);
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const messaging = await import("../../src/lib/repo/messaging");
const providers = await import("../../src/lib/messaging/providers");

const sends = () => calls.filter((c) => c.url.includes("/messages"));

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  // Pasted with stray quotes and a "Bearer " prefix, as happens in hosting dashboards.
  Object.assign(process.env, { WHATSAPP_TOKEN: ' "Bearer abc123" ', WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast" });
  delete process.env.WHATSAPP_TEMPLATE_LANG;
  delete process.env.TERMII_API_KEY;
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { calls.length = 0; meta.sendError = null; meta.approvedLanguage = "en_US"; });

describe("WhatsApp broadcasts explain their failures", () => {
  it("finds an English template approved as en_US even though the app is set to en, and remembers it", async () => {
    const p = await people.createPerson({ full_name: "Prince Tester", phone: "07082170248", status: "member" });
    const b = await messaging.sendBroadcast({ title: "I am Testing", body: "This is me testing", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    expect(sends().map((c) => (c.body as { template: { language: { code: string } } }).template.language.code)).toEqual(["en", "en_US"]);
    expect(sends()[0].auth).toBe("Bearer abc123"); // quotes and the extra "Bearer " are cleaned up
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    expect(row).toMatchObject({ whatsapp_status: "sent", channel_used: "whatsapp" });
    expect(row.whatsapp_error ?? null).toBeNull();
    calls.length = 0;
    await messaging.sendBroadcast({ title: "Again", body: "x", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    expect(sends().map((c) => (c.body as { template: { language: { code: string } } }).template.language.code)).toEqual(["en_US"]);
  });

  it("saves Meta's reason with the fix next to a failed message", async () => {
    const p = await people.createPerson({ full_name: "Ada Notallowed", phone: "08031110001", status: "member" });
    meta.sendError = { code: 131030, message: "(#131030) Recipient phone number not in allowed list", details: "Recipient phone number not in allowed list: Add recipient phone number to recipient list and try again." };
    const b = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    expect(sends()).toHaveLength(1); // not a language problem: no retries
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    expect(row.whatsapp_status).toBe("failed");
    expect(row.sms_status).toBe("skipped");
    expect(row.whatsapp_error).toMatch(/^Error 131030: You're on Meta's test number/);
    expect(row.whatsapp_error).toContain("Recipient phone number not in allowed list");
    // A number that isn't on WhatsApp is still remembered as such.
    expect((await db().get("people", { id: p.id }))!.whatsapp).not.toBe("no");
  });

  it("explains when the template isn't found in any English variant", async () => {
    meta.approvedLanguage = "fr";
    const r = await messaging.sendTestMessage("whatsapp", "08031110002");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Error 132001");
    expect(r.message).toMatch(/tried language codes (?=.*\ben\b)(?=.*en_US)(?=.*en_GB)/);
  });

  it("records the reason from a failed delivery receipt", async () => {
    const p = await people.createPerson({ full_name: "Bola Receipt", phone: "08031110003", status: "member" });
    const b = await messaging.sendBroadcast({ title: "Hi", body: "x", kind: "general", audience: `person:${p.id}`, channels: ["whatsapp"], request_response: false, created_by: "t" });
    const row = (await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }))[0];
    await messaging.handleWhatsAppStatus({ id: row.whatsapp_message_id!, status: "failed", errors: [{ code: 131042, title: "Business eligibility payment issue", message: "Business eligibility payment issue" }] });
    const after = (await db().get("broadcast_recipients", { id: row.id }))!;
    expect(after.whatsapp_status).toBe("failed");
    expect(after.whatsapp_error).toMatch(/^Error 131042: Payment problem/);
  });

  it("an unknown error code still shows Meta's own words", () => {
    expect(providers.whatsappReason(999999, "Something new")).toBe("Error 999999: Something new");
    expect(providers.whatsappReason(undefined, undefined)).toBe("WhatsApp didn't say why.");
  });
});

describe("Check WhatsApp setup", () => {
  it("spots a test number, a blocked account, a language mismatch and named variables — without sending anything", async () => {
    process.env.WHATSAPP_TEMPLATE_LANG = "en";
    meta.phone = {
      id: "1234567890123", display_phone_number: "+1 555-010-9999", verified_name: "Test Number", account_mode: "SANDBOX", platform_type: "CLOUD_API", status: "CONNECTED",
      health_status: { can_send_message: "BLOCKED", entities: [
        { entity_type: "PHONE_NUMBER", id: "1234567890123", can_send_message: "AVAILABLE" },
        { entity_type: "WABA", id: "555000111", can_send_message: "BLOCKED", errors: [{ error_code: 141006, error_description: "There is an error with the payment method.", possible_solution: "Add a valid payment method in Business Manager." }] }
      ] }
    };
    meta.templates = [
      { name: "fuj_broadcast", status: "APPROVED", language: "fr", category: "UTILITY", parameter_format: "NAMED", components: [{ type: "BODY", text: "Hello {{title}} {{message}}" }] },
      { name: "fuj_broadcast_old", status: "APPROVED", language: "en", components: [] }
    ];
    const r = await providers.checkWhatsAppSetup();
    expect(sends()).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("555000111/message_templates") && c.url.includes("name=fuj_broadcast"))).toBe(true);
    const text = r.lines.map((l) => `${l.ok}|${l.text}`).join("\n");
    expect(r.ok).toBe(false);
    expect(text).toContain("true|Token and Phone number ID work: sending from +1 555-010-9999");
    expect(text).toContain("false|This is Meta's free TEST number");
    expect(text).toContain("false|WhatsApp Business account is blocked (error 141006): There is an error with the payment method. — Fix: Add a valid payment method");
    expect(text).toContain("set WHATSAPP_TEMPLATE_LANG=fr");
    expect(text).toContain("uses named variables ({{title}}, {{message}})");
    delete process.env.WHATSAPP_TEMPLATE_LANG;
  });

  it("says so plainly when the token is rejected", async () => {
    meta.token = { data: { is_valid: false, error: { message: "Session has expired" } } };
    meta.phone = { error: { code: 190, message: "Error validating access token: Session has expired" } };
    const r = await providers.checkWhatsAppSetup();
    expect(r.ok).toBe(false);
    expect(r.lines[0].text).toMatch(/Meta refused the token \/ Phone number ID — Error 190: The access token is invalid or expired/);
    expect(r.lines[1].text).toBe("WHATSAPP_TOKEN isn't valid any more (Meta: “Session has expired”) — create a new System User token and update it in Vercel.");
  });

  it("“API access blocked” points at the Meta app / account, not the number or template", async () => {
    meta.phone = { error: { code: 200, message: "API access blocked.", type: "OAuthException" } };
    meta.token = { error: { code: 200, message: "API access blocked." } };
    const r = await providers.checkWhatsAppSetup();
    expect(r.ok).toBe(false);
    expect(r.lines[0].text).toContain("Error 200: Meta is blocking API access for the Meta app");
    expect(r.lines[0].text).toContain("developers.facebook.com/apps");
    expect(r.lines[0].text).toContain("(Meta: “API access blocked.”)");
    expect(r.lines[1]).toEqual({ ok: false, text: "Meta won't even describe the token, so the block is on the Meta app or account itself — see the fix above." });
    expect(calls.some((c) => c.url.includes("/debug_token?input_token=abc123"))).toBe(true);
    // The same explanation appears on a failed broadcast.
    expect(providers.whatsappReason(200, "API access blocked.")).toMatch(/^Error 200: Meta is blocking API access/);
  });

  it("explains a token that works but is set up wrongly: temporary, missing a permission, other WhatsApp account", async () => {
    meta.phone = { error: { code: 100, message: "Unsupported get request. Object with ID '1234567890123' does not exist, cannot be loaded due to missing permissions" } };
    meta.token = { data: { is_valid: true, type: "USER", application: "FUJ Online", expires_at: Math.floor(Date.UTC(2026, 10, 10, 12) / 1000), scopes: ["whatsapp_business_messaging"],
      granular_scopes: [{ scope: "whatsapp_business_messaging", target_ids: ["999888777"] }] } };
    const text = (await providers.checkWhatsAppSetup()).lines.map((l) => `${l.ok}|${l.text}`).join("\n");
    expect(text).toContain("null|WHATSAPP_TOKEN is a personal (user) token for the Meta app “FUJ Online”, expiring 10 Nov 2026 12:00 UTC");
    expect(text).toContain("false|The token is missing the whatsapp_business_management permission");
    expect(text).toContain("null|The token may only use WhatsApp account ID 999888777");
  });

  it("all green when Meta reports a healthy number and an approved template", async () => {
    meta.token = { data: { is_valid: true, type: "SYSTEM_USER", application: "FUJ Online", expires_at: 0, scopes: ["whatsapp_business_messaging", "whatsapp_business_management"] } };
    meta.phone = { display_phone_number: "+234 704 274 1000", verified_name: "FlagUpJesus", account_mode: "LIVE", platform_type: "CLOUD_API", status: "CONNECTED", name_status: "APPROVED", quality_rating: "GREEN",
      health_status: { can_send_message: "AVAILABLE", entities: [{ entity_type: "WABA", id: "777", can_send_message: "AVAILABLE" }] } };
    meta.templates = [{ name: "fuj_broadcast", status: "APPROVED", language: "en_US", category: "UTILITY", parameter_format: "POSITIONAL", components: [{ type: "BODY", text: "Hello from FlagUpJesus 👋\n*{{1}}*\n{{2}}\nReply to respond." }] }];
    const r = await providers.checkWhatsAppSetup();
    expect(r.lines.filter((l) => l.ok !== true)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.lines.map((l) => l.text).join(" ")).toContain("Template “fuj_broadcast” is approved (en_US, utility)");
  });
});
