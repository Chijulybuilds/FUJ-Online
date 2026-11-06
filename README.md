# FlagUpJesus Online Church — V1

A responsive church-management web app for **Flag of Jesus Global Ministry** (product name **FlagUpJesus**): an animated public landing page, QR attendance with personal **flag usernames**, a member portal, and an admin dashboard for pastoral care, broadcasts, prayer, testimonies, giving and reports.

## What's included

| Area | What it does |
|---|---|
| **Landing page** (`/`) | A five-layer FlagUpJesus story with a numbered section rail: **01 Welcome** (waving flag-red banner, outreach photo reel gliding from the right edge to the centre, live service countdown), **02 Our Heartbeat** (the motto lighting up word-by-word as you scroll; *The Word + The Works*), **03 Global Love Campaigns** (story-style outreach slideshow, two moving photo carousels, medical/food/community care), **04 Word & Worship** (Word Experience, Bible Study, International Prayer & Mission Conference, Unveiled Worship Encounter, service times), **05 Our Reach** (animated Nigeria map: Port Harcourt HQ, Lagos, Abuja, Bayelsa; Pastor Caleb's books). Then check-in how-to, news, testimonies, public prayer requests + prayer wall, partnering/giving. Light/dark themes; respects `prefers-reduced-motion`. Photos live in `public/images/fuj/`. |
| **Check-in desk** (`/admin/attendance/desk`) | The no-phone alternative to QR: staff type a member's **name** (or username/phone), tap **Check in**, and can add a first-timer with name + phone in one step. |
| **QR check-in** | Staff open check-in for a service → full-screen display shows a QR that **rotates every 20 s**. Scanning exchanges the short-lived token for a 15-minute ticket on that phone. **Returning members just type their flag username (no OTP).** First-timers tap *Register* and are checked in automatically. |
| **Flag usernames** | Every person gets a unique username at first registration: `flag` + first name + 3 digits, e.g. `flaggrace101`. Case-insensitive; the `flag` prefix is optional when typing. |
| **Registration** | Only **full name + phone number** (verified with a 6-digit **SMS OTP**) and an optional email — or simply **Continue with Google** (then just add a phone number). Ushers can also add first-timers at the check-in desk. |
| **Member portal** (`/member`) | Username card, messages from the church (read + reply), announcements, prayer requests + prayer wall ("I prayed"), testimonies, attendance history, giving details/history, profile. Sign in with Google or username + phone number. |
| **Admin** (`/admin` → `/admin/login`) | Not linked from the public site: go to `yoursite/admin`. Sign in with the **shared FUJ admin email + password** (each person adds their name so actions stay attributable), or individual staff can use Google. |
| **Admin pages** | Dashboard, people directory (search, CSV export), member records, services, attendance, QR display, usher manual check-in, pastoral care, broadcasts + tracking, inbox, announcements, prayer moderation, testimony moderation, departments, giving, reports, settings & staff roles. |
| **Pastoral care** | Absence analysis (runs automatically when check-in closes, or on demand) flags regular attenders who missed the last *N* services and first-time guests. Tasks have priority, assignee, due date, confidential notes, call/WhatsApp shortcuts and a contact log. It never changes membership status automatically. |
| **WhatsApp → SMS delivery** | Broadcasts (and inbox replies / announcements) can go to every contact's phone: **WhatsApp first** (WhatsApp and WhatsApp Business), **SMS automatically** for numbers that aren't on WhatsApp. The app learns who is on WhatsApp from delivery receipts, records per-recipient WhatsApp/SMS status, counts WhatsApp "read" receipts as reads, and turns WhatsApp replies into Inbox responses. |
| **Broadcasts & follow-up tracking** | Send to everyone / members / visitors / first-timers / absentees / a department / one person, with `{first_name}` personalisation. Track **read** and **responded** per recipient, send a **follow-up broadcast** to non-readers or non-responders, or hand non-responders to pastoral care as tasks. Replies land in the admin **Inbox**. In-app delivery always works; SMS (Termii) and email (Resend) when configured. |
| **Roles** | `super_admin`, `admin`, `pastor`, `pastoral_worker`, `finance_admin`, `department_leader` (usher). Each sees only their areas (e.g. finance can't read prayer requests; "private" prayer requests are pastor/admin only). |

## 1. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open http://localhost:3000.

**Without Supabase** (`SUPABASE_SERVICE_ROLE_KEY` empty) the app stores data in `.data/flagupjesus-db.json` and seeds demo data. Admin: open http://localhost:3000/admin and sign in with `admin@flagupjesus.local` / `FlagUpJesus@2026` (local demo only), or use "Developer sign-in" with `pastor@…`, `care@…`, `finance@…`, `usher@flagupjesus.local` to try other roles. Demo member: `flaggrace101` / `08031234567`. Without an SMS provider, the registration OTP is shown on screen in development.

## 2. Connect Supabase (database)

1. In the Supabase SQL Editor run **every** file in `supabase/migrations/` in order (`0001` → `0006`). `0005` and `0006` are idempotent (`0006` adds OTP codes and WhatsApp delivery tracking).
2. Optionally run `supabase/seed.sql`.
3. Put the Project URL, anon key and **service-role key** in `.env.local`. The service-role key is used only on the server (route handlers / server actions); permissions are enforced in the app layer and RLS stays on so the anon key cannot read church data.
4. Check `GET /api/health` → `{"mode":"supabase","database":"ready"}`. If you see `PGRST205`, run `notify pgrst, 'reload schema';`.

## 3. Google sign-in

The app runs the Google OAuth flow itself using `CLIENT_ID` / `CLIENT_SECRET` (also accepted as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client (Web application).
2. Add the authorised redirect URI: `http://localhost:3000/api/auth/google/callback` (and your production URL's equivalent).
3. Optional: set `ADMIN_EMAILS=you@gmail.com` — that Google account becomes a super admin the first time it uses "Staff sign in with Google" on `/admin/login`. Add other individual staff in **Settings → Staff & roles**. (Most admins can simply use the shared FUJ admin login.)

Members can sign in with Google (linked by Google account / email) or with username + phone.

## 4. Admin login, SMS OTP and WhatsApp

**Shared admin login** — set `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` (12+ characters in production) and optionally `ADMIN_LOGIN_ROLE` (default `super_admin`). Every FUJ admin signs in at `/admin` with these and types their own name, which is recorded in the audit log and on broadcasts. Change the password whenever someone leaves the team; sign-in attempts are rate-limited and failures are audited.

**SMS (Termii)** — `TERMII_API_KEY`, `TERMII_SENDER_ID` (registered sender ID), optional `TERMII_CHANNEL=dnd` to reach numbers on Do-Not-Disturb. Used for registration OTPs and for SMS broadcasts / WhatsApp fallback. In production, phone registration is unavailable until SMS is configured (Google still works).

**WhatsApp Business Cloud API (Meta)**
1. In Meta for Developers create an app → add **WhatsApp** → register your church's business number. Copy a **permanent access token** (System User) → `WHATSAPP_TOKEN`, and the **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
2. Create and get approved a **message template** (category *Utility* or *Marketing*) whose body has two variables, e.g. `*{{1}}*\n\n{{2}}\n\n— FlagUpJesus Global Ministry`, and set `WHATSAPP_TEMPLATE_NAME` (and `WHATSAPP_TEMPLATE_LANG`, default `en`). WhatsApp only delivers free-form messages to people who messaged you in the last 24 h, so broadcasts need this template.
3. Webhook: callback URL `https://<your-domain>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to **messages**. Set `WHATSAPP_APP_SECRET` (App settings → Basic) so receipts are signature-checked.

How delivery works: people marked *not on WhatsApp* get SMS directly; everyone else gets WhatsApp. If WhatsApp rejects the message, or the webhook later reports the number isn't on WhatsApp (error 131026), the SMS version is sent automatically and the person is remembered as *not on WhatsApp*. On a broadcast's tracking page you can also SMS everyone who has no WhatsApp delivery receipt yet. Staff can correct a person's WhatsApp status on their member record.

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
| `/admin/departments`, `/admin/giving`, `/admin/reports`, `/admin/settings` | Management |
| `/api/webhooks/whatsapp` | WhatsApp delivery receipts + inbound replies |
| `/api/health` | Health / configuration check |

## 9. Project layout

```
src/
  app/                  pages (App Router), API route handlers
  components/           layout shells, landing-page motion components, UI
  lib/
    db/                 storage contract + Supabase and local JSON implementations, row types, demo seed
    repo/               domain logic (people, services/attendance, care, messaging, content, giving, reports)
    actions/            server actions (admin, member) — each checks the caller's role
    auth/               signed-cookie sessions, roles, Google + identity handling
    security/           HMAC signing, QR tokens/tickets, rate limiting
    messaging/          SMS / email provider adapters
supabase/migrations/    SQL schema (run in order)
tests/unit, tests/integration, tests/e2e
```

## Brand and scope

- Ministry: Flag of Jesus Global Ministry · Application: FlagUpJesus
- V1: single church location · Sermon repository deferred to V2
- Online card payments: not enabled — giving is recorded by finance staff; a payment provider must confirm via verified webhooks.
