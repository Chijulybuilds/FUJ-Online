import "server-only";
import { db, DuplicateError } from "@/lib/db";
import type { Person } from "@/lib/db/types";
import { env } from "@/lib/env";
import { emailAttempt, providers } from "@/lib/messaging/providers";
import { passwordResetEmail, welcomeEmail } from "@/lib/messaging/welcome-email";
import { createPasswordToken, hashPassword, passwordProblem, readPasswordToken, verifyPassword } from "@/lib/auth/password";
import { parsePrograms } from "@/lib/programs";
import { nowIso } from "@/lib/utils";
import { findByEmail, findByUsername, FriendlyError } from "./people";
import { getPublicSettings } from "./settings";

const DAY = 86400000;
export const WELCOME_LINK_TTL = 30 * DAY;
export const RESET_LINK_TTL = 2 * 3600000;
/** Resend allows 2 emails a second (free plan: 100 a day), so batches are small and paced. */
export const WELCOME_BATCH = 40;
const PACE_MS = 600;

const firstName = (p: Person) => p.full_name.trim().split(/\s+/)[0];
const link = (path: string) => `${env.appUrl.replace(/\/+$/, "")}${path}`;

async function church() {
  const s = await getPublicSettings();
  return { churchName: s.church_name, siteUrl: env.appUrl, motto: s.tagline, address: s.address, phone: s.contact_phone, email: s.contact_email, programs: parsePrograms(s.service_times), replyTo: s.contact_email };
}

/* ------------------------------------------------------------------ passwords */
export async function credentialFor(personId: string) {
  return db().get("member_credentials", { person_id: personId }).catch(() => null);
}
/** Changes whenever the password is set, so old "set your password" links stop working. */
const versionOf = (c: { updated_at: string } | null) => c?.updated_at ?? "none";

export async function setPassword(personId: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new FriendlyError(problem);
  const hash = await hashPassword(password);
  const now = nowIso();
  const existing = await credentialFor(personId);
  if (existing) await db().update("member_credentials", { person_id: personId }, { password_hash: hash, updated_at: now });
  else {
    try { await db().insert("member_credentials", { person_id: personId, password_hash: hash, updated_at: now }); }
    catch (error) { if (error instanceof DuplicateError) await db().update("member_credentials", { person_id: personId }, { password_hash: hash, updated_at: now }); else throw error; }
  }
}

/** Username (or email) + password → the member, or null. */
export async function signInWithPassword(login: string, password: string) {
  const key = login.trim();
  const person = key.includes("@") ? await findByEmail(key) : await findByUsername(key);
  const credential = person ? await credentialFor(person.id) : null;
  // Always run one scrypt so a wrong username takes as long as a wrong password.
  const ok = await verifyPassword(password, credential?.password_hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  return person && credential && ok ? person : null;
}

export async function passwordLinkFor(person: Person, kind: "welcome" | "reset") {
  const token = createPasswordToken(person.id, versionOf(await credentialFor(person.id)), kind, kind === "welcome" ? WELCOME_LINK_TTL : RESET_LINK_TTL);
  return link(`/set-password?token=${token}`);
}

/** Checks a "set your password" link. */
export async function checkPasswordLink(token: string | null | undefined) {
  const payload = readPasswordToken(token);
  if (!payload) return { ok: false as const, reason: "invalid" as const };
  if (payload.e < Date.now()) return { ok: false as const, reason: "expired" as const };
  const person = await db().get("people", { id: payload.p }).catch(() => null);
  if (!person) return { ok: false as const, reason: "invalid" as const };
  if (versionOf(await credentialFor(person.id)) !== payload.v) return { ok: false as const, reason: "used" as const };
  return { ok: true as const, person };
}

/** "Forgot password": emails a link if we have an email for that username / email (never says whether we do). */
export async function sendPasswordReset(login: string) {
  const key = login.trim();
  if (!key) return false;
  const person = key.includes("@") ? await findByEmail(key) : await findByUsername(key);
  if (!person?.email || !person.username) return false;
  const c = await church();
  const mail = passwordResetEmail({ firstName: firstName(person), username: person.username, url: await passwordLinkFor(person, "reset") }, c);
  return (await emailAttempt(person.email, mail.subject, mail.text, { html: mail.html, replyTo: c.replyTo })).status === "sent";
}

/* ------------------------------------------------------------------ welcome email */
export type WelcomeResult = { status: "sent" | "failed" | "skipped"; detail?: string };

/**
 * "Welcome to FlagUpJesus Global Connect" with their flag username and a link to set a password. Sent once per person
 * (pass force to send again); skipped without an email address or when email isn't set up.
 */
export async function sendWelcomeEmail(person: Person, opts: { force?: boolean; churchInfo?: Awaited<ReturnType<typeof church>> } = {}): Promise<WelcomeResult> {
  if (!person.email || !person.username) return { status: "skipped", detail: "No email address." };
  if (person.welcome_email_sent_at && !opts.force) return { status: "skipped", detail: "Already sent." };
  if (!providers.email) return { status: "skipped", detail: "Email isn't set up yet (RESEND_API_KEY / EMAIL_FROM)." };
  const c = opts.churchInfo ?? await church();
  const credential = await credentialFor(person.id);
  const mail = welcomeEmail({
    firstName: firstName(person), username: person.username, setPasswordUrl: await passwordLinkFor(person, "welcome"),
    dashboardUrl: link("/login"), hasPassword: Boolean(credential), parentsPhone: Boolean(person.is_child)
  }, c);
  const attempt = await emailAttempt(person.email, mail.subject, mail.text, { html: mail.html, replyTo: c.replyTo });
  if (attempt.status === "sent") await db().update("people", { id: person.id }, { welcome_email_sent_at: nowIso(), updated_at: nowIso() });
  return attempt;
}

/** Members with an email who haven't had the welcome email yet (oldest registrations first). */
export async function welcomePending() {
  return (await db().list("people", { order: { column: "created_at" } })).filter((p) => p.status === "member" && p.email && p.username && !p.welcome_email_sent_at);
}

export async function welcomeStats() {
  const people = (await db().list("people")).filter((p) => p.status === "member");
  return {
    sent: people.filter((p) => p.welcome_email_sent_at).length,
    pending: people.filter((p) => p.email && !p.welcome_email_sent_at).length,
    noEmail: people.filter((p) => !p.email).length
  };
}

export type BacklogResult = { sent: number; failed: number; remaining: number; stoppedBecause?: string; emailReady: boolean };

/**
 * Sends the welcome email to members who registered before it existed (or whose email failed), a small paced batch
 * at a time: from Settings → Welcome emails ("Send now") and every day with the automatic job. Stops at the first
 * failure (usually an email setup problem) so it doesn't hammer the provider.
 */
export async function sendWelcomeBacklog(limit = WELCOME_BATCH, pace = PACE_MS): Promise<BacklogResult> {
  const pending = await welcomePending();
  const result: BacklogResult = { sent: 0, failed: 0, remaining: pending.length, emailReady: providers.email };
  if (!providers.email || !pending.length) return result;
  const c = await church();
  for (const person of pending.slice(0, limit)) {
    const r = await sendWelcomeEmail(person, { churchInfo: c });
    if (r.status === "sent") { result.sent++; result.remaining--; }
    else if (r.status === "failed") { result.failed++; result.stoppedBecause = r.detail ?? "The email provider refused the message."; break; }
    if (pace) await new Promise((resolve) => setTimeout(resolve, pace));
  }
  return result;
}

export function describeBacklog(r: BacklogResult) {
  if (!r.emailReady) return "Email isn't set up yet — add RESEND_API_KEY and EMAIL_FROM (Settings → Messaging channels).";
  const parts = [`${r.sent} welcome email${r.sent === 1 ? "" : "s"} sent`];
  if (r.stoppedBecause) parts.push(`stopped: ${r.stoppedBecause}`);
  parts.push(r.remaining ? `${r.remaining} still to send (the daily job continues, or click again)` : "everyone with an email has it now 🎉");
  return parts.join(" · ") + ".";
}
