import "server-only";
import { db } from "@/lib/db";
import type { ChurchSettings, Person } from "@/lib/db/types";
import { normalizePhone } from "@/lib/identity-utils";
import { smsAttempt } from "@/lib/messaging/providers";
import { env } from "@/lib/env";
import { peopleById } from "./people";
import { getSettings, saveSettings } from "./settings";

/**
 * Members who have missed the last N Sundays in a row (N = settings.absence_threshold, default 2) — the follow-up
 * list for the pastor and admins. Only members who came before count (not people who never attended), children
 * are left out (their parents are), and a Sunday only counts if attendance was taken that day. Being at any
 * service since (e.g. Wednesday prayers) means they're not absent.
 */
export type Absentee = { person: Person; lastSeen: string; missed: number };

export async function absentMembers(threshold?: number): Promise<{ absentees: Absentee[]; sundays: number; threshold: number }> {
  const n = Math.max(1, threshold ?? ((await getSettings()).absence_threshold || 2));
  const now = Date.now();
  const attendance = await db().list("attendance");
  const taken = new Set(attendance.map((a) => a.service_id));
  const services = (await db().list("services", { order: { column: "starts_at", ascending: false } }))
    .filter((s) => s.status !== "cancelled" && new Date(s.starts_at).getTime() < now && taken.has(s.id));
  const sundays = services.filter((s) => s.category === "Sunday worship");
  const pool = sundays.length >= n ? sundays : services;
  const recent = pool.slice(0, n);
  if (recent.length < n) return { absentees: [], sundays: recent.length, threshold: n };
  const oldest = new Date(recent[recent.length - 1].starts_at).getTime();
  const byPerson = new Map<string, string[]>();
  for (const a of attendance) byPerson.set(a.person_id, [...(byPerson.get(a.person_id) ?? []), a.checked_in_at]);
  const absentees: Absentee[] = [];
  for (const person of (await peopleById()).values()) {
    if (person.status !== "member" || person.is_child) continue;
    const times = (byPerson.get(person.id) ?? []).sort().reverse();
    if (!times.length || new Date(times[0]).getTime() >= oldest) continue; // never came, or came recently
    const missed = pool.filter((s) => new Date(s.starts_at).getTime() > new Date(times[0]).getTime()).length;
    absentees.push({ person, lastSeen: times[0], missed });
  }
  absentees.sort((a, b) => b.missed - a.missed || a.person.full_name.localeCompare(b.person.full_name));
  return { absentees, sundays: n, threshold: n };
}

/** The numbers in Settings → Missed-Sundays report (one per line or comma-separated). */
export function reportNumbers(settings: Pick<ChurchSettings, "absence_report_numbers">) {
  return [...new Set((settings.absence_report_numbers ?? "").split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean).map((v) => normalizePhone(v)).filter((v) => v.length >= 8))];
}

const SMS_LIMIT = 600; // about 4 SMS pages — longer lists end with a link to the full list
/** The report text: names and phone numbers, cut short with a link when the list is long. */
export function reportText(absentees: Absentee[], threshold: number, siteUrl = env.appUrl) {
  const head = `FUJ follow-up: ${absentees.length} member${absentees.length === 1 ? "" : "s"} missed the last ${threshold} Sunday${threshold === 1 ? "" : "s"}:`;
  const link = `${siteUrl.replace(/\/+$/, "")}/admin/absent`;
  let text = head;
  let shown = 0;
  for (const a of absentees) {
    const line = `\n${a.person.full_name} ${a.person.phone}`;
    const more = absentees.length - shown - 1;
    if ((text + line + (more ? `\n+${more} more: ${link}` : "")).length > SMS_LIMIT) break;
    text += line; shown++;
  }
  if (shown < absentees.length) text += `\n+${absentees.length - shown} more: ${link}`;
  // Plain characters only (GSM), so each SMS page holds 160 characters.
  return text.normalize("NFKD").replace(/[^\x20-\x7E\n]/g, "");
}

export type AbsenceReport = { sent: number; failed: number; absentees: number; skipped?: string };

/**
 * Sends the report by SMS to every number in Settings. Automatically once a week (Monday, from the daily job) when
 * it's turned on, or straight away with "Send report now". Nothing is sent when nobody is missing.
 */
export async function sendAbsenceReport(opts: { force?: boolean; now?: Date } = {}): Promise<AbsenceReport> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const numbers = reportNumbers(settings);
  if (!opts.force) {
    if (!settings.absence_report) return { sent: 0, failed: 0, absentees: 0, skipped: "the report is turned off" };
    if (new Date(now.getTime() + 3600000).getUTCDay() !== 1) return { sent: 0, failed: 0, absentees: 0, skipped: "it goes out on Mondays" };
    if (settings.absence_report_sent_at && now.getTime() - new Date(settings.absence_report_sent_at).getTime() < 5 * 86400000) return { sent: 0, failed: 0, absentees: 0, skipped: "already sent this week" };
  }
  if (!numbers.length) return { sent: 0, failed: 0, absentees: 0, skipped: "no phone numbers are set" };
  const { absentees, threshold } = await absentMembers(settings.absence_threshold);
  if (!absentees.length) return { sent: 0, failed: 0, absentees: 0, skipped: "nobody has missed the last Sundays" };
  const text = reportText(absentees, threshold);
  let sent = 0, failed = 0;
  for (const to of numbers) {
    if ((await smsAttempt(to, text)).status === "sent") sent++;
    else failed++;
  }
  if (sent) await saveSettings({ absence_report_sent_at: now.toISOString() });
  return { sent, failed, absentees: absentees.length };
}

export function describeAbsenceReport(r: AbsenceReport) {
  if (r.skipped) return `Not sent — ${r.skipped}.`;
  return `Report on ${r.absentees} member${r.absentees === 1 ? "" : "s"} sent by SMS to ${r.sent} number${r.sent === 1 ? "" : "s"}${r.failed ? ` (${r.failed} failed — check SMS in Messaging channels)` : ""}.`;
}
