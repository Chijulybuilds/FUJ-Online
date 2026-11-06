# Product scope — V1

## Primary actors
- Visitor: self-registers once and can check in on later visits.
- Member: maintains profile, views attendance and church updates.
- Usher: checks people in manually when QR/mobile access is unavailable.
- Pastoral worker: handles assigned follow-up and pastoral-care tasks.
- Usher: checks people in at the check-in desk and manages services/attendance.
- Finance administrator: manages giving and financial reports.
- Administrator / pastor / super administrator: manages church operations according to assigned permissions.

## Core flows
1. Visitor scans the current service QR and registers with minimum required details.
2. Phone verification establishes control of the phone number before identity is linked.
3. Returning visitor/member signs in or verifies OTP and checks in against the same `people` record.
4. Attendance is recorded using server time and a unique person/service key.
5. Absence analysis creates follow-up recommendations; it does not automatically declare someone inactive.
6. Prayer requests and testimonies have visibility/moderation controls.
7. Giving records are reconciled against verified payment webhooks, never browser claims.

## Explicit V1 constraints
- One physical church location.
- No sermon repository (V2).
- QR rotates every 20 seconds; a service session has a separately controlled opening/closing window.
- Manual usher check-in is supported as a fallback.
