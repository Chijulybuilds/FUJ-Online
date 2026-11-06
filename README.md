# FlagUpJesus

<<<<<<< Updated upstream
A responsive church-management web app for **Flag of Jesus Global Ministry** (product name **FlagUpJesus**): an animated public landing page, QR attendance with personal **flag usernames**, a member portal, and an admin dashboard for pastoral care, broadcasts, prayer, testimonies, giving and reports.

## What's included

| Area | What it does |
|---|---|
| **Landing page** (`/`) | Aurora hero with word-reveal animation, live countdown to the next service ("LIVE NOW" when check-in is open), marquee, scroll-reveal sections, animated counters, service times, watch-online, how check-in works, public announcements, testimonies carousel, public prayer request form + prayer wall, giving details, CTA. Light/dark themes; respects `prefers-reduced-motion`. |
| **QR check-in** | Staff open check-in for a service → full-screen display shows a QR that **rotates every 20 s**. Scanning exchanges the short-lived token for a 15-minute ticket on that phone. **Returning members just type their flag username (no OTP).** First-timers tap *Register* and are checked in automatically. |
| **Flag usernames** | Every person gets a unique username at first registration: `flag` + first name + 3 digits, e.g. `flaggrace101`. Case-insensitive; the `flag` prefix is optional when typing. |
| **Registration** | Google sign-in, **or** directly from a scanned QR (proves they are in the room — no SMS needed). Ushers/admins can also register people. |
| **Member portal** (`/member`) | Username card, messages from the church (read + reply), announcements, prayer requests + prayer wall ("I prayed"), testimonies, attendance history, giving details/history, profile. Sign in with Google or username + phone number. |
| **Admin** (`/admin`) | Dashboard, people directory (search, CSV export), member records, services, attendance, QR display, usher manual check-in, pastoral care, broadcasts + tracking, inbox, announcements, prayer moderation, testimony moderation, departments, giving, reports, settings & staff roles. |
| **Pastoral care** | Absence analysis (runs automatically when check-in closes, or on demand) flags regular attenders who missed the last *N* services and first-time guests. Tasks have priority, assignee, due date, confidential notes, call/WhatsApp shortcuts and a contact log. It never changes membership status automatically. |
| **Broadcasts & follow-up tracking** | Send to everyone / members / visitors / first-timers / absentees / a department / one person, with `{first_name}` personalisation. Track **read** and **responded** per recipient, send a **follow-up broadcast** to non-readers or non-responders, or hand non-responders to pastoral care as tasks. Replies land in the admin **Inbox**. In-app delivery always works; SMS (Termii) and email (Resend) when configured. |
| **Roles** | `super_admin`, `admin`, `pastor`, `pastoral_worker`, `finance_admin`, `department_leader` (usher). Each sees only their areas (e.g. finance can't read prayer requests; "private" prayer requests are pastor/admin only). |

## 1. Run locally
=======
FlagUpJesus is a responsive church-management and member-engagement application for **Flag of Jesus Global Ministry**. It is built as a Next.js application and uses Supabase for hosted authentication, PostgreSQL, and row-level security (RLS).

> **Project status:** This repository is a runnable V1 scaffold and user-interface foundation. Several pages use sample data, and some service, member, OTP-verification, QR-session administration, messaging, and payment workflows are not complete. A successful build does not mean the application is ready to manage real member or financial data. Review [What works and what is not finished](#what-works-and-what-is-not-finished) before using it with a congregation.

## Contents

- [Capabilities and project status](#capabilities-and-project-status)
- [Technology and tools](#technology-and-tools)
- [Requirements](#requirements)
- [Run the app locally](#run-the-app-locally)
- [Environment variables](#environment-variables)
- [Set up Supabase](#set-up-supabase)
- [Configure phone OTP and SMS delivery](#configure-phone-otp-and-sms-delivery)
- [Routes and API endpoints](#routes-and-api-endpoints)
- [Database and security model](#database-and-security-model)
- [Other integrations](#other-integrations)
- [Development commands and testing](#development-commands-and-testing)
- [Deploying](#deploying)
- [Troubleshooting](#troubleshooting)
- [Repository layout](#repository-layout)
- [Product scope](#product-scope)

## Capabilities and project status

### Present in the repository

- Responsive landing page with the ministry logo, red-and-black brand styling, and a persistent light/dark theme switch.
- Admin and member portal screen layouts.
- Sample-data dashboards and page foundations for members, services, attendance, announcements, pastoral care, departments, prayer requests, testimonies, giving, reports, and settings.
- Supabase browser and server clients, cookie-based session refresh middleware, and environment-based demo/Supabase mode detection.
- SQL migrations for the initial PostgreSQL schema, RLS policies, auth profile trigger, and PostgREST schema refresh.
- Zod registration input validation.
- HMAC-signed, short-lived QR token helpers and attendance token/check-in route-handler foundations.
- A health endpoint that reports demo mode or checks whether the `profiles` table is visible through the database API.
- Unit tests for QR token signing and validation.

### Not finished or not connected to production data

- **Pages displaying sample data are not live database views.** In particular, the admin dashboard, member directory, service schedule, announcements, pastoral follow-up queue, reports, and giving figures include static sample content.
- **Phone OTP verification UI is incomplete.** The login and registration forms can ask Supabase Auth to send an OTP, but the application does not yet include a code-entry page that calls `verifyOtp()` and completes the sign-in flow. Configure the provider below to deliver test messages, but do not consider application login end-to-end complete until verification is implemented and tested.
- **Admin/member authorization and role provisioning are incomplete.** The route groups and sidebar are UI organization, not a complete authorization boundary. Do not rely on hiding a link or the current sample admin profile to protect data.
- **QR session lifecycle screens are incomplete.** The attendance display can request a token for an existing active session; the app does not yet provide a finished workflow for an authorized administrator to create and activate that session.
- **Messaging and payment webhooks are placeholders** and return HTTP 501. No SMS campaign, WhatsApp inbox, donation checkout, or payment reconciliation provider is integrated.
- **Member registration does not yet create/link a church `people` row.** Auth identity and a church person record are deliberately separate in the schema.
- The integration and e2e test directories currently contain guidance, not a configured integration/e2e runner. Playwright is not a project dependency.

Use demo mode for a UI preview. Before production, finish the relevant workflows, enforce authorization on the server and in RLS, review the migrations and policies, and complete security, privacy, accessibility, and provider testing.

## Technology and tools

| Tool or service | Purpose |
|---|---|
| Node.js 20.9+ and npm 10+ | Run the Next.js application, tests, and build. |
| Next.js 15 App Router | React pages, layouts, route handlers, middleware, development server, and production build. |
| React 19 and TypeScript 5 | User interface and strict type checking. |
| Tailwind CSS 3, PostCSS, and Autoprefixer | Utility styling and CSS processing. Some layout styles also live in `src/app/globals.css`. |
| Supabase JS and `@supabase/ssr` | Browser/server clients, Supabase Auth requests, and cookie-based server sessions. |
| Supabase hosted project | Managed PostgreSQL, Auth, REST API, and RLS. A hosted project is optional for the local demo. |
| Supabase CLI and Docker-compatible runtime (optional) | Run a local Supabase stack and apply/test migrations locally. Neither is required to run only the Next.js app against a hosted Supabase project. |
| Zod | Validate registration and API inputs. |
| `qrcode` | Render QR images; `lucide-react` supplies interface icons; `clsx` joins class names. |
| Vitest | Run the current unit tests. |
| ESLint and `eslint-config-next` | Lint the project. |
| VS Code and Git (recommended) | Editing, source control, and team workflow; not required by the runtime. |

The npm dependencies and commands are declared in [`package.json`](./package.json) and locked in [`package-lock.json`](./package-lock.json). Install with npm; do not install a separate OTP SDK, SMS SDK, image library, or e2e runner unless you are implementing that integration.

## Requirements

- Node.js **20.9 or later** and npm **10 or later**.
- A supported operating system for Node.js (Linux, macOS, or Windows).
- Internet access to install packages.
- A modern browser for testing.
- Optional: a Supabase project for real Auth/database connectivity.
- Optional: an SMS provider and an enabled Supabase Phone Auth configuration for sending OTPs to real phone numbers.
- Optional: Docker and the Supabase CLI only if you want to run the Supabase stack locally.

## Run the app locally

From the project directory:
>>>>>>> Stashed changes

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js reads `.env.local` at startup. If you create or change environment variables while the server is running, restart `npm run dev`.

<<<<<<< Updated upstream
**Without Supabase** (`SUPABASE_SERVICE_ROLE_KEY` empty) the app stores data in `.data/flagupjesus-db.json` and seeds demo data. Developer sign-in is available on `/login?as=staff` (try `admin@flagupjesus.local`, `pastor@…`, `care@…`, `finance@…`, `usher@…`) and demo members such as `flaggrace101` / `08031234567`.

## 2. Connect Supabase (database)

1. In the Supabase SQL Editor run **every** file in `supabase/migrations/` in order (`0001` → `0005`). `0005` is idempotent and adds usernames, broadcasts, follow-up logs, staff, etc.
2. Optionally run `supabase/seed.sql`.
3. Put the Project URL, anon key and **service-role key** in `.env.local`. The service-role key is used only on the server (route handlers / server actions); permissions are enforced in the app layer and RLS stays on so the anon key cannot read church data.
4. Check `GET /api/health` → `{"mode":"supabase","database":"ready"}`. If you see `PGRST205`, run `notify pgrst, 'reload schema';`.

## 3. Google sign-in

The app runs the Google OAuth flow itself using `CLIENT_ID` / `CLIENT_SECRET` (also accepted as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client (Web application).
2. Add the authorised redirect URI: `http://localhost:3000/api/auth/google/callback` (and your production URL's equivalent).
3. Set `ADMIN_EMAILS=you@gmail.com` — the first time that Google account signs in on **Staff sign in**, it becomes a super admin. Add other staff in **Settings → Staff & roles**.

Members can sign in with Google (linked by Google account / email) or with username + phone.

## 4. Secrets & production

- `QR_SIGNING_SECRET` (or `SESSION_SECRET`): 32+ random characters, e.g. `openssl rand -base64 48`. Production refuses to start signing with the placeholder value.
- Production needs Supabase — the local JSON store is for development only (serverless file systems are not persistent).
- Developer sign-in is off automatically when using Supabase data or in production. `ALLOW_DEV_LOGIN=true` forces it on — never do that in production.
- Rate limits are in-memory (per instance). Use a shared store if you run multiple instances.

## 5. How check-in works (and its limits)

1. Staff: **Services → (service) → Open check-in & launch display** (or **Attendance → Open QR display**).
2. The display fetches a signed token every 20 s from `/api/attendance/token` (staff-only).
3. The phone posts the token to `/api/check-in/scan` (10 s grace for camera/network lag) and receives a 15-minute httpOnly ticket.
4. The member types their username → `/api/check-in/confirm` records attendance with server time. A unique `(person_id, service_id)` key prevents duplicates.
5. **One phone, one person per service** — a device that already checked someone in can't check in a different username (stops one person checking in a list of friends). Ushers can check anyone in manually.

A rotating QR reduces casual sharing but can't prove physical presence; a screenshot works during its ~30 s window. Usernames aren't secrets — that's why check-in requires a fresh scan, and why the **portal** needs username **and** phone number (or Google).

## 6. Commands

```bash
npm run dev        # local development
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # unit + integration tests (vitest)
npm run build      # production build
npm run test:e2e   # end-to-end tests (Playwright, runs `next start` on :3100 with a fresh local DB)
npm run test:all   # everything above
```

## 7. Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login`, `/login?as=staff` | Member / staff sign in |
| `/register`, `/register/complete` | First-time registration → flag username |
| `/check-in` | QR check-in (opened by scanning) |
| `/member/*` | Member portal: messages, announcements, prayer-requests, testimonies, attendance, giving, profile |
| `/admin` | Dashboard |
| `/admin/members`, `/admin/members/[id]`, `/admin/members/new` | People |
| `/admin/services`, `/admin/services/[id]`, `/admin/services/new` | Services + check-in controls |
| `/admin/attendance`, `/admin/attendance/display` | Attendance + rotating QR display |
| `/admin/pastoral-care`, `/admin/pastoral-care/[id]` | Follow-up queue + task |
| `/admin/messaging`, `/admin/messaging/[id]` | Broadcasts + read/response tracking |
| `/admin/inbox`, `/admin/inbox/[personId]` | Member responses + replies |
| `/admin/announcements`, `/admin/prayer-requests`, `/admin/testimonies` | Content + moderation |
| `/admin/departments`, `/admin/giving`, `/admin/reports`, `/admin/settings` | Management |
| `/api/health` | Health / configuration check |

## 8. Project layout

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
=======
### Demo mode

If either `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is empty, the app reports `mode: "demo"`. The interface can be previewed, but sample data is not persisted.

### Supabase-connected mode

Set both public Supabase variables in `.env.local` to use Supabase Auth and database APIs. The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health):

- `mode: "demo"` means the public Supabase settings are absent.
- `mode: "supabase"` means the settings are present; it does **not** by itself mean the database schema is available.
- HTTP 200 with `database: "ready"` means the health check can see `public.profiles`.
- HTTP 503 with `database: "unavailable"` means the project/API/schema needs investigation. The JSON includes a database error code but no credentials.

Do not treat Supabase-connected mode as evidence that the scaffold’s unfinished pages have become live database features.

## Environment variables

Copy `.env.example` to `.env.local` and set values locally. `.env.local` is ignored by Git; never commit it or paste its secrets into an issue, chat, or source file.

| Variable | Required? | Where it is used |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical app URL for configuration and provider setup. Use `http://localhost:3000` locally and the HTTPS production URL after deployment. |
| `NEXT_PUBLIC_APP_NAME` | No | Public-facing application name; defaults to `FlagUpJesus`. |
| `NEXT_PUBLIC_CHURCH_NAME` | No | Ministry name; defaults to `Flag of Jesus Global Ministry`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for Supabase mode | Supabase project URL from the project’s API settings. This is public configuration. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for Supabase mode | Supabase publishable/anon key from the same project. This key is safe to use in the browser only when RLS is correctly enabled and configured. |
| `SUPABASE_SERVICE_ROLE_KEY` | **No; leave blank unless needed** | Optional server-only key that bypasses RLS. Current ordinary Auth/RLS-backed app flows do not require it. Never add a `NEXT_PUBLIC_` prefix or import it into a client component. |
| `QR_SIGNING_SECRET` | Required for live QR token signing | Server-only secret used by HMAC QR signing. Use at least 32 random bytes; do not use the example placeholder in production. |

Generate a signing secret locally:

```bash
openssl rand -base64 48
>>>>>>> Stashed changes
```

If OpenSSL is unavailable, use another cryptographically secure random generator. Keep the resulting value private and configure it in the server’s environment, not in browser code.

<<<<<<< Updated upstream
- Ministry: Flag of Jesus Global Ministry · Application: FlagUpJesus
- V1: single church location · Sermon repository deferred to V2
- Online card payments: not enabled — giving is recorded by finance staff; a payment provider must confirm via verified webhooks.
=======
SMS provider credentials and API keys are configured in Supabase Auth’s provider settings or in the server-side SMS Hook you choose to build. They are **not** `NEXT_PUBLIC_` app variables and are not currently read directly by this application.

## Set up Supabase

### Hosted Supabase project

1. Create a Supabase project and choose a region appropriate for your users and operational requirements.
2. In the project’s API settings, copy the Project URL and publishable/anon key into `.env.local`. Verify the URL belongs to the project where you will run the migrations.
3. In the Supabase SQL Editor for that same project, apply the migrations in order:

   ```text
   supabase/migrations/0001_core_schema.sql
   supabase/migrations/0002_rls_policies.sql
   supabase/migrations/0003_auth_profile_trigger.sql
   supabase/migrations/0004_refresh_postgrest_schema.sql
   ```

4. `supabase/seed.sql` is optional development seed data. Run it only in a non-production project after the migrations.
5. Confirm the database tables exist in the `public` schema and that API access is enabled for the tables your application needs.
6. If PostgREST reports `PGRST205` after migrations, confirm the project URL and schema, then refresh its schema cache:

   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

7. Set the Supabase Auth site URL to `http://localhost:3000` for local work. Add the matching redirect URLs. Update them to the production URL when deploying.
8. Configure phone authentication and an SMS provider if you intend to test real OTP delivery; see the next section.
9. Run `npm run dev` and inspect `/api/health`.

The migrations define the schema, constraints, a profile-creation trigger, and RLS policies. They do not create an administrator account or a secure administrator role-provisioning process. Review every policy in a test project before using any real personal information.

### Optional local Supabase stack

For local development of the database/Auth stack itself, install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and a Docker-compatible container runtime, then follow the CLI instructions to initialize/start a local stack. The CLI and Docker are optional and are not installed by this project’s npm dependencies.

The `supabase/config.toml` file provides local project settings. Local Supabase endpoints and keys are different from hosted project credentials; configure the local URL and anon key in `.env.local` while testing locally. Do not point a development app at production data accidentally.

## Configure phone OTP and SMS delivery

### What “OTP API” means in this project

The application uses **Supabase Auth’s phone OTP service**, not a custom OTP-generating API. The client calls `supabase.auth.signInWithOtp(...)`; Supabase Auth creates and verifies the one-time code and asks the configured SMS provider to deliver it. Your application should never generate, store, or verify its own SMS codes.

Supabase Auth exposes an OTP endpoint (`/auth/v1/otp`) and a verification endpoint (`/auth/v1/verify`) through its Auth service. The Supabase JavaScript client wraps those requests. Do not call a phone provider directly from a browser using a secret provider key.

### Provider options

Supabase documents these SMS options for Phone Auth:

- **Twilio** — a common general-purpose option; supports SMS and, in Supabase’s documented configuration, WhatsApp with Twilio/Twilio Verify.
- **Twilio Verify** — managed verification workflows; check current Supabase settings and provider pricing/availability.
- **Vonage** — SMS delivery option available in Supabase Auth provider settings.
- **MessageBird (Bird)** — SMS delivery option available in Supabase Auth provider settings.
- **TextLocal** — community-supported option; verify current compatibility and availability before depending on it.
- **Regional provider via a Supabase Send SMS Hook** — useful when a local provider is preferred. For example, a provider such as Termii or Africa’s Talking may require you to implement and host a secure Supabase Auth Send SMS Hook rather than entering its API key as if it were a built-in Auth provider.

Provider support, country coverage, sender-ID rules, registration, pricing, delivery times, and regulations change. Check the current Supabase Auth dashboard and the provider’s official documentation before choosing a service. Confirm coverage and sender-ID approval for your recipient countries (including Nigerian phone networks if applicable); do not assume that a sender ID or provider works in every country.

### Supabase dashboard setup

1. In Supabase Dashboard, open **Authentication → Sign In / Providers** (dashboard labels may change).
2. Enable **Phone** sign-in.
3. Select a supported SMS provider and enter the provider credentials in Supabase’s protected provider settings.
4. Configure the OTP message template. Never include secrets or unnecessary personal data in the text.
5. Review OTP expiry, resend limits, abuse protection, and CAPTCHA/rate-limit options. SMS is billable and can be abused if endpoints are left unprotected.
6. For local testing, use Supabase Auth’s configured test phone numbers and fixed OTP codes where available. This avoids sending paid messages.
7. Test a real phone only after checking provider balance, country permissions, sender-ID approval, and consent requirements.

### Phone format and end-to-end readiness

- Collect and submit phone numbers in **E.164** format, such as `+234...` for a Nigerian number. The current forms show an example placeholder but do not yet provide a full international phone-number input/normalization component.
- The current `/login` and `/register` forms request OTP delivery, but the code-entry/confirmation UI and `verifyOtp()` call are not implemented. Sending a message proves only that the send request was accepted; it does not complete login or registration.
- Before calling this flow operational, implement the OTP input, call `supabase.auth.verifyOtp({ phone, token, type: "sms" })`, handle resend/expiry/errors, and test that the resulting session is refreshed by middleware.
- Registration currently passes name/email as Auth metadata. A verified Auth user is not automatically linked to a church `people` row; implement and secure that linking workflow separately.
- For a custom regional provider, implement a Supabase Send SMS Hook on the server/Edge Function, store its secret in Supabase’s secret manager, validate hook authorization, and test delivery and failure behavior. This project does not currently include such a hook or Termii/Africa’s Talking integration.

Supabase references: [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login), [Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), and [Auth rate limits and CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

## Routes and API endpoints

### Pages

| Route | Purpose | Status |
|---|---|---|
| `/` | Landing page and entry links | Implemented |
| `/login` | Phone OTP request form | Sends OTP when Supabase is configured; code verification is not implemented |
| `/register` | Visitor/member registration entry | Validates and requests OTP; persistence/person linking is incomplete |
| `/admin` | Admin overview | Sample data |
| `/admin/members`, `/admin/members/new`, `/admin/members/[memberId]` | People directory and record screens | Sample data/UI scaffold |
| `/admin/services`, `/admin/services/new`, `/admin/services/[serviceId]` | Service schedule and forms | Sample data/UI scaffold |
| `/admin/attendance` and `/admin/attendance/[serviceId]` | Attendance overview/detail | Sample data/UI scaffold |
| `/admin/attendance/display` | Projectable rotating attendance QR | Uses a live signed token only when an authenticated user can read an active QR session; demo mode uses a clearly marked demo token |
| `/admin/pastoral-care` and `/admin/pastoral-care/[taskId]` | Follow-up queue | Sample data/UI scaffold |
| `/admin/announcements`, `/admin/departments`, `/admin/giving`, `/admin/inbox`, `/admin/prayer-requests`, `/admin/reports`, `/admin/settings`, `/admin/testimonies` | Management screens | Primarily placeholders/sample content |
| `/member` | Member landing page | UI scaffold |
| `/member/announcements`, `/member/attendance`, `/member/giving`, `/member/prayer-requests`, `/member/profile`, `/member/testimonies` | Member features | UI scaffold; not all workflows save/load data |
| `/check-in` | QR check-in entry | UI foundation; does not yet submit a completed client check-in flow |
| `/attendance-display` | Redirect alias for the admin QR display | Implemented |

### API routes

| Method and route | Purpose | Current behavior |
|---|---|---|
| `GET /api/health` | Runtime/schema health | Reports demo/Supabase mode; in Supabase mode checks visibility of `profiles`. |
| `GET /api/attendance/token` | Get a rotating token for an active session | Requires a signed-in user and an active session visible under RLS. |
| `POST /api/attendance/token` | Get a token for a specified active session | Requires a signed-in user and a valid session ID. |
| `POST /api/attendance/check-in` | Validate token and record attendance | Authenticates the user, checks the token/session and inserts attendance; test RLS and person linkage before use. |
| `POST /api/webhooks/messaging` | Future messaging provider webhook | Placeholder; returns HTTP 501. |
| `POST /api/webhooks/payments` | Future payment provider webhook | Placeholder; returns HTTP 501. |

## Database and security model

The main schema is in `supabase/migrations/0001_core_schema.sql`; follow-on files add RLS policies, an Auth profile trigger, and a PostgREST cache refresh. Principal tables include:

- `people`: church person records, separate from login identities.
- `profiles`: application profile linked to Supabase Auth and optionally a church person.
- `roles` and `user_roles`: role catalog and assignments.
- `departments` and `member_departments`: ministry teams and membership links.
- `service_types`, `services`, `qr_sessions`, and `attendance`: service scheduling and check-ins.
- `follow_up_tasks`, `announcements`, `prayer_requests`, and `testimonies`: ministry features.
- `donations` and `audit_logs`: financial records and audit foundation.

Important protections and operational gaps:

- RLS must remain enabled and policies must be reviewed against the actual roles and app flows.
- Never ship the Supabase service-role key to the browser. The anon/publishable key is expected to be public, but RLS is what protects data.
- Privileged role assignment needs a controlled process; users must never be able to grant themselves roles.
- A unique `(person_id, service_id)` constraint prevents duplicate attendance for one service.
- QR tokens are short-lived HMAC-signed values. `QR_SIGNING_SECRET` must be random, server-only, and identical across the app instances that validate tokens.
- A rotating QR is not proof of physical presence; screenshots can be shared. Keep an usher/manual fallback.
- Prayer, pastoral, profile, phone, and donation data is sensitive. Minimize access, define retention and deletion practices, and test policies with non-admin accounts.
- Do not configure permissive development policies or load real member data until authentication, route authorization, role provisioning, and RLS have been reviewed.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/QR_ATTENDANCE.md](./docs/QR_ATTENDANCE.md), and [docs/SECURITY.md](./docs/SECURITY.md).

## Other integrations

### SMS and WhatsApp messaging

Phone OTP delivery is configured through Supabase Auth as described above. General outbound messages, two-way inbox, announcement SMS, and WhatsApp Business messaging are **not implemented**. Choose a provider (for example a regional SMS service or WhatsApp Business Platform), then implement server-side sending, webhook signature verification, retries/idempotency, opt-in and opt-out, delivery status, templates, and rate limits. The existing messaging webhook is only a placeholder and does not receive messages.

### Payments and giving

No donation checkout or payment reconciliation provider is connected. If implementing payments, evaluate options such as Paystack or Flutterwave for your region, business requirements, settlement, fees, and compliance. Build server-side checkout/session creation and a verified webhook before displaying payment success. Verify provider signatures, use idempotency, and never trust a browser redirect as proof of payment. Keep payment secrets server-side. The current payments webhook returns HTTP 501.

### Supabase Storage

The application can be extended to use Supabase Storage, but current screens do not require a bucket. If adding profile images or documents, define private buckets, object-level access policies, upload limits, allowed file types, retention, and signed URL rules.

### Background jobs and email

No scheduler, queue, email provider, or Supabase Edge Function is currently wired into the application. Add a managed job/Edge Function only when a real workflow needs scheduled follow-ups, reports, or notifications; secure its secrets and make jobs retry-safe. Supabase phone OTP does not require adding a separate email or OTP vendor.

## Development commands and testing

```bash
npm run dev       # Next.js development server at http://localhost:3000
npm run typecheck # TypeScript check (tsc --noEmit)
npm run lint      # ESLint
npm test          # Vitest unit tests
npm run build     # optimized production build
npm start         # serve the last successful production build
```

Before submitting changes, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The current Vitest suite has a small QR-token unit test. The `tests/integration/` and `tests/e2e/` directories are guidance only; there is no configured integration database, Playwright installation, or end-to-end test command yet. Never point automated tests or local seed scripts at production data.

For manual Supabase testing:

1. Use a dedicated test Supabase project or a local Supabase stack.
2. Apply migrations and configure test phone numbers/provider credentials.
3. Test Auth and RLS as unauthenticated, ordinary member, and administrator accounts.
4. Test expired/invalid QR tokens, inactive/out-of-window sessions, duplicate attendance, and missing `profiles.person_id`.
5. Test provider/webhook failure paths before enabling any real messaging or money movement.

## Deploying

The app is a Next.js Node application and can be deployed to a compatible Node host (for example Vercel or another Next.js hosting platform).

1. Run the production checks and `npm run build`.
2. Configure production environment variables in the hosting provider’s server environment. Set `NEXT_PUBLIC_APP_URL`, the public Supabase URL/key, and a securely generated `QR_SIGNING_SECRET`.
3. Set Supabase Auth’s production Site URL and allow-listed redirect URLs to the actual HTTPS domain.
4. Confirm the production Supabase project has the reviewed migrations, RLS, Auth provider settings, and schema visibility.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` absent unless a specifically reviewed server-only feature requires it.
6. Use provider test/sandbox modes first; verify SMS delivery and payment webhook signatures using each provider’s official procedure.
7. Check the deployed `/api/health`, application logs, error handling, rate limits, monitoring, backups, and incident/secret rotation process.
8. Complete the authentication verification and authorization work listed above before exposing member/admin pages to real users.

For a standard Node host:

```bash
npm ci
npm run build
npm start
```

The host must provide a supported Node version and route traffic to the configured Next.js server port. Do not use a static export for this app: route handlers, middleware, and server-side Supabase operations require a server runtime.

## Troubleshooting

| Symptom | Checks |
|---|---|
| App says demo mode | Confirm both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are non-empty, point to the intended project, and restart `npm run dev`. |
| `/api/health` returns `PGRST205` | Confirm migrations were applied to the same project URL, tables are in the `public` schema, and PostgREST schema cache was refreshed with `NOTIFY pgrst, 'reload schema';`. |
| `/api/health` reports another database error | Check Supabase project availability, API URL/key pairing, grants/RLS, and server output. Never paste keys into logs or support requests. |
| OTP send fails | Confirm Phone Auth is enabled, provider settings and credentials are valid, the number is E.164, country/sender-ID rules are met, and Auth rate limits/provider balance allow the request. |
| OTP is delivered but login does not finish | Expected until the code-entry and `verifyOtp()` UI is implemented. OTP delivery alone does not establish an application session. |
| Live QR cannot be issued | Ensure the user is signed in, `QR_SIGNING_SECRET` is present and at least 32 characters, an active `qr_sessions` record is within its opening/closing window, and RLS allows the intended administrator to read it. |
| QR check-in returns 403 | Ensure Auth profile creation completed and the signed-in profile has a valid `person_id` linked to `people`. |
| QR check-in returns 409 | The QR session is inactive, outside its allowed time window, or closing. |
| Webhook endpoint returns 501 | This is expected: payment and messaging webhook implementations are not present yet. |
| `next`/`vitest` is not found | Run `npm install` (or `npm ci` when the lockfile is available) in the project directory. |
| Port 3000 is occupied | Stop the other local server or set a different port, e.g. `npm run dev -- --port 3001`. |

## Repository layout

```text
src/
  app/                 Next.js routes, layouts, pages, API route handlers
  components/          Shared layout, UI, and brand components
  features/            Feature documentation and reserved module structure
  lib/                 Supabase clients, validation, demo data, QR token utilities
  middleware.ts        Supabase cookie/session refresh
supabase/
  migrations/          Ordered PostgreSQL schema, policies, and supporting SQL
  seed.sql             Optional development-only reference data
tests/
  unit/                Vitest unit tests
  integration/         Integration-test guidance (runner not yet configured)
  e2e/                 E2E-test guidance (runner not yet configured)
docs/                  Architecture, product, QR, security, and integration notes
public/images/         Static brand assets
```

## Product scope

- **Ministry:** Flag of Jesus Global Ministry.
- **Application:** FlagUpJesus.
- **V1 target:** one church location.
- **Future/deferred:** sermon repository (V2), complete role-provisioning, end-to-end verified phone auth, live data-backed screens, provider messaging, payment processing, and automated integration/e2e suites.

See [docs/PRODUCT_SCOPE.md](./docs/PRODUCT_SCOPE.md) for product actors and planned workflows.
>>>>>>> Stashed changes
