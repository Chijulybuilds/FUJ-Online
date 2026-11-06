-- FlagUpJesus V1 features: flag usernames, Google identity link, broadcasts with
-- read/response tracking, follow-up logs, staff roles by email, richer content.
-- The Next.js server talks to these tables with the service-role key and enforces
-- permissions in the application layer. RLS stays ON with no anon/authenticated
-- policies on new tables, so the public anon key cannot read them.

-- ---------- people ----------
alter table public.people add column if not exists username text;
alter table public.people add column if not exists auth_subject text;
alter table public.people add column if not exists avatar_url text;
alter table public.people add column if not exists gender text;
alter table public.people add column if not exists birthday date;
alter table public.people add column if not exists address text;
alter table public.people add column if not exists how_heard text;
alter table public.people add column if not exists last_seen_at timestamptz;
create unique index if not exists people_username_key on public.people(username);
create unique index if not exists people_auth_subject_key on public.people(auth_subject);
create index if not exists people_email_idx on public.people(lower(email));
do $$ begin
  alter table public.people add constraint people_username_format check (username is null or username ~ '^flag[a-z]{1,10}[0-9]{3}$');
exception when duplicate_object then null; end $$;

-- ---------- services / attendance ----------
alter table public.services add column if not exists category text not null default 'Sunday worship';
alter table public.services add column if not exists location text;
alter table public.attendance add column if not exists recorded_by text;
alter table public.attendance add column if not exists device_id text;
create index if not exists attendance_service_device_idx on public.attendance(service_id, device_id);

-- ---------- pastoral care ----------
alter table public.follow_up_tasks add column if not exists category text not null default 'general';
alter table public.follow_up_tasks add column if not exists assignee text;
alter table public.follow_up_tasks add column if not exists notes text;
alter table public.follow_up_tasks add column if not exists last_contacted_at timestamptz;
alter table public.follow_up_tasks add column if not exists source_broadcast_id uuid;
alter table public.follow_up_tasks add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.follow_up_tasks add constraint follow_up_category_valid check (category in ('absentee','first_timer','prayer','broadcast','general'));
exception when duplicate_object then null; end $$;
create index if not exists follow_up_person_idx on public.follow_up_tasks(person_id);

create table if not exists public.follow_up_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.follow_up_tasks(id) on delete cascade,
  channel text not null check (channel in ('call','sms','whatsapp','visit','email','in_app','note')),
  outcome text not null,
  note text,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists follow_up_logs_task_idx on public.follow_up_logs(task_id, created_at desc);

-- ---------- announcements ----------
alter table public.announcements add column if not exists pinned boolean not null default false;
alter table public.announcements add column if not exists is_public boolean not null default false;
alter table public.announcements add column if not exists author text;
alter table public.announcements add column if not exists updated_at timestamptz not null default now();

-- ---------- prayer requests ----------
alter table public.prayer_requests add column if not exists requester_name text;
alter table public.prayer_requests add column if not exists requester_contact text;
alter table public.prayer_requests add column if not exists is_anonymous boolean not null default false;
alter table public.prayer_requests add column if not exists prayed_count integer not null default 0;
alter table public.prayer_requests add column if not exists admin_note text;
alter table public.prayer_requests add column if not exists assignee text;
alter table public.prayer_requests add column if not exists on_wall boolean not null default false;
alter table public.prayer_requests add column if not exists updated_at timestamptz not null default now();
alter table public.prayer_requests drop constraint if exists prayer_requests_status_check;
alter table public.prayer_requests add constraint prayer_requests_status_check
  check (status in ('pending','praying','answered','closed','approved','declined'));
do $$ begin
  alter table public.prayer_requests add constraint prayer_wall_requires_consent check (not on_wall or visibility = 'public');
exception when duplicate_object then null; end $$;

-- ---------- testimonies ----------
alter table public.testimonies add column if not exists featured boolean not null default false;
alter table public.testimonies add column if not exists published_at timestamptz;
alter table public.testimonies add column if not exists reviewer text;
do $$ begin
  alter table public.testimonies add constraint testimony_publish_requires_consent check (status <> 'published' or consent_to_publish);
exception when duplicate_object then null; end $$;

-- ---------- giving ----------
alter table public.donations add column if not exists method text not null default 'transfer';
alter table public.donations add column if not exists note text;
alter table public.donations add column if not exists donor_name text;
alter table public.donations add column if not exists recorded_by text;

-- ---------- broadcasts (messaging + follow-up tracking) ----------
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'general' check (kind in ('announcement','follow_up','general','direct')),
  audience text not null,
  channels text[] not null default array['in_app'],
  status text not null default 'sent' check (status in ('draft','sent')),
  request_response boolean not null default false,
  parent_id uuid references public.broadcasts(id) on delete set null,
  recipient_count integer not null default 0,
  created_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_created_idx on public.broadcasts(created_at desc);
create index if not exists broadcasts_parent_idx on public.broadcasts(parent_id);

create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  read_at timestamptz,
  response text,
  responded_at timestamptz,
  sms_status text,
  email_status text,
  created_at timestamptz not null default now(),
  constraint broadcast_recipient_unique unique (broadcast_id, person_id)
);
create index if not exists broadcast_recipients_person_idx on public.broadcast_recipients(person_id, created_at desc);

do $$ begin
  alter table public.follow_up_tasks add constraint follow_up_source_broadcast_fk foreign key (source_broadcast_id) references public.broadcasts(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------- staff (signed in with Google by email) ----------
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('super_admin','admin','pastor','pastoral_worker','finance_admin','department_leader')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- church settings ----------
alter table public.church_settings add column if not exists tagline text;
alter table public.church_settings add column if not exists address text;
alter table public.church_settings add column if not exists service_times text;
alter table public.church_settings add column if not exists livestream_url text;
alter table public.church_settings add column if not exists bank_name text;
alter table public.church_settings add column if not exists account_name text;
alter table public.church_settings add column if not exists account_number text;
alter table public.church_settings add column if not exists absence_threshold integer not null default 2;
insert into public.church_settings (id) values (true) on conflict (id) do nothing;

-- ---------- audit ----------
alter table public.audit_logs add column if not exists actor text;

-- ---------- RLS on new tables (no policies = no anon/authenticated access) ----------
alter table public.follow_up_logs enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.admin_users enable row level security;

notify pgrst, 'reload schema';
