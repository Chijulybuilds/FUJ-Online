import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * End-to-end journey against the local JSON store (seeded demo data):
 * staff opens QR check-in → a new member registers from the QR → returning member checks in by username →
 * broadcast + read/response tracking → follow-up broadcast → testimony moderation → prayer → roles.
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

test("landing: red Donate button jumps to the ministry bank account; departments are gone", async ({ page }) => {
  await go(page, "/");
  const donate = page.getByTestId("donate-button");
  await expect(donate).toBeVisible();
  await expect(donate).toHaveText(/Donate/);
  expect(await donate.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(232, 48, 58)");
  await donate.click();
  await expect(page).toHaveURL(/#give$/);
  await expect(page.locator("#give")).toBeInViewport();
  await expect(page.locator("#give")).toContainText("Fidelity Bank");
  await expect(page.locator("#give")).toContainText("5600605313");
  await expect(page.locator("#give")).toContainText("FlagUp Jesus Global Ministry");
  await expect(page.locator("#reach")).toContainText("United Kingdom");
  // Motto + FUJ programmes
  await expect(page.getByTestId("footer-motto")).toHaveText("We Love, We Give, We Change The World");
  // Our reach: what FUJ actually does in each place.
  await expect(page.locator(".place-row").filter({ hasText: "Port Harcourt" })).toContainText("The Headquarters of Love");
  await expect(page.locator(".place-row").filter({ hasText: "Lagos" })).toContainText("Medical & village outreaches");
  await expect(page.locator(".place-row").filter({ hasText: "Abuja" })).toContainText("Village & medical outreaches");
  await expect(page.getByText(/Miracle Service|youth outreach/i)).toHaveCount(0);
  // The FUJ flag is the browser-tab icon.
  await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href^="/icon.png"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  for (const path of ["/favicon.ico", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"]) expect((await page.request.get(path)).status()).toBe(200);
  // No livestream yet: no "Watch online" button or livestream placeholder.
  await expect(page.getByTestId("watch-online")).toHaveCount(0);
  await expect(page.getByText(/livestream link/i)).toHaveCount(0);
  await expect(page.locator(".lp-eyebrow").first()).toContainText("WE LOVE · WE GIVE · WE CHANGE THE WORLD");
  // Pastor Caleb's real book covers
  const covers = page.getByTestId("books").getByRole("img");
  await expect(covers).toHaveCount(2);
  await page.getByTestId("books").scrollIntoViewIfNeeded();
  await expect(covers.first()).toHaveAttribute("alt", /The 5 Dimensions of Grace/);
  await expect.poll(() => covers.evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const programs = page.getByTestId("program-card");
  await expect(programs).toHaveCount(8);
  await expect(programs.filter({ hasText: "Word Experience" })).toContainText("Every Sunday · 4:30 PM");
  await expect(programs.filter({ hasText: "Jesus Festival" })).toContainText("Annual");
  const footer = page.locator("footer");
  await expect(footer).toContainText("2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt");
  await expect(footer.getByRole("link", { name: "07042741000" })).toHaveAttribute("href", "tel:07042741000");
  await expect(footer.getByRole("link", { name: "flagupjesusglobal@gmail.com" })).toHaveAttribute("href", "mailto:flagupjesusglobal@gmail.com");
  await expect(page.locator('svg.ng-map [data-place="United Kingdom"]')).toHaveCount(1);
  const res = await page.request.get("/admin/departments");
  expect(res.status()).toBe(404);
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
  await hydrated(admin);
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

test("a new member scans the QR, registers, gets a flag username and is checked in", async ({ browser }) => {
  const phone = await newDevice(browser);
  await go(phone, await currentQrUrl());
  await expect(phone.getByTestId("checkin-service")).toHaveText("E2E Sunday Service");
  await expect(phone).toHaveURL(/\/check-in$/); // token stripped from the URL
  await shot(phone, "05-checkin-scanned");
  await phone.getByRole("link", { name: "Register now" }).click();
  await expect(phone.getByText(/checked in to E2E Sunday Service automatically/)).toBeVisible();
  // Registration is name + phone + birthday + home address (+ optional email). No paid SMS OTP and no approval step.
  await expect(phone.getByLabel("Email (optional)")).toBeVisible();
  await expect(phone.getByLabel("Birthday")).toHaveAttribute("required", "");
  await expect(phone.getByLabel("Home address")).toHaveAttribute("required", "");
  await expect(phone.getByLabel("Gender")).toHaveCount(0);
  await expect(phone.getByLabel("Verification code")).toHaveCount(0);
  await phone.getByLabel("Full name").fill("Chiamaka Nwankwo");
  await phone.getByLabel("Phone number").fill("0812 345 6789");
  await phone.getByLabel("Birthday").fill("1998-03-14");
  await phone.getByLabel("Home address").fill("7 Ikwerre Road, Mile 1, Port Harcourt");
  // Is it their first time? (required) — and would they like to become a FUJ Partner? (optional)
  await phone.getByRole("button", { name: "Register & get my username" }).click();
  await expect(phone.getByTestId("register-success")).toHaveCount(0); // the first-time question must be answered
  await phone.getByRole("radio", { name: /Yes, it's my first time/ }).check();
  await phone.getByLabel(/I'd like to become a FUJ Partner/).check();
  await phone.getByRole("button", { name: "Register & get my username" }).click();
  await expect(phone.getByTestId("register-success")).toBeVisible();
  await expect(phone.getByTestId("partner-thanks")).toBeVisible();
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

test("check-in desk: admin finds members by name and checks them in; adds a new member", async () => {
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
  await admin.getByLabel("New member full name").fill("Kelechi Amadi");
  await admin.getByLabel("New member phone").fill("0818 765 4321");
  await admin.getByLabel(/First time at FlagUpJesus/).check();
  await admin.getByRole("button", { name: "Add & check in" }).click();
  await expect(admin.getByText(/Welcome Kelechi! Added as a new member \(username flagkelechi\d{3}\)/)).toBeVisible();
  await expect(admin.getByTestId("desk-total")).toHaveText("5 checked in");
  await shot(admin, "08b-checkin-desk");
});

test("online self-registration makes you a member straight away (no visitors, no verification); contacts export for WhatsApp", async ({ browser }) => {
  const p = await newDevice(browser);
  // Birthday and home address are required (checked on the server too, not just in the browser).
  const missing = await p.request.post("/api/register", { data: { fullName: "No Birthday", phone: "0705 000 0001", address: "1 Test Street, Port Harcourt" } });
  expect(missing.status()).toBe(400);
  expect((await missing.json()).error).toBe("Enter your birthday");
  const future = await p.request.post("/api/register", { data: { fullName: "Future Baby", phone: "0705 000 0002", birthday: "2999-01-01", address: "1 Test Street, Port Harcourt" } });
  expect((await future.json()).error).toBe("Your birthday can't be in the future");
  await go(p, "/register");
  await p.getByLabel("Full name").fill("Obinna Online");
  await p.getByLabel("Phone number").fill("0705 111 2222");
  await p.getByLabel("Birthday").fill("1990-11-30");
  await p.getByLabel("Home address").fill("15 Olu Obasanjo Road, D-Line, Port Harcourt");
  await p.getByRole("radio", { name: /No, I've been here before/ }).check(); // an existing member registering online
  await p.getByRole("button", { name: "Register & get my username" }).click();
  await expect(p.getByTestId("register-success")).toBeVisible();
  await p.context().close();

  await go(admin, "/admin/members");
  await expect(admin.getByRole("link", { name: /Visitors|Unverified/ })).toHaveCount(0);
  const row = admin.getByRole("row").filter({ hasText: "Obinna Online" });
  await expect(row.getByText("member", { exact: true })).toBeVisible();
  await expect(admin.getByText(/visitor|unverified/i)).toHaveCount(0);
  await row.getByRole("link", { name: "Obinna Online" }).click();
  await expect(admin.getByRole("button", { name: "Mark verified" })).toHaveCount(0);
  await expect(admin.getByLabel("Status")).toHaveValue("member");
  await expect(admin.getByLabel("Status").locator("option", { hasText: "visitor" })).toHaveCount(0);
  // What they typed at sign-up is on their record and in the members export.
  await expect(admin.getByLabel("Birthday")).toHaveValue("1990-11-30");
  await expect(admin.getByLabel("Address")).toHaveValue("15 Olu Obasanjo Road, D-Line, Port Harcourt");
  const peopleCsv = await (await admin.request.get("/api/admin/export?type=people")).text();
  expect(peopleCsv.split("\n")[0]).toContain("birthday,address");
  expect(peopleCsv).toContain("1990-11-30");
  expect(peopleCsv).toContain("15 Olu Obasanjo Road, D-Line, Port Harcourt");

  const vcf = await admin.request.get("/api/admin/export?type=vcf");
  expect(vcf.headers()["content-type"]).toContain("text/vcard");
  const text = await vcf.text();
  expect(text).toContain("FN:Obinna Online (FUJ)");
  expect(text).toContain("TEL;TYPE=CELL:+2347051112222");
});

test("first timers: a simple call list — existing members registering online aren't on it", async () => {
  await go(admin, "/admin/first-timers");
  await expect(admin.getByTestId("first-timer-automation")).toContainText("Automatic messages are on");
  const rows = () => admin.getByTestId("first-timers-list").getByTestId("first-timer-row");
  const chiamaka = rows().filter({ hasText: "Chiamaka Nwankwo" });
  await expect(chiamaka).toContainText("E2E Sunday Service"); // registered from the service QR
  await expect(rows().filter({ hasText: "Kelechi Amadi" })).toContainText("E2E Sunday Service"); // added at the desk, "first time" ticked
  await expect(admin.getByTestId("first-timers-list").getByText("Obinna Online")).toHaveCount(0); // said "No, I've been here before"
  await expect(chiamaka).toContainText("To call");
  await expect(chiamaka).toContainText(/Call to welcome them/);
  await expect(chiamaka.getByRole("link", { name: "Call Chiamaka Nwankwo" })).toHaveAttribute("href", /^tel:\+234/);
  await expect(admin.getByTestId("show-to_call")).toContainText("To call");
  await shot(admin, "13-first-timers");
  // One click from the list: Kelechi was reached, so he moves from "To call" to "Called".
  await hydrated(admin);
  await rows().filter({ hasText: "Kelechi Amadi" }).getByRole("button", { name: "Reached them" }).click();
  await expect(rows().filter({ hasText: "Kelechi Amadi" })).toHaveCount(0);
  await go(admin, "/admin/first-timers?show=called");
  await expect(rows().filter({ hasText: "Kelechi Amadi" })).toContainText("Called");
  // Chiamaka's page: the welcome message went out automatically; the team reached her and left a note.
  await go(admin, "/admin/first-timers");
  await chiamaka.getByRole("link", { name: "Chiamaka Nwankwo", exact: true }).click();
  await expect(admin.getByTestId("first-timer-status")).toHaveText("To call");
  await expect(async () => {
    await admin.reload();
    await expect(admin.getByTestId("first-timer-history")).toContainText("Welcome message sent automatically", { timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await hydrated(admin);
  await admin.getByTestId("first-timer-step").getByLabel(/^Note/).fill("Lovely chat — she enjoyed the worship and will bring her sister.");
  await admin.getByRole("button", { name: "Reached them" }).click();
  await expect(admin.getByText("Marked as called. 🙌")).toBeVisible();
  await admin.reload();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Chiamaka Nwankwo");
  await expect(admin.getByTestId("first-timer-status")).toHaveText("Called");
  await expect(admin.getByTestId("first-timer-history")).toContainText("Reached them");
  await expect(admin.getByText("Lovely chat")).toBeVisible();
  await shot(admin, "14-first-timer");
  // Her member record links to it, and staff can message all first timers at once.
  await hydrated(admin);
  await admin.getByRole("link", { name: "Member record" }).click();
  await admin.waitForURL(/\/admin\/members\/[0-9a-f-]+$/);
  await expect(admin.getByTestId("member-journeys")).toContainText("First timer");
  await expect(admin.getByTestId("member-journeys")).toContainText("Outreach partner");
  await go(admin, "/admin/messaging?audience=first_timers");
  await expect(admin.getByLabel("Audience").locator("option:checked")).toHaveText(/First timers/);
});

test("FUJ Partners: outreach (members) and associate (abroad) partners — sign-ups followed up, pledges and gifts recorded", async ({ browser }) => {
  await go(admin, "/admin/partners");
  await expect(admin.getByTestId("stream-outreach")).toHaveAttribute("aria-selected", "true");
  const table = admin.getByTestId("partners-table");
  const chiamaka = table.getByRole("row").filter({ hasText: "Chiamaka Nwankwo" });
  await expect(chiamaka).toContainText("interested");
  await expect(chiamaka).toContainText("At registration");
  await chiamaka.getByRole("link", { name: "Chiamaka Nwankwo" }).click();
  await admin.waitForURL(/\/admin\/partners\/[0-9a-f-]+$/);
  await expect(async () => {
    await admin.reload();
    await expect(admin.getByTestId("partner-history")).toContainText("Automatic thank-you message", { timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await hydrated(admin);
  await admin.getByLabel("Status").selectOption("committed");
  await expect(admin.getByTestId("partner-stream")).toHaveText("Outreach partner");
  await admin.getByLabel("Pledge", { exact: true }).fill("20000");
  await admin.getByLabel("How often").selectOption("monthly");
  await admin.getByRole("button", { name: "Save partner" }).click();
  await expect(admin.getByText("Partner saved.")).toBeVisible();
  // A gift recorded in Giving with her username makes her an active partner.
  await go(admin, "/admin/giving");
  await admin.getByLabel("Amount", { exact: true }).fill("20000");
  await admin.getByLabel("Member or partner username").fill(newUsername);
  await admin.getByRole("button", { name: "Record" }).click();
  await expect(admin.getByText("Donation recorded.")).toBeVisible();
  await go(admin, "/admin/partners");
  const row = admin.getByTestId("partners-table").getByRole("row").filter({ hasText: "Chiamaka Nwankwo" });
  await expect(row).toContainText("active");
  await expect(row).toContainText("₦20,000");
  // Staff add someone who told them in person.
  await admin.getByLabel("Full name").fill("Emeka Generous");
  await admin.getByLabel("Phone number").fill("0809 444 5555");
  await admin.getByLabel(/^Pledge/).fill("50,000");
  await admin.getByRole("button", { name: "Add outreach partner" }).click();
  await expect(admin.getByText("Emeka Generous was added to the partners list.")).toBeVisible();
  await expect(admin.locator("main").getByText("committed", { exact: true }).first()).toBeVisible();
  await shot(admin, "15-partner");
  const csv = await (await admin.request.get("/api/admin/export?type=partners")).text();
  expect(csv.split("\n")[0]).toContain("name,partner_type,organisation,country,username,phone,email,status,currency,pledge");
  expect(csv).toContain("Emeka Generous,Outreach");

  // Associate partners: key partners outside FlagUpJesus, anywhere in the world.
  await go(admin, "/admin/partners");
  await admin.getByTestId("stream-associate").click();
  await admin.waitForURL(/stream=associate/);
  await hydrated(admin);
  const add = admin.getByTestId("add-partner");
  await expect(add).toContainText("Add an associate partner");
  const addAssociate = async (phone: string) => {
    await add.getByLabel("Full name").fill("Grace Abroad");
    await add.getByLabel(/Church \/ organisation/).fill("Grace Chapel, London");
    await add.getByLabel("Country", { exact: true }).fill("United Kingdom");
    await add.getByLabel(/WhatsApp \/ phone number/).fill(phone);
    await add.getByLabel(/^Pledge/).fill("100");
    await add.getByRole("button", { name: "Add associate partner" }).click();
  };
  await addAssociate("07700 900123");
  await expect(admin.getByText(/Add the country code/)).toBeVisible(); // a UK number needs +44
  await addAssociate("+44 7700 900123");
  await expect(admin.getByText("Grace Abroad was added to the partners list.")).toBeVisible();
  await expect(admin.getByTestId("partner-stream")).toHaveText("Associate partner");
  await expect(admin.locator("main")).toContainText("£100");
  await go(admin, "/admin/partners?stream=associate");
  await expect(admin.getByTestId("partners-table").getByRole("row").filter({ hasText: "Grace Abroad" })).toContainText("United Kingdom");
  await expect(admin.getByTestId("partners-pledged")).toContainText("£100");
  await shot(admin, "15b-associate-partners");
  // Not a church member: she isn't on the members list.
  await go(admin, "/admin/members?q=Grace%20Abroad");
  await expect(admin.getByRole("link", { name: "Grace Abroad" })).toHaveCount(0);

  // An existing member becomes a partner from their portal.
  const m = await newDevice(browser);
  await memberLogin(m, "flaggrace101", "08031234567");
  await go(m, "/member/giving");
  await expect(m.getByTestId("partner-card")).toContainText("Become a FUJ Partner");
  await m.getByLabel(/Amount you'd like to give/).fill("10000");
  await m.getByRole("button", { name: "I want to partner" }).click();
  // The card turns into "You're a FUJ Partner" with their pledge.
  await expect(m.getByTestId("partner-card")).toContainText("You're a FUJ Partner");
  await expect(m.getByTestId("partner-card")).toContainText("₦10,000");
  await m.reload();
  await expect(m.getByTestId("partner-card")).toContainText("You're a FUJ Partner");
  await m.context().close();
  await go(admin, "/admin/partners");
  await expect(admin.getByTestId("partners-table").getByRole("row").filter({ hasText: "Grace Okafor" })).toContainText("From their portal");
  await go(admin, "/admin/messaging?audience=partners_associate");
  await expect(admin.getByLabel("Audience").locator("option:checked")).toHaveText(/Associate partners/);
});

test("under-18s register on the same I'm new page — with their own phone or a parent's — and the parent checks the family in", async ({ browser }) => {
  const born = (years: number) => new Date(Date.now() - (years * 365.25 + 40) * 86400000).toISOString().slice(0, 10);
  async function fill(page: Page, name: string, phone: string, birthday: string, firstTime = false) {
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel(/^Phone number/).fill(phone);
    await page.getByLabel("Birthday").fill(birthday);
    await page.getByLabel("Home address").fill("4 Elelenwo Street, Port Harcourt");
    await page.getByRole("radio", { name: firstTime ? /Yes, it's my first time/ : /No, I've been here before/ }).check();
  }
  // A parent scans the QR and registers (checked in automatically).
  const fam = await newDevice(browser);
  await go(fam, await currentQrUrl());
  await fam.getByRole("link", { name: "Register now" }).click();
  await hydrated(fam);
  await fill(fam, "Funke Adeyemi", "0803 555 1234", "1988-04-22", true);
  await expect(fam.getByTestId("under-18")).toHaveCount(0); // adults don't see the under-18 questions
  await fam.getByRole("button", { name: "Register & get my username" }).click();
  await expect(fam.getByTestId("register-success")).toBeVisible();
  await expect(fam.getByText(/checked in for today/)).toBeVisible();

  // Her son registers on the same phone, on the same I'm new page, with her number.
  await go(fam, "/register");
  await expect(fam.getByTestId("signed-in-note")).toContainText("Funke");
  await fill(fam, "Tobi Adeyemi", "0803 555 1234", born(6), true);
  const minor = fam.getByTestId("under-18");
  await expect(minor).toContainText("You're under 18");
  await expect(fam.getByLabel(/become a FUJ Partner/)).toHaveCount(0);
  // "My own phone" with a number that's already registered → a helpful hint.
  await minor.getByRole("radio", { name: /My own phone/ }).check();
  await minor.getByLabel(/My parent or guardian knows/).check();
  await fam.getByRole("button", { name: "Register & get my username" }).click();
  await expect(fam.getByText(/already registered to someone else. If it's your parent's or guardian's number/)).toBeVisible();
  await minor.getByRole("radio", { name: /My parent's or guardian's/ }).check();
  await minor.getByLabel("Parent or guardian's full name").fill("Funke Adeyemi");
  await minor.getByLabel("They are my").selectOption("Mother");
  await minor.getByLabel(/My parent or guardian knows/).check();
  await shot(fam, "16-under-18-form");
  await fam.getByRole("button", { name: "Register & get my username" }).click();
  await expect(fam.getByTestId("register-success")).toContainText("Welcome to the family, Tobi!");
  await expect(fam.getByTestId("parents-phone-note")).toContainText("Funke Adeyemi");
  await expect(fam.getByText(/checked in for today/)).toBeVisible(); // same phone, same family
  await expect(fam.getByTestId("new-username")).toHaveText(/^flagtobi\d{3}$/);
  await shot(fam, "17-under-18-done");

  // His sister registers later on another phone, also with mum's number (not at church).
  const sis = await newDevice(browser);
  await go(sis, "/register");
  await fill(sis, "Ada Adeyemi", "08035551234", born(9));
  await sis.getByRole("radio", { name: /My parent's or guardian's/ }).check();
  await sis.getByLabel("Parent or guardian's full name").fill("Funke Adeyemi");
  await sis.getByLabel("They are my").selectOption("Mother");
  await sis.getByLabel(/My parent or guardian knows/).check();
  await sis.getByRole("button", { name: "Register & get my username" }).click();
  await expect(sis.getByTestId("register-success")).toContainText("Welcome to the family, Ada!");
  await sis.context().close();

  // A teenager with her own phone.
  const teen = await newDevice(browser);
  await go(teen, "/register");
  await fill(teen, "Teni Bello", "0809 888 7777", born(15), true);
  await teen.getByRole("radio", { name: /My own phone/ }).check();
  await teen.getByLabel(/My parent or guardian knows/).check();
  await teen.getByRole("button", { name: "Register & get my username" }).click();
  await expect(teen.getByTestId("register-success")).toContainText("Welcome to the family, Teni!");
  await teen.context().close();

  // At church: mum (still signed in) scans again and checks Ada in with one tap.
  await go(fam, await currentQrUrl());
  const family = fam.getByTestId("family-checkin");
  await expect(family).toContainText("Your children");
  await expect(family.getByRole("listitem").filter({ hasText: "Tobi Adeyemi" })).toContainText("Checked in");
  await family.getByRole("button", { name: "Check in Ada" }).click();
  await expect(family.getByText("✓ Checked in")).toHaveCount(2);
  await shot(fam, "18-family-checkin");
  await fam.context().close();

  // Admin: everyone under 18, own phone or a parent's.
  await go(admin, "/admin/children");
  await expect(admin.getByTestId("children-count")).toHaveText("3");
  const table = admin.getByTestId("children-table");
  const tobiRow = table.getByRole("row").filter({ hasText: "Tobi Adeyemi" });
  await expect(tobiRow).toContainText("Funke Adeyemi");
  await expect(tobiRow).toContainText("Mother's phone");
  await expect(tobiRow).toContainText("In church today");
  await expect(tobiRow).toContainText("Pre-school");
  await expect(table.getByRole("row").filter({ hasText: "Teni Bello" })).toContainText("Own phone");
  await expect(admin.getByTestId("group-teens")).toContainText("1 child");
  await expect(admin.getByTestId("under-18-how")).toContainText("I'm new");
  await shot(admin, "19-children-teens");
  const csv = await (await admin.request.get("/api/admin/export?type=children")).text();
  expect(csv).toContain("Tobi Adeyemi");
  expect(csv).toContain("parent/guardian");
  // Children on a parent's number aren't in the phone-contacts export (the parent is).
  const vcf = await (await admin.request.get("/api/admin/export?type=vcf")).text();
  expect(vcf).not.toContain("Tobi Adeyemi");
  expect(vcf).toContain("Funke Adeyemi");
  await tobiRow.getByRole("link", { name: /Tobi Adeyemi/ }).click();
  await expect(admin.getByTestId("child-summary")).toContainText("Funke Adeyemi");

  // Ushers can add an under-18 without a phone at the desk.
  const sid = serviceUrl.split("/").pop();
  await go(admin, `/admin/attendance/desk?service=${sid}`);
  await admin.getByLabel("New member full name").fill("Kemi Okafor");
  await admin.getByLabel(/Under 18, using a parent's phone/).check();
  await admin.getByLabel("Child's birthday").fill(born(4));
  await admin.getByLabel("New member phone").fill("0803 123 4567");
  await admin.getByRole("button", { name: "Add & check in" }).click();
  await expect(admin.getByText(/Welcome Kemi! 🎈 Registered as a child with Grace Okafor's number/)).toBeVisible();
});

test("members can set a password and sign in with it; welcome emails (username + password link) are tracked", async ({ browser }) => {
  const m = await newDevice(browser);
  await memberLogin(m, "flagdavid102", "08062345678");
  await go(m, "/member/profile");
  const card = m.getByTestId("password-card");
  await expect(card).toContainText("Optional");
  await card.getByLabel(/^Password/).fill("short");
  await card.getByLabel("Type it again").fill("short");
  await card.getByRole("button", { name: "Set password" }).click();
  await expect(m.getByText(/at least 8 characters/i).first()).toBeVisible();
  await card.getByLabel(/^Password/).fill("Grace&Truth2026");
  await card.getByLabel("Type it again").fill("Grace&Truth2026");
  await card.getByRole("button", { name: "Set password" }).click();
  await expect(m.getByText(/Password set! You can now sign in/)).toBeVisible();
  await m.reload();
  await expect(m.getByTestId("password-card")).toContainText("Change the password");
  await m.context().clearCookies();

  // Sign in with username + password (phone number still works too).
  await go(m, "/login");
  await m.getByRole("tab", { name: /Password/ }).click();
  await m.getByLabel("Username or email").fill("flagdavid102");
  await m.getByLabel("Password", { exact: true }).fill("not-my-password");
  await m.getByRole("button", { name: "Sign in" }).click();
  await expect(m.getByText(/don't match/)).toBeVisible();
  await m.getByLabel("Password", { exact: true }).fill("Grace&Truth2026");
  await m.getByRole("button", { name: "Sign in" }).click();
  await m.waitForURL(/\/member$/);
  await expect(m.getByTestId("portal-username")).toHaveText("flagdavid102");
  await shot(m, "20-password-signin");
  await m.context().clearCookies();
  // Forgot password never says whether an account exists; bad links explain what to do.
  await go(m, "/login");
  await m.getByRole("tab", { name: /Password/ }).click();
  await m.getByRole("button", { name: "Forgot your password?" }).click();
  await m.getByLabel("Username or email").fill("flagdavid102");
  await m.getByRole("button", { name: "Email me a link" }).click();
  await expect(m.getByTestId("forgot-sent")).toContainText("If we have an email address for that account");
  await go(m, "/set-password?token=abc.def");
  await expect(m.getByTestId("set-password-problem")).toContainText("isn't valid");
  await m.context().close();

  // Admin: who has had the welcome email (no email provider in tests, so nothing is lost — it waits).
  await go(admin, "/admin/settings");
  const welcome = admin.getByTestId("welcome-emails");
  await expect(welcome).toContainText("flag username");
  await expect(welcome).toContainText("Email isn't set up yet");
  await expect(welcome.getByTestId("welcome-pending")).not.toHaveText("0");
  const david = (await (await admin.request.get("/api/admin/desk?serviceId=x&q=david")).json()).people[0];
  await go(admin, `/admin/members/${david.id}`);
  await expect(admin.getByTestId("welcome-status")).toContainText("Password: set");
});

test("admins import an Excel contact list: people already in the database are skipped, families share numbers", async () => {
  await go(admin, "/admin/members");
  await admin.getByTestId("import-link").click();
  await admin.waitForURL(/\/admin\/members\/import$/);
  await hydrated(admin);
  await admin.getByLabel("Contact list file").setInputFiles("tests/fixtures/contacts-sample.xlsx");
  const summary = admin.getByTestId("import-summary");
  await expect(summary).toContainText("3 new");
  await expect(summary).toContainText("1 on a family number");
  await expect(summary).toContainText("1 already in the database"); // Grace Okafor is registered
  await expect(summary).toContainText("1 listed twice");
  await expect(summary).toContainText("1 without a phone number");
  const table = admin.getByTestId("import-table");
  await expect(table.getByRole("row").filter({ hasText: "Grace Okafor" })).toContainText("Already in the database as Grace Okafor");
  await expect(table.getByRole("row").filter({ hasText: "Mrs. Ifeoma Bassey" })).toContainText("Shares Pst. Daniel Bassey's number");
  await shot(admin, "21-import-preview");
  await admin.getByTestId("import-run").click();
  await expect(admin.getByTestId("import-done")).toBeVisible({ timeout: 30000 });
  await expect(admin.getByTestId("import-added")).toHaveText("4");
  await expect(admin.getByTestId("import-skipped")).toHaveText("3");
  await shot(admin, "22-import-done");
  // They're members now — and importing the same file again adds nobody.
  await go(admin, "/admin/members?q=bassey");
  await expect(admin.getByRole("link", { name: "Mrs. Ifeoma Bassey" })).toBeVisible();
  await go(admin, "/admin/members/import");
  await admin.getByLabel("Contact list file").setInputFiles("tests/fixtures/contacts-sample.xlsx");
  await expect(admin.getByTestId("import-summary")).toContainText("0 new");
  await expect(admin.getByTestId("import-run")).toHaveText(/Nothing new to import/);
  await expect(admin.getByTestId("import-run")).toBeDisabled();
});

test("broadcast with response tracking, member replies, follow-up to non-responders", async ({ browser }) => {
  await go(admin, "/admin/messaging");
  await expect(admin.getByLabel("Audience").locator("option", { hasText: /visitor/i })).toHaveCount(0);
  await admin.getByLabel("Audience").selectOption("all");
  await expect(admin.getByTestId("audience-count")).toContainText("recipient");
  await admin.getByLabel("Title").fill("Thanksgiving Sunday");
  await admin.getByRole("textbox", { name: /^Message/ }).fill("Hi {first_name}, will you join us for Thanksgiving Sunday? Reply yes!");
  await admin.getByLabel("Flyer image").setInputFiles("public/images/fuj/outreach-children.webp");
  await expect(admin.getByTestId("flyer-preview")).toBeVisible();
  await admin.getByRole("button", { name: "Send broadcast" }).click();
  await admin.waitForURL(/\/admin\/messaging\/[0-9a-f-]{36}\?sent=1/);
  const trackingUrl = admin.url().split("?")[0];
  await expect(admin.getByText(/Sent to \d+ (people|person) in the member portal/)).toBeVisible();
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
  await expect(admin.getByText(/pastoral care/i)).toHaveCount(0);

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

test("leaders: admin adds leaders by unit and messages them on WhatsApp/SMS/email from Broadcasts", async () => {
  await go(admin, "/admin/leaders");
  await expect(admin.getByText("No leaders yet")).toBeVisible();
  const add = async (name: string, unit: string, phone: string, email = "") => {
    const form = admin.locator("form", { has: admin.getByRole("button", { name: "Add leader" }) });
    await form.getByLabel("Full name").fill(name);
    await form.getByLabel("Unit").fill(unit);
    await form.getByLabel("WhatsApp number").fill(phone);
    if (email) await form.getByLabel(/^Email/).fill(email);
    await form.getByRole("button", { name: "Add leader" }).click();
  };
  await add("Uche Choirmaster", "Choir", "0803 222 1111", "uche@example.com");
  await expect(admin.getByText("Uche Choirmaster added to the leaders list (Choir).")).toBeVisible();
  // Someone already registered with that number is linked, not duplicated.
  await add("Grace O.", "Ushering", "08031234567");
  await expect(admin.getByText("Grace Okafor was already registered — added to the leaders list (Ushering).")).toBeVisible();
  await add("Chika Choir", "choir", "0803 222 3333");
  await expect(admin.getByTestId("leader-row")).toHaveCount(3);
  await expect(admin.getByRole("link", { name: "Choir (2)" })).toBeVisible();
  await expect(admin.getByTestId("leader-row").filter({ hasText: "Uche Choirmaster" }).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/2348032221111");
  await shot(admin, "13-leaders");

  // One unit's leaders → Broadcasts with that audience preselected.
  await admin.getByRole("link", { name: "Choir (2)" }).click();
  await expect(admin.getByTestId("leader-row")).toHaveCount(2);
  await admin.getByTestId("message-unit-leaders").click();
  await admin.waitForURL(/\/admin\/messaging\?audience=leaders/);
  await expect(admin.getByLabel("Audience")).toHaveValue("leaders:Choir");
  await expect(admin.getByTestId("audience-count")).toContainText("2 recipients");
  // WhatsApp, SMS and Email are separate choices (not set up in the test environment).
  const channels = admin.getByTestId("channels");
  for (const name of [/^WhatsApp/, /^SMS text message/, /^Email/]) await expect(channels.getByRole("checkbox", { name })).toBeDisabled();
  await expect(channels.getByText("Not set up yet — see Settings → Messaging channels")).toHaveCount(3);

  // All leaders.
  await go(admin, "/admin/leaders");
  await admin.getByTestId("message-all-leaders").click();
  await admin.waitForURL(/\/admin\/messaging\?audience=leaders$/);
  await expect(admin.getByLabel("Audience")).toHaveValue("leaders");
  await expect(admin.getByTestId("audience-count")).toContainText("3 recipients");
  await admin.getByLabel("Title").fill("Leaders' meeting");
  await admin.getByRole("textbox", { name: /^Message/ }).fill("Hi {first_name}, leaders meet on Saturday at 4pm.");
  await admin.getByRole("button", { name: "Send broadcast" }).click();
  await admin.waitForURL(/\/admin\/messaging\/[0-9a-f-]{36}\?sent=1/);
  await expect(admin.getByText("All leaders").first()).toBeVisible();
  await expect(admin.getByTestId("recipient-row")).toHaveCount(3);

  // Edit, then remove (member record stays).
  await go(admin, "/admin/leaders");
  const chika = admin.getByTestId("leader-row").filter({ hasText: "Chika Choir" });
  await chika.getByText("Edit or remove").click();
  await chika.getByLabel("Unit").fill("Media");
  await chika.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("Leader updated.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByRole("link", { name: "Media (1)" })).toBeVisible();
  const grace = admin.getByTestId("leader-row").filter({ hasText: "Grace Okafor" });
  await grace.getByText("Edit or remove").click();
  await grace.getByRole("button", { name: "Remove from leaders" }).click();
  await expect(admin.getByText("Grace Okafor was removed from the leaders list. They're still in Members.")).toBeVisible();
  await expect(admin.getByTestId("leader-row")).toHaveCount(2);
  await go(admin, "/admin/members?status=leaders");
  await expect(admin.getByRole("link", { name: "Leaders (2)" })).toBeVisible();

  const vcf = await admin.request.get("/api/admin/export?type=leaders_vcf");
  expect(await vcf.text()).toContain("FN:Uche Choirmaster (FUJ)");

  await go(admin, "/admin/settings");
  await expect(admin.getByTestId("messaging-channels").getByText("Not set up")).toHaveCount(3);
});

test("pastoral care has been removed; the follow-up team works with first timers", async ({ browser }) => {
  await go(admin, "/admin");
  await expect(admin.getByRole("link", { name: "Pastoral care" })).toHaveCount(0);
  await expect(admin.getByText(/Open follow-ups|Pastoral care queue/)).toHaveCount(0);
  await expect(admin.getByRole("link", { name: /First timers to call/ })).toBeVisible();
  expect((await admin.request.get("/admin/pastoral-care")).status()).toBe(404);
  await go(admin, "/admin/settings");
  await expect(admin.getByText("Automatic follow-up for absent members")).toHaveCount(0);
  await expect(admin.getByTestId("first-timer-partner-settings").getByText("Send on")).toBeVisible();
  // The old "pastoral worker" role is now the follow-up team: first timers, no pastoral care.
  const team = await newDevice(browser);
  await devStaffLogin(team, "care@flagupjesus.local");
  await team.waitForURL(/\/admin$/);
  await expect(team.getByRole("link", { name: "First timers", exact: true })).toBeVisible();
  await expect(team.getByRole("link", { name: "Pastoral care" })).toHaveCount(0);
  await go(team, "/admin/first-timers");
  await expect(team.getByRole("heading", { name: "First timers" })).toBeVisible();
  await team.context().close();
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
