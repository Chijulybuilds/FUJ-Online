# FlagUpJesus Global Connect — V1

A responsive church-management web app for **FlagUpJesus Global Ministry** (product name **FlagUpJesus Global Connect**, formerly *FlagUpJesus Online Church*): an animated public landing page, QR attendance with personal **flag usernames**, a member portal, and an admin dashboard for first timers, partners, broadcasts, prayer, testimonies, giving and reports.

## What's included

| Area | What it does |
|---|---|
| **Landing page** (`/`) | A five-layer FlagUpJesus story with a numbered section rail: **01 Welcome** (waving flag-red banner, outreach photo reel gliding from the right edge to the centre, live service countdown), **02 Our Heartbeat** (the motto lighting up word-by-word as you scroll; *The Word + The Works*), **03 Global Love Campaigns** (story-style outreach slideshow, two moving photo carousels, medical/food/community care), **04 Word & Worship** (Word Experience, Bible Study, International Prayer & Mission Conference, Unveiled Worship Encounter, service times), **05 Our Reach** (animated Nigeria map: Port Harcourt HQ, Lagos, Abuja, Bayelsa; Pastor Caleb's books). Then check-in how-to, news, testimonies, public prayer requests + prayer wall, partnering/giving. Light/dark themes; respects `prefers-reduced-motion`. Photos live in `public/images/fuj/`. |
| **Check-in desk** (`/admin/attendance/desk`) | The no-phone alternative to QR: staff type a member's **name** (or username/phone), tap **Check in**, and can add someone new (name + phone) and check them in in one step. |
| **QR check-in** | Staff open check-in for a service → full-screen display shows a QR that **rotates every 20 s**. Scanning exchanges the short-lived token for a 15-minute ticket on that phone. **Returning members just type their flag username (no OTP).** New people tap *Register* and are checked in automatically. |
| **Flag usernames** | Every person gets a unique username at first registration: `flag` + first name + 3 digits, e.g. `flagyourname123`. Case-insensitive; the `flag` prefix is optional when typing. |
| **Registration** | **Full name, phone number, birthday and home address**, plus an optional email — or **Continue with Google** (then the same details). Under-18s use the same form with their own phone number or a parent's / guardian's (see *Under 18s*). Everyone also answers **"Is this your first time worshipping with FlagUpJesus?"** (first timers get their own follow-up) and can tick **"I'd like to become a FUJ Partner"**. Birthday and address show on the member's record (and in the members CSV export), and members can update them in their portal. **Everyone who registers is a member** (FUJ has no "visitor" category) and is **verified automatically at sign-up** — there's no approval step and no paid SMS OTP. (Optional: `REGISTRATION_OTP=true` adds an SMS code via Termii.) |
| **Member portal** (`/member`) | Username card, messages from the church (read + reply), announcements, prayer requests + prayer wall ("I prayed"), testimonies, attendance history, giving details/history, profile. Sign in with Google or username + phone number. |
| **Admin** (`/admin` → `/admin/login`) | Not linked from the public site: go to `yoursite/admin`. Sign in with the **shared FUJ admin email + password** (each person adds their name so actions stay attributable), or individual staff can use Google. |
| **Leaders** (`/admin/leaders`) | Admins add the church's leaders — **name, unit (e.g. Choir), WhatsApp number, optional email**. Leaders don't sign up themselves; if someone already registered with that number, their member record is linked. Filter by unit, one-tap WhatsApp/email, download leaders' contacts (.vcf), and **Message all leaders** / **Message one unit's leaders** straight from Broadcasts. |
| **Admin pages** | Dashboard, members directory (search, CSV export), leaders, member records, services, attendance, QR display, check-in desk, first timers, partners, broadcasts + tracking, inbox, announcements, prayer moderation, testimony moderation, giving, reports, settings & staff roles. |
| **Under 18s** (`/admin/children`) | Under-18s register on the **same "I'm new" page** as everyone else. When their birthday shows they're under 18, the form asks **whose phone number they entered — their own, or a parent's / guardian's** (then the parent's name and relationship), and asks them to confirm their parent knows they're registering. With a parent's number they get their **own record and flag username** (phone numbers stay unique among adults only), are linked to the parent's member record when the parent is registered (or registers later), and their WhatsApp / SMS / email go to the parent — never twice to one phone. If a parent is signed in on the phone, the form still opens ("You're signed in as …") and the parent stays signed in. The partner opt-in isn't shown to under-18s. **Family check-in:** after a parent checks in with the QR code, children on their number appear with **Check in Tobi** / **Check in all** on the same phone. Ushers can add an under-18 at the check-in desk (*Under 18, using a parent's phone*). **Children & teens page:** everyone under 18, age groups (Toddlers 0–3, Pre-school 4–6, Juniors 7–9, Pre-teens 10–12, Teens 13–17), whose phone (own / parent's), coming birthdays 🎂, who's in church today, care notes ⚠️, parent call/WhatsApp, CSV export and **Message parents** (audience *Parents & guardians*). Children on a parent's number are left out of the phone-contacts export. |
| **Import contacts** (`/admin/members/import`) | Upload a contact list — **Excel (.xlsx) or CSV** — from **Members → Import contacts**. The columns are found from the headings (Name / First name + Surname, Phone, Alt phone, Gender, Address, Email, Birthday, Notes, Source, Needs checking; you can change them), and before anything is saved you see what will happen to every row: **new**, **already in the database — skipped** (same phone number with a matching name, or the same full name; titles like *Pst.*/*Mrs.* and one-letter typos are ignored), **listed twice in the file**, **no phone number**, or **on a family number** (a different person on a number someone already has — added and linked, like children on a parent's number; messages go to the number's owner once). Imports run in small batches with a progress bar and end with a downloadable report; importing the same file again adds nobody. Notes, the source list, other phone numbers and "needs checking" flags are saved on each member's record; first-visit is left blank for imported people. Readers are built in (no extra libraries). |
| **Welcome email & passwords** | Everyone with an email gets a warm **"Welcome to FlagUpJesus Global Connect"** email with their **flag username**, how to check in, the programmes, and a **Set my password** button (optional; the link works for 30 days and only once). New registrations get it straight away (also people added in *Add a member*); everyone who registered earlier gets it from **Settings → Welcome emails → Send welcome emails now** (40 at a time, paced for Resend's limits), when they next sign in, or from the daily job (60 a day) — each person once, tracked per member ("Send again" on their record). Members can then sign in with **username or email + password** (Login → 🔐 Password) as well as username + phone, use **Forgot your password?** (a 2-hour link; it never reveals whether an account exists), and set or change their password in **Profile**. Passwords are scrypt-hashed in their own table (`member_credentials`) that members can't read. |
| **First timers** (`/admin/first-timers`) | At registration everyone answers **"Is this your first time worshipping with FlagUpJesus?"** — so an existing member registering online today isn't mistaken for a newcomer (ushers can also tick *First time* at the check-in desk, and admins on *Add a member*). The page is a simple **call list** with three tabs — **To call → Called → Came back** — and one-click buttons on every name: **Call**, **WhatsApp**, **Reached them** and **No answer** (and **Came back** once they've been called). A first timer's page has the same buttons with an optional note, **Remove from list** (moved away, only visiting), their details, notes and a plain history. Automatically: a **welcome message** as soon as they register, then a **Sunday invitation every Saturday** (up to 3) until they come back; **coming back is picked up at check-in**. Broadcast audience: **First timers**. |
| **FUJ Partners** (`/admin/partners`) | Two streams, each with its own tab, totals, list and *Add* form. **Outreach partners** are FlagUpJesus members: they tick **"I'd like to become a FUJ Partner"** at registration or tap **Become a FUJ Partner** on their portal's Giving page, or an admin adds them. **Associate partners** are key partners **outside FlagUpJesus — in the UK, the US and around the world**: an admin adds them with their church / organisation, country, WhatsApp number (with the country code) and a pledge in **NGN, USD, GBP, EUR or CAD**. Associates get messages, a giving history and a username (for transfer references) but **aren't church members** — they don't appear on the members list, in member counts or in member broadcasts. Statuses for both: **Interested → Contacted → Committed (pledged) → Active (giving)**, or Paused / Declined; pledge, next follow-up, notes, contact log, and gifts from **Admin → Giving** (recording one with their username and currency marks them *Active*). Totals are kept per currency (never adding pounds to naira). Automatically: a **thank-you message** on sign-up and — once turned on in Settings — a **monthly partnership reminder**: outreach partners get the naira account; associates get the **international giving details** set in Settings (domiciliary account, SWIFT, online link). A partner can be moved between streams on their page. Broadcast audiences: **FUJ Partners** (both), **Outreach partners**, **Associate partners**, **committed & active**; CSV export per stream. Finance admins can see Partners. |
| **Free WhatsApp sharing** | Broadcasts can carry a **flyer image**. After sending, **Share on WhatsApp** opens WhatsApp's share sheet with the flyer + message so you post it to the church's WhatsApp **broadcast lists, groups, Status or Channel** — free. Every recipient row also has a one-tap personal WhatsApp link, and **Members → Contacts for WhatsApp (.vcf)** loads everyone into the church phone. |
| **WhatsApp, SMS & email delivery** | Every broadcast lands in the member's **app inbox**, and — once each channel is connected — also as a **personal WhatsApp message** (SMS automatically for numbers not on WhatsApp), an **SMS**, and/or an **email** (with the flyer). Tick the channels per message. The app learns who is on WhatsApp from delivery receipts, records per-recipient WhatsApp/SMS/email status, counts WhatsApp "read" receipts as reads, and turns WhatsApp replies into Inbox responses. **Settings → Messaging channels** shows what's connected and sends a test. |
| **Broadcasts & follow-up tracking** | Send to everyone / **all leaders** / **one unit's leaders** / first timers / outreach or associate partners / parents / one person, with `{first_name}` personalisation. Track **read** and **responded** per recipient, or send a **follow-up broadcast** to non-readers or non-responders. Replies land in the admin **Inbox**. In-app delivery always works; WhatsApp, SMS and email when connected (see §4). |
| **Roles** | `super_admin`, `admin`, `pastor`, `pastoral_worker` (shown as **Follow-up team**: first timers, members, broadcasts, inbox, prayer, testimonies), `finance_admin`, `department_leader` (shown as **Usher**). Each sees only their areas (e.g. finance can't read prayer requests; "private" prayer requests are pastor/admin only). |

## 1. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev
```

Open http://localhost:3000.

**Without Supabase** (`SUPABASE_SERVICE_ROLE_KEY` empty) the app stores data in `.data/flagupjesus-db.json`. It starts **empty** — no sample members, services or offerings; only the ministry name, contact details and bank account. Anything FUJ hasn't provided yet (e.g. the next service date) shows as a dashed **[placeholder]**; the **Watch online** button only appears once a livestream link is set in **Admin → Settings**. Set `ADMIN_LOGIN_EMAIL` / `ADMIN_LOGIN_PASSWORD` in `.env.local`, then open http://localhost:3000/admin. Flyers uploaded locally are stored in `.data/uploads/`. (The automated tests use their own fictional sample data from `tests/e2e/fixtures/`, written to a throwaway database.) If your local database was created by an earlier version (with sample members, "Demo Bank", a Lagos address…), that old sample data is removed automatically the next time the app starts; records you created yourself are kept.

## 2. Connect Supabase (database)

1. **Easiest:** open `supabase/setup.sql`, copy **all** of it into Supabase → **SQL Editor → New query**, and click **Run**. It contains every migration plus FUJ's starting values, and is safe on a brand-new project *and* on one that already ran some or all migrations (it only adds what's missing). Alternatively run the files in `supabase/migrations/` (`0001` → `0017`) in order — each one can also be re-run safely.
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
4. For individual follow-ups (first timers, new members) use the **WhatsApp** link on each recipient row or on the first-timers list — it opens a chat with a personalised message.

**B. Automatic: WhatsApp, SMS and email from the app** — tick the channels on each broadcast; each one needs its keys added in **Vercel → Settings → Environment Variables** (Production), then **Redeploy**. Afterwards open **Admin → Settings → Messaging channels**: it shows *Connected*, has **Check WhatsApp setup** (asks Meta about the token, the church number, the account's health — payment method, display name, test-number limits — and the broadcast template, without sending anything) and a **Send test** button that explains any error in plain English. When a broadcast fails on WhatsApp, its tracking page shows Meta's reason and the fix next to each person. `/api/health` also names any missing or half-set key.

#### WhatsApp (Meta WhatsApp Business Cloud API)
1. Go to **https://developers.facebook.com/apps** → *Create app* → use case **"Connect with customers through WhatsApp"** (type *Business*) → link or create your **Meta Business portfolio** (business.facebook.com).
2. In the app: **WhatsApp → API Setup**. Meta gives you a free **test number** — add up to 5 recipient numbers (e.g. your own) to test with. Copy **Phone number ID** (a long number, *not* the phone number) → `WHATSAPP_PHONE_NUMBER_ID`.
3. Permanent token (the one on the API Setup page expires in 24 h): **business.facebook.com → Settings → Users → System users** → *Add* (role Admin) → *Assign assets* (your app + WhatsApp account, full control) → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`, expiry **Never** → `WHATSAPP_TOKEN`.
4. **WhatsApp Manager → Message templates → Create template** (Meta only lets businesses *start* conversations with approved templates):
   - Name `fuj_broadcast`, category **Utility** (meeting reminders, notices) or **Marketing** (programmes, campaigns), language **English** → body (variables can't be the very first or last thing):
     `Hello from FlagUpJesus Global Ministry 👋` · `*{{1}}*` · `{{2}}` · `Reply to this message to respond.` (one per line; give samples like "Leaders meeting" / "Hi, we meet on Saturday at 4pm.") → `WHATSAPP_TEMPLATE_NAME=fuj_broadcast`
   - Optional `fuj_flyer` — same body plus a **Header: Image** → `WHATSAPP_FLYER_TEMPLATE_NAME=fuj_flyer` (used when a broadcast has a flyer).
   - `WHATSAPP_TEMPLATE_LANG=en` (match the template's language code). English templates approved as `en_US` ("English (US)") or `en_GB` are found automatically; for any other language set its code here. **Check WhatsApp setup** says which language Meta approved.
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
1. **resend.com** → sign up → **Domains → Add domain** → `flagupjesus.org`. Resend lists the DNS records to add — typically a **TXT** `resend._domainkey` (DKIM), two **CNAME**s for sending (`send` and `rsend`, or an MX + TXT on `send` for older accounts) and an optional **TXT** `_dmarc`. In **Hostinger → Domains → flagupjesus.org → DNS / Nameservers** add each one with the same type, the **Name exactly as shown** (Hostinger adds `.flagupjesus.org` itself) and the **full value** (click the value in Resend to copy it — the `[...]` means it's shortened on screen). A CNAME can't share its name with any other record, so delete any old `send` records first. Then click **Verify** in Resend (can take up to an hour).
2. **API Keys → Create API key** (Sending access) → `RESEND_API_KEY`.
3. `EMAIL_FROM=FlagUpJesus <news@flagupjesus.org>` (any name @flagupjesus.org works once verified). Replies go to the contact email in **Admin → Settings**.
Emails include the title, message and flyer, styled in FUJ red.

How phone delivery works: people marked *not on WhatsApp* get SMS directly; everyone else gets WhatsApp. If WhatsApp rejects a message or later reports the number isn't on WhatsApp (error 131026), the SMS version (with a flyer link) is sent automatically and the person is remembered as *not on WhatsApp*. Tick **SMS** as well to text everyone in addition to WhatsApp.

### Daily automatic messages

Saturday invitations for first timers, partner reminders and the welcome-email backlog run **every morning at about 10:00 Lagos time** via Vercel Cron (`vercel.json` → `/api/cron/follow-ups`). Add **`CRON_SECRET`** (any long random text, e.g. `openssl rand -hex 24`) in Vercel → Environment Variables and redeploy — without it the daily run is refused. Vercel's free plan allows one run per day, which is all this needs. Each message is a normal tracked broadcast (read / replied), and replies land in the **Inbox**.

*(Pastoral care — the absent-members queue and its automatic "We missed you" messages — has been removed. Its old records stay in the database, untouched, but nothing reads or adds to them.)*

### First timers & partners — automatic messages

**Settings → First timers & partners** (choose the channels under *Send on* — WhatsApp / SMS / email — plus the app inbox, always):
- **First timers:** welcome message straight away (from registration, the check-in desk or *Add a member*); then on **Saturdays** an invitation for Sunday — at least 3 days after their first visit, at most once a week, up to 3 (0–8) — until they check in again. `{address}` in the invitation becomes the church address.
- **Partners:** a thank-you message when someone signs up themselves (staff choose when adding someone); **monthly reminders are off by default** — turn them on and pick the day of the month (1–28). Monthly partners are reminded once a month unless they've already given that month; quarterly / yearly partners once per period; one-off pledges never. `{amount}` and `{frequency}` are filled in (in the partner's currency) and the giving details are added at the end — the naira account for outreach partners, and *Giving details for associate partners abroad* (when set) for associates. **Send reminders now** on the Partners page sends any that are due straight away.
- Both run with the daily job (`/api/cron/follow-ups`) and from **Send due messages** on each page. Every automatic message is a tracked broadcast and is logged in the person's history.

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
| `/login` | Member sign in (Google, username + phone, or username / email + password) |
| `/set-password` | Set a password from the welcome / forgot-password email link |
| `/admin/login` | Admin sign in (shared FUJ admin email + password, or staff Google) — reached by visiting `/admin` |
| `/register`, `/register/complete` | First-time registration → flag username (under-18s: own phone or a parent's) |
| `/check-in` | QR check-in (opened by scanning) |
| `/member/*` | Member portal: messages, announcements, prayer-requests, testimonies, attendance, giving, profile |
| `/admin` | Dashboard |
| `/admin/members`, `/admin/members/[id]`, `/admin/members/new`, `/admin/members/import` | People, and importing contact lists (Excel / CSV) |
| `/admin/services`, `/admin/services/[id]`, `/admin/services/new` | Services + check-in controls |
| `/admin/attendance`, `/admin/attendance/display`, `/admin/attendance/desk` | Attendance, rotating QR display, check-in by name |
| `/admin/children` | Children & teens (under 18): age groups, whose phone, birthdays, care notes, parents |
| `/admin/first-timers`, `/admin/first-timers/[id]` | First timers: a simple call list (To call → Called → Came back) |
| `/admin/partners`, `/admin/partners/[id]` | FUJ Partners — outreach (members) and associate (outside FUJ, worldwide): pledges, giving, follow-ups |
| `/admin/messaging`, `/admin/messaging/[id]` | Broadcasts + read/response tracking |
| `/admin/inbox`, `/admin/inbox/[personId]` | Member responses + replies |
| `/admin/announcements`, `/admin/prayer-requests`, `/admin/testimonies` | Content + moderation |
| `/admin/giving`, `/admin/reports`, `/admin/settings` | Management |
| `/api/webhooks/whatsapp` | WhatsApp delivery receipts + inbound replies |
| `/api/cron/follow-ups` | Daily automatic messages: first timers, partners, welcome emails (Vercel Cron, needs `CRON_SECRET`) |
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
| Broadcast shows WhatsApp **failed** | Read the reason on the broadcast's page (or run **Settings → Check WhatsApp setup**). Most common: Meta's *test* number only reaches the ≤5 numbers on its "To" list (error 131030); the 24-hour token expired (190); the template isn't approved yet or has a different language (132001); no payment method on the WhatsApp account (131042); *“API access blocked”* (200) means Meta has restricted the Meta app or account behind the token — clear any notice on the app's dashboard at developers.facebook.com/apps and in business.facebook.com → Account quality, then make a fresh System User token. |
| Port 3000 is busy | `npm run dev -- --port 3001`. |

## 11. Project layout

```
src/
  app/                  pages (App Router), API route handlers
  components/           layout shells, landing-page motion components, UI
  lib/
    db/                 storage contract + Supabase and local JSON implementations, row types, starting data (ministry name + bank account only)
    repo/               domain logic (people, services/attendance, first timers, partners, messaging, content, giving, reports)
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
