import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * End-to-end journey against the local JSON store (seeded demo data):
 * staff opens QR check-in → first-timer registers from the QR → returning member checks in by username →
 * broadcast + read/response tracking → follow-up broadcast → testimony moderation → prayer → pastoral care → roles.
 */
test.describe.configure({ mode: "serial" });

const SHOTS = process.env.E2E_SCREENSHOTS;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

/** Navigate and wait until React has hydrated, so clicks reach server-action handlers. */
async function go(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
}
async function hydrated(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLFormElement>("form[data-action-form]")].every((f) => f.dataset.ready === "true"));
}

/** The shared FUJ admin login at /admin/login (email + password + optional name). */
async function staffLogin(page: Page) {
  await go(page, "/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Admin email").fill("admin@flagupjesus.org");
  await page.getByLabel("Password", { exact: true }).fill("E2E-shared-admin-pass-2026");
  await page.getByLabel(/Your name/).fill("Church Usher");
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await page.waitForURL(/\/admin$/);
}

/** Individual staff account (stands in for Google sign-in in tests). */
async function devStaffLogin(page: Page, email: string) {
  await go(page, "/admin/login");
  await page.getByText("Developer sign-in (no Google)").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function memberLogin(page: Page, username: string, phone: string) {
  await go(page, "/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/member$/);
  await hydrated(page);
}

let admin: Page;
let serviceUrl = "";
let newUsername = "";

async function currentQrUrl() {
  await go(admin, serviceUrl.replace(/\/admin\/services\/(.+)$/, "/admin/attendance/display?service=$1"));
  const img = admin.getByTestId("qr-image");
  await expect(img).toBeVisible();
  return (await img.getAttribute("data-url"))!;
}

async function newDevice(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (process.env.DEBUG_NET) {
    page.on("response", async (r) => {
      if (r.request().method() !== "POST") return;
      const body = await r.text().catch(() => "");
      console.log("[net]", r.request().method(), r.url().replace(/^http:\/\/localhost:\d+/, ""), r.status(), JSON.stringify(r.headers()["x-action-redirect"] ?? ""), body.length, JSON.stringify(body.slice(0, 160)));
    });
    page.on("requestfailed", (r) => console.log("[net-failed]", r.url().replace(/^http:\/\/localhost:\d+/, ""), r.failure()?.errorText));
    page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 300)); });
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("[nav]", f.url()); });
  }
  return page;
}

test("landing page renders with motion sections and accepts a guest prayer request", async ({ page }) => {
  await go(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Raise the flag.");
  await expect(page.getByText("Service", { exact: false }).first()).toBeVisible();
  await expect(page.locator(".lp-count")).toBeVisible(); // countdown to next seeded service
  await shot(page, "01-landing-hero");
  await page.locator("#prayer").scrollIntoViewIfNeeded();
  await page.getByLabel("Your name").fill("Visitor Tunde");
  await page.getByLabel("Prayer request").fill("Please pray for my family's travel this week.");
  await page.getByRole("button", { name: "Send prayer request" }).click();
  await expect(page.getByTestId("prayer-sent")).toBeVisible();
  await page.locator("#testimonies").scrollIntoViewIfNeeded();
  await expect(page.getByText("God provided a new job")).toBeVisible();
  await shot(page, "02-landing-testimonies");
});

test("staff creates a service and opens a rotating QR check-in", async ({ browser }) => {
  admin = await newDevice(browser);
  await staffLogin(admin);
  await expect(admin.getByRole("heading", { name: /Welcome, Church/ })).toBeVisible();
  await shot(admin, "03-admin-dashboard");
  await go(admin, "/admin/services/new");
  const now = new Date(Date.now() + 3600_000 + 5 * 60_000); // Lagos = UTC+1
  await admin.getByLabel("Service name").fill("E2E Sunday Service");
  await admin.getByLabel("Starts").fill(now.toISOString().slice(0, 16));
  await admin.getByRole("button", { name: "Create service" }).click();
  await admin.waitForURL(/\/admin\/services\/[0-9a-f-]{36}$/);
  serviceUrl = admin.url();
  await admin.getByRole("button", { name: /Open check-in/ }).click();
  await admin.waitForURL(/attendance\/display/);
  await expect(admin.getByTestId("qr-image")).toBeVisible();
  await expect(admin.getByText(/New code in \d+s/)).toBeVisible();
  await shot(admin, "04-qr-display");
  // The token must rotate: fetch two tokens via the staff API and compare.
  const sid = serviceUrl.split("/").pop();
  const a = await (await admin.request.get(`/api/attendance/token?serviceId=${sid}`)).json();
  await admin.waitForTimeout(1100);
  const b = await (await admin.request.get(`/api/attendance/token?serviceId=${sid}`)).json();
  expect(a.token).not.toEqual(b.token);
  expect(a.expiresIn).toBeLessThanOrEqual(20);
});

test("QR token API is staff-only", async ({ request }) => {
  const res = await request.get("/api/attendance/token");
  expect(res.status()).toBe(401);
});

test("a first-timer scans the QR, registers, gets a flag username and is checked in", async ({ browser }) => {
  const phone = await newDevice(browser);
  await go(phone, await currentQrUrl());
  await expect(phone.getByTestId("checkin-service")).toHaveText("E2E Sunday Service");
  await expect(phone).toHaveURL(/\/check-in$/); // token stripped from the URL
  await shot(phone, "05-checkin-scanned");
  await phone.getByRole("link", { name: "Register now" }).click();
  await expect(phone.getByText(/checked in to E2E Sunday Service automatically/)).toBeVisible();
  // Registration is just name + phone (+ optional email). No paid SMS OTP: scanning the live QR verifies them in person.
  await expect(phone.getByLabel("Email (optional)")).toBeVisible();
  await expect(phone.getByLabel("Gender")).toHaveCount(0);
  await expect(phone.getByLabel("Verification code")).toHaveCount(0);
  await phone.getByLabel("Full name").fill("Chiamaka Nwankwo");
  await phone.getByLabel("Phone number").fill("0812 345 6789");
  await phone.getByRole("button", { name: "Register & get my username" }).click();
  await expect(phone.getByTestId("register-success")).toBeVisible();
  newUsername = (await phone.getByTestId("new-username").textContent())!.trim();
  expect(newUsername).toMatch(/^flagchiamaka\d{3}$/);
  await expect(phone.getByText(/checked in for today/)).toBeVisible();
  await shot(phone, "06-register-success");
  await phone.getByRole("link", { name: "Go to my portal" }).click();
  await expect(phone.getByTestId("portal-username")).toHaveText(newUsername);
  await phone.context().close();
});

test("a returning member checks in with just their username (no OTP), once per service, one person per phone", async ({ browser }) => {
  const phone = await newDevice(browser);
  await go(phone, await currentQrUrl());
  await phone.getByLabel("Username").fill("FlagGrace101");
  await phone.getByRole("button", { name: "Check in" }).click();
  await expect(phone.getByTestId("checkin-done")).toContainText("Welcome, Grace!");
  await shot(phone, "07-checkin-done");
  // same device, scan again → already checked in
  await go(phone, await currentQrUrl());
  await expect(phone.getByTestId("checkin-done")).toContainText("already checked in");
  // the same phone cannot check in somebody else
  await phone.request.post("/api/check-in/scan", { data: { token: new URL(await currentQrUrl()).searchParams.get("t") } });
  const res = await phone.request.post("/api/check-in/confirm", { data: { username: "flagdavid102" } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatch(/already been used/);
  await phone.context().close();

  // unknown username on a fresh device
  const other = await newDevice(browser);
  await go(other, await currentQrUrl());
  await other.getByLabel("Username").fill("flagnobody999");
  await other.getByRole("button", { name: "Check in" }).click();
  await expect(other.getByTestId("checkin-message")).toContainText("couldn't find that username");
  await other.context().close();
});

test("expired or forged QR codes are rejected", async ({ page }) => {
  await go(page, "/check-in?t=eyJmYWtlIjp0cnVlfQ.forged");
  await expect(page.getByTestId("checkin-error")).toContainText("expired");
  const res = await page.request.post("/api/check-in/confirm", { data: { username: "flaggrace101" } });
  expect(res.status()).toBe(401);
});

test("usher can check someone in manually and attendance shows on the service", async () => {
  await go(admin, serviceUrl);
  await admin.getByLabel("Person").fill("flagesther105");
  await admin.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(admin.getByText("Esther Bello checked in.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByRole("heading", { name: /Attendance \(3\)/ })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Chiamaka Nwankwo" })).toBeVisible();
  await shot(admin, "08-service-attendance");
});

test("check-in desk: admin finds members by name and checks them in; adds a first-timer", async () => {
  const sid = serviceUrl.split("/").pop();
  await go(admin, `/admin/attendance/desk?service=${sid}`);
  await expect(admin.getByTestId("desk-total")).toHaveText("3 checked in");
  await admin.getByLabel("Search member").fill("david");
  const row = admin.getByTestId("desk-row").filter({ hasText: "David Nwosu" });
  await row.getByRole("button", { name: "Check in" }).click();
  await expect(admin.getByText("David Nwosu checked in ✓")).toBeVisible();
  await expect(admin.getByTestId("desk-total")).toHaveText("4 checked in");
  await admin.getByLabel("Search member").fill("david");
  await expect(admin.getByTestId("desk-row").filter({ hasText: "David Nwosu" }).getByRole("button", { name: "Check in" })).toHaveCount(0);
  await admin.getByLabel("First-timer full name").fill("Kelechi Amadi");
  await admin.getByLabel("First-timer phone").fill("0818 765 4321");
  await admin.getByRole("button", { name: "Add & check in" }).click();
  await expect(admin.getByText(/Welcome Kelechi! Added as a first-timer \(username flagkelechi\d{3}\)/)).toBeVisible();
  await expect(admin.getByTestId("desk-total")).toHaveText("5 checked in");
  await shot(admin, "08b-checkin-desk");
});

test("online self-registration is free and stays 'unverified' until seen in church; contacts export for WhatsApp", async ({ browser }) => {
  const p = await newDevice(browser);
  await go(p, "/register");
  await p.getByLabel("Full name").fill("Obinna Online");
  await p.getByLabel("Phone number").fill("0705 111 2222");
  await p.getByRole("button", { name: "Register & get my username" }).click();
  await expect(p.getByTestId("register-success")).toBeVisible();
  await p.context().close();

  await go(admin, "/admin/members?status=unverified");
  await admin.getByRole("link", { name: "Obinna Online" }).click();
  await expect(admin.getByTestId("verified-state")).toContainText("Not yet");
  await admin.getByRole("button", { name: "Mark verified" }).click();
  await expect(admin.getByTestId("verified-state")).toContainText("confirmed by an admin");

  const vcf = await admin.request.get("/api/admin/export?type=vcf");
  expect(vcf.headers()["content-type"]).toContain("text/vcard");
  const text = await vcf.text();
  expect(text).toContain("FN:Obinna Online (FUJ)");
  expect(text).toContain("TEL;TYPE=CELL:+2347051112222");
});

test("broadcast with response tracking, member replies, follow-up to non-responders", async ({ browser }) => {
  await go(admin, "/admin/messaging");
  await admin.getByLabel("Audience").selectOption("members");
  await expect(admin.getByTestId("audience-count")).toContainText("recipient");
  await admin.getByLabel("Title").fill("Thanksgiving Sunday");
  await admin.getByRole("textbox", { name: /^Message/ }).fill("Hi {first_name}, will you join us for Thanksgiving Sunday? Reply yes!");
  await admin.getByLabel("Flyer image").setInputFiles("public/images/fuj/outreach-children.webp");
  await expect(admin.getByTestId("flyer-preview")).toBeVisible();
  await admin.getByRole("button", { name: "Send broadcast" }).click();
  await admin.waitForURL(/\/admin\/messaging\/[0-9a-f-]{36}\?sent=1/);
  const trackingUrl = admin.url().split("?")[0];
  await expect(admin.getByText(/Sent to \d+ people in the member portal/)).toBeVisible();
  // Free WhatsApp distribution: flyer + group-friendly text ready to share.
  const share = admin.getByTestId("share-whatsapp");
  await expect(share.getByRole("img", { name: "Flyer" })).toBeVisible();
  await expect(share.getByTestId("share-text")).toContainText("Hi family, will you join us");
  await expect(share.getByRole("button", { name: "Share on WhatsApp" })).toBeVisible();
  await expect(admin.getByTestId("recipient-row").filter({ hasText: "Grace Okafor" }).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/2348031234567\?text=Hi%20Grace/);
  await shot(admin, "09b-share-whatsapp");

  const member = await newDevice(browser);
  await memberLogin(member, "flaggrace101", "08031234567");
  await expect(member.getByText(/unread message/)).toBeVisible();
  await go(member, "/member/messages");
  const msg = member.getByTestId("member-message").filter({ hasText: "Thanksgiving Sunday" });
  await msg.getByRole("button", { name: "Read message" }).click();
  await expect(member.getByText("Hi Grace, will you join us")).toBeVisible();
  const flyer = member.getByTestId("member-flyer");
  await expect(flyer).toBeVisible();
  expect(await flyer.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await member.getByLabel("Reply").first().fill("Yes! Coming with my family.");
  await member.getByRole("button", { name: "Reply" }).first().click();
  await expect(member.getByText("your response was sent")).toBeVisible();
  await shot(member, "09-member-messages");

  await go(admin, trackingUrl);
  const graceRow = admin.getByTestId("recipient-row").filter({ hasText: "Grace Okafor" });
  await expect(graceRow).toContainText("Yes! Coming with my family.");
  await expect(graceRow).toContainText("read");
  await shot(admin, "10-broadcast-tracking");
  await go(admin, `${trackingUrl}?filter=unresponded`);
  await expect(admin.getByTestId("recipient-row").filter({ hasText: "Grace Okafor" })).toHaveCount(0);

  // follow-up broadcast to non-responders
  await admin.getByLabel("Title").fill("Reminder: Thanksgiving Sunday");
  await admin.getByRole("textbox", { name: /^Message/ }).fill("Hi {first_name}, just a reminder — we'd love to see you!");
  await admin.getByRole("button", { name: "Send broadcast" }).click();
  await admin.waitForURL(/sent=1/);
  await expect(admin.getByRole("link", { name: "Grace Okafor" })).toHaveCount(0);
  await go(admin, trackingUrl);
  await expect(admin.getByText("Reminder: Thanksgiving Sunday")).toBeVisible();
  await admin.getByRole("button", { name: "Create care tasks" }).click();
  await expect(admin.getByText(/Created \d+ follow-up task/)).toBeVisible();

  await go(admin, "/admin/inbox");
  await expect(admin.getByText("Yes! Coming with my family.")).toBeVisible();

  // testimony from member → moderation → published on landing
  await go(member, "/member/testimonies");
  await member.getByLabel("Title").fill("Healed of a long illness");
  await member.getByLabel("Testimony").fill("For two years I struggled with my health and this year God restored me completely. Glory to God!");
  await member.getByRole("button", { name: "Submit testimony" }).click();
  await expect(member.getByText("Thank you for sharing!")).toBeVisible();
  await go(member, "/member/prayer-requests");
  await member.getByLabel("Prayer request").fill("Pray for my exams next month.");
  await member.getByLabel("Who can see this").selectOption("public");
  await member.getByRole("button", { name: "Send prayer request" }).click();
  await expect(member.getByTestId("prayer-sent")).toBeVisible();
  await member.context().close();

  await go(admin, "/admin/testimonies");
  const card = admin.getByTestId("testimony-card").filter({ hasText: "Healed of a long illness" });
  await card.getByRole("button", { name: "Publish" }).click();
  await expect(card).toHaveCount(0); // leaves the "To review" queue
  await go(admin, "/admin/testimonies?status=published");
  await expect(admin.getByTestId("testimony-card").filter({ hasText: "Healed of a long illness" })).toContainText("published");
  const landing = await newDevice(browser);
  await go(landing, "/");
  await expect(landing.getByText("Healed of a long illness")).toBeVisible();
  await landing.context().close();
});

test("prayer requests are moderated and can go on the prayer wall only with consent", async () => {
  await go(admin, "/admin/prayer-requests");
  await expect(admin.getByText("Please pray for my family's travel this week.")).toBeVisible();
  const card = admin.getByTestId("prayer-card").filter({ hasText: "Pray for my exams next month." });
  await card.getByLabel("Status").selectOption("praying");
  await card.getByLabel("Show on prayer wall").check();
  await card.getByRole("button", { name: "Update" }).click();
  await expect(card).toHaveCount(0); // moved from "New" to "Praying"
  await go(admin, "/admin/prayer-requests?status=praying");
  await expect(admin.getByTestId("prayer-card").filter({ hasText: "Pray for my exams next month." })).toContainText("On prayer wall");
  await go(admin, "/admin/prayer-requests");
  await expect(admin.getByTestId("prayer-card").filter({ hasText: "Please pray for my family" }).getByLabel("Show on prayer wall")).toHaveCount(0);
  await shot(admin, "11-prayer-moderation");
});

test("pastoral care: absence analysis flags absentees and contact can be logged", async () => {
  await go(admin, "/admin/pastoral-care");
  await admin.getByRole("button", { name: "Run absence analysis" }).click();
  await expect(admin.getByText(/Created \d+ absentee/)).toBeVisible();
  await go(admin, "/admin/pastoral-care?cat=absentee");
  await admin.getByRole("link", { name: "Samuel James" }).first().click();
  await admin.getByLabel("Note", { exact: true }).fill("Called — he was travelling, will be back next Sunday.");
  await admin.getByRole("button", { name: "Log contact" }).click();
  await expect(admin.getByText("Contact logged.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("Called — he was travelling")).toBeVisible();
  await shot(admin, "12-care-task");
});

test("announcements publish to the member portal and landing page", async ({ browser }) => {
  await go(admin, "/admin/announcements");
  await admin.getByLabel("Title").fill("Youth Conference 2026");
  await admin.getByLabel("Body").fill("All youths are invited to our conference on the 20th. Registration is free!");
  await admin.getByLabel("Also broadcast when publishing").check();
  await admin.getByRole("button", { name: "Publish", exact: true }).first().click();
  await expect(admin.getByText(/Announcement published\. Broadcast to \d+ people/)).toBeVisible();
  const p = await newDevice(browser);
  await go(p, "/");
  await expect(p.getByText("Youth Conference 2026")).toBeVisible();
  await p.context().close();
});

test("role-based access: finance cannot see prayer requests; staff list is enforced", async ({ browser }) => {
  const finance = await newDevice(browser);
  await devStaffLogin(finance, "finance@flagupjesus.local");
  await finance.waitForURL(/\/admin$/);
  await expect(finance.getByRole("link", { name: "Prayer requests" })).toHaveCount(0);
  await go(finance, "/admin/prayer-requests");
  await expect(finance).toHaveURL(/denied=prayer/);
  await go(finance, "/admin/giving");
  await expect(finance.getByRole("heading", { name: "Giving & donations" })).toBeVisible();
  await finance.context().close();

  const stranger = await newDevice(browser);
  // The public sign-in has no staff entry point; old links forward to /admin/login.
  await go(stranger, "/login");
  await expect(stranger.getByText(/staff/i)).toHaveCount(0);
  await go(stranger, "/login?as=staff");
  await expect(stranger).toHaveURL(/\/admin\/login$/);
  await go(stranger, "/admin/messaging");
  await expect(stranger).toHaveURL(/\/admin\/login$/);
  await stranger.getByLabel("Admin email").fill("admin@flagupjesus.org");
  await stranger.getByLabel("Password", { exact: true }).fill("wrong-password");
  await stranger.getByRole("button", { name: "Sign in to admin" }).click();
  await expect(stranger.getByText("Incorrect admin email or password.")).toBeVisible();
  await devStaffLogin(stranger, "random@example.com");
  await expect(stranger.getByText("not on the staff list")).toBeVisible();
  await go(stranger, "/member");
  await expect(stranger).toHaveURL(/\/login$/);
  await stranger.context().close();
});

test("closing check-in completes the service", async () => {
  await go(admin, serviceUrl);
  await admin.getByRole("button", { name: "Close check-in" }).click();
  await expect(admin.getByText("completed").first()).toBeVisible();
  const sid = serviceUrl.split("/").pop();
  const res = await admin.request.get(`/api/attendance/token?serviceId=${sid}`);
  expect(res.status()).toBe(404);
});
