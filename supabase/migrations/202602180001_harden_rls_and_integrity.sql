-- Harden RLS-adjacent integrity paths for student self-service updates and applications.
-- This migration is backend-only and does not alter frontend UI.

-- Align eligibility behavior with client-side checks for deterministic gating.
-- `other_requirements` is informational text and should not auto-reject candidates.
create or replace function public.check_eligibility(student_id uuid, company_id uuid)
returns table(eligible boolean, reasons text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.students%rowtype;
  c public.companies%rowtype;
  criteria jsonb;
  cgpa_min numeric;
  tenth_min numeric;
  twelfth_min numeric;
  backlogs_allowed integer;
  branches text[];
  reasons_acc text[] := '{}';
begin
  select * into s from public.students where id = student_id;
  select * into c from public.companies where id = company_id and active = true;

  if s.id is null then
    return query select false, array['Student profile not found']::text[];
    return;
  end if;

  if c.id is null then
    return query select false, array['Company is not active']::text[];
    return;
  end if;

  if not s.profile_complete then
    reasons_acc := reasons_acc || 'Profile is incomplete';
  end if;

  criteria := c.criteria_json;
  cgpa_min := coalesce((criteria->>'cgpa_min')::numeric, 0);
  tenth_min := nullif((criteria->>'tenth_min'), '')::numeric;
  twelfth_min := nullif((criteria->>'twelfth_min'), '')::numeric;
  backlogs_allowed := coalesce((criteria->>'backlogs_allowed')::integer, 0);

  select coalesce(array_agg(value), '{}')::text[]
  into branches
  from jsonb_array_elements_text(coalesce(criteria->'branches', '[]'::jsonb));

  if coalesce(s.overall_cgpa, 0) < cgpa_min then
    reasons_acc := reasons_acc || format('CGPA requirement: %s (You: %s)', cgpa_min, coalesce(s.overall_cgpa, 0));
  end if;

  if tenth_min is not null and coalesce(s.tenth_percentage, 0) < tenth_min then
    reasons_acc := reasons_acc || format('10th percentage requirement: %s (You: %s)', tenth_min, coalesce(s.tenth_percentage, 0));
  end if;

  if twelfth_min is not null and coalesce(s.twelfth_percentage, 0) < twelfth_min then
    reasons_acc := reasons_acc || format('12th percentage requirement: %s (You: %s)', twelfth_min, coalesce(s.twelfth_percentage, 0));
  end if;

  if array_length(branches, 1) is not null and array_length(branches, 1) > 0 and not (s.branch = any(branches)) then
    reasons_acc := reasons_acc || format('Branch requirement mismatch (%s)', array_to_string(branches, ', '));
  end if;

  if s.current_backlogs > backlogs_allowed then
    reasons_acc := reasons_acc || format('Backlogs allowed: %s (You: %s)', backlogs_allowed, s.current_backlogs);
  end if;

  return query select (array_length(reasons_acc, 1) is null), coalesce(reasons_acc, '{}');
end;
$$;

-- 1) Guard student profile updates from mutating protected lifecycle fields.
create or replace function public.guard_students_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.email is distinct from old.email
    or new.prn is distinct from old.prn
    or new.branch is distinct from old.branch
    or new.batch_year is distinct from old.batch_year
    or new.documents_uploaded is distinct from old.documents_uploaded
    or new.profile_complete is distinct from old.profile_complete
    or new.is_active is distinct from old.is_active
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Protected student fields are read-only';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_students_guard_update on public.students;
create trigger trg_students_guard_update
before update on public.students
for each row execute function public.guard_students_update();

-- 2) Prevent students from self-verifying documents or mutating immutable columns.
create or replace function public.guard_documents_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.student_id is distinct from old.student_id
    or new.doc_type is distinct from old.doc_type
    or new.verified is distinct from old.verified
    or new.uploaded_at is distinct from old.uploaded_at
  then
    raise exception 'Protected document fields are read-only';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_guard_update on public.documents;
create trigger trg_documents_guard_update
before update on public.documents
for each row execute function public.guard_documents_update();

-- 3) Enforce application integrity on insert (ownership, deadline, eligibility, resume ownership).
create or replace function public.guard_applications_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_user_id uuid;
  owner_active boolean;
  company_active boolean;
  company_deadline timestamptz;
  resume_owner uuid;
  eligibility record;
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  select s.user_id, s.is_active
  into owner_user_id, owner_active
  from public.students s
  where s.id = new.student_id;

  if owner_user_id is null or owner_user_id <> auth.uid() then
    raise exception 'Cannot apply for another student';
  end if;

  if owner_active is not true then
    raise exception 'Student account is not active';
  end if;

  if new.resume_id is not null then
    select r.student_id
    into resume_owner
    from public.resumes r
    where r.id = new.resume_id;

    if resume_owner is null or resume_owner <> new.student_id then
      raise exception 'Selected resume does not belong to student';
    end if;
  end if;

  select c.active, c.application_deadline
  into company_active, company_deadline
  from public.companies c
  where c.id = new.company_id;

  if company_active is not true then
    raise exception 'Company is not accepting applications';
  end if;

  if company_deadline is not null and company_deadline < now() then
    raise exception 'Application deadline has passed';
  end if;

  select *
  into eligibility
  from public.check_eligibility(new.student_id, new.company_id)
  limit 1;

  if coalesce(eligibility.eligible, false) is not true then
    raise exception 'Not eligible: %', array_to_string(coalesce(eligibility.reasons, array['Not eligible']), '; ');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_applications_guard_insert on public.applications;
create trigger trg_applications_guard_insert
before insert on public.applications
for each row execute function public.guard_applications_insert();

-- 4) Restrict student-side application updates to safe fields while status remains 'applied'.
create or replace function public.guard_applications_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resume_owner uuid;
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = old.student_id
      and s.user_id = auth.uid()
  ) then
    raise exception 'Cannot update another student''s application';
  end if;

  if old.status <> 'applied' then
    raise exception 'Application can no longer be edited';
  end if;

  if new.student_id is distinct from old.student_id
    or new.company_id is distinct from old.company_id
    or new.status is distinct from old.status
    or new.admin_notes is distinct from old.admin_notes
  then
    raise exception 'Protected application fields are read-only';
  end if;

  if new.resume_id is not null then
    select r.student_id
    into resume_owner
    from public.resumes r
    where r.id = new.resume_id;

    if resume_owner is null or resume_owner <> old.student_id then
      raise exception 'Selected resume does not belong to student';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_applications_guard_update on public.applications;
create trigger trg_applications_guard_update
before update on public.applications
for each row execute function public.guard_applications_update();

-- 5) Tighten insert policy to align with trigger checks and reduce bypass surface.
drop policy if exists "applications_insert_own" on public.applications;

create policy "applications_insert_own"
on public.applications
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or (
    exists (
      select 1
      from public.students s
      where s.id = applications.student_id
        and s.user_id = auth.uid()
    )
    and (
      applications.resume_id is null
      or exists (
        select 1
        from public.resumes r
        where r.id = applications.resume_id
          and r.student_id = applications.student_id
      )
    )
    and exists (
      select 1
      from public.companies c
      where c.id = applications.company_id
        and c.active = true
        and (c.application_deadline is null or c.application_deadline >= now())
    )
    and (
      select e.eligible
      from public.check_eligibility(applications.student_id, applications.company_id) e
      limit 1
    ) = true
  )
);
