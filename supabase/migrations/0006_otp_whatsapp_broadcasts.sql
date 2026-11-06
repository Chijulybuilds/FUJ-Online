-- Phone OTP for registration, WhatsApp-first broadcasts with SMS fallback.
-- Idempotent: safe to run more than once.

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  purpose text not null default 'register' check (purpose in ('register')),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_idx on public.otp_codes(phone, created_at desc);
alter table public.otp_codes enable row level security;

alter table public.people add column if not exists whatsapp text not null default 'unknown';
alter table public.people add column if not exists whatsapp_checked_at timestamptz;
do $$ begin
  alter table public.people add constraint people_whatsapp_valid check (whatsapp in ('unknown','yes','no'));
exception when duplicate_object then null; end $$;

alter table public.broadcast_recipients add column if not exists whatsapp_status text;
alter table public.broadcast_recipients add column if not exists whatsapp_message_id text;
alter table public.broadcast_recipients add column if not exists channel_used text;
create index if not exists broadcast_recipients_wamid_idx on public.broadcast_recipients(whatsapp_message_id);

notify pgrst, 'reload schema';
