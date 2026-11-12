-- Welcome email + optional member passwords.
--  * Everyone with an email address gets a warm "Welcome to FlagUpJesus Global Connect" email with their flag username —
--    new registrations straight away, people who registered earlier through Settings → Welcome emails or the
--    daily job. welcome_email_sent_at records when it went out.
--  * The email has a link to set a password, so members can sign in with username (or email) + password as well as
--    username + phone. Password hashes live in their own table with no client access (people rows can be read by
--    the member they belong to).
-- Idempotent: safe to run more than once.

alter table public.people add column if not exists welcome_email_sent_at timestamptz;

create table if not exists public.member_credentials (
  person_id uuid primary key references public.people(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.member_credentials enable row level security;

notify pgrst, 'reload schema';
