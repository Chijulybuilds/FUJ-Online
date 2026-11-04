-- Optional development seed. Run only in a non-production project.
insert into public.church_settings (id, church_name, app_name)
values (true, 'Flag of Jesus Global Ministry', 'FlagUpJesus')
on conflict (id) do nothing;

insert into public.service_types (name, description)
values
 ('Sunday worship', 'Main Sunday worship gathering'),
 ('Bible study', 'Midweek Bible study'),
 ('Prayer meeting', 'Corporate prayer gathering'),
 ('Special event', 'Conference or special ministry event')
on conflict (name) do nothing;
