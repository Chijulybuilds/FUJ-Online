# FlagUpJesus Online Church — V1

A responsive church-management web application for **Flag of Jesus Global Ministry**. The product name is **FlagUpJesus**.

## Included in this starter

- Responsive admin dashboard and member portal.
- Member directory with search and member-status labels.
- Service management interface and attendance overview.
- QR attendance display/check-in workflow foundation.
- Prayer request, testimony, announcements, giving, reports and settings screens.
- Local demo data so the interface works before Supabase is configured.
- Supabase browser/server clients and middleware session refresh.
- PostgreSQL schema migrations with core tables, constraints and RLS policies.
- Server-side QR token signing/verification foundation.
- Unit/integration/e2e test folders and project documentation.

## 1. Requirements

- Node.js 20.9 or later
- npm 10 or later
- VS Code (recommended)
- A Supabase project for real authentication and persistent data (optional for local demo)

## 2. Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The app starts in **demo mode** if `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are empty. Demo mode uses sample UI data; it does not persist changes to a database.

`SUPABASE_SERVICE_ROLE_KEY` is optional for normal Auth and RLS-protected database access. Only configure it for trusted server-side operations that explicitly require bypassing RLS; never expose it to browser code. After applying the database migrations, run `notify pgrst, 'reload schema';` in the same Supabase project's SQL Editor if the health endpoint reports `PGRST205` or the tables are not visible through the API. Confirm the project's API URL matches `NEXT_PUBLIC_SUPABASE_URL`.

## 3. Connect Supabase

1. Create a Supabase project.
2. In Project Settings → API, copy the Project URL and anon/public key into `.env.local`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` and `QR_SIGNING_SECRET` server-only. Never expose them in browser code.
4. In Supabase SQL Editor, run the SQL files in `supabase/migrations/` in numerical order.
5. Enable Phone Auth / configure an SMS provider in Supabase Auth if you want phone OTP. OTP delivery may incur provider charges.
6. Set the site URL and redirect URLs in Supabase Auth settings to `http://localhost:3000` for local development.

## 4. Routes

| Route | Purpose |
|---|---|
| `/` | Product landing / role entry |
| `/login` | Sign in |
| `/register` | Visitor/member registration entry |
| `/admin` | Admin overview |
| `/admin/members` | People directory |
| `/admin/services` | Service schedule |
| `/admin/attendance` | Attendance overview |
| `/admin/attendance/display` | Rotating QR display foundation |
| `/admin/pastoral-care` | Follow-up queue |
| `/admin/announcements` | Church announcements |
| `/admin/prayer-requests` | Prayer request moderation |
| `/admin/testimonies` | Testimony moderation |
| `/admin/giving` | Giving overview |
| `/admin/reports` | Reports |
| `/admin/settings` | Church settings |
| `/member` | Member portal |
| `/member/attendance` | Personal attendance |
| `/member/announcements` | Member announcements |
| `/check-in` | QR check-in entry point |

## 5. Important V1 engineering notes

- This is a runnable application scaffold and UI foundation, not a production deployment.
- Demo mode is deliberately read-only/sample-data mode.
- Supabase migrations define the core data model. Review and apply them to your own project.
- The initial QR display page is a development demonstration. Production attendance must use authenticated members and server-side token validation. A rotating QR is not proof of physical presence; screenshots can be shared during their short validity window.
- The QR signing secret must remain on the server. Tokens are signed, short-lived, scoped to an active service session, and checked server-side.
- A unique `(person_id, service_id)` constraint prevents duplicate attendance.
- Payment, SMS and WhatsApp integrations are provider-neutral placeholders. Configure and test a provider before enabling transactions or outbound messages.
- Prayer requests and pastoral notes can contain sensitive information. Restrict access and apply least-privilege policies.
- Do not deploy with permissive RLS policies or demo data.

## 6. Suggested build sequence

1. Create Supabase project and apply migrations.
2. Configure phone OTP and test registration/login.
3. Complete role provisioning and admin authorization.
4. Connect member/service repositories to Supabase.
5. Finish QR session creation, token rotation, and check-in transaction.
6. Add notifications and pastoral-care scheduled jobs.
7. Integrate payment provider using verified webhooks.
8. Run security review, accessibility checks, and end-to-end tests.

## 7. Commands

```bash
npm run dev       # local development
npm run typecheck # TypeScript check
npm run lint      # ESLint check
npm run build     # production build
npm test          # unit tests
npm start         # run production build
```

## Brand and scope

- Ministry: Flag of Jesus Global Ministry
- Application: FlagUpJesus
- V1: single church location
- Sermon repository: intentionally deferred to V2

flagupjesus/
├── public/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── attendance/
│   │   │       ├── announcements/
│   │   │       ├── departments/
│   │   │       ├── giving/
│   │   │       ├── inbox/
│   │   │       ├── members/
│   │   │       ├── pastoral-care/
│   │   │       ├── prayer-requests/
│   │   │       ├── reports/
│   │   │       ├── services/
│   │   │       ├── settings/
│   │   │       └── testimonies/
│   │   ├── (member)/
│   │   │   └── member/
│   │   │       ├── announcements/
│   │   │       ├── attendance/
│   │   │       ├── giving/
│   │   │       ├── prayer-requests/
│   │   │       ├── profile/
│   │   │       └── testimonies/
│   │   ├── api/
│   │   │   ├── attendance/
│   │   │   ├── webhooks/
│   │   │   └── health/
│   │   ├── check-in/
│   │   ├── attendance-display/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── navigation/
│   │   └── shared/
│   ├── features/
│   │   ├── authentication/
│   │   ├── members/
│   │   ├── attendance/
│   │   ├── services/
│   │   ├── departments/
│   │   ├── pastoral-care/
│   │   ├── messaging/
│   │   ├── announcements/
│   │   ├── prayer-requests/
│   │   ├── testimonies/
│   │   ├── giving/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   └── audit/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── security/
│   │   ├── validation/
│   │   ├── constants.ts
│   │   ├── demo-data.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── types/
│   └── config/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── config.toml
│   └── seed.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRODUCT_SCOPE.md
│   ├── QR_ATTENDANCE.md
│   ├── SECURITY.md
│   └── INTEGRATIONS.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md