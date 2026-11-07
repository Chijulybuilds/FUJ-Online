# FlagUpJesus Online Church — V1

A responsive church-management web app for **FlagUpJesus Global Ministry** (product name **FlagUpJesus**): an animated public landing page, QR attendance with personal **flag usernames**, a member portal, and an admin dashboard for pastoral care, broadcasts, prayer, testimonies, giving and reports.

## What's included

| Area | What it does |
|---|---|
| **Landing page** (`/`) | A five-layer FlagUpJesus story with a numbered section rail: **01 Welcome** (waving flag-red banner, outreach photo reel gliding from the right edge to the centre, live service countdown), **02 Our Heartbeat** (the motto lighting up word-by-word as you scroll; *The Word + The Works*), **03 Global Love Campaigns** (story-style outreach slideshow, two moving photo carousels, medical/food/community care), **04 Word & Worship** (Word Experience, Bible Study, International Prayer & Mission Conference, Unveiled Worship Encounter, service times), **05 Our Reach** (animated Nigeria map: Port Harcourt HQ, Lagos, Abuja, Bayelsa; Pastor Caleb's books). Then check-in how-to, news, testimonies, public prayer requests + prayer wall, partnering/giving. Light/dark themes; respects `prefers-reduced-motion`. Photos live in `public/images/fuj/`. |
| **Check-in desk** (`/admin/attendance/desk`) | The no-phone alternative to QR: staff type a member's **name** (or username/phone), tap **Check in**, and can add a first-timer with name + phone in one step. |
| **QR check-in** | Staff open check-in for a service → full-screen display shows a QR that **rotates every 20 s**. Scanning exchanges the short-lived token for a 15-minute ticket on that phone. **Returning members just type their flag username (no OTP).** First-timers tap *Register* and are checked in automatically. |
| **Flag usernames** | Every person gets a unique username at first registration: `flag` + first name + 3 digits, e.g. `flagyourname123`. Case-insensitive; the `flag` prefix is optional when typing. |
| **Registration** | Only **full name + phone number** and an optional email — or **Continue with Google**. **No paid SMS OTP**: people are verified for free — automatically at their **first in-person check-in** (live QR or usher desk), by **Google**, or by an admin (**Mark verified**). The directory shows an *Unverified* filter for online sign-ups not yet seen in church. (Optional: `REGISTRATION_OTP=true` adds an SMS code via Termii.) |
| **Member portal** (`/member`) | Username card, messages from the church (read + reply), announcements, prayer requests + prayer wall ("I prayed"), testimonies, attendance history, giving details/history, profile. Sign in with Google or username + phone number. |
| **Admin** (`/admin` → `/admin/login`) | Not linked from the public site: go to `yoursite/admin`. Sign in with the **shared FUJ admin email + password** (each person adds their name so actions stay attributable), or individual staff can use Google. |
| **Admin pages** | Dashboard, people directory (search, CSV export), member records, services, attendance, QR display, check-in desk, pastoral care, broadcasts + tracking, inbox, announcements, prayer moderation, testimony moderation, giving, reports, settings & staff roles. |
| **Pastoral care** | Absence analysis (runs automatically when check-in closes, or on demand) flags regular attenders who missed the last *N* services and first-time guests. Tasks have priority, assignee, due date, confidential notes, call/WhatsApp shortcuts and a contact log. It never changes membership status automatically. |
| **Free WhatsApp sharing** | Broadcasts can carry a **flyer image**. After sending, **Share on WhatsApp** opens WhatsApp's share sheet with the flyer + message so you post it to the church's WhatsApp **broadcast lists, groups, Status or Channel** — free. Every recipient row also has a one-tap personal WhatsApp link, and **Members → Contacts for WhatsApp (.vcf)** loads everyone into the church phone. |
| **Automatic WhatsApp → SMS (optional, paid)** | Broadcasts (and inbox replies / announcements) can go to every contact's phone: **WhatsApp first** (WhatsApp and WhatsApp Business), **SMS automatically** for numbers that aren't on WhatsApp. The app learns who is on WhatsApp from delivery receipts, records per-recipient WhatsApp/SMS status, counts WhatsApp "read" receipts as reads, and turns WhatsApp replies into Inbox responses. |
| **Broadcasts & follow-up tracking** | Send to everyone / members / visitors / first-timers / absentees / one person, with `{first_name}` personalisation. Track **read** and **responded** per recipient, send a **follow-up broadcast** to non-readers or non-responders, or hand non-responders to pastoral care as tasks. Replies land in the admin **Inbox**. In-app delivery always works; SMS (Termii) and email (Resend) when configured. |
| **Roles** | `super_admin`, `admin`, `pastor`, `pastoral_worker`, `finance_admin`, `department_leader` (shown as **Usher**). Each sees only their areas (e.g. finance can't read prayer requests; "private" prayer requests are pastor/admin only). |

## 1. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open http://localhost:3000.

**Without Supabase** (`SUPABASE_SERVICE_ROLE_KEY` empty) the app stores data in `.data/flagupjesus-db.json`. It starts **empty** — no sample members, services or offerings; only the ministry name, contact details and bank account. Anything FUJ hasn't provided yet (address, phone, email, service times, livestream link) shows as a dashed **[placeholder]** until you fill it in **Admin → Settings**. Set `ADMIN_LOGIN_EMAIL` / `ADMIN_LOGIN_PASSWORD` in `.env.local`, then open http://localhost:3000/admin. Flyers uploaded locally are stored in `.data/uploads/`. (The automated tests use their own fictional sample data from `tests/e2e/fixtures/`, written to a throwaway database.) If your local database was created by an earlier version (with sample members, "Demo Bank", a Lagos address…), that old sample data is removed automatically the next time the app starts; records you created yourself are kept.

## 2. Connect Supabase (database)

1. In the Supabase SQL Editor run **every** file in `supabase/migrations/` in order (`0001` → `0008`). `0005`–`0008` are idempotent (`0006`: WhatsApp delivery tracking, `0007`: free verification + flyers and the public `flyers` Storage bucket, `0008`: removes departments).
2. Optionally run `supabase/seed.sql`.
3. Put the Project URL, anon key and **service-role key** in `.env.local`. The service-role key is used only on the server (route handlers / server actions); permissions are enforced in the app layer and RLS stays on so the anon key cannot read church data.
4. Check `GET /api/health` → `{"mode":"supabase","database":"ready"}`. If you see `PGRST205`, run `notify pgrst, 'reload schema';`.

## 3. Google sign-in

The app runs the Google OAuth flow itself using `CLIENT_ID` / `CLIENT_SECRET` (also accepted as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client (Web application).
2. Add the authorised redirect URI: `http://localhost:3000/api/auth/google/callback` (and your production URL's equivalent).
3. Optional: set `ADMIN_EMAILS=you@gmail.com` — that Google account becomes a super admin the first time it uses "Staff sign in with Google" on `/admin/login`. Add other individual staff in **Settings → Staff & roles**. (Most admins can simply use the shared FUJ admin login.)

Members can sign in with Google (linked by Google account / email) or with username + phone.

## 4. Admin login, verification and WhatsApp

**Shared admin login** — set `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` (12+ characters in production) and optionally `ADMIN_LOGIN_ROLE` (default `super_admin`). Every FUJ admin signs in at `/admin` and types their own name, which is recorded on audit logs and broadcasts. Change the password whenever someone leaves the team.

**Verification without SMS (default, free)** — registration is name + phone (+ email). A self-registered person is *unverified* until they are seen in church: their first check-in (scanning the live, rotating QR — which only works in the room — or an usher checking them in at the desk) verifies them automatically. Google sign-ups are verified by Google. Admins can **Mark verified** on any member record. No smartphone? The usher checks them in by name at **Admin → Check-in desk**, or adds them there as a first-timer.

### WhatsApp broadcasting — two ways

**A. Free (works today, no setup):**
1. **Members → Contacts for WhatsApp (.vcf)** → open the file on the church phone → "Import" (Android: Contacts app; iPhone: open the file → Add all contacts).
2. In **WhatsApp Business** on that phone create **broadcast lists** (up to 256 contacts each; only people who have saved the church number receive them — ask members to save it), or use a **group / Community / Channel**.
3. In the admin, write the broadcast, attach the **flyer**, send → on the tracking page tap **Share on WhatsApp** → choose your broadcast lists / groups / Status → send. On a computer it opens WhatsApp Web with the text; download the flyer and attach it.
4. For individual follow-ups (absentees, first-timers) use the **WhatsApp** link on each recipient row or on the pastoral-care task — it opens a chat with a personalised message.

**B. Automatic (optional): Meta WhatsApp Business Cloud API** — every broadcast goes to each member's WhatsApp by itself, SMS for numbers not on WhatsApp.
1. Go to **https://developers.facebook.com/apps** → *Create app* → use case **"Connect with customers through WhatsApp"** (type *Business*) → link or create your **Meta Business portfolio** (business.facebook.com).
2. In the app: **WhatsApp → API Setup**. Meta gives you a free **test number** — add up to 5 recipient numbers you can test with (free while building). Copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`. The temporary token on that page expires in 24 h; for a permanent one go to **business.facebook.com → Settings → Users → System users** → add a system user (Admin) → *Assign assets* (your app + WhatsApp account) → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management` → `WHATSAPP_TOKEN`.
3. **WhatsApp Manager → Message templates → Create**:
   - `fuj_broadcast` (category *Marketing* for programs/announcements, *Utility* for reminders) — body: `*{{1}}*` then `{{2}}` then `— FlagUpJesus Global Ministry` → `WHATSAPP_TEMPLATE_NAME=fuj_broadcast`
   - `fuj_flyer` — header **Image**, same body → `WHATSAPP_FLYER_TEMPLATE_NAME=fuj_flyer`
   Approval usually takes minutes to a day. (Templates are required: WhatsApp only allows free-form messages to people who messaged you in the last 24 h.)
4. **WhatsApp → Configuration → Webhook**: callback URL `https://<your-domain>/api/webhooks/whatsapp`, verify token = any secret you choose (`WHATSAPP_VERIFY_TOKEN`), subscribe to **messages**. Copy **App settings → Basic → App secret** → `WHATSAPP_APP_SECRET`. (Needs your deployed https site; it can't call localhost.)
5. To message real members: **WhatsApp → API Setup → Add phone number** (the church's own number, not already on the WhatsApp app — or migrate it), and complete **business verification** to lift the starting limit (250 people per 24 h).
6. Cost: Meta bills per delivered template message (marketing templates cost more than utility; see Meta's pricing page for Nigeria). Replies from members open a free 24-hour window. Flyers must be publicly reachable — in production they're served from Supabase Storage automatically.

How automatic delivery works: people marked *not on WhatsApp* get SMS directly; everyone else gets WhatsApp. If WhatsApp rejects a message or later reports the number isn't on WhatsApp (error 131026), the SMS version (with a flyer link) is sent automatically and the person is remembered as *not on WhatsApp*. WhatsApp replies arrive in the admin **Inbox**.

**SMS (Termii, optional)** — `TERMII_API_KEY`, `TERMII_BASE_URL` (both in Termii → Settings / API), `TERMII_SENDER_ID` (approved under **IDs**), optional `TERMII_CHANNEL=dnd`. Only needed for `REGISTRATION_OTP=true` and automatic SMS.

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
| `/api/health` | Health / configuration check |

## 9. Deploying

The app needs a Node server (route handlers, server actions, uploads) — not a static export. Vercel or any Next.js-compatible Node host works.

1. Run the checks locally: `npm run test:all`.
2. Apply all migrations (`0001` → `0008`) to the production Supabase project and check `/api/health`.
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
2. **Vercel → project `fuj-online` → Settings → Environment Variables** (Production): add every variable from `.env.local`, with `NEXT_PUBLIC_APP_URL=https://flagupjesus.org`. Then **Deployments → ⋯ → Redeploy** (`NEXT_PUBLIC_*` values are baked in at build time).
3. **Vercel → Settings → Domains → Add** `flagupjesus.org` (and let it add `www.flagupjesus.org` redirecting to it). Vercel then shows the DNS records to create.
4. **Hostinger → Domains → flagupjesus.org → DNS / Nameservers → DNS records**: delete the existing `A` record for `@` and the `CNAME` for `www` (Hostinger's parking page), then add exactly what Vercel shows — usually `A  @  76.76.21.21` and `CNAME  www  cname.vercel-dns.com`. Leave MX/TXT records alone.
5. Wait for Vercel to show **Valid Configuration** (minutes, occasionally a few hours); HTTPS is issued automatically.
6. **Google Cloud → Credentials → your OAuth client**: add `https://flagupjesus.org/api/auth/google/callback` to Authorised redirect URIs; on the **OAuth consent screen** add `flagupjesus.org` as an authorised domain and **publish** the app so anyone (not only test users) can sign in.
7. Check `https://flagupjesus.org/api/health` → `"mode":"supabase"`, `"database":"ready"`, `"adminLogin":true`, `"googleAuth":true`.

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
