-- Automatic absence follow-up: when a member misses N consecutive Sundays (absence_threshold) they get a
-- message on the chosen channels, then a reminder every follow_up_every_days days until they come back
-- (or staff close their follow-up task). Idempotent: safe to run more than once.

alter table public.church_settings add column if not exists auto_follow_up boolean not null default true;
alter table public.church_settings add column if not exists follow_up_every_days integer not null default 3
  check (follow_up_every_days between 1 and 30);
-- 0 = keep reminding until they come back.
alter table public.church_settings add column if not exists follow_up_max_messages integer not null default 0
  check (follow_up_max_messages between 0 and 100);
alter table public.church_settings add column if not exists follow_up_channels text[] not null default array['whatsapp','sms','email'];
alter table public.church_settings add column if not exists follow_up_first_message text;
alter table public.church_settings add column if not exists follow_up_reminder_message text;

alter table public.follow_up_tasks add column if not exists auto_messages_sent integer not null default 0;
alter table public.follow_up_tasks add column if not exists last_auto_message_at timestamptz;
create index if not exists follow_up_tasks_open_absentee_idx on public.follow_up_tasks (category, status);

notify pgrst, 'reload schema';
