-- Departments are not part of FlagUpJesus V1: remove the tables (and their RLS policies).
-- The "department_leader" role value remains as the internal key for the "Usher" role.
drop table if exists public.member_departments;
drop table if exists public.departments;
notify pgrst, 'reload schema';
