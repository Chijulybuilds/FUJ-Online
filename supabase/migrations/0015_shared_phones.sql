-- Family members who share one phone number (e.g. a couple with one phone). Like children on a parent's number,
-- an adult can now use another member's number: their own record and username, linked to the person whose number
-- it is (guardian_id), with WhatsApp / SMS / email going to that person once. Used by contact imports where a
-- list has several people on one number. Idempotent: safe to run more than once.

alter table public.people add column if not exists shares_phone boolean not null default false;

-- One phone number per "owner"; children and family members sharing it are allowed.
drop index if exists public.people_adult_phone_key;
create unique index if not exists people_phone_owner_key on public.people (normalized_phone) where not is_child and not shares_phone;

notify pgrst, 'reload schema';
