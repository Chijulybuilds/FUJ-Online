import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-kids-")), "db.json");
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
const children = await import("../../src/lib/repo/children");
const services = await import("../../src/lib/repo/services");
const messaging = await import("../../src/lib/repo/messaging");
const { nowIso, uid } = await import("../../src/lib/utils");

const yearsAgo = (n: number, days = 10) => new Date(Date.now() - n * 365.25 * 86400000 - days * 86400000).toISOString().slice(0, 10);

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ", RESEND_API_KEY: "re", EMAIL_FROM: "FUJ <news@flagupjesus.org>" });
});
afterAll(() => vi.unstubAllGlobals());

describe("children registered with a parent's phone number", () => {
  let tobi = "", ada = "", mum = "";

  it("registers a child with a parent who isn't registered yet, then links them when the parent registers", async () => {
    const { child, guardian } = await children.registerChild({ full_name: "Tobi Adeyemi", birthday: yearsAgo(6), gender: "male", phone: "0803 555 1234", guardian_name: "Funke Adeyemi", guardian_relationship: "Mother", care_notes: "Allergic to peanuts" });
    expect(guardian).toBeNull();
    expect(child).toMatchObject({ is_child: true, guardian_id: null, guardian_name: "Funke Adeyemi", normalized_phone: "+2348035551234", care_notes: "Allergic to peanuts" });
    expect(child.username).toMatch(/^flagtobi\d{3}$/);
    tobi = child.id;
    // A second child on the same number is fine — but not the same child twice.
    ada = (await children.registerChild({ full_name: "Ada Adeyemi", birthday: yearsAgo(9), gender: "female", phone: "08035551234", guardian_name: "Funke Adeyemi" })).child.id;
    await expect(children.registerChild({ full_name: "tobi adeyemi", birthday: yearsAgo(6), phone: "08035551234", guardian_name: "Funke" })).rejects.toThrow(/already registered with this phone number — their username is flagtobi/);
    // Too old for children's registration.
    await expect(children.registerChild({ full_name: "Big Bro", birthday: yearsAgo(19), phone: "08035551234", guardian_name: "Funke" })).rejects.toThrow(/under-18s/);
    // The phone number isn't "taken" by the children: the parent can register with it and the children are linked.
    expect(await people.findByPhone("08035551234")).toBeNull();
    const parent = await people.createPerson({ full_name: "Funke Adeyemi", phone: "0803 555 1234", email: "funke@example.com" });
    mum = parent.id;
    expect((await db().get("people", { id: tobi }))!.guardian_id).toBe(mum);
    expect((await people.findByPhone("+2348035551234"))!.id).toBe(mum);
    expect((await people.findByEmail("funke@example.com"))!.id).toBe(mum);
    expect((await people.childrenOf(parent)).map((k) => k.full_name)).toEqual(["Ada Adeyemi", "Tobi Adeyemi"]); // oldest first
    // Phone numbers are still unique among adults.
    await expect(people.createPerson({ full_name: "Someone Else", phone: "08035551234" })).rejects.toThrow(/already registered/);
  });

  it("links a child straight to a registered parent", async () => {
    const { child, guardian } = await children.registerChild({ full_name: "Zara Adeyemi", birthday: yearsAgo(1), phone: "08035551234" });
    expect(guardian?.id).toBe(mum);
    expect(child).toMatchObject({ guardian_id: mum, guardian_name: "Funke Adeyemi", email: "funke@example.com" });
  });

  it("one phone checks in the whole family — but not strangers", async () => {
    const svc = await services.createService({ title: "Family Sunday", category: "Sunday worship", starts_at: new Date().toISOString() });
    const get = async (id: string) => (await db().get("people", { id }))!;
    await services.recordAttendance({ person: await get(mum), serviceId: svc.id, method: "qr", deviceId: "phone-1" });
    expect((await services.recordAttendance({ person: await get(tobi), serviceId: svc.id, method: "qr", deviceId: "phone-1" })).status).toBe("checked_in");
    expect((await services.recordAttendance({ person: await get(ada), serviceId: svc.id, method: "qr", deviceId: "phone-1" })).status).toBe("checked_in");
    const stranger = await people.createPerson({ full_name: "Stranger Danger", phone: "08035559999" });
    await expect(services.recordAttendance({ person: stranger, serviceId: svc.id, method: "qr", deviceId: "phone-1" })).rejects.toThrow(/already been used/);
    const family = await children.familyForCheckIn(await get(mum), svc.id);
    expect(family.map((k) => [k.firstName, k.checkedIn])).toEqual([["Ada", true], ["Tobi", true], ["Zara", false]]);
    const list = await children.listChildren();
    const t = list.find((k) => k.id === tobi)!;
    expect(t).toMatchObject({ age: 6, visits: 1, inToday: true });
    expect(t.group?.label).toBe("Pre-school");
    expect(t.guardian?.id).toBe(mum);
  });

  it("children get messages in the app only — WhatsApp / SMS go to the parent once", async () => {
    calls.length = 0;
    const b = await messaging.sendBroadcast({ title: "Children's day", body: "Hi {first_name}!", kind: "general", audience: "all", channels: ["whatsapp", "sms", "email"], request_response: false, created_by: "Test" });
    const rows = await db().list("broadcast_recipients", { where: { broadcast_id: b.id } });
    expect(rows.find((r) => r.person_id === tobi)).toMatchObject({ whatsapp_status: null, sms_status: null, email_status: null });
    const toFamilyPhone = calls.filter((c) => JSON.stringify(c.body).includes("2348035551234"));
    // Funke gets the WhatsApp and the SMS once each — none of the messages are the children's.
    expect(toFamilyPhone.map((c) => (c.url.includes("termii") ? "sms" : "whatsapp")).sort()).toEqual(["sms", "whatsapp"]);
    expect(toFamilyPhone.every((c) => JSON.stringify(c.body).includes("Funke") && !/Tobi|Ada|Zara/.test(JSON.stringify(c.body)))).toBe(true);
    expect((await messaging.resolveAudience("parents")).map((p) => p.full_name)).toEqual(["Funke Adeyemi"]);
  });

  it("children aren't flagged as absentees, and inbound WhatsApp finds the parent", async () => {
    const old = await services.createService({ title: "Old Sunday", category: "Sunday worship", starts_at: new Date(Date.now() - 30 * 86400000).toISOString() });
    await db().insert("attendance", { id: uid(), person_id: ada, service_id: old.id, checked_in_at: new Date(Date.now() - 30 * 86400000).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: nowIso() });
    for (const d of [14, 7]) {
      const s = await services.createService({ title: `Sunday -${d}`, category: "Sunday worship", starts_at: new Date(Date.now() - d * 86400000).toISOString() });
      const other = await people.createPerson({ full_name: `Regular ${d}`, phone: `0803000${d}111` });
      await db().insert("attendance", { id: uid(), person_id: other.id, service_id: s.id, checked_in_at: new Date(Date.now() - d * 86400000).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: nowIso() });
    }
    const r = await messaging.handleWhatsAppInbound("2348035551234", "Thank you!");
    expect(r).toBeDefined();
    expect((await db().get("people", { id: mum }))!.whatsapp).toBe("yes");
    expect((await db().get("people", { id: tobi }))!.whatsapp).toBe("unknown");
  });

  it("a child's record can change to a new parent number without clashing", async () => {
    const dad = await people.createPerson({ full_name: "Kunle Adeyemi", phone: "08035557777" });
    await people.updatePerson(tobi, { phone: "08035557777", guardian_id: dad.id });
    expect((await db().get("people", { id: tobi }))!.normalized_phone).toBe("+2348035557777");
    await expect(people.updatePerson(dad.id, { phone: "08035551234" })).rejects.toThrow(/Another person already uses/);
  });
});
