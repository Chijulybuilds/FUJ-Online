# Security checklist

- [x] Server-only service-role key and signing secret; production refuses the placeholder secret.
- [x] Role checks on every admin page, server action and API route (`src/lib/auth/roles.ts`); staff status re-checked on each request.
- [x] Staff can't self-assign roles; only super admins manage staff.
- [x] Rate limits on member sign-in, scan, check-in confirm, registration and prayer submission (in-memory, per instance).
- [x] Short-lived signed QR tokens, purpose-separated from tickets and sessions; OAuth `state` verified.
- [x] One device → one person per service; unique attendance key.
- [x] Prayer requests: private (pastor/admin only), pastoral, or public; prayer wall requires the requester's consent (DB constraint).
- [x] Testimonies can only be published with consent (DB constraint).
- [x] Privileged actions written to `audit_logs`; CSV exports are audited and protected against formula injection.
- [ ] Use a shared rate-limit store when running more than one instance.
- [ ] Verify payment webhook signatures and implement idempotency before enabling online giving.
- [ ] Define retention, export and deletion procedures consistent with the Nigeria Data Protection Act 2023.
- [ ] Security and privacy review before real member data is loaded.
