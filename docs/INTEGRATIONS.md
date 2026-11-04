# External integrations

## Authentication
Supabase Auth phone OTP is the intended default. Configure an SMS provider and templates in Supabase. Keep rate limits and abuse controls enabled.

## Messaging
Choose an SMS provider (for example Termii or Africa's Talking) and WhatsApp Business Platform when ready. Two-way inbox requires inbound webhooks; outbound SMS capability alone is not a two-way inbox.

## Payments
Choose Paystack or Flutterwave after reviewing fees, settlement, reconciliation and webhook support. Verify signatures server-side. Never mark a donation paid from a client redirect alone.

These integrations are not active in the local demo.
