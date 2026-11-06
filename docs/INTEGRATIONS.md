# External integrations

## Authentication
Google OAuth 2.0 (authorization-code flow) is implemented in `/api/auth/google` using `CLIENT_ID` / `CLIENT_SECRET`. Redirect URI: `<APP_URL>/api/auth/google/callback`. Staff access is granted by email in **Settings → Staff & roles** (bootstrap with `ADMIN_EMAILS`). Members may also sign in with username + phone. Sessions are HMAC-signed httpOnly cookies.

## Database
Supabase Postgres via the server-only service-role key (`src/lib/db/supabase.ts`). Without it, a local JSON store is used for development.

## Messaging
Broadcasts are always delivered in-app (member portal) with read/response tracking. The phone channel is **WhatsApp first** (Meta WhatsApp Business Cloud API, approved template `WHATSAPP_TEMPLATE_NAME`) with **automatic SMS fallback** (Termii) for numbers that aren't on WhatsApp — detected from synchronous errors or the `131026` failure receipt on `/api/webhooks/whatsapp`. Receipts also mark people as on/not on WhatsApp and record reads; inbound WhatsApp messages become Inbox responses. Email via Resend is optional. Registration OTP codes are sent by SMS (Termii).

## Payments
Not enabled. Finance staff record cash/transfer giving. Choose Paystack or Flutterwave, verify webhook signatures server-side, and never mark a donation paid from a client redirect.
