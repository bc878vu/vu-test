-- Run this AFTER the separately maintained supabase-tp.sql base schema.
-- Adds database-side authorization for the root admin and optional extra admins.
begin;

create table if not exists public.tp_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint tp_admins_email_valid check (
    email = lower(btrim(email))
    and email <> 'veducator4@gmail.com'
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  )
);

alter table public.tp_admins enable row level security;

-- SECURITY DEFINER avoids recursive RLS evaluation when policies consult tp_admins.
-- The empty search_path and fully-qualified names protect against object shadowing.
create or replace function public.tp_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'veducator4@gmail.com'
    or exists (
      select 1
      from public.tp_admins as a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$function$;

revoke all on function public.tp_is_admin() from public, anon;
grant execute on function public.tp_is_admin() to authenticated;

grant select, insert, delete on table public.tp_admins to authenticated;

drop policy if exists tp_admins_admin_select_v2 on public.tp_admins;
create policy tp_admins_admin_select_v2
  on public.tp_admins for select to authenticated
  using (public.tp_is_admin());

drop policy if exists tp_admins_admin_insert_v2 on public.tp_admins;
create policy tp_admins_admin_insert_v2
  on public.tp_admins for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_admins_admin_delete_v2 on public.tp_admins;
create policy tp_admins_admin_delete_v2
  on public.tp_admins for delete to authenticated
  using (public.tp_is_admin());

-- Grant table privileges, with RLS still controlling the rows/actions.
grant select, insert, update, delete on table
  public.tp_subjects,
  public.tp_mcqs,
  public.tp_short_questions,
  public.tp_long_questions,
  public.tp_settings
to authenticated;

-- Add admin access without removing the base schema's student/read policies.
alter table public.tp_subjects enable row level security;
drop policy if exists tp_subjects_admin_manage_v2 on public.tp_subjects;
create policy tp_subjects_admin_manage_v2
  on public.tp_subjects for all to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

alter table public.tp_mcqs enable row level security;
drop policy if exists tp_mcqs_admin_manage_v2 on public.tp_mcqs;
create policy tp_mcqs_admin_manage_v2
  on public.tp_mcqs for all to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

alter table public.tp_short_questions enable row level security;
drop policy if exists tp_short_questions_admin_manage_v2 on public.tp_short_questions;
create policy tp_short_questions_admin_manage_v2
  on public.tp_short_questions for all to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

alter table public.tp_long_questions enable row level security;
drop policy if exists tp_long_questions_admin_manage_v2 on public.tp_long_questions;
create policy tp_long_questions_admin_manage_v2
  on public.tp_long_questions for all to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

alter table public.tp_settings enable row level security;
drop policy if exists tp_settings_admin_manage_v2 on public.tp_settings;
create policy tp_settings_admin_manage_v2
  on public.tp_settings for all to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

-- Restrictive write policies ensure older permissive base-schema policies
-- cannot accidentally grant students insert/update/delete access.
-- Existing SELECT policies remain untouched for student question access.

drop policy if exists tp_subjects_admin_insert_only_v1 on public.tp_subjects;
create policy tp_subjects_admin_insert_only_v1
  on public.tp_subjects as restrictive for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_subjects_admin_update_only_v1 on public.tp_subjects;
create policy tp_subjects_admin_update_only_v1
  on public.tp_subjects as restrictive for update to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

drop policy if exists tp_subjects_admin_delete_only_v1 on public.tp_subjects;
create policy tp_subjects_admin_delete_only_v1
  on public.tp_subjects as restrictive for delete to authenticated
  using (public.tp_is_admin());

drop policy if exists tp_mcqs_admin_insert_only_v1 on public.tp_mcqs;
create policy tp_mcqs_admin_insert_only_v1
  on public.tp_mcqs as restrictive for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_mcqs_admin_update_only_v1 on public.tp_mcqs;
create policy tp_mcqs_admin_update_only_v1
  on public.tp_mcqs as restrictive for update to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

drop policy if exists tp_mcqs_admin_delete_only_v1 on public.tp_mcqs;
create policy tp_mcqs_admin_delete_only_v1
  on public.tp_mcqs as restrictive for delete to authenticated
  using (public.tp_is_admin());

drop policy if exists tp_short_questions_admin_insert_only_v1 on public.tp_short_questions;
create policy tp_short_questions_admin_insert_only_v1
  on public.tp_short_questions as restrictive for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_short_questions_admin_update_only_v1 on public.tp_short_questions;
create policy tp_short_questions_admin_update_only_v1
  on public.tp_short_questions as restrictive for update to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

drop policy if exists tp_short_questions_admin_delete_only_v1 on public.tp_short_questions;
create policy tp_short_questions_admin_delete_only_v1
  on public.tp_short_questions as restrictive for delete to authenticated
  using (public.tp_is_admin());

drop policy if exists tp_long_questions_admin_insert_only_v1 on public.tp_long_questions;
create policy tp_long_questions_admin_insert_only_v1
  on public.tp_long_questions as restrictive for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_long_questions_admin_update_only_v1 on public.tp_long_questions;
create policy tp_long_questions_admin_update_only_v1
  on public.tp_long_questions as restrictive for update to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

drop policy if exists tp_long_questions_admin_delete_only_v1 on public.tp_long_questions;
create policy tp_long_questions_admin_delete_only_v1
  on public.tp_long_questions as restrictive for delete to authenticated
  using (public.tp_is_admin());

drop policy if exists tp_settings_admin_insert_only_v1 on public.tp_settings;
create policy tp_settings_admin_insert_only_v1
  on public.tp_settings as restrictive for insert to authenticated
  with check (public.tp_is_admin());

drop policy if exists tp_settings_admin_update_only_v1 on public.tp_settings;
create policy tp_settings_admin_update_only_v1
  on public.tp_settings as restrictive for update to authenticated
  using (public.tp_is_admin())
  with check (public.tp_is_admin());

drop policy if exists tp_settings_admin_delete_only_v1 on public.tp_settings;
create policy tp_settings_admin_delete_only_v1
  on public.tp_settings as restrictive for delete to authenticated
  using (public.tp_is_admin());

commit;
