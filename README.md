# FlagUpJesus Online Church — V1

A responsive church-management web app for **FlagUpJesus Global Ministry** (product name **FlagUpJesus**): an animated public landing page, QR attendance with personal **flag usernames**, a member portal, and an admin dashboard for pastoral care, broadcasts, prayer, testimonies, giving and reports.

## What's included

| Area | What it does |
|---|---|
| **Landing page** (`/`) | A five-layer FlagUpJesus story with a numbered section rail: **01 Welcome** (waving flag-red banner, outreach photo reel gliding from the right edge to the centre, live service countdown), **02 Our Heartbeat** (the motto lighting up word-by-word as you scroll; *The Word + The Works*), **03 Global Love Campaigns** (story-style outreach slideshow, two moving photo carousels, medical/food/community care), **04 Word & Worship** (Word Experience, Bible Study, International Prayer & Mission Conference, Unveiled Worship Encounter, service times), **05 Our Reach** (animated Nigeria map: Port Harcourt HQ, Lagos, Abuja, Bayelsa; Pastor Caleb's books). Then check-in how-to, news, testimonies, public prayer requests + prayer wall, partnering/giving. Light/dark themes; respects `prefers-reduced-motion`. Photos live in `public/images/fuj/`. |
| **Check-in desk** (`/admin/attendance/desk`) | The no-phone alternative to QR: staff type a member's **name** (or username/phone), tap **Check in**, and can add someone new (name + phone) and check them in in one step. |
| **QR check-in** | Staff open check-in for a service → full-screen display shows a QR that **rotates every 20 s**. Scanning exchanges the short-lived token for a 15-minute ticket on that phone. **Returning members just type their flag username (no OTP).** New people tap *Register* and are checked in automatically. |
| **Flag usernames** | Every person gets a unique username at first registration: `flag` + first name + 3 digits, e.g. `flagyourname123`. Case-insensitive; the `flag` prefix is optional when typing. |
| **Registration** | Only **full name + phone number** and an optional email — or **Continue with Google**. **Everyone who registers is a member** (FUJ has no "visitor" category) and is **verified automatically at sign-up** — there's no approval step and no paid SMS OTP. (Optional: `REGISTRATION_OTP=true` adds an SMS code via Termii.) |
| **Member portal** (`/member`) | Username card, messages from the church (read + reply), announcements, prayer requests + prayer wall ("I prayed"), testimonies, attendance history, giving details/history, profile. Sign in with Google or username + phone number. |
| **Admin** (`/admin` → `/admin/login`) | Not linked from the public site: go to `yoursite/admin`. Sign in with the **shared FUJ admin email + password** (each person adds their name so actions stay attributable), or individual staff can use Google. |
| **Leaders** (`/admin/leaders`) | Admins add the church's leaders — **name, unit (e.g. Choir), WhatsApp number, optional email**. Leaders don't sign up themselves; if someone already registered with that number, their member record is linked. Filter by unit, one-tap WhatsApp/email, download leaders' contacts (.vcf), and **Message all leaders** / **Message one unit's leaders** straight from Broadcasts. |
| **Admin pages** | Dashboard, members directory (search, CSV export), leaders, member records, services, attendance, QR display, check-in desk, pastoral care, broadcasts + tracking, inbox, announcements, prayer moderation, testimony moderation, giving, reports, settings & staff roles. |
| **Pastoral care** | Absence analysis (runs every morning, when Sunday check-in closes, or on demand) flags members who attended before and then missed the last *N* Sundays in a row (default 2), and people in church for the first time; every new registration gets a welcome-call task. Tasks have priority, assignee, due date, confidential notes, call/WhatsApp shortcuts and a contact log. It never changes membership status automatically. |
| **Free WhatsApp sharing** | Broadcasts can carry a **flyer image**. After sending, **Share on WhatsApp** opens WhatsApp's share sheet with the flyer + message so you post it to the church's WhatsApp **broadcast lists, groups, Status or Channel** — free. Every recipient row also has a one-tap personal WhatsApp link, and **Members → Contacts for WhatsApp (.vcf)** loads everyone into the church phone. |
| **Automatic absence follow-up** | When a member misses 2 Sundays in a row they automatically get a caring "We missed you" message — WhatsApp, SMS, email and the app inbox — then a reminder every 3 days (or 5, 7…) until they come back. It stops when they check in again (any service), when staff complete or dismiss their follow-up task, or after an optional message limit. Only Sundays where attendance was taken count, so a Sunday without check-in never makes everyone look absent. Configure in **Settings → Automatic follow-up**; status per person in **Pastoral care**. |
| **WhatsApp, SMS & email delivery** | Every broadcast lands in the member's **app inbox**, and — once each channel is connected — also as a **personal WhatsApp message** (SMS automatically for numbers not on WhatsApp), an **SMS**, and/or an **email** (with the flyer). Tick the channels per message. The app learns who is on WhatsApp from delivery receipts, records per-recipient WhatsApp/SMS/email status, counts WhatsApp "read" receipts as reads, and turns WhatsApp replies into Inbox responses. **Settings → Messaging channels** shows what's connected and sends a test. |
| **Broadcasts & follow-up tracking** | Send to everyone / **all leaders** / **one unit's leaders** / new members / absentees / one person, with `{first_name}` personalisation. Track **read** and **responded** per recipient, send a **follow-up broadcast** to non-readers or non-responders, or hand non-responders to pastoral care as tasks. Replies land in the admin **Inbox**. In-app delivery always works; WhatsApp, SMS and email when connected (see §4). |
| **Roles** | `super_admin`, `admin`, `pastor`, `pastoral_worker`, `finance_admin`, `department_leader` (shown as **Usher**). Each sees only their areas (e.g. finance can't read prayer requests; "private" prayer requests are pastor/admin only). |

## 1. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open http://localhost:3000.

**Without Supabase** (`SUPABASE_SERVICE_ROLE_KEY` empty) the app stores data in `.data/flagupjesus-db.json`. It starts **empty** — no sample members, services or offerings; only the ministry name, contact details and bank account. Anything FUJ hasn't provided yet (e.g. the next service date) shows as a dashed **[placeholder]**; the **Watch online** button only appears once a livestream link is set in **Admin → Settings**. Set `ADMIN_LOGIN_EMAIL` / `ADMIN_LOGIN_PASSWORD` in `.env.local`, then open http://localhost:3000/admin. Flyers uploaded locally are stored in `.data/uploads/`. (The automated tests use their own fictional sample data from `tests/e2e/fixtures/`, written to a throwaway database.) If your local database was created by an earlier version (with sample members, "Demo Bank", a Lagos address…), that old sample data is removed automatically the next time the app starts; records you created yourself are kept.

## 2. Connect Supabase (database)

1. **Easiest:** open `supabase/setup.sql`, copy **all** of it into Supabase → **SQL Editor → New query**, and click **Run**. It contains every migration plus FUJ's starting values, and is safe on a brand-new project *and* on one that already ran some or all migrations (it only adds what's missing). Alternatively run the files in `supabase/migrations/` (`0001` → `0011`) in order — each one can also be re-run safely.
2. After changing a migration, regenerate the combined file with `npm run db:setup-sql` (a test fails if it's out of date).
3. Put the Project URL, anon key and **service-role key** in `.env.local`. The service-role key is used only on the server (route handlers / server actions); permissions are enforced in the app layer and RLS stays on so the anon key cannot read church data.
4. Check `GET /api/health` → `{"mode":"supabase","database":"ready"}`. If you see `PGRST205`, run `notify pgrst, 'reload schema';`.

## 3. Google sign-in

The app runs the Google OAuth flow itself using `CLIENT_ID` / `CLIENT_SECRET` (also accepted as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client (Web application).
2. Add the authorised redirect URI: `http://localhost:3000/api/auth/google/callback` (and your production URL's equivalent).
3. Optional: set `ADMIN_EMAILS=you@gmail.com` — that Google account becomes a super admin the first time it uses "Staff sign in with Google" on `/admin/login`. Add other individual staff in **Settings → Staff & roles**. (Most admins can simply use the shared FUJ admin login.)

Members can sign in with Google (linked by Google account / email) or with username + phone.

## 4. Admin login, members and messaging (WhatsApp, SMS, email)

**Shared admin login** — set `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` (12+ characters in production) and optionally `ADMIN_LOGIN_ROLE` (default `super_admin`). Every FUJ admin signs in at `/admin` and types their own name, which is recorded on audit logs and broadcasts. Change the password whenever someone leaves the team.

**Members** — everyone who registers (online, with Google, or added by an usher/admin) is a **member** and verified automatically; there are no visitors and nothing to approve. Admins can mark someone *inactive*, *transferred* or *left* on their record. No smartphone? The usher checks them in by name at **Admin → Check-in desk**, or adds them there.

**Leaders** — **Admin → Leaders → Add a leader**: name, unit, WhatsApp number, optional email. Then **Message all leaders** (or open a unit and **Message <unit> leaders**) — it opens Broadcasts with that audience selected.

### WhatsApp broadcasting — two ways

**A. Free (works today, no setup):**
1. **Members → Contacts for WhatsApp (.vcf)** → open the file on the church phone → "Import" (Android: Contacts app; iPhone: open the file → Add all contacts).
2. In **WhatsApp Business** on that phone create **broadcast lists** (up to 256 contacts each; only people who have saved the church number receive them — ask members to save it), or use a **group / Community / Channel**.
3. In the admin, write the broadcast, attach the **flyer**, send → on the tracking page tap **Share on WhatsApp** → choose your broadcast lists / groups / Status → send. On a computer it opens WhatsApp Web with the text; download the flyer and attach it.
4. For individual follow-ups (absentees, new members) use the **WhatsApp** link on each recipient row or on the pastoral-care task — it opens a chat with a personalised message.

**B. Automatic: WhatsApp, SMS and email from the app** — tick the channels on each broadcast; each one needs its keys added in **Vercel → Settings → Environment Variables** (Production), then **Redeploy**. Afterwards open **Admin → Settings → Messaging channels**: it shows *Connected* and has a **Send test** button that explains any error in plain English. `/api/health` also names any missing or half-set key.

#### WhatsApp (Meta WhatsApp Business Cloud API)
1. Go to **https://developers.facebook.com/apps** → *Create app* → use case **"Connect with customers through WhatsApp"** (type *Business*) → link or create your **Meta Business portfolio** (business.facebook.com).
2. In the app: **WhatsApp → API Setup**. Meta gives you a free **test number** — add up to 5 recipient numbers (e.g. your own) to test with. Copy **Phone number ID** (a long number, *not* the phone number) → `WHATSAPP_PHONE_NUMBER_ID`.
3. Permanent token (the one on the API Setup page expires in 24 h): **business.facebook.com → Settings → Users → System users** → *Add* (role Admin) → *Assign assets* (your app + WhatsApp account, full control) → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`, expiry **Never** → `WHATSAPP_TOKEN`.
4. **WhatsApp Manager → Message templates → Create template** (Meta only lets businesses *start* conversations with approved templates):
   - Name `fuj_broadcast`, category **Utility** (meeting reminders, notices) or **Marketing** (programmes, campaigns), language **English** → body (variables can't be the very first or last thing):
     `Hello from FlagUpJesus Global Ministry 👋` · `*{{1}}*` · `{{2}}` · `Reply to this message to respond.` (one per line; give samples like "Leaders meeting" / "Hi, we meet on Saturday at 4pm.") → `WHATSAPP_TEMPLATE_NAME=fuj_broadcast`
   - Optional `fuj_flyer` — same body plus a **Header: Image** → `WHATSAPP_FLYER_TEMPLATE_NAME=fuj_flyer` (used when a broadcast has a flyer).
   - `WHATSAPP_TEMPLATE_LANG=en` (match the template's language code, e.g. `en_US` if you picked "English (US)").
   Approval usually takes minutes to a day. The app fills `{{1}}` with the title and `{{2}}` with the message.
5. **WhatsApp → Configuration → Webhook**: callback URL `https://www.flagupjesus.org/api/webhooks/whatsapp`, verify token = any secret you make up (also set it as `WHATSAPP_VERIFY_TOKEN` and redeploy *first*), then subscribe to **messages**. Copy **App settings → Basic → App secret** → `WHATSAPP_APP_SECRET`. This gives delivery/read receipts, automatic SMS for numbers not on WhatsApp, and replies in the Inbox.
6. To message everyone (not just test numbers): **WhatsApp → API Setup → Add phone number** — the church's own number (it must not be active in the WhatsApp app at the same time, unless Meta offers you to keep both), add a payment method, and complete **business verification** to lift the starting limit (250 people per 24 h).
7. Cost: Meta bills per delivered template message (Marketing costs more than Utility; see Meta's WhatsApp pricing page for Nigeria). When a member messages the church number, replies to them are free for 24 h.

#### SMS (Termii)
1. **termii.com** → sign in → **Settings / API**: copy the **API key** → `TERMII_API_KEY`, and your **Base URL** → `TERMII_BASE_URL` (e.g. `https://v3.api.termii.com`).
2. **Sender ID** → request one, e.g. `FlagUpJesus` (max 11 characters; approval takes a few days) → `TERMII_SENDER_ID`.
3. Fund the wallet (each SMS costs a few naira). Many Nigerian lines are on DND: ask Termii to activate the **DND route** and set `TERMII_CHANNEL=dnd`, otherwise `generic`.
SMS is used when *SMS* is ticked on a broadcast, and automatically for people who aren't on WhatsApp.

#### Email (Resend — free tier is enough for V1)
1. **resend.com** → sign up → **Domains → Add domain** → `flagupjesus.org`. Resend shows a few DNS records (TXT for SPF/DKIM, an MX for the `send` subdomain). Add each one in **Hostinger → Domains → flagupjesus.org → DNS / Nameservers**, then click **Verify** in Resend (can take up to an hour).
2. **API Keys → Create API key** (Sending access) → `RESEND_API_KEY`.
3. `EMAIL_FROM=FlagUpJesus <news@flagupjesus.org>` (any name @flagupjesus.org works once verified). Replies go to the contact email in **Admin → Settings**.
Emails include the title, message and flyer, styled in FUJ red.

How phone delivery works: people marked *not on WhatsApp* get SMS directly; everyone else gets WhatsApp. If WhatsApp rejects a message or later reports the number isn't on WhatsApp (error 131026), the SMS version (with a flyer link) is sent automatically and the person is remembered as *not on WhatsApp*. Tick **SMS** as well to text everyone in addition to WhatsApp.

### Automatic follow-up for absent members

1. **Settings → Automatic follow-up for absent members**: on/off, after how many missed Sundays (default **2**), remind every **3** days (2–14), keep going **until they come back** or stop after *N* messages, which channels (WhatsApp / SMS / email — plus the app inbox always), and the wording of the first message and the reminders (`{first_name}` is personalised).
2. It runs **straight after Sunday check-in is closed** (first messages go out that evening) and **every morning at about 10:00 Lagos time** for reminders, via Vercel Cron (`vercel.json` → `/api/cron/follow-ups`). Add **`CRON_SECRET`** (any long random text, e.g. `openssl rand -hex 24`) in Vercel → Environment Variables and redeploy — without it the daily run is refused. Vercel's free plan allows one run per day, which is all this needs.
3. **Pastoral care** shows who was flagged, how many automatic messages each person has had and when the next one is due; **Check absences now** runs the whole thing on demand. Each message is a normal tracked broadcast (read / replied), and replies land in the **Inbox**.
4. It stops for a person when they check in at any service, when you mark their task **Completed** or **Dismissed**, when their status is no longer *member*, or at the message limit. If they come back and later miss again, a new follow-up starts.

## 5. Secrets & production

- `QR_SIGNING_SECRET` (or `SESSION_SECRET`): 32+ random characters, e.g. `openssl rand -base64 48`. Production refuses to start signing with the placeholder value.
- Production needs Supabase — the local JSON store is for development only (serverless file systems are not persistent).
- Developer sign-in is off automatically when using Supabase data or in production. `ALLOW_DEV_LOGIN=true` forces it on — never do that in production.
- Rate limits are in-memory (per instance). Use a shared store if you run multiple instances.

## 6. How check-in works (and its limits)

1. Staff: **Services → (service) → Open check-in & launch display** (or **Attendance → Open QR display**).
2. The display fetches a signed token every 20 s from `/api/attendance/token` (staff-only).
3. The phone posts the token to `/api/check-in/scan` (10 s grace for camera/network lag) and receives a 15-minute httpOnly ticket.
4. The member types their username → `/api/check-in/confirm` records attendance with server time. A unique `(person_id, service_id)` key prevents duplicates.
5. **One phone, one person per service** — a device that already checked someone in can't check in a different username (stops one person checking in a list of friends). Ushers can check anyone in manually.

A rotating QR reduces casual sharing but can't prove physical presence; a screenshot works during its ~30 s window. Usernames aren't secrets — that's why check-in requires a fresh scan, and why the **portal** needs username **and** phone number (or Google).

## 7. Commands

```bash
npm run dev        # local development
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # unit + integration tests (vitest)
npm run build      # production build
npm run test:e2e   # end-to-end tests (Playwright, runs `next start` on :3100 with a fresh local DB)
npm run test:all   # everything above
```

## 8. Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Member sign in (Google, or username + phone) |
| `/admin/login` | Admin sign in (shared FUJ admin email + password, or staff Google) — reached by visiting `/admin` |
| `/register`, `/register/complete` | First-time registration → flag username |
| `/check-in` | QR check-in (opened by scanning) |
| `/member/*` | Member portal: messages, announcements, prayer-requests, testimonies, attendance, giving, profile |
| `/admin` | Dashboard |
| `/admin/members`, `/admin/members/[id]`, `/admin/members/new` | People |
| `/admin/services`, `/admin/services/[id]`, `/admin/services/new` | Services + check-in controls |
| `/admin/attendance`, `/admin/attendance/display`, `/admin/attendance/desk` | Attendance, rotating QR display, check-in by name |
| `/admin/pastoral-care`, `/admin/pastoral-care/[id]` | Follow-up queue + task |
| `/admin/messaging`, `/admin/messaging/[id]` | Broadcasts + read/response tracking |
| `/admin/inbox`, `/admin/inbox/[personId]` | Member responses + replies |
| `/admin/announcements`, `/admin/prayer-requests`, `/admin/testimonies` | Content + moderation |
| `/admin/giving`, `/admin/reports`, `/admin/settings` | Management |
| `/api/webhooks/whatsapp` | WhatsApp delivery receipts + inbound replies |
| `/api/cron/follow-ups` | Daily automatic absence follow-up (Vercel Cron, needs `CRON_SECRET`) |
| `/api/health` | Health / configuration check |

## 9. Deploying

The app needs a Node server (route handlers, server actions, uploads) — not a static export. Vercel or any Next.js-compatible Node host works.

1. Run the checks locally: `npm run test:all`.
2. Run `supabase/setup.sql` in the production Supabase project's SQL Editor and check `/api/health`.
3. In the host's environment settings add: `NEXT_PUBLIC_APP_URL` (your https domain), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_ID`, `CLIENT_SECRET`, `ADMIN_LOGIN_EMAIL`, `ADMIN_LOGIN_PASSWORD` (12+ chars) and a random `QR_SIGNING_SECRET` (`openssl rand -base64 48`). Never put secrets in `NEXT_PUBLIC_*` variables.
4. Add `https://<your-domain>/api/auth/google/callback` to the Google OAuth client's authorised redirect URIs.
5. Deploy, then open `https://<your-domain>/api/health` — expect `"mode":"supabase","database":"ready"` and `"adminLogin":true`.

On a plain Node host:

```bash
npm ci
npm run build
npm start
```

### Live on flagupjesus.org (Vercel + Hostinger domain)

1. **Merge** the latest branch into `master` — Vercel deploys `master` to production.
2. **Vercel → project `fuj-online` → Settings → Environment Variables** (Production): add every variable from `.env.local`, with `NEXT_PUBLIC_APP_URL` set to the **primary** domain Vercel shows — `https://www.flagupjesus.org` (Vercel's default; `flagupjesus.org` redirects to it). Tip: you can paste the whole `.env.local` into the first *Key* box to add them all at once, then fix `NEXT_PUBLIC_APP_URL`. Then **Deployments → ⋯ → Redeploy** (`NEXT_PUBLIC_*` values are baked in at build time).
3. **Vercel → Domains → Add** both `www.flagupjesus.org` and `flagupjesus.org`; keep **www** as the primary and let `flagupjesus.org` redirect to it. Vercel then shows the DNS records to create for each.
4. **Hostinger → Domains → flagupjesus.org → DNS / Nameservers → DNS records**: delete the existing `A` record for `@` and the `CNAME` for `www` (Hostinger's parking page), then add exactly what Vercel shows — usually `A  @  76.76.21.21` and `CNAME  www  cname.vercel-dns.com`. Leave MX/TXT records alone.
5. Wait for Vercel to show **Valid Configuration** (minutes, occasionally a few hours); HTTPS is issued automatically.
6. **Google Cloud → Credentials → your OAuth client**: add `https://www.flagupjesus.org/api/auth/google/callback` (the primary domain) to Authorised redirect URIs; on the **OAuth consent screen** add `flagupjesus.org` as an authorised domain and **publish** the app so anyone (not only test users) can sign in.
7. Check `https://www.flagupjesus.org/api/health` → `"mode":"supabase"`, `"database":"ready"`, `"adminLogin":true`, `"googleAuth":true`.

Turn on **auto-renewal** for the domain in Hostinger so the site never goes offline when it expires.

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| `/api/health` shows `"mode":"local"` | `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` is missing; restart the server after editing `.env.local`. |
| `/api/health` shows `database: unavailable` / `PGRST205` | Run the migrations in the same Supabase project as the URL, then `notify pgrst, 'reload schema';`. |
| `/admin/login` says the admin login isn't set up | Set `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` (12+ characters in production) and restart. |
| Google sign-in returns "oauth_exchange" | The redirect URI in Google Cloud must exactly match `<NEXT_PUBLIC_APP_URL>/api/auth/google/callback`. |
| QR display says check-in isn't open | Open check-in for the service first (Services → service → Open check-in). |
| Flyer upload fails in production | Run migration `0007` (creates the public `flyers` storage bucket) and check the service-role key. |
| Port 3000 is busy | `npm run dev -- --port 3001`. |

## 11. Project layout

```
src/
  app/                  pages (App Router), API route handlers
  components/           layout shells, landing-page motion components, UI
  lib/
    db/                 storage contract + Supabase and local JSON implementations, row types, starting data (ministry name + bank account only)
    repo/               domain logic (people, services/attendance, care, messaging, content, giving, reports)
    actions/            server actions (admin, member) — each checks the caller's role
    auth/               signed-cookie sessions, roles, Google + identity handling
    security/           HMAC signing, QR tokens/tickets, rate limiting
    messaging/          SMS / email provider adapters
supabase/migrations/    SQL schema (run in order)
tests/unit, tests/integration, tests/e2e
```

## Brand and scope

- Ministry: FlagUpJesus Global Ministry · Application: FlagUpJesus
- Motto: **We Love, We Give, We Change The World**
- Contact: 2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt · 07042741000 · flagupjesusglobal@gmail.com
- Programmes: Word Experience (Sundays 4:30 PM) · Weekly Prayers (Wednesdays 5:00 PM) · Connect (last Sunday monthly) · TFT — The Family Table (last Saturday monthly) · Online Global Prayers (third Friday monthly) · The Forge Retreat (quarterly) · International Prayer & Missions Conference (June, annual) · Jesus Festival (November, annual) — editable in Admin → Settings → Programmes & service times
- Giving: Fidelity Bank · 5600605313 · FlagUp Jesus Global Ministry (contact and bank details are editable in Admin → Settings)
- V1: single church location · Sermon repository deferred to V2
- Online card payments: not enabled — giving is recorded by finance staff; a payment provider must confirm via verified webhooks.
