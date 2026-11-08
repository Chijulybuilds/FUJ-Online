-- Children's registration. Children who don't have a phone of their own register with a parent's or guardian's
-- number: they get their own record and flag username (for check-in and attendance), linked to the parent when
-- the parent is — or later becomes — a registered member with that number. Phone numbers therefore stay unique
-- among adults only. Children receive messages in the app only; WhatsApp / SMS / email go to the parent.
-- Idempotent: safe to run more than once.

alter table public.people add column if not exists is_child boolean not null default false;
alter table public.people add column if not exists guardian_id uuid references public.people(id) on delete set null;
alter table public.people add column if not exists guardian_name text;
alter table public.people add column if not exists guardian_relationship text;
-- Allergies, medical or special-care needs (children's church only).
alter table public.people add column if not exists care_notes text;
create index if not exists people_guardian_idx on public.people (guardian_id);

-- One phone number per adult; children share their parent's number.
alter table public.people drop constraint if exists people_normalized_phone_key;
create unique index if not exists people_adult_phone_key on public.people (normalized_phone) where not is_child;
create index if not exists people_phone_idx on public.people (normalized_phone);

notify pgrst, 'reload schema';
