-- First timers and FUJ Partners — two follow-up workflows of their own.
--  * At registration people say whether this is their FIRST TIME at FlagUpJesus (an old member can register
--    online any day, so "new on the website" no longer means "new to church"). First timers get a journey:
--    new → welcomed (someone reached them) → returned (came back to church) → settled (joined a unit / regular),
--    or closed. A welcome message goes out straight away and, until they come back, an invitation every Saturday.
--  * People can ask to become FUJ PARTNERS (regular giving to support the ministry). Partners move through
--    interested → contacted → committed (pledged) → active (giving), or paused / declined, with pledges,
--    follow-up dates, giving history and optional monthly reminders.
-- Idempotent: safe to run more than once.

-- What the person told us at registration (null = not asked, e.g. added by an usher before this existed).
alter table public.people add column if not exists first_timer boolean;

create table if not exists public.first_timers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  first_visit_at timestamptz not null default now(),
  service_id uuid references public.services(id) on delete set null,
  stage text not null default 'new' check (stage in ('new','welcomed','returned','settled','closed')),
  source text not null default 'registration' check (source in ('registration','desk','admin')),
  assignee text,
  visits integer not null default 1,
  welcome_sent_at timestamptz,
  invites_sent integer not null default 0,
  last_invite_at timestamptz,
  welcomed_at timestamptz,
  returned_at timestamptz,
  settled_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  last_contacted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint first_timers_person_unique unique (person_id)
);
create index if not exists first_timers_stage_idx on public.first_timers (stage);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  status text not null default 'interested' check (status in ('interested','contacted','committed','active','paused','declined')),
  source text not null default 'registration' check (source in ('registration','portal','admin')),
  pledge_amount numeric(14,2) check (pledge_amount is null or pledge_amount >= 0),
  frequency text check (frequency is null or frequency in ('monthly','quarterly','yearly','one_off')),
  assignee text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  last_gift_at timestamptz,
  thanks_sent_at timestamptz,
  last_reminder_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_person_unique unique (person_id)
);
create index if not exists partners_status_idx on public.partners (status);

-- Calls, WhatsApps, visits and automatic messages logged against a first timer or a partner.
create table if not exists public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('first_timer','partner')),
  subject_id uuid not null,
  channel text not null check (channel in ('call','sms','whatsapp','visit','email','in_app','note')),
  outcome text not null,
  note text,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists contact_logs_subject_idx on public.contact_logs (subject, subject_id, created_at desc);

-- Automatic messages (sent on the same channels as the absence follow-up).
alter table public.church_settings add column if not exists first_timer_auto boolean not null default true;
alter table public.church_settings add column if not exists first_timer_max_invites integer not null default 3
  check (first_timer_max_invites between 0 and 8);
alter table public.church_settings add column if not exists first_timer_welcome_message text;
alter table public.church_settings add column if not exists first_timer_invite_message text;
alter table public.church_settings add column if not exists partner_auto boolean not null default true;
alter table public.church_settings add column if not exists partner_reminders boolean not null default false;
alter table public.church_settings add column if not exists partner_reminder_day integer not null default 1
  check (partner_reminder_day between 1 and 28);
alter table public.church_settings add column if not exists partner_thanks_message text;
alter table public.church_settings add column if not exists partner_reminder_message text;

-- Only the server (service-role key) reads or writes these; no direct client access.
alter table public.first_timers enable row level security;
alter table public.partners enable row level security;
alter table public.contact_logs enable row level security;

notify pgrst, 'reload schema';
