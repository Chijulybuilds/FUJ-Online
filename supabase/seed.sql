-- Optional starting values. Contains only details provided by FUJ — no sample people or records.
insert into public.church_settings (id, church_name, app_name, bank_name, account_name, account_number)
values (true, 'FlagUpJesus Global Ministry', 'FlagUpJesus', 'Fidelity Bank', 'FlagUp Jesus Global Ministry', '5600605313')
on conflict (id) do update set
  church_name = excluded.church_name,
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
