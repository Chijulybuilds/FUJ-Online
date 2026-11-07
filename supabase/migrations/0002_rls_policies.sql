-- Enable RLS on all application tables. Policies are intentionally conservative.
-- Safe to run more than once: each policy is dropped (if present) and re-created.
alter table public.church_settings enable row level security;
alter table public.people enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_types enable row level security;
alter table public.services enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.announcements enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.testimonies enable row level security;
alter table public.donations enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: role checks must be based on trusted DB assignments, never user-editable metadata.
create or replace function public.has_role(role_name text)
returns boolean language sql stable security definer set search_path = public as $$
 select exists (
  select 1 from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=auth.uid() and r.name=role_name
 );
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
 select public.has_role('super_admin') or public.has_role('admin') or public.has_role('pastor');
$$;

drop policy if exists "authenticated users read church settings" on public.church_settings;
create policy "authenticated users read church settings" on public.church_settings
for select to authenticated using (true);
drop policy if exists "admins manage church settings" on public.church_settings;
create policy "admins manage church settings" on public.church_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read people" on public.people;
create policy "admins read people" on public.people
for select to authenticated using (public.is_admin() or public.has_role('pastoral_worker') or public.has_role('department_leader'));
drop policy if exists "admins insert people" on public.people;
create policy "admins insert people" on public.people
for insert to authenticated with check (public.is_admin());
drop policy if exists "admins update people" on public.people;
create policy "admins update people" on public.people
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
for select to authenticated using (id=auth.uid() or public.is_admin());
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists "admins insert profiles" on public.profiles;
create policy "admins insert profiles" on public.profiles
for insert to authenticated with check (public.is_admin() or id=auth.uid());

drop policy if exists "authenticated read roles" on public.roles;
create policy "authenticated read roles" on public.roles for select to authenticated using (true);
drop policy if exists "admins manage roles" on public.roles;
create policy "admins manage roles" on public.roles for all to authenticated using (public.has_role('super_admin')) with check (public.has_role('super_admin'));
drop policy if exists "users read own role assignments" on public.user_roles;
create policy "users read own role assignments" on public.user_roles for select to authenticated using (user_id=auth.uid() or public.has_role('super_admin'));
drop policy if exists "super admins manage role assignments" on public.user_roles;
create policy "super admins manage role assignments" on public.user_roles for all to authenticated using (public.has_role('super_admin')) with check (public.has_role('super_admin'));


drop policy if exists "authenticated read service types" on public.service_types;
create policy "authenticated read service types" on public.service_types for select to authenticated using (true);
drop policy if exists "admins manage service types" on public.service_types;
create policy "admins manage service types" on public.service_types for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "authenticated read services" on public.services;
create policy "authenticated read services" on public.services for select to authenticated using (true);
drop policy if exists "admins manage services" on public.services;
create policy "admins manage services" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read qr sessions" on public.qr_sessions;
create policy "authenticated read qr sessions" on public.qr_sessions for select to authenticated using (public.is_admin());
drop policy if exists "admins manage qr sessions" on public.qr_sessions;
create policy "admins manage qr sessions" on public.qr_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read own attendance and admins read all" on public.attendance;
create policy "members read own attendance and admins read all" on public.attendance
for select to authenticated using (public.is_admin() or person_id=(select p.person_id from public.profiles p where p.id=auth.uid()));
drop policy if exists "admins or ushers record attendance" on public.attendance;
create policy "admins or ushers record attendance" on public.attendance
for insert to authenticated with check (public.is_admin() or public.has_role('department_leader'));

drop policy if exists "pastoral team read followups" on public.follow_up_tasks;
create policy "pastoral team read followups" on public.follow_up_tasks
for select to authenticated using (public.is_admin() or public.has_role('pastoral_worker'));
drop policy if exists "admins manage followups" on public.follow_up_tasks;
create policy "admins manage followups" on public.follow_up_tasks
for all to authenticated using (public.is_admin() or public.has_role('pastoral_worker')) with check (public.is_admin() or public.has_role('pastoral_worker'));

drop policy if exists "authenticated read published announcements" on public.announcements;
create policy "authenticated read published announcements" on public.announcements
for select to authenticated using (status='published' or public.is_admin());
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pastoral team read prayer requests" on public.prayer_requests;
create policy "pastoral team read prayer requests" on public.prayer_requests
for select to authenticated using (public.is_admin() or public.has_role('pastoral_worker') or person_id=(select p.person_id from public.profiles p where p.id=auth.uid()));
drop policy if exists "authenticated submit prayer requests" on public.prayer_requests;
create policy "authenticated submit prayer requests" on public.prayer_requests
for insert to authenticated with check (person_id=(select p.person_id from public.profiles p where p.id=auth.uid()));
drop policy if exists "pastoral team update prayer requests" on public.prayer_requests;
create policy "pastoral team update prayer requests" on public.prayer_requests
for update to authenticated using (public.is_admin() or public.has_role('pastoral_worker')) with check (public.is_admin() or public.has_role('pastoral_worker'));

drop policy if exists "read published testimonies or own" on public.testimonies;
create policy "read published testimonies or own" on public.testimonies
for select to authenticated using (status='published' or person_id=(select p.person_id from public.profiles p where p.id=auth.uid()) or public.is_admin());
drop policy if exists "authenticated submit testimonies" on public.testimonies;
create policy "authenticated submit testimonies" on public.testimonies
for insert to authenticated with check (person_id=(select p.person_id from public.profiles p where p.id=auth.uid()));
drop policy if exists "admins moderate testimonies" on public.testimonies;
create policy "admins moderate testimonies" on public.testimonies
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "finance admins read donations" on public.donations;
create policy "finance admins read donations" on public.donations
for select to authenticated using (public.has_role('finance_admin') or public.is_admin());
drop policy if exists "finance admins manage donations" on public.donations;
create policy "finance admins manage donations" on public.donations
for all to authenticated using (public.has_role('finance_admin') or public.is_admin()) with check (public.has_role('finance_admin') or public.is_admin());

drop policy if exists "super admins read audit logs" on public.audit_logs;
create policy "super admins read audit logs" on public.audit_logs
for select to authenticated using (public.has_role('super_admin'));
drop policy if exists "authenticated write audit logs" on public.audit_logs;
create policy "authenticated write audit logs" on public.audit_logs
for insert to authenticated with check (actor_user_id=auth.uid());


-- A signed-in person may read their own church person record.
drop policy if exists "people read own linked record" on public.people;
create policy "people read own linked record" on public.people
for select to authenticated using (id=(select p.person_id from public.profiles p where p.id=auth.uid()));

-- A member may check themselves into an active session for the service.
-- Server-side token validation still runs before this insert.
drop policy if exists "members record own active session attendance" on public.attendance;
create policy "members record own active session attendance" on public.attendance
for insert to authenticated with check (
  person_id=(select p.person_id from public.profiles p where p.id=auth.uid())
  and exists (
    select 1 from public.qr_sessions qs
    where qs.service_id=attendance.service_id
      and qs.status='active'
      and now() between qs.opens_at and qs.closes_at
  )
);
