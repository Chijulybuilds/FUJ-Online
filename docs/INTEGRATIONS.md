# External integrations

## Authentication
Google OAuth 2.0 (authorization-code flow) is implemented in `/api/auth/google` using `CLIENT_ID` / `CLIENT_SECRET`. Redirect URI: `<APP_URL>/api/auth/google/callback`. Staff access is granted by email in **Settings → Staff & roles** (bootstrap with `ADMIN_EMAILS`). Members may also sign in with username + phone. Sessions are HMAC-signed httpOnly cookies.

## Database
Supabase Postgres via the server-only service-role key (`src/lib/db/supabase.ts`). Without it, a local JSON store is used for development.

## Messaging
Broadcasts are always delivered in-app (member portal) with read/response tracking. SMS via Termii (`TERMII_API_KEY`, `TERMII_SENDER_ID`) and email via Resend (`RESEND_API_KEY`, `EMAIL_FROM`) are attempted only when configured; each recipient's delivery status is stored. Two-way SMS/WhatsApp needs inbound webhooks (`/api/webhooks/messaging` is a placeholder).

## Payments
Not enabled. Finance staff record cash/transfer giving. Choose Paystack or Flutterwave, verify webhook signatures server-side, and never mark a donation paid from a client redirect.
