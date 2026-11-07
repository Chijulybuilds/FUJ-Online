-- FUJ has no "visitor" category and no verification step: everyone who registers is a member,
-- verified automatically at sign-up. Idempotent: safe to run more than once.

-- 1. Existing visitors become members (joined when they first registered).
update public.people
set status = 'member', joined_at = coalesce(joined_at, first_visit_at, created_at), updated_at = now()
where status = 'visitor';
alter table public.people alter column status set default 'member';
-- The enum value can't be dropped safely, so stop it being used again.
do $$ begin
  alter table public.people add constraint people_no_visitor_status check (status <> 'visitor');
exception when duplicate_object then null; end $$;

-- 2. Everyone counts as verified from their first sign-in.
alter table public.people drop constraint if exists people_verified_via_valid;
alter table public.people add constraint people_verified_via_valid
  check (verified_via is null or verified_via in ('google','in_person','admin','otp','registration'));
update public.people
set verified_via = 'registration', verified_at = coalesce(verified_at, created_at)
where verified_via is null;

notify pgrst, 'reload schema';
