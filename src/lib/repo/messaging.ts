import "server-only";
import { db } from "@/lib/db";
import type { Broadcast, BroadcastRecipient, Channel, Person } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { peopleById } from "./people";
import { createTask } from "./care";
import { sendEmail, sendSms } from "@/lib/messaging/providers";
import { firstName } from "@/lib/identity-utils";

export const AUDIENCES: { value: string; label: string }[] = [
  { value: "all", label: "Everyone (members + visitors)" },
  { value: "members", label: "Members only" },
  { value: "visitors", label: "Visitors only" },
  { value: "first_timers", label: "First-timers (last 30 days)" },
  { value: "absentees", label: "Absentees (open absence follow-ups)" },
  { value: "care_open", label: "Everyone with an open follow-up task" }
];

/** Resolves an audience key to the people who should receive a message. */
export async function resolveAudience(audience: string): Promise<Person[]> {
  const people = [...(await peopleById()).values()].filter((p) => p.status === "member" || p.status === "visitor");
  const [kind, arg, mode] = audience.split(":");
  switch (kind) {
    case "all": return people;
    case "members": return people.filter((p) => p.status === "member");
    case "visitors": return people.filter((p) => p.status === "visitor");
    case "first_timers": {
      const since = Date.now() - 30 * 86400000;
      return people.filter((p) => p.first_visit_at && new Date(p.first_visit_at).getTime() >= since);
    }
    case "absentees":
    case "care_open": {
      const tasks = await db().list("follow_up_tasks", { where: { status: ["open", "in_progress"] } });
      const ids = new Set(tasks.filter((t) => kind === "care_open" || t.category === "absentee").map((t) => t.person_id));
      return people.filter((p) => ids.has(p.id));
    }
    case "department": {
      const links = await db().list("member_departments", { where: { department_id: arg, is_active: true } });
      const ids = new Set(links.map((l) => l.person_id));
      return people.filter((p) => ids.has(p.id));
    }
    case "person": return people.filter((p) => p.id === arg);
    case "followup": {
      // followup:<broadcastId>:unread | unresponded
      const rows = await db().list("broadcast_recipients", { where: { broadcast_id: arg } });
      const ids = new Set(rows.filter((r) => (mode === "unread" ? !r.read_at : !r.responded_at)).map((r) => r.person_id));
      return people.filter((p) => ids.has(p.id));
    }
    default: return [];
  }
}

export async function audienceLabel(audience: string) {
  const preset = AUDIENCES.find((a) => a.value === audience);
  if (preset) return preset.label;
  const [kind, arg, mode] = audience.split(":");
  if (kind === "department") return `Department: ${(await db().get("departments", { id: arg }))?.name ?? "Unknown"}`;
  if (kind === "person") return `Direct: ${(await db().get("people", { id: arg }))?.full_name ?? "Unknown"}`;
  if (kind === "followup") return mode === "unread" ? "Follow-up: hasn't read previous message" : "Follow-up: hasn't responded";
  return audience;
}

const personalise = (text: string, person: Person) =>
  text.replaceAll("{first_name}", firstName(person.full_name)).replaceAll("{username}", person.username ?? "");

export async function sendBroadcast(input: {
  title: string; body: string; kind: Broadcast["kind"]; audience: string; channels: Channel[]; request_response: boolean;
  parent_id?: string | null; created_by: string;
}) {
  const recipients = await resolveAudience(input.audience);
  const now = nowIso();
  const channels: Channel[] = Array.from(new Set<Channel>(["in_app", ...input.channels]));
  const broadcast = await db().insert("broadcasts", {
    id: uid(), title: input.title, body: input.body, kind: input.kind, audience: input.audience, channels, status: "sent",
    request_response: input.request_response, parent_id: input.parent_id ?? null, recipient_count: recipients.length,
    created_by: input.created_by, sent_at: now, created_at: now
  });
  for (const person of recipients) {
    const text = personalise(input.body, person);
    const sms_status = channels.includes("sms") ? await sendSms(person.normalized_phone, `${input.title}: ${text}`) : null;
    const email_status = channels.includes("email") ? (person.email ? await sendEmail(person.email, input.title, text) : "skipped") : null;
    await db().insert("broadcast_recipients", {
      id: uid(), broadcast_id: broadcast.id, person_id: person.id, read_at: null, response: null, responded_at: null,
      sms_status, email_status, created_at: now
    });
  }
  return broadcast;
}

export function stats(rows: BroadcastRecipient[]) {
  const total = rows.length;
  const read = rows.filter((r) => r.read_at).length;
  const responded = rows.filter((r) => r.responded_at).length;
  return { total, read, responded, unread: total - read, readRate: total ? Math.round((read / total) * 100) : 0, responseRate: total ? Math.round((responded / total) * 100) : 0 };
}

export async function listBroadcasts() {
  const [broadcasts, recipients] = await Promise.all([
    db().list("broadcasts", { order: { column: "created_at", ascending: false } }),
    db().list("broadcast_recipients")
  ]);
  return Promise.all(broadcasts.map(async (b) => ({
    ...b, audienceLabel: await audienceLabel(b.audience), stats: stats(recipients.filter((r) => r.broadcast_id === b.id))
  })));
}

export async function getBroadcast(id: string) {
  const broadcast = await db().get("broadcasts", { id });
  if (!broadcast) return null;
  const rows = await db().list("broadcast_recipients", { where: { broadcast_id: id } });
  const people = await peopleById(rows.map((r) => r.person_id));
  const followUps = await db().list("broadcasts", { where: { parent_id: id }, order: { column: "created_at", ascending: false } });
  const followUpStats = await Promise.all(followUps.map(async (f) => ({ ...f, stats: stats(await db().list("broadcast_recipients", { where: { broadcast_id: f.id } })) })));
  return {
    ...broadcast, audienceLabel: await audienceLabel(broadcast.audience), stats: stats(rows), followUps: followUpStats,
    recipients: rows.map((r) => ({ ...r, person: people.get(r.person_id) ?? null })).sort((a, b) => (a.person?.full_name ?? "").localeCompare(b.person?.full_name ?? ""))
  };
}

/** Creates pastoral follow-up tasks for recipients who have not responded to a broadcast. */
export async function tasksForNonResponders(broadcastId: string) {
  const broadcast = await db().get("broadcasts", { id: broadcastId });
  if (!broadcast) return 0;
  const rows = (await db().list("broadcast_recipients", { where: { broadcast_id: broadcastId } })).filter((r) => !r.responded_at);
  const open = await db().list("follow_up_tasks", { where: { source_broadcast_id: broadcastId } });
  let created = 0;
  for (const r of rows) {
    if (open.some((t) => t.person_id === r.person_id)) continue;
    await createTask({ person_id: r.person_id, category: "broadcast", reason: `No response to “${broadcast.title}”${r.read_at ? " (read)" : " (unread)"}`, source_broadcast_id: broadcastId });
    created++;
  }
  return created;
}

export async function memberMessages(personId: string) {
  const rows = await db().list("broadcast_recipients", { where: { person_id: personId }, order: { column: "created_at", ascending: false } });
  const ids = rows.map((r) => r.broadcast_id);
  const broadcasts = new Map((ids.length ? await db().list("broadcasts", { where: { id: ids.length <= 100 ? ids : undefined } }) : []).map((b) => [b.id, b]));
  return rows.flatMap((r) => { const b = broadcasts.get(r.broadcast_id); return b ? [{ ...r, broadcast: b }] : []; });
}

export async function unreadCount(personId: string) {
  return (await db().list("broadcast_recipients", { where: { person_id: personId, read_at: null } })).length;
}

export async function markRead(recipientId: string, personId: string) {
  const row = await db().get("broadcast_recipients", { id: recipientId, person_id: personId });
  if (row && !row.read_at) await db().update("broadcast_recipients", { id: recipientId }, { read_at: nowIso() });
  return row;
}

export async function respond(recipientId: string, personId: string, text: string) {
  const row = await db().get("broadcast_recipients", { id: recipientId, person_id: personId });
  if (!row) return null;
  const now = nowIso();
  const response = row.response ? `${row.response}\n—\n${text}` : text;
  await db().update("broadcast_recipients", { id: recipientId }, { response, responded_at: now, read_at: row.read_at ?? now });
  return row;
}

/** Admin inbox: everyone who has responded to a message, newest first. */
export async function inboxThreads() {
  const rows = (await db().list("broadcast_recipients")).filter((r) => r.responded_at);
  const people = await peopleById(rows.map((r) => r.person_id));
  const broadcasts = new Map((await db().list("broadcasts")).map((b) => [b.id, b]));
  const byPerson = new Map<string, typeof rows>();
  rows.forEach((r) => byPerson.set(r.person_id, [...(byPerson.get(r.person_id) ?? []), r]));
  return [...byPerson.entries()].map(([personId, list]) => {
    const latest = list.sort((a, b) => (b.responded_at ?? "").localeCompare(a.responded_at ?? ""))[0];
    return { person: people.get(personId) ?? null, personId, latest, broadcast: broadcasts.get(latest.broadcast_id) ?? null, count: list.length };
  }).sort((a, b) => (b.latest.responded_at ?? "").localeCompare(a.latest.responded_at ?? ""));
}

export async function threadForPerson(personId: string) {
  const rows = await db().list("broadcast_recipients", { where: { person_id: personId }, order: { column: "created_at" } });
  const broadcasts = new Map((await db().list("broadcasts")).map((b) => [b.id, b]));
  return rows.flatMap((r) => { const b = broadcasts.get(r.broadcast_id); return b ? [{ ...r, broadcast: b }] : []; });
}
