import "server-only";
import { db, DuplicateError } from "@/lib/db";
import type { ChurchSettings, ContactLog, FirstTimer, FirstTimerStage, Person, Service } from "@/lib/db/types";
import { formatDate, nowIso, uid } from "@/lib/utils";
import { peopleById } from "./people";
import { getSettings } from "./settings";
import { addContactLog, contactLogsFor, followUpChannels, sendAutomaticMessage } from "./contact-logs";

/**
 * First-timer follow-up. Someone who tells us at registration (or an usher/admin who records) that it's their
 * FIRST TIME at FlagUpJesus gets a journey of their own — separate from existing members who simply register
 * online. Stages: new → welcomed (someone reached them) → returned (back in church) → settled (joined a unit,
 * TFT, or now a regular), or closed. Automatically: a welcome message straight away, then an invitation every
 * Saturday (up to `first_timer_max_invites`) until they come back. Coming back is detected at check-in.
 */

export const FIRST_TIMER_AUTHOR = "Automatic first-timer follow-up";
export const STAGES: { value: FirstTimerStage; label: string; hint: string }[] = [
  { value: "new", label: "New", hint: "Just joined us — call to welcome them" },
  { value: "welcomed", label: "Welcomed", hint: "Someone from the team has reached them" },
  { value: "returned", label: "Came back", hint: "Back in church after their first visit" },
  { value: "settled", label: "Settled in", hint: "Joined a unit or TFT, or now a regular" },
  { value: "closed", label: "Closed", hint: "Moved away, not interested or unreachable" }
];
export const stageLabel = (s: FirstTimerStage) => STAGES.find((x) => x.value === s)?.label ?? s;

/**
 * What admins see: three simple statuses instead of five stages.
 *   To call   — nobody has reached them yet (stage "new")
 *   Called    — someone from the team reached them (stage "welcomed")
 *   Came back — back in church after their first visit (stages "returned" and "settled")
 * "Removed" (stage "closed") is for people who moved away, were only visiting, or asked not to be contacted.
 */
export type SimpleStatus = "to_call" | "called" | "came_back" | "removed";
export const SIMPLE_STATUSES: { value: SimpleStatus; label: string; hint: string }[] = [
  { value: "to_call", label: "To call", hint: "Nobody has reached them yet — give them a call to say welcome" },
  { value: "called", label: "Called", hint: "Someone has reached them — the app invites them back each Saturday" },
  { value: "came_back", label: "Came back", hint: "Back in church after their first visit 🙌" },
  { value: "removed", label: "Removed", hint: "Moved away, only visiting, or asked not to be contacted" }
];
export function simpleStatus(stage: FirstTimerStage): SimpleStatus {
  return stage === "new" ? "to_call" : stage === "welcomed" ? "called" : stage === "closed" ? "removed" : "came_back";
}
export const simpleLabel = (stage: FirstTimerStage) => SIMPLE_STATUSES.find((x) => x.value === simpleStatus(stage))!.label;

/** History entries in plain words (older entries used the five-stage names). */
const HISTORY_WORDS: Record<string, string> = {
  auto_welcome: "Welcome message sent automatically", auto_invite: "Sunday invitation sent automatically",
  "Moved to Welcomed": "Marked as called", "Moved to Came back": "Marked as came back", "Moved to Settled in": "Marked as came back",
  "Moved to Closed": "Removed from the list", "Moved to New": "Put back on the call list"
};
export const historyLabel = (outcome: string) => HISTORY_WORDS[outcome] ?? outcome.replace(/^Reached — /, "Reached them — ");

export type QuickAction = "reached" | "no_answer" | "came_back" | "remove" | "restore";

/** One-click updates from the first-timers list and page: what happened, plus an optional note. */
export async function firstTimerQuickAction(id: string, action: QuickAction, actor: string, note?: string | null) {
  const journey = await db().get("first_timers", { id });
  if (!journey) return null;
  const now = nowIso();
  const text = note?.trim() || null;
  const log = (outcome: string, channel: ContactLog["channel"] = "note") => addContactLog({ subject: "first_timer", subject_id: id, channel, outcome, note: text, author: actor });
  let patch: Partial<FirstTimer> = { updated_at: now };
  if (action === "reached") {
    await log("Reached them", "call");
    patch = { ...patch, last_contacted_at: now, ...(journey.stage === "new" ? { stage: "welcomed" as const, welcomed_at: journey.welcomed_at ?? now } : {}) };
  } else if (action === "no_answer") {
    await log("No answer", "call");
    patch = { ...patch, last_contacted_at: now };
  } else if (action === "came_back") {
    await log("Marked as came back");
    patch = { ...patch, stage: "returned", returned_at: journey.returned_at ?? now, closed_at: null, close_reason: null };
  } else if (action === "remove") {
    await log("Removed from the list");
    patch = { ...patch, stage: "closed", closed_at: now, close_reason: text };
  } else {
    await log("Put back on the call list");
    patch = { ...patch, stage: journey.returned_at ? "returned" : journey.welcomed_at ? "welcomed" : "new", closed_at: null, close_reason: null };
  }
  const [row] = await db().update("first_timers", { id }, patch);
  return row;
}

export const WELCOME_TITLE = "Welcome to FlagUpJesus";
export const INVITE_TITLE = "See you this Sunday?";
export const DEFAULT_WELCOME_MESSAGE =
  "Hi {first_name}, thank you for worshipping with us at FlagUpJesus Global Ministry! We're so glad you came, and we'd love to get to know you. Someone from our team will reach out to you this week. God bless you!";
export const DEFAULT_INVITE_MESSAGE =
  "Hi {first_name}, it was a joy having you at FlagUpJesus! We'd love to see you again this Sunday at our Word Experience service, 4:30 PM, {address}. Come as you are — God bless you!";

/** Contact-log outcomes staff can choose. "Reached …" moves a new first timer to Welcomed. */
export const FIRST_TIMER_OUTCOMES = ["Reached — welcomed them", "Reached — will come again", "Reached — joined a unit / TFT", "Reached — needs prayer", "No answer", "Wrong number", "Not interested", "Other"];

const DAY = 86400000;
/** A check-in at least this long after the first visit counts as coming back (not the same service). */
export const RETURN_GAP = 12 * 3600000;
/** Lagos is UTC+1 all year (no daylight saving). */
const inLagos = (d: Date) => new Date(d.getTime() + 3600000);
export const isSaturdayInLagos = (d: Date) => inLagos(d).getUTCDay() === 6;
const open = (j: Pick<FirstTimer, "stage">) => j.stage === "new" || j.stage === "welcomed";

export type FirstTimerRow = FirstTimer & { person: Person; service: Pick<Service, "id" | "title" | "starts_at"> | null };

/** Starts the first-timer journey for this person (once). Returns the journey and whether it was just created. */
export async function startFirstTimer(person: Person, opts: { source: FirstTimer["source"]; serviceId?: string | null; firstVisitAt?: string | null; assignee?: string | null }) {
  const existing = await db().get("first_timers", { person_id: person.id });
  if (existing) return { journey: existing, created: false };
  const now = nowIso();
  const firstVisit = opts.firstVisitAt ?? now;
  let journey: FirstTimer;
  try {
    journey = await db().insert("first_timers", {
      id: uid(), person_id: person.id, first_visit_at: firstVisit, service_id: opts.serviceId ?? null, stage: "new", source: opts.source,
      assignee: opts.assignee ?? null, visits: 1, welcome_sent_at: null, invites_sent: 0, last_invite_at: null, welcomed_at: null,
      returned_at: null, settled_at: null, closed_at: null, close_reason: null, last_contacted_at: null, notes: null, created_at: now, updated_at: now
    });
  } catch (error) {
    const again = error instanceof DuplicateError ? await db().get("first_timers", { person_id: person.id }) : null;
    if (again) return { journey: again, created: false };
    throw error;
  }
  if (person.first_timer !== true || !person.first_visit_at) {
    await db().update("people", { id: person.id }, { first_timer: true, first_visit_at: person.first_visit_at ?? firstVisit, updated_at: now });
  }
  return { journey, created: true };
}

export async function listFirstTimers(): Promise<FirstTimerRow[]> {
  const rows = await db().list("first_timers", { order: { column: "first_visit_at", ascending: false } });
  const people = await peopleById(rows.map((r) => r.person_id));
  const serviceIds = [...new Set(rows.flatMap((r) => (r.service_id ? [r.service_id] : [])))];
  const services = new Map((serviceIds.length ? await db().list("services", { where: { id: serviceIds } }) : []).map((s) => [s.id, s]));
  return rows.flatMap((r) => {
    const person = people.get(r.person_id);
    return person ? [{ ...r, person, service: r.service_id ? services.get(r.service_id) ?? null : null }] : [];
  });
}

export async function getFirstTimer(id: string) {
  const journey = await db().get("first_timers", { id });
  if (!journey) return null;
  const [person, logs, attendance] = await Promise.all([
    db().get("people", { id: journey.person_id }),
    contactLogsFor("first_timer", id),
    db().list("attendance", { where: { person_id: journey.person_id }, order: { column: "checked_in_at", ascending: false } })
  ]);
  if (!person) return null;
  const services = new Map((attendance.length ? await db().list("services", { where: { id: attendance.map((a) => a.service_id) } }) : []).map((s) => [s.id, s]));
  const service = journey.service_id ? services.get(journey.service_id) ?? await db().get("services", { id: journey.service_id }) : null;
  return { ...journey, person, service, logs, attendance: attendance.map((a) => ({ ...a, service: services.get(a.service_id) ?? null })) };
}

/** What should happen next for this first timer, in plain words (shown in the list). */
export function nextStep(j: Pick<FirstTimer, "stage" | "first_visit_at" | "invites_sent" | "close_reason">, settings: Pick<ChurchSettings, "first_timer_auto" | "first_timer_max_invites">, now = new Date()) {
  const status = simpleStatus(j.stage);
  if (status === "removed") return { text: `Removed${j.close_reason ? ` — ${j.close_reason}` : ""}`, overdue: false };
  if (status === "came_back") return { text: "Came back 🙌", overdue: false };
  if (status === "to_call") {
    const due = new Date(new Date(j.first_visit_at).getTime() + 2 * DAY);
    return { text: `Call to welcome them (by ${formatDate(due.toISOString(), { weekday: "short", day: "numeric", month: "short" })})`, overdue: now > due };
  }
  if (settings.first_timer_auto && j.invites_sent < settings.first_timer_max_invites) {
    return { text: `Sunday invitation ${j.invites_sent + 1} of ${settings.first_timer_max_invites} goes out on Saturday`, overdue: false };
  }
  return { text: "Invite them personally for Sunday", overdue: false };
}

const STAGE_STAMP: Partial<Record<FirstTimerStage, keyof FirstTimer>> = { welcomed: "welcomed_at", returned: "returned_at", settled: "settled_at", closed: "closed_at" };

export async function updateFirstTimer(id: string, patch: Partial<Pick<FirstTimer, "stage" | "assignee" | "notes" | "close_reason">>, actor: string) {
  const current = await db().get("first_timers", { id });
  if (!current) return null;
  const now = nowIso();
  const next: Partial<FirstTimer> = { ...patch, updated_at: now };
  if (patch.stage && patch.stage !== current.stage) {
    const stamp = STAGE_STAMP[patch.stage];
    if (stamp && !current[stamp]) (next as Record<string, unknown>)[stamp] = now;
    if (patch.stage !== "closed") { next.closed_at = null; next.close_reason = null; }
    await addContactLog({ subject: "first_timer", subject_id: id, channel: "note", outcome: `Moved to ${stageLabel(patch.stage)}`, author: actor, note: patch.stage === "closed" && patch.close_reason ? patch.close_reason : null });
  }
  const [row] = await db().update("first_timers", { id }, next);
  return row;
}

export async function logFirstTimerContact(id: string, input: { channel: ContactLog["channel"]; outcome: string; note?: string | null; author: string }) {
  const journey = await db().get("first_timers", { id });
  if (!journey) return null;
  const log = await addContactLog({ subject: "first_timer", subject_id: id, channel: input.channel, outcome: input.outcome, note: input.note ?? null, author: input.author });
  const now = nowIso();
  const reached = /^reached/i.test(input.outcome);
  await db().update("first_timers", { id }, {
    last_contacted_at: now, updated_at: now,
    ...(reached && journey.stage === "new" ? { stage: "welcomed" as const, welcomed_at: journey.welcomed_at ?? now } : {}),
    ...(/joined a unit/i.test(input.outcome) && (journey.stage === "new" || journey.stage === "welcomed" || journey.stage === "returned") ? { stage: "settled" as const, settled_at: now } : {})
  });
  return log;
}

/**
 * Called on every check-in: keeps the visit count and marks a first timer as "came back" when they check in
 * to a later service (which also stops the Saturday invitations).
 */
export async function noteFirstTimerCheckIn(personId: string, checkedInAt: string, serviceTitle?: string | null) {
  const journey = await db().get("first_timers", { person_id: personId });
  if (!journey || journey.stage === "closed") return null;
  const first = new Date(journey.first_visit_at).getTime();
  const all = await db().list("attendance", { where: { person_id: personId } });
  const visits = Math.max(1, all.filter((a) => new Date(a.checked_in_at).getTime() >= first - RETURN_GAP).length);
  const now = nowIso();
  const cameBack = new Date(checkedInAt).getTime() - first >= RETURN_GAP && open(journey);
  await db().update("first_timers", { id: journey.id }, { visits, updated_at: now, ...(cameBack ? { stage: "returned" as const, returned_at: checkedInAt } : {}) });
  if (cameBack) {
    await addContactLog({
      subject: "first_timer", subject_id: journey.id, channel: "note", outcome: "Came back to church", author: FIRST_TIMER_AUTHOR,
      note: `Checked in${serviceTitle ? ` at ${serviceTitle}` : ""} — visit ${visits}. Automatic invitations stopped.`
    });
  }
  return cameBack;
}

const fill = (settings: ChurchSettings) => (text: string) => text.replaceAll("{address}", settings.address ?? "our church");

/** Sends the welcome message to these first timers (skips anyone already welcomed, or when turned off). */
export async function sendFirstTimerWelcome(items: { journey: FirstTimer; person: Person }[], settings?: ChurchSettings) {
  const s = settings ?? await getSettings();
  const due = items.filter((i) => !i.journey.welcome_sent_at && i.journey.stage !== "closed" && i.person.status === "member");
  if (!s.first_timer_auto || !due.length) return 0;
  await sendAutomaticMessage({
    subject: "first_timer", items: due.map((i) => ({ id: i.journey.id, person: i.person })), title: WELCOME_TITLE,
    // Not by email: everyone with an email already gets the "Welcome to FUJ Online Church" email with their username.
    body: s.first_timer_welcome_message?.trim() || DEFAULT_WELCOME_MESSAGE, audience: "auto_first_timer:welcome", channels: followUpChannels(s).filter((c) => c !== "email"),
    author: FIRST_TIMER_AUTHOR, outcome: "auto_welcome", note: () => "Welcome message.", personalize: fill(s)
  });
  const now = nowIso();
  for (const i of due) await db().update("first_timers", { id: i.journey.id }, { welcome_sent_at: now, updated_at: now });
  return due.length;
}

export type FirstTimerRun = { enabled: boolean; welcomed: number; invited: number; inviteDay: boolean };

/**
 * Daily job: welcome anyone who hasn't had the welcome message yet, and on Saturdays invite first timers who
 * haven't come back (at least 3 days after their first visit, at most one invitation a week, up to the limit).
 */
export async function runFirstTimerFollowUps(now = new Date()): Promise<FirstTimerRun> {
  const settings = await getSettings();
  const result: FirstTimerRun = { enabled: settings.first_timer_auto, welcomed: 0, invited: 0, inviteDay: isSaturdayInLagos(now) };
  if (!settings.first_timer_auto) return result;
  const journeys = (await db().list("first_timers")).filter(open);
  if (!journeys.length) return result;
  const people = await peopleById(journeys.map((j) => j.person_id));
  const withPerson = journeys.flatMap((j) => { const person = people.get(j.person_id); return person && person.status === "member" ? [{ journey: j, person }] : []; });

  result.welcomed = await sendFirstTimerWelcome(withPerson.filter((i) => !i.journey.welcome_sent_at && now.getTime() - new Date(i.journey.created_at).getTime() <= 7 * DAY), settings);

  if (result.inviteDay) {
    const invite = withPerson.filter(({ journey: j }) =>
      j.invites_sent < settings.first_timer_max_invites &&
      now.getTime() - new Date(j.first_visit_at).getTime() >= 3 * DAY &&
      (!j.last_invite_at || now.getTime() - new Date(j.last_invite_at).getTime() >= 5 * DAY));
    if (invite.length) {
      await sendAutomaticMessage({
        subject: "first_timer", items: invite.map((i) => ({ id: i.journey.id, person: i.person, n: i.journey.invites_sent + 1 })), title: INVITE_TITLE,
        body: settings.first_timer_invite_message?.trim() || DEFAULT_INVITE_MESSAGE, audience: "auto_first_timer:invite", channels: followUpChannels(settings),
        author: FIRST_TIMER_AUTHOR, outcome: "auto_invite", note: (i) => `Invitation ${i.n} of ${settings.first_timer_max_invites} for Sunday.`, personalize: fill(settings)
      });
      const stamp = now.toISOString();
      for (const { journey: j } of invite) await db().update("first_timers", { id: j.id }, { invites_sent: j.invites_sent + 1, last_invite_at: stamp, updated_at: nowIso() });
      result.invited = invite.length;
    }
  }
  return result;
}

export function describeFirstTimerRun(r: FirstTimerRun) {
  if (!r.enabled) return "First-timer messages are off (Settings → First timers & partners).";
  return `${r.welcomed} welcome message${r.welcomed === 1 ? "" : "s"} sent · ${r.inviteDay ? `${r.invited} Sunday invitation${r.invited === 1 ? "" : "s"} sent` : "Sunday invitations go out on Saturdays"}.`;
}
