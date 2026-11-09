import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-import-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const calls: { url: string; body: string }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, body: String(init?.body ?? "") });
  if (url.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
  return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const importer = await import("../../src/lib/repo/contact-import");
const messaging = await import("../../src/lib/repo/messaging");
const { readSpreadsheet } = await import("../../src/lib/import/spreadsheet");
const { detectColumns, toContacts } = await import("../../src/lib/import/contacts");

function contactsFromFixture() {
  const rows = readSpreadsheet("contacts-sample.xlsx", readFileSync("tests/fixtures/contacts-sample.xlsx"))[0].rows;
  const d = detectColumns(rows);
  return toContacts(rows, d.headerRow, d.mapping);
}

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1234567890123", WHATSAPP_TEMPLATE_NAME: "fuj_broadcast", TERMII_API_KEY: "k", TERMII_SENDER_ID: "FUJ" });
});
afterAll(() => vi.unstubAllGlobals());

describe("importing a contact list", () => {
  it("adds only the people who aren't in the database yet", async () => {
    const grace = await people.createPerson({ full_name: "Grace Okafor", phone: "08031234567", email: "grace@example.com", notes: "Choir" });
    const results = await importer.importContacts(contactsFromFixture(), "contacts-sample.xlsx");
    expect(results.map((r) => [r.name, r.outcome])).toEqual([
      ["Grace Okafor", "skipped"], ["Pst. Daniel Bassey", "added"], ["Mrs. Ifeoma Bassey", "added"], ["Tunde Bakare", "added"],
      ["Tunde Bakare", "skipped"], ["Ngozi Eze", "skipped"], ["Halima Musa", "added"]
    ]);
    expect(results[0].detail).toBe("Already in the database as Grace Okafor");
    // The person already in the database is left exactly as they were.
    expect(await db().get("people", { id: grace.id })).toMatchObject({ notes: "Choir", email: "grace@example.com" });
    expect(await db().list("people", { where: { normalized_phone: "+2348031234567" } })).toHaveLength(1);
  });

  it("saves the details, notes and family links", async () => {
    const daniel = (await people.findByPhone("08091110001"))!;
    expect(daniel).toMatchObject({ full_name: "Pst. Daniel Bassey", gender: "male", address: "GRA Phase 2", shares_phone: false, first_visit_at: null, verified_via: "admin" });
    expect(daniel.username).toMatch(/^flagdaniel\d{3}$/); // not "flagpst…"
    expect(daniel.notes).toBe("Imported from contacts-sample.xlsx (Original list). Shares a number with Mrs. Bassey");
    const ifeoma = (await db().list("people", { where: { full_name: "Mrs. Ifeoma Bassey" } }))[0];
    expect(ifeoma).toMatchObject({ shares_phone: true, is_child: false, guardian_id: daniel.id, guardian_name: "Pst. Daniel Bassey", normalized_phone: "+2348091110001" });
    expect(ifeoma.username).toMatch(/^flagifeoma\d{3}$/);
    const tunde = (await db().list("people", { where: { full_name: "Tunde Bakare" } }))[0];
    expect(tunde.notes).toContain("Other phone: +2347031110002");
    expect(tunde.notes).toContain("needs checking");
    expect((await people.findByPhone("08091110003"))!.full_name).toBe("Halima Musa");
  });

  it("importing the same list again adds nobody", async () => {
    const before = (await db().list("people")).length;
    const again = await importer.importContacts(contactsFromFixture(), "contacts-sample.xlsx");
    expect(again.filter((r) => r.outcome === "added")).toHaveLength(0);
    expect((await db().list("people")).length).toBe(before);
    const preview = await importer.previewImport(contactsFromFixture());
    expect(preview.filter((r) => r.decision.status === "new" || r.decision.status === "shares")).toHaveLength(0);
  });

  it("family members on a shared number get messages in the app; the number's owner gets the WhatsApp once", async () => {
    calls.length = 0;
    const b = await messaging.sendBroadcast({ title: "Family day", body: "Hi {first_name}!", kind: "general", audience: "all", channels: ["whatsapp"], request_response: false, created_by: "Test" });
    const toBassey = calls.filter((c) => c.body.includes("2348091110001"));
    expect(toBassey).toHaveLength(1);
    expect(toBassey[0].body).toContain("Daniel"); // greeted by name, not "Pst."
    const ifeoma = (await db().list("people", { where: { full_name: "Mrs. Ifeoma Bassey" } }))[0];
    expect((await db().list("broadcast_recipients", { where: { broadcast_id: b.id, person_id: ifeoma.id } }))[0]).toMatchObject({ whatsapp_status: null });
  });
});
