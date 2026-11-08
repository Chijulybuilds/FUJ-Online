import "server-only";
import { db, DuplicateError } from "@/lib/db";
import type { Attendance, Person, QrSession, Service } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { peopleById, FriendlyError, sameFamily } from "./people";
import { closeAbsenteeTasksOnReturn } from "./auto-follow-up";
import { noteFirstTimerCheckIn } from "./first-timers";

export async function listServices() {
  return db().list("services", { order: { column: "starts_at", ascending: false } });
}
export async function getService(id: string) {
  return db().get("services", { id });
}

export async function createService(input: Pick<Service, "title" | "category" | "starts_at"> & Partial<Service>) {
  const now = nowIso();
  return db().insert("services", {
    id: uid(), title: input.title, description: input.description ?? null, category: input.category, location: input.location ?? null,
    starts_at: input.starts_at, ends_at: input.ends_at ?? null, check_in_opens_at: null, check_in_closes_at: null,
    status: "scheduled", created_at: now, updated_at: now
  });
}

export async function updateService(id: string, patch: Partial<Service>) {
  const [row] = await db().update("services", { id }, { ...patch, updated_at: nowIso() });
  return row;
}

/** The next service that has not finished, used for the landing-page countdown and dashboard. */
export async function upcomingService(): Promise<Service | null> {
  const now = Date.now();
  const services = await db().list("services", { where: { status: ["scheduled", "active"] }, order: { column: "starts_at" } });
  return services.find((s) => s.status === "active" || new Date(s.ends_at ?? s.starts_at).getTime() + 3600000 > now) ?? null;
}

export async function activeSessionForService(serviceId: string): Promise<QrSession | null> {
  const now = Date.now();
  const sessions = await db().list("qr_sessions", { where: { service_id: serviceId, status: "active" } });
  return sessions.find((s) => new Date(s.opens_at).getTime() <= now && new Date(s.closes_at).getTime() >= now) ?? null;
}

export async function activeSessions() {
  const now = Date.now();
  const sessions = await db().list("qr_sessions", { where: { status: "active" }, order: { column: "opens_at", ascending: false } });
  return sessions.filter((s) => new Date(s.opens_at).getTime() <= now && new Date(s.closes_at).getTime() >= now);
}

/** Opens (or reuses) the check-in window for a service. Default window: 4 hours. */
export async function openCheckIn(serviceId: string, minutes = 240) {
  const service = await getService(serviceId);
  if (!service) throw new FriendlyError("Service not found");
  if (service.status === "cancelled") throw new FriendlyError("This service was cancelled");
  const existing = await activeSessionForService(serviceId);
  if (existing) return existing;
  const opens = new Date();
  const closes = new Date(opens.getTime() + minutes * 60000);
  const session = await db().insert("qr_sessions", {
    id: uid(), service_id: serviceId, status: "active", opens_at: opens.toISOString(), closes_at: closes.toISOString(),
    created_at: nowIso(), closed_at: null
  });
  await updateService(serviceId, { status: "active", check_in_opens_at: session.opens_at, check_in_closes_at: session.closes_at });
  return session;
}

export async function closeCheckIn(serviceId: string) {
  const now = nowIso();
  await db().update("qr_sessions", { service_id: serviceId, status: "active" }, { status: "closed", closed_at: now });
  await updateService(serviceId, { status: "completed", check_in_closes_at: now });
}

export type CheckInResult = { status: "checked_in" | "already"; attendance: Attendance; person: Person };

/** Records attendance once per person per service (enforced by a unique key in the database). */
export async function recordAttendance(input: {
  person: Person; serviceId: string; method: Attendance["check_in_method"]; deviceId?: string | null; recordedBy?: string | null;
}): Promise<CheckInResult> {
  const existing = await db().get("attendance", { person_id: input.person.id, service_id: input.serviceId });
  if (existing) return { status: "already", attendance: existing, person: input.person };
  if (input.deviceId) {
    // One phone, one person per service: stops a single device checking in a list of usernames.
    const sameDevice = await db().get("attendance", { service_id: input.serviceId, device_id: input.deviceId });
    if (sameDevice && sameDevice.person_id !== input.person.id) {
      // …except a family: a parent can check in the children who use their phone number.
      const other = await db().get("people", { id: sameDevice.person_id });
      if (!other || !sameFamily(other, input.person)) {
        throw new FriendlyError("This phone has already been used to check someone in for this service. Please see an usher.");
      }
    }
  }
  const now = nowIso();
  try {
    const attendance = await db().insert("attendance", {
      id: uid(), person_id: input.person.id, service_id: input.serviceId, checked_in_at: now, check_in_method: input.method,
      recorded_by: input.recordedBy ?? null, device_id: input.deviceId ?? null, created_at: now
    });
    await db().update("people", { id: input.person.id }, { last_seen_at: now, updated_at: now });
    // Back in church: close their absence follow-up so the automatic messages stop.
    const service = await db().get("services", { id: input.serviceId });
    await closeAbsenteeTasksOnReturn(input.person.id, service?.title);
    // A first timer checking in to a later service has come back: their Saturday invitations stop.
    await noteFirstTimerCheckIn(input.person.id, now, service?.title).catch((error) => console.error("first-timer check-in note failed", error));
    return { status: "checked_in", attendance, person: input.person };
  } catch (error) {
    if (error instanceof DuplicateError) {
      const row = await db().get("attendance", { person_id: input.person.id, service_id: input.serviceId });
      if (row) return { status: "already", attendance: row, person: input.person };
    }
    throw error;
  }
}

export async function attendanceForService(serviceId: string) {
  const rows = await db().list("attendance", { where: { service_id: serviceId }, order: { column: "checked_in_at", ascending: false } });
  const ids = rows.map((r) => r.person_id);
  const [people, history] = await Promise.all([
    peopleById(ids),
    ids.length && ids.length <= 100 ? db().list("attendance", { where: { person_id: ids } }) : ids.length ? db().list("attendance") : Promise.resolve([])
  ]);
  // Each person's earliest check-in: if it's this service, it was their first time in church — unless they told
  // us at registration they've been coming for a while (an existing member who only just registered online).
  const firstId = new Map<string, { id: string; at: string }>();
  for (const a of history) { const cur = firstId.get(a.person_id); if (!cur || a.checked_in_at < cur.at) firstId.set(a.person_id, { id: a.id, at: a.checked_in_at }); }
  return rows.map((r) => {
    const person = people.get(r.person_id) ?? null;
    return { ...r, person, firstTime: firstId.get(r.person_id)?.id === r.id && person?.first_timer !== false };
  });
}

export async function attendanceForPerson(personId: string) {
  const rows = await db().list("attendance", { where: { person_id: personId }, order: { column: "checked_in_at", ascending: false } });
  const services = new Map((await db().list("services")).map((s) => [s.id, s]));
  return rows.map((r) => ({ ...r, service: services.get(r.service_id) ?? null }));
}

/** Attendance counts for completed/active services, newest first. */
export async function serviceSummaries(limit = 12) {
  const services = (await listServices()).filter((s) => s.status !== "cancelled" && new Date(s.starts_at).getTime() <= Date.now() + 86400000);
  const [attendance, existingMembers] = await Promise.all([
    db().list("attendance"),
    // People who said at registration it was NOT their first time aren't counted as new.
    db().list("people", { where: { first_timer: false } }).then((rows) => new Set(rows.map((p) => p.id)), () => new Set<string>())
  ]);
  return services.slice(0, limit).map((service) => {
    const rows = attendance.filter((a) => a.service_id === service.id);
    // New members = first timers whose first-ever check-in was this service.
    const newMembers = rows.filter((a) => {
      if (existingMembers.has(a.person_id)) return false;
      const first = attendance.filter((x) => x.person_id === a.person_id).sort((x, y) => x.checked_in_at.localeCompare(y.checked_in_at))[0];
      return first?.id === a.id;
    }).length;
    return { service, total: rows.length, newMembers };
  });
}
