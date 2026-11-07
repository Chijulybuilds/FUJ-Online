-- Church leaders, added by FUJ admins (leaders don't sign up themselves).
-- Each leader is linked to a person record (name, WhatsApp/phone number, email), so broadcasts to
-- "All leaders" or one unit's leaders use the same WhatsApp / SMS / email / in-app delivery and tracking.
-- Idempotent: safe to run more than once.

create table if not exists public.leaders (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  unit text not null check (length(trim(unit)) > 0),
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaders_person_unique unique (person_id)
);
create index if not exists leaders_unit_idx on public.leaders (lower(unit));

-- Only the server (service-role key) reads or writes leaders; no direct client access.
alter table public.leaders enable row level security;

notify pgrst, 'reload schema';
