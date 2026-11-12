-- FUJ Partners in two streams:
--   OUTREACH partners  — FlagUpJesus members who partner with the ministry (as before);
--   ASSOCIATE partners — key partners outside FlagUpJesus (UK, US and around the world).
-- Associates get a record of their own (for messages, giving history and the username used as transfer narration)
-- but they are not church members: person status 'associate' keeps them out of member lists, counts and member
-- broadcasts. Their pledges can be in other currencies. Idempotent: safe to run more than once.

alter type public.person_status add value if not exists 'associate';

alter table public.partners add column if not exists stream text not null default 'outreach';
do $$ begin
  alter table public.partners add constraint partners_stream_valid check (stream in ('outreach','associate'));
exception when duplicate_object then null; end $$;
alter table public.partners add column if not exists country text;
alter table public.partners add column if not exists organisation text;
alter table public.partners add column if not exists currency text not null default 'NGN';
create index if not exists partners_stream_idx on public.partners (stream);

-- How associates abroad can give (domiciliary account, IBAN / SWIFT, online link) — used in their reminders.
alter table public.church_settings add column if not exists associate_giving_details text;

notify pgrst, 'reload schema';
