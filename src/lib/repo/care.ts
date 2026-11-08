import "server-only";
import { db } from "@/lib/db";
import type { FollowUpCategory, FollowUpLog, FollowUpTask } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { peopleById } from "./people";
import { getSettings } from "./settings";
import { firstName } from "@/lib/identity-utils";

export async function createTask(input: {
  person_id: string; reason: string; category: FollowUpCategory; priority?: FollowUpTask["priority"]; assignee?: string | null;
  due_at?: string | null; source_broadcast_id?: string | null;
}) {
  const now = nowIso();
  return db().insert("follow_up_tasks", {
    id: uid(), person_id: input.person_id, reason: input.reason, category: input.category, priority: input.priority ?? "normal",
    status: "open", assignee: input.assignee ?? null, due_at: input.due_at ?? new Date(Date.now() + 3 * 86400000).toISOString(),
    completed_at: null, notes: null, last_contacted_at: null, source_broadcast_id: input.source_broadcast_id ?? null,
    auto_messages_sent: 0, last_auto_message_at: null, created_at: now, updated_at: now
  });
}

/**
 * Absence analysis: flags members who attended before but missed the last N Sunday services in a row
 * (N = settings.absence_threshold, default 2). First timers have their own follow-up (repo/first-timers.ts):
 * only people who say it's their first time get one — not existing members who register online.
 * A service only counts if attendance was actually taken (at least one check-in), so a Sunday where nobody
 * opened check-in never makes the whole church look absent. One absentee task per absence streak: if staff
 * closed it while the person is still away, it isn't recreated until they come back and miss again.
 * It never changes anyone's membership status.
 */
export async function runFollowUpAnalysis() {
  const settings = await getSettings();
  const threshold = Math.max(1, settings.absence_threshold || 2);
  const now = Date.now();
  const attendance = await db().list("attendance");
  const taken = new Set(attendance.map((a) => a.service_id));
  const allServices = (await db().list("services", { order: { column: "starts_at", ascending: false } }))
    .filter((s) => s.status !== "cancelled" && new Date(s.starts_at).getTime() < now && taken.has(s.id));
  const sundays = allServices.filter((s) => s.category === "Sunday worship");
  const pool = sundays.length >= threshold ? sundays : allServices;
  const recent = pool.slice(0, threshold);
  const tasks = await db().list("follow_up_tasks");
  const people = await peopleById();
  let absentees = 0;

  if (recent.length === threshold) {
    const recentIds = new Set(recent.map((s) => s.id));
    const oldest = new Date(recent[recent.length - 1].starts_at).getTime();
    for (const person of people.values()) {
      if (person.status !== "member") continue;
      const mine = attendance.filter((a) => a.person_id === person.id);
      const attendedBefore = mine.some((a) => new Date(a.checked_in_at).getTime() < oldest);
      // Present at any of those Sundays — or at any service since (e.g. Wednesday prayers) — means not absent.
      if (!attendedBefore || mine.some((a) => recentIds.has(a.service_id) || new Date(a.checked_in_at).getTime() >= oldest)) continue;
      const last = mine.sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))[0];
      // Already followed up for this absence (open, or closed by staff since they were last in church).
      if (tasks.some((t) => t.person_id === person.id && t.category === "absentee" && (t.status === "open" || t.status === "in_progress" || t.created_at > last.checked_in_at))) continue;
      const missed = pool.filter((s) => new Date(s.starts_at).getTime() > new Date(last.checked_in_at).getTime()).length;
      await createTask({
        person_id: person.id, category: "absentee", priority: missed > threshold ? "high" : "normal",
        reason: `Missed ${missed} consecutive ${pool === sundays ? "Sunday" : "service"}${missed === 1 ? "" : "s"} — check in on ${firstName(person.full_name)}`
      });
      absentees++;
    }
  }

  return { absentees };
}

export async function listTasks() {
  const tasks = await db().list("follow_up_tasks", { order: { column: "created_at", ascending: false } });
  const people = await peopleById(tasks.map((t) => t.person_id));
  return tasks.map((t) => ({ ...t, person: people.get(t.person_id) ?? null }));
}

export async function getTask(id: string) {
  const task = await db().get("follow_up_tasks", { id });
  if (!task) return null;
  const [person, logs] = await Promise.all([
    db().get("people", { id: task.person_id }),
    db().list("follow_up_logs", { where: { task_id: id }, order: { column: "created_at", ascending: false } })
  ]);
  return { ...task, person, logs };
}

export async function updateTask(id: string, patch: Partial<FollowUpTask>) {
  if (patch.status === "completed") patch.completed_at = nowIso();
  const [row] = await db().update("follow_up_tasks", { id }, { ...patch, updated_at: nowIso() });
  return row;
}

export async function logContact(taskId: string, input: Pick<FollowUpLog, "channel" | "outcome"> & { note?: string | null; author: string }) {
  const now = nowIso();
  const log = await db().insert("follow_up_logs", { id: uid(), task_id: taskId, channel: input.channel, outcome: input.outcome, note: input.note ?? null, author: input.author, created_at: now });
  const task = await db().get("follow_up_tasks", { id: taskId });
  await db().update("follow_up_tasks", { id: taskId }, { last_contacted_at: now, updated_at: now, status: task?.status === "open" ? "in_progress" : task?.status });
  return log;
}
