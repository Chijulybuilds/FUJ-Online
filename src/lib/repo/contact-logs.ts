import "server-only";
import { db } from "@/lib/db";
import type { Channel, ContactLog, Person } from "@/lib/db/types";
import { nowIso, uid } from "@/lib/utils";
import { providers } from "@/lib/messaging/providers";
import { sendBroadcast } from "./messaging";

export const CONTACT_CHANNELS = ["call", "whatsapp", "sms", "visit", "email", "note"] as const;

export async function addContactLog(input: Omit<ContactLog, "id" | "created_at" | "note" | "author"> & { note?: string | null; author?: string | null }) {
  return db().insert("contact_logs", {
    id: uid(), subject: input.subject, subject_id: input.subject_id, channel: input.channel, outcome: input.outcome,
    note: input.note ?? null, author: input.author ?? null, created_at: nowIso()
  });
}

export async function contactLogsFor(subject: ContactLog["subject"], subjectId: string) {
  return db().list("contact_logs", { where: { subject, subject_id: subjectId }, order: { column: "created_at", ascending: false } });
}

/** Human list of where an automatic message actually goes, e.g. "app inbox, WhatsApp, email". */
export function deliveredVia(channels: Channel[]) {
  return [...new Set(["app inbox", ...channels.flatMap((c) =>
    c === "whatsapp" ? (providers.whatsapp ? ["WhatsApp"] : providers.sms ? ["SMS"] : []) : c === "sms" ? (providers.sms ? ["SMS"] : []) : c === "email" ? (providers.email ? ["email"] : []) : [])])];
}

/** The main channel to record in the contact log for an automatic message. */
export const logChannel = (channels: Channel[]): ContactLog["channel"] =>
  channels.includes("whatsapp") ? "whatsapp" : channels.includes("sms") ? "sms" : channels.includes("email") ? "email" : "in_app";

/**
 * Sends one automatic message to a batch of people (one tracked broadcast: app inbox + the chosen channels)
 * and records it in each person's contact log.
 */
export async function sendAutomaticMessage<T extends { id: string; person: Person }>(input: {
  subject: ContactLog["subject"]; items: T[]; title: string; body: string; audience: string; channels: Channel[];
  author: string; outcome: string; note: (item: T) => string; personalize?: (text: string, person: Person) => string;
}) {
  if (!input.items.length) return null;
  const broadcast = await sendBroadcast({
    title: input.title, body: input.body, kind: "follow_up", audience: input.audience, channels: input.channels, request_response: true,
    created_by: input.author, recipients: input.items.map((i) => i.person), personalize: input.personalize
  });
  const via = deliveredVia(input.channels).join(", ");
  for (const item of input.items) {
    await addContactLog({
      subject: input.subject, subject_id: item.id, channel: logChannel(input.channels), outcome: input.outcome, author: input.author,
      note: `${input.note(item)} Sent via ${via}.`
    });
  }
  return broadcast;
}
