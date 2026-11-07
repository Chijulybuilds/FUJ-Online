-- Core schema. Safe to run more than once (everything is created only if missing).
create extension if not exists pgcrypto;

do $$ begin create type public.person_status as enum ('visitor','member','inactive','transferred','left_ministry'); exception when duplicate_object then null; end $$;
do $$ begin create type public.service_status as enum ('scheduled','active','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.qr_session_status as enum ('active','closed','revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.check_in_method as enum ('qr','manual','admin'); exception when duplicate_object then null; end $$;

create table if not exists public.church_settings (
  id boolean primary key default true check (id = true),
  church_name text not null default 'Flag of Jesus Global Ministry',
  app_name text not null default 'FlagUpJesus',
  timezone text not null default 'Africa/Lagos',
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  person_code text unique,
  full_name text not null,
  phone text not null,
  normalized_phone text not null unique,
  email text,
  status public.person_status not null default 'visitor',
  first_visit_at timestamptz,
  joined_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_full_name_idx on public.people using gin (to_tsvector('simple', full_name));
create index if not exists people_status_idx on public.people(status);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid unique references public.people(id) on delete set null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);
insert into public.roles(name,description) values
 ('super_admin','Full platform administration'),
 ('pastor','Pastoral leadership access'),
 ('admin','Church operations administration'),
 ('department_leader','Usher — services and attendance'),
 ('pastoral_worker','Assigned pastoral follow-up'),
 ('finance_admin','Giving and financial reporting'),
 ('member','Member portal access')
on conflict (name) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(user_id,role_id)
);


create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid references public.service_types(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  check_in_opens_at timestamptz,
  check_in_closes_at timestamptz,
  status public.service_status not null default 'scheduled',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_time_valid check (ends_at is null or ends_at > starts_at),
  constraint service_checkin_window_valid check (
    check_in_closes_at is null or check_in_opens_at is null or check_in_closes_at > check_in_opens_at
  )
);
create index if not exists services_starts_at_idx on public.services(starts_at desc);

create table if not exists public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  status public.qr_session_status not null default 'active',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint qr_session_window_valid check (closes_at > opens_at)
);
create index if not exists qr_sessions_service_idx on public.qr_sessions(service_id);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  check_in_method public.check_in_method not null default 'qr',
  checked_in_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint unique_person_service unique(person_id,service_id)
);
create index if not exists attendance_service_idx on public.attendance(service_id,checked_in_at desc);
create index if not exists attendance_person_idx on public.attendance(person_id,checked_in_at desc);

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  reason text not null,
  priority text not null default 'normal' check(priority in ('low','normal','high')),
  status text not null default 'open' check(status in ('open','in_progress','completed','dismissed')),
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists follow_up_open_idx on public.follow_up_tasks(status,priority);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  status text not null default 'draft' check(status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  request_text text not null,
  visibility text not null default 'pastoral' check(visibility in ('pastoral','public','private')),
  status text not null default 'pending' check(status in ('pending','approved','declined','closed')),
  consent_to_share boolean not null default false,
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.testimonies (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  title text not null,
  body text not null,
  consent_to_publish boolean not null default false,
  status text not null default 'pending' check(status in ('pending','approved','declined','published')),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  amount numeric(14,2) not null check(amount > 0),
  currency text not null default 'NGN',
  fund_name text not null default 'General',
  status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
  provider_reference text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists donations_paid_at_idx on public.donations(paid_at desc) where status='paid';

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create or replace trigger people_updated_at before update on public.people for each row execute function public.set_updated_at();
create or replace trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create or replace trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
