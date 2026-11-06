# QR attendance design

1. Staff open a check-in window for a service (`qr_sessions`, default 4 h). Closing it marks the service completed and runs the absence analysis.
2. The display page (staff only) fetches a signed token from `/api/attendance/token` every **20 seconds**. Tokens are HMAC-signed (`QR_SIGNING_SECRET`), scoped to the session, and expire after 20 s (+10 s grace for camera/network latency).
3. Scanning opens `/check-in?t=…`; the page posts the token to `/api/check-in/scan`, which verifies signature, expiry and session state, then sets a 15-minute httpOnly **ticket** cookie and removes the token from the URL.
4. Returning members type their **flag username** (`/api/check-in/confirm`) — no SMS OTP. First-timers register (`/api/register`) and are checked in using the same ticket.
5. Attendance uses server time; `unique(person_id, service_id)` prevents duplicates.
6. Each phone has a device cookie; a device that already checked in one person for a service cannot check in another username. Ushers can check people in manually (`check_in_method = manual`).

Limits: a rotating QR reduces casual reuse but cannot prove physical presence (a screenshot works within its short window). Usernames are not secrets, so check-in always requires a fresh scan and portal access requires username + phone or Google.
