import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOCAL_DB_PATH = join(mkdtempSync(join(tmpdir(), "fuj-welcome-")), "db.json");
process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
process.env.NEXT_PUBLIC_APP_URL = "https://www.flagupjesus.org";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

type Mail = { to: string; subject: string; text: string; html: string; reply_to?: string };
const mails: Mail[] = [];
let failNext = false;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("resend")) {
    if (failNext) { failNext = false; return new Response(JSON.stringify({ message: "The flagupjesus.org domain is not verified." }), { status: 403 }); }
    mails.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ id: `email-${mails.length}` }), { status: 200 });
  }
  return new Response("{}", { status: 200 });
});

const { db } = await import("../../src/lib/db");
const people = await import("../../src/lib/repo/people");
const accounts = await import("../../src/lib/repo/accounts");
const tokenFrom = (mail: Mail) => /\/set-password\?token=([\w.-]+)/.exec(mail.text)?.[1] ?? null;

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "FlagUpJesus <news@flagupjesus.org>" });
});
afterAll(() => vi.unstubAllGlobals());

describe("welcome email with the flag username", () => {
  it("sends a warm welcome with the username and a set-password link, once", async () => {
    const ada = await people.createPerson({ full_name: "Ada Obi", phone: "08070000001", email: "ada@example.com" });
    const r = await accounts.sendWelcomeEmail(ada);
    expect(r.status).toBe("sent");
    const mail = mails.at(-1)!;
    expect(mail.to).toBe("ada@example.com");
    expect(mail.subject).toBe("Welcome to FlagUpJesus Global Connect, Ada! Your flag username is inside 🎉");
    expect(mail.text).toContain(`YOUR FLAG USERNAME: ${ada.username}`);
    expect(mail.text).toContain("Welcome to the FlagUpJesus family");
    expect(mail.html).toContain(ada.username);
    expect(mail.html).toContain("Set my password");
    expect(mail.text).toContain("https://www.flagupjesus.org/set-password?token=");
    expect(mail.reply_to).toBe("flagupjesusglobal@gmail.com");
    expect((await db().get("people", { id: ada.id }))!.welcome_email_sent_at).not.toBeNull();
    expect((await accounts.sendWelcomeEmail((await db().get("people", { id: ada.id }))!)).status).toBe("skipped"); // only once
    expect((await accounts.sendWelcomeEmail((await db().get("people", { id: ada.id }))!, { force: true })).status).toBe("sent"); // unless asked
  });

  it("the link sets a password once; then they can sign in with username or email", async () => {
    const ada = (await people.findByPhone("08070000001"))!;
    const token = tokenFrom(mails.at(-1)!);
    const link = await accounts.checkPasswordLink(token);
    expect(link.ok && link.person.id).toBe(ada.id);
    await expect(accounts.setPassword(ada.id, "short")).rejects.toThrow(/at least 8/);
    await accounts.setPassword(ada.id, "Jesus is Lord!");
    expect((await accounts.checkPasswordLink(token)).ok).toBe(false); // used
    expect(await accounts.checkPasswordLink(token)).toMatchObject({ reason: "used" });
    expect((await accounts.signInWithPassword(ada.username!, "Jesus is Lord!"))?.id).toBe(ada.id);
    expect((await accounts.signInWithPassword("ADA@example.com", "Jesus is Lord!"))?.id).toBe(ada.id);
    expect(await accounts.signInWithPassword(ada.username!, "wrong password")).toBeNull();
    expect(await accounts.signInWithPassword("flagnobody999", "Jesus is Lord!")).toBeNull();
    // The hash is stored apart from the person record.
    expect(JSON.stringify(await db().get("people", { id: ada.id }))).not.toContain("scrypt");
    // A member who already has a password gets a welcome email without the "set my password" button.
    await accounts.sendWelcomeEmail((await db().get("people", { id: ada.id }))!, { force: true });
    expect(mails.at(-1)!.html).not.toContain("Set my password");
  });

  it("forgot password emails a 2-hour link (and says nothing about unknown accounts)", async () => {
    const before = mails.length;
    expect(await accounts.sendPasswordReset("ada@example.com")).toBe(true);
    expect(mails.length).toBe(before + 1);
    expect(mails.at(-1)!.subject).toBe("Set a new password for your FlagUpJesus dashboard");
    const link = await accounts.checkPasswordLink(tokenFrom(mails.at(-1)!));
    expect(link.ok).toBe(true);
    expect(await accounts.sendPasswordReset("nobody@example.com")).toBe(false);
    expect(mails.length).toBe(before + 1);
  });

  it("people who registered earlier get theirs in paced batches; it stops at a provider error", async () => {
    for (let i = 2; i <= 6; i++) await people.createPerson({ full_name: `Member ${i}`, phone: `0807000000${i}`, email: `m${i}@example.com` });
    await people.createPerson({ full_name: "No Email", phone: "08070000009" });
    expect(await accounts.welcomeStats()).toMatchObject({ sent: 1, pending: 5, noEmail: 1 });
    failNext = true;
    const stopped = await accounts.sendWelcomeBacklog(10, 0);
    expect(stopped).toMatchObject({ sent: 0, failed: 1, remaining: 5 });
    expect(accounts.describeBacklog(stopped)).toMatch(/domain is not verified/);
    const first = await accounts.sendWelcomeBacklog(3, 0);
    expect(first).toMatchObject({ sent: 3, remaining: 2 });
    expect(accounts.describeBacklog(first)).toMatch(/2 still to send/);
    const rest = await accounts.sendWelcomeBacklog(10, 0);
    expect(rest).toMatchObject({ sent: 2, remaining: 0 });
    expect(accounts.describeBacklog(rest)).toMatch(/everyone with an email has it now/);
    expect(await accounts.welcomeStats()).toMatchObject({ sent: 6, pending: 0, noEmail: 1 });
  });

  it("under-18s on a parent's phone are told to sign in with that number; links expire", async () => {
    const parent = await people.createPerson({ full_name: "Funke Adeyemi", phone: "08070000010" });
    const child = await people.createPerson({ full_name: "Tobi Adeyemi", phone: "08070000010", email: "funke.family@example.com", is_child: true, guardian_id: parent.id, birthday: "2019-05-04" });
    await accounts.sendWelcomeEmail(child);
    expect(mails.at(-1)!.text).toContain("your username and your parent's or guardian's phone number");
    const { createPasswordToken } = await import("../../src/lib/auth/password");
    expect(await accounts.checkPasswordLink(createPasswordToken(child.id, "none", "welcome", -1000))).toMatchObject({ ok: false, reason: "expired" });
    expect(await accounts.checkPasswordLink("abc.def")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("does nothing (and loses nothing) while email isn't set up", async () => {
    delete process.env.RESEND_API_KEY;
    const p = await people.createPerson({ full_name: "Later Larry", phone: "08070000011", email: "larry@example.com" });
    expect((await accounts.sendWelcomeEmail(p)).status).toBe("skipped");
    const r = await accounts.sendWelcomeBacklog(10, 0);
    expect(r).toMatchObject({ emailReady: false, sent: 0, remaining: 1 });
    expect(accounts.describeBacklog(r)).toMatch(/Email isn't set up yet/);
    process.env.RESEND_API_KEY = "re_test";
  });
});
