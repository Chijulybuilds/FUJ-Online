# Architecture

Next.js App Router is the modular-monolith application layer. Supabase provides PostgreSQL, Auth and Storage. Next.js route handlers perform synchronous authenticated operations; Supabase Edge Functions / scheduled jobs are reserved for independent background tasks and provider webhooks.

```text
Browser
  ├── Public registration / check-in
  ├── Member portal
  └── Admin portal
        │
        ▼
Next.js App Router
  ├── Feature modules (members, attendance, services, giving...)
  ├── Server actions / route handlers
  ├── Zod validation
  └── Supabase server client
        │
        ▼
Supabase
  ├── Auth (phone OTP)
  ├── PostgreSQL + RLS
  ├── Storage
  └── Edge Functions / scheduled jobs
```

`profiles` represents application identity; `people` represents the church person record. A person can exist without an app login. Attendance references `people`, so usher check-in does not require a member account.

Security boundaries:
- Never trust browser-supplied identity, role, service timestamp or attendance status.
- Use database RLS and server-side permission checks.
- Never expose the service-role key or QR signing secret.
- Keep financial access separate from attendance access.
