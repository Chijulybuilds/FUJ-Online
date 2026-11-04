# Supabase Edge Functions (planned deployment targets)

Create and deploy these functions after the core V1 data flows are tested:

- `attendance-analysis`: scheduled absence analysis; creates idempotent follow-up tasks.
- `send-notification`: provider-neutral outbound notification dispatch.
- `process-payment-webhook`: verify provider signature and reconcile payment events.
- `messaging-webhook`: validate inbound provider webhook and append messages.

Synchronous QR token issuance and check-in are currently represented by Next.js route handlers in `src/app/api/attendance/`.
