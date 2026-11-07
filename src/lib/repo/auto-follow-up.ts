import "server-only";
import { db } from "@/lib/db";
import type { Channel, ChurchSettings, FollowUpTask, Person } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { providers } from "@/lib/messaging/providers";
import { runFollowUpAnalysis } from "./care";
import { getSettings } from "./settings";
import { sendBroadcast } from "./messaging";

export const AUTO_FOLLOW_UP_AUTHOR = "Automatic follow-up";
export const DEFAULT_FIRST_MESSAGE =
  "Hi {first_name}, we've missed you at church these past Sundays and we hope you're doing well. Is everything okay? Reply to this message — we'd love to hear from you and pray with you. God bless you!";
export const DEFAULT_REMINDER_MESSAGE =
  "Hi {first_name}, we're still thinking of you and we miss you at FlagUpJesus. We'd love to see you this Sunday. If anything is wrong, reply to this message and let us know how we can pray with you or help.";
export const FIRST_TITLE = "We missed you";
export const REMINDER_TITLE = "We're still thinking of you";

const DAY = 86400000;
/** A little slack so a once-a-day job that runs a bit earlier than yesterday still counts as "N days later". */
const SLACK = 3 * 3600000;

const isOpen = (t: FollowUpTask) => t.status === "open" || t.status === "in_progress";

export function followUpChannels(settings: Pick<ChurchSettings, "follow_up_channels">): Channel[] {
  const chosen = new Set(settings.follow_up_channels ?? []);
  const out: Channel[] = [];
  if (chosen.has("whatsapp")) out.push("whatsapp");
  if (chosen.has("sms")) out.push("sms");
  if (chosen.has("email")) out.push("email");
  return out;
}

/** When the next automatic message for this task is due (null = none: off, stopped, or limit reached). */
export function nextAutoMessageAt(task: Pick<FollowUpTask, "status" | "category" | "auto_messages_sent" | "last_auto_message_at">, settings: Pick<ChurchSettings, "auto_follow_up" | "follow_up_every_days" | "follow_up_max_messages">): Date | null {
  if (!settings.auto_follow_up || task.category !== "absentee" || !isOpen(task as FollowUpTask)) return null;
  const sent = task.auto_messages_sent ?? 0;
  if (settings.follow_up_max_messages > 0 && sent >= settings.follow_up_max_messages) return null;
  if (!task.last_auto_message_at) return new Date(0); // first message: due now
  return new Date(new Date(task.last_auto_message_at).getTime() + Math.max(1, settings.follow_up_every_days) * DAY);
}

/** Closes open absentee follow-ups when the person is back in church (called on every check-in). */
export async function closeAbsenteeTasksOnReturn(personId: string, serviceTitle?: string | null) {
  const open = (await db().list("follow_up_tasks", { where: { person_id: personId, category: "absentee" } })).filter(isOpen);
  const now = nowIso();
  for (const t of open) {
    await db().update("follow_up_tasks", { id: t.id }, { status: "completed", completed_at: now, updated_at: now });
    await db().insert("follow_up_logs", {
      id: uid(), task_id: t.id, channel: "note", outcome: "returned", author: AUTO_FOLLOW_UP_AUTHOR, created_at: now,
      note: `Back in church${serviceTitle ? ` (${serviceTitle})` : ""} — automatic follow-up messages stopped.`
    });
  }
  return open.length;
}

export type AutoFollowUpResult = {
  enabled: boolean; detected: number; newMembers: number; returned: number; firstSent: number; remindersSent: number; channels: Channel[];
};

/**
 * The daily job (and the step after Sunday check-in closes):
 * 1. detect members who just missed N Sundays in a row (creates their absentee task);
 * 2. close tasks for anyone who has since come back;
 * 3. send the first message to newly-flagged members and a reminder to anyone whose last message was
 *    `follow_up_every_days` ago — on WhatsApp / SMS / email (whichever are connected and chosen) and the app inbox.
 * Messages stop when the person checks in again, when staff complete or dismiss the task, when their
 * membership status changes from "member", or after `follow_up_max_messages` (0 = no limit).
 */
export async function runAbsenteeFollowUps(now = new Date()): Promise<AutoFollowUpResult> {
  const analysis = await runFollowUpAnalysis();
  const settings = await getSettings();
  const channels = followUpChannels(settings);
  const result: AutoFollowUpResult = { enabled: settings.auto_follow_up, detected: analysis.absentees, newMembers: analysis.newMembers, returned: 0, firstSent: 0, remindersSent: 0, channels };
  if (!settings.auto_follow_up) return result;

  const tasks = (await db().list("follow_up_tasks", { where: { category: "absentee" } })).filter(isOpen);
  if (!tasks.length) return result;
  const attendance = await db().list("attendance", tasks.length <= 100 ? { where: { person_id: tasks.map((t) => t.person_id) } } : {});
  const first: { task: FollowUpTask; person: Person }[] = [];
  const reminders: { task: FollowUpTask; person: Person }[] = [];
  for (const task of tasks) {
    const person = await db().get("people", { id: task.person_id });
    if (!person || person.status !== "member") continue;
    // Safety net: back in church since the task was created (check-in normally closes it straight away).
    if (attendance.some((a) => a.person_id === person.id && a.checked_in_at > task.created_at)) {
      result.returned += await closeAbsenteeTasksOnReturn(person.id);
      continue;
    }
    const due = nextAutoMessageAt(task, settings);
    if (!due || due.getTime() - SLACK > now.getTime()) continue;
    (task.last_auto_message_at ? reminders : first).push({ task, person });
  }

  const send = async (batch: typeof first, kind: "first" | "reminder") => {
    if (!batch.length) return 0;
    const body = (kind === "first" ? settings.follow_up_first_message : settings.follow_up_reminder_message)?.trim() || (kind === "first" ? DEFAULT_FIRST_MESSAGE : DEFAULT_REMINDER_MESSAGE);
    const broadcast = await sendBroadcast({
      title: kind === "first" ? FIRST_TITLE : REMINDER_TITLE, body, kind: "follow_up", audience: kind === "first" ? "auto_follow_up" : "auto_follow_up:reminder",
      channels, request_response: true, created_by: AUTO_FOLLOW_UP_AUTHOR, recipients: batch.map((b) => b.person)
    });
    const stamp = nowIso();
    const via = [...new Set(["app inbox", ...channels.flatMap((c) =>
      c === "whatsapp" ? (providers.whatsapp ? ["WhatsApp"] : providers.sms ? ["SMS"] : []) : c === "sms" ? (providers.sms ? ["SMS"] : []) : providers.email ? ["email"] : [])])];
    for (const { task } of batch) {
      const n = (task.auto_messages_sent ?? 0) + 1;
      await db().update("follow_up_tasks", { id: task.id }, { auto_messages_sent: n, last_auto_message_at: stamp, last_contacted_at: stamp, updated_at: stamp });
      await db().insert("follow_up_logs", {
        id: uid(), task_id: task.id, channel: channels.includes("whatsapp") ? "whatsapp" : channels.includes("sms") ? "sms" : channels.includes("email") ? "email" : "in_app",
        outcome: kind === "first" ? "auto_message" : "auto_reminder", author: AUTO_FOLLOW_UP_AUTHOR, created_at: stamp,
        note: `${kind === "first" ? "First automatic message" : `Automatic reminder (message ${n})`} sent via ${via.join(", ")}. Broadcast ${broadcast.id}.`
      });
    }
    return batch.length;
  };
  result.firstSent = await send(first, "first");
  result.remindersSent = await send(reminders, "reminder");
  return result;
}

/** One-line summary for admins. */
export function describeRun(r: AutoFollowUpResult) {
  const parts = [`${r.detected} newly absent member${r.detected === 1 ? "" : "s"} found`];
  if (r.enabled) parts.push(`${r.firstSent} first message${r.firstSent === 1 ? "" : "s"} and ${r.remindersSent} reminder${r.remindersSent === 1 ? "" : "s"} sent`);
  else parts.push("automatic messages are off (Settings → Automatic follow-up)");
  if (r.returned) parts.push(`${r.returned} back in church`);
  if (r.newMembers) parts.push(`${r.newMembers} new-member welcome task${r.newMembers === 1 ? "" : "s"}`);
  return parts.join(" · ") + ".";
}
