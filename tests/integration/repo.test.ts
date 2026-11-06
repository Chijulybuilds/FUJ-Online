import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Fresh local JSON store per run, no demo seed.
process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-")), "db.json");
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { db, DuplicateError } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const services = await import("../../src/lib/repo/services");
const care = await import("../../src/lib/repo/care");
const messaging = await import("../../src/lib/repo/messaging");

describe("people + check-in", () => {
  let personId = "";
  let serviceId = "";
  beforeAll(async () => {
    const p = await people.createPerson({ full_name: "Grace Okafor", phone: "08031234567", status: "member" });
    personId = p.id;
    serviceId = (await services.createService({ title: "Sunday", category: "Sunday worship", starts_at: new Date().toISOString() })).id;
  });

  it("assigns a unique flag username and finds it case-insensitively", async () => {
    const p = await db().get("people", { id: personId });
    expect(p?.username).toMatch(/^flaggrace\d{3}$/);
    expect((await people.findByUsername(p!.username!.toUpperCase()))?.id).toBe(personId);
    expect((await people.findByUsername(p!.username!.replace("flag", "")))?.id).toBe(personId);
  });

  it("rejects a duplicate phone in any format", async () => {
    await expect(people.createPerson({ full_name: "Other", phone: "+234 803 123 4567" })).rejects.toThrow(/already registered/);
  });

  it("records attendance once per person per service", async () => {
    const person = (await db().get("people", { id: personId }))!;
    await services.openCheckIn(serviceId);
    expect((await services.recordAttendance({ person, serviceId, method: "qr", deviceId: "dev1" })).status).toBe("checked_in");
    expect((await services.recordAttendance({ person, serviceId, method: "qr", deviceId: "dev1" })).status).toBe("already");
    await expect(db().insert("attendance", { id: crypto.randomUUID(), person_id: personId, service_id: serviceId, checked_in_at: "", check_in_method: "qr", recorded_by: null, device_id: null, created_at: "" })).rejects.toBeInstanceOf(DuplicateError);
  });

  it("blocks one device from checking in a second person", async () => {
    const other = await people.createPerson({ full_name: "David Nwosu", phone: "08062345678" });
    await expect(services.recordAttendance({ person: other, serviceId, method: "qr", deviceId: "dev1" })).rejects.toThrow(/already been used/);
    expect((await services.recordAttendance({ person: other, serviceId, method: "manual" })).status).toBe("checked_in");
  });
});

describe("absence analysis + broadcasts", () => {
  it("flags regular attenders who missed the last N services, once", async () => {
    const regular = await people.createPerson({ full_name: "Samuel James", phone: "08024567890", status: "member" });
    const day = 86400000;
    const ids: string[] = [];
    for (let w = 3; w >= 1; w--) ids.push((await services.createService({ title: `Sunday -${w}`, category: "Sunday worship", starts_at: new Date(Date.now() - w * 7 * day).toISOString() })).id);
    // attended only the oldest of the three
    await db().insert("attendance", { id: crypto.randomUUID(), person_id: regular.id, service_id: ids[0], checked_in_at: new Date(Date.now() - 21 * day).toISOString(), check_in_method: "qr", recorded_by: null, device_id: null, created_at: new Date().toISOString() });
    const first = await care.runFollowUpAnalysis();
    expect(first.absentees).toBeGreaterThanOrEqual(1);
    const tasks = (await db().list("follow_up_tasks", { where: { person_id: regular.id, category: "absentee" } }));
    expect(tasks).toHaveLength(1);
    await care.runFollowUpAnalysis();
    expect(await db().list("follow_up_tasks", { where: { person_id: regular.id, category: "absentee" } })).toHaveLength(1);
  });

  it("tracks reads/responses and targets non-responders in a follow-up", async () => {
    const b = await messaging.sendBroadcast({ title: "We missed you", body: "Hi {first_name}", kind: "follow_up", audience: "members", channels: [], request_response: true, created_by: "test" });
    expect(b.recipient_count).toBeGreaterThan(0);
    const rows = await db().list("broadcast_recipients", { where: { broadcast_id: b.id } });
    await messaging.respond(rows[0].id, rows[0].person_id, "I'm fine, thanks");
    const stats = messaging.stats(await db().list("broadcast_recipients", { where: { broadcast_id: b.id } }));
    expect(stats.responded).toBe(1);
    expect(stats.read).toBe(1);
    const targets = await messaging.resolveAudience(`followup:${b.id}:unresponded`);
    expect(targets.map((p) => p.id)).not.toContain(rows[0].person_id);
    expect(targets).toHaveLength(rows.length - 1);
    expect(await messaging.tasksForNonResponders(b.id)).toBe(rows.length - 1);
  });
});
