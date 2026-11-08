"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireMember } from "@/lib/auth/session";
import { markRead, respond } from "@/lib/repo/messaging";
import { submitTestimony } from "@/lib/repo/content";
import { FriendlyError, updatePerson } from "@/lib/repo/people";
import { db } from "@/lib/db";
import { addPartner, sendPartnerThanks } from "@/lib/repo/partners";
import { credentialFor, sendWelcomeEmail, setPassword } from "@/lib/repo/accounts";
import { verifyPassword } from "@/lib/auth/password";

type State = { ok?: boolean; message?: string } | null;
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function markReadAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  await markRead(str(fd, "id"), me.personId);
  revalidatePath("/member", "layout");
  return null;
}

export async function respondAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  const text = str(fd, "response");
  if (text.length < 1) return { ok: false, message: "Write a response first." };
  if (text.length > 1000) return { ok: false, message: "Please keep your response under 1000 characters." };
  const row = await respond(str(fd, "id"), me.personId, text);
  if (!row) return { ok: false, message: "Message not found." };
  revalidatePath("/member", "layout");
  return { ok: true, message: "Thank you — your response was sent to the church team." };
}

export async function submitTestimonyAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  const title = str(fd, "title"); const body = str(fd, "body");
  if (title.length < 3 || body.length < 20) return { ok: false, message: "Add a short title and at least a couple of sentences." };
  await submitTestimony({ person_id: me.personId, title: title.slice(0, 140), body: body.slice(0, 5000), consent_to_publish: fd.get("consent") === "on" });
  revalidatePath("/member/testimonies");
  return { ok: true, message: "Thank you for sharing! Your testimony will appear once the pastoral team reviews it." };
}

export async function updateProfileAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  try {
    const email = str(fd, "email");
    await updatePerson(me.personId, { phone: str(fd, "phone"), email: email || null, address: str(fd, "address") || null, birthday: str(fd, "birthday") || null });
  } catch (error) {
    return { ok: false, message: error instanceof FriendlyError ? error.message : "Could not update your profile." };
  }
  revalidatePath("/member/profile");
  return { ok: true, message: "Profile updated." };
}

export async function myPrayerCloseAction(fd: FormData) {
  const me = await requireMember();
  const row = await db().get("prayer_requests", { id: str(fd, "id"), person_id: me.personId });
  if (row) await db().update("prayer_requests", { id: row.id }, { status: str(fd, "status") === "answered" ? "answered" : "closed", updated_at: new Date().toISOString() });
  revalidatePath("/member/prayer-requests");
}

/** "Become a FUJ Partner" from the member portal (Giving page). */
export async function becomePartnerAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  const raw = str(fd, "pledge_amount").replace(/[,₦\s]/g, "");
  const amount = raw ? Number(raw) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return { ok: false, message: "Enter the amount in naira, or leave it empty." };
  const frequency = ["monthly", "quarterly", "yearly", "one_off"].includes(str(fd, "frequency")) ? str(fd, "frequency") as "monthly" | "quarterly" | "yearly" | "one_off" : null;
  try {
    const { partner, person, created } = await addPartner({ personId: me.personId, source: "portal", pledge_amount: amount, frequency: amount ? frequency ?? "monthly" : frequency });
    if (!created && amount && !partner.pledge_amount) await db().update("partners", { id: partner.id }, { pledge_amount: amount, frequency: frequency ?? "monthly", status: partner.status === "interested" || partner.status === "contacted" ? "committed" : partner.status, updated_at: new Date().toISOString() });
    if (created) after(() => sendPartnerThanks([{ partner, person }]).then(() => undefined, (error) => console.error("partner thank-you failed", error)));
  } catch (error) {
    if (error instanceof FriendlyError) return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  revalidatePath("/member/giving");
  return { ok: true, message: "Thank you for partnering with us! 💛 Our partnership team will reach out to you." };
}


/** Profile → Password: set one (or change it — the current password is needed then). */
export async function setOwnPasswordAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember();
  const password = String(fd.get("password") ?? ""); const confirm = String(fd.get("confirm") ?? "");
  if (password !== confirm) return { ok: false, message: "The two passwords don't match." };
  const existing = await credentialFor(me.personId);
  if (existing && !(await verifyPassword(String(fd.get("current") ?? ""), existing.password_hash))) return { ok: false, message: "Your current password isn't right." };
  try {
    await setPassword(me.personId, password);
  } catch (error) {
    if (error instanceof FriendlyError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/member/profile");
  return { ok: true, message: existing ? "Password changed. 🔐" : "Password set! You can now sign in with your username (or email) and password. 🔐" };
}

/** Profile → "Email me my username": the welcome email again (with the set-a-password link if they have none). */
export async function emailMyUsernameAction(): Promise<State> {
  const me = await requireMember();
  const person = await db().get("people", { id: me.personId });
  if (!person?.email) return { ok: false, message: "Add your email address above first." };
  const r = await sendWelcomeEmail(person, { force: true });
  return r.status === "sent" ? { ok: true, message: `Sent to ${person.email} — check your inbox (and spam folder).` } : { ok: false, message: r.status === "skipped" ? "Email isn't available right now. Please try again later." : "We couldn't send the email. Please try again later." };
}
