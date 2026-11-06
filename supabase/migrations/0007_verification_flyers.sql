-- Free verification (Google / in person at church / admin) instead of paid SMS OTP,
-- and flyer images on broadcasts. Idempotent.

alter table public.people add column if not exists verified_via text;
alter table public.people add column if not exists verified_at timestamptz;
do $$ begin
  alter table public.people add constraint people_verified_via_valid check (verified_via is null or verified_via in ('google','in_person','admin','otp'));
exception when duplicate_object then null; end $$;

-- Everyone who has already attended in person counts as verified.
update public.people p set verified_via = 'in_person', verified_at = coalesce(p.verified_at, now())
where p.verified_via is null and exists (select 1 from public.attendance a where a.person_id = p.id);
update public.people set verified_via = 'google', verified_at = coalesce(verified_at, now())
where verified_via is null and auth_subject like 'google:%';

alter table public.broadcasts add column if not exists image_url text;

-- Public bucket for flyers (Supabase Storage). The app also creates it automatically if missing.
insert into storage.buckets (id, name, public) values ('flyers', 'flyers', true) on conflict (id) do nothing;

notify pgrst, 'reload schema';
