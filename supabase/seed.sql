-- Optional starting values. Contains only details provided by FUJ — no sample people or records.
-- Existing values are kept (edit them in Admin → Settings).
insert into public.church_settings (id, church_name, app_name, contact_email, contact_phone, address, bank_name, account_name, account_number)
values (true, 'FlagUpJesus Global Ministry', 'FlagUpJesus', 'flagupjesusglobal@gmail.com', '07042741000',
        '2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt',
        'Fidelity Bank', 'FlagUp Jesus Global Ministry', '5600605313')
on conflict (id) do update set
  church_name = excluded.church_name,
  contact_email = coalesce(public.church_settings.contact_email, excluded.contact_email),
  contact_phone = coalesce(public.church_settings.contact_phone, excluded.contact_phone),
  address = coalesce(public.church_settings.address, excluded.address),
  bank_name = coalesce(public.church_settings.bank_name, excluded.bank_name),
  account_name = coalesce(public.church_settings.account_name, excluded.account_name),
  account_number = coalesce(public.church_settings.account_number, excluded.account_number);

insert into public.service_types (name, description)
values
 ('Sunday worship', 'Main Sunday worship gathering'),
 ('Bible study', 'Bible study'),
 ('Prayer meeting', 'Corporate prayer gathering'),
 ('Special event', 'Conference or special ministry event')
on conflict (name) do nothing;
