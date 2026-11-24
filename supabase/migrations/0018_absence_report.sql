-- Weekly "missed Sundays" report: an SMS to the pastor and admins listing members who have missed the last N
-- Sundays in a row (N = absence_threshold), so they can follow them up. Idempotent: safe to run more than once.

alter table public.church_settings add column if not exists absence_report boolean not null default false;
-- Phone numbers that receive the report (one per line or comma-separated).
alter table public.church_settings add column if not exists absence_report_numbers text;
alter table public.church_settings add column if not exists absence_report_sent_at timestamptz;

notify pgrst, 'reload schema';
