# Security checklist

- [ ] Apply and review RLS policies in a non-production Supabase project.
- [ ] Create a controlled role-provisioning process; never let a user self-assign privileged roles.
- [ ] Keep service-role and QR signing secrets server-only.
- [ ] Add rate limits to OTP, registration, QR token and check-in endpoints.
- [ ] Verify payment webhook signatures and implement idempotency.
- [ ] Restrict prayer requests, testimonies and pastoral notes by explicit visibility.
- [ ] Log privileged actions without storing OTPs, secrets or unnecessary sensitive content.
- [ ] Define retention, export and deletion procedures consistent with the Nigeria Data Protection Act 2023.
- [ ] Conduct security and privacy review before real member data is loaded.
