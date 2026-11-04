# QR attendance design

The display obtains a short-lived signed token from a server-only signing endpoint. The QR changes every 20 seconds. A token is scoped to one active `qr_sessions` record and has an expiry. The check-in endpoint validates signature, session state, expiry and authenticated person, then inserts attendance transactionally.

A database unique constraint on `(person_id, service_id)` prevents duplicate check-ins. Database time is authoritative. A short bounded clock/network grace can be introduced after measuring real device conditions; do not accept stale tokens indefinitely.

Rotating QR reduces casual reuse but cannot guarantee physical presence: a screenshot can be shared during its validity window. Usher fallback is required. Consider venue Wi-Fi validation as an additional signal, not a security guarantee.
