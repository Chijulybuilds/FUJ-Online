-- Why a WhatsApp message failed, in plain English (Meta's error code, the fix and Meta's own words), shown next to
-- "failed" on a broadcast's tracking page so admins can see what to change. Idempotent: safe to run more than once.

alter table public.broadcast_recipients add column if not exists whatsapp_error text;

notify pgrst, 'reload schema';
