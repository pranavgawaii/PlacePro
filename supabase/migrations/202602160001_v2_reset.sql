create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Reset V1/V2 tables for a clean V2 baseline

-- Drop storage policies from prior versions
DROP POLICY IF EXISTS "documents_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "v2_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "v2_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "v2_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "v2_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "v2_documents_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "v2_resumes_select" ON storage.objects;
DROP POLICY IF EXISTS "v2_resumes_insert" ON storage.objects;
DROP POLICY IF EXISTS "v2_resumes_update" ON storage.objects;
DROP POLICY IF EXISTS "v2_resumes_delete" ON storage.objects;
DROP POLICY IF EXISTS "v2_resumes_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "v2_company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "v2_company_logos_admin_write" ON storage.objects;

DROP TABLE IF EXISTS public.student_activity_logs CASCADE;
DROP TABLE IF EXISTS public.application_events CASCADE;
DROP TABLE IF EXISTS public.message_recipients CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.sync_student_document_state();
DROP FUNCTION IF EXISTS public.check_resume_limit();
DROP FUNCTION IF EXISTS public.manage_default_resume();
DROP FUNCTION IF EXISTS public.touch_updated_at();
DROP FUNCTION IF EXISTS public.log_application_status_change();
DROP FUNCTION IF EXISTS public.seed_message_recipients();
DROP FUNCTION IF EXISTS public.check_eligibility(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_eligible_students_for_company(uuid);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin', 'super_admin')),
  is_active boolean not null default true
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = uid
      and role in ('admin', 'super_admin')
      and is_active = true
  );
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  prn text unique,
  branch text check (branch in ('CSE', 'ECE', 'ENTC', 'CIVIL', 'AERO', 'MECH')),
  batch_year integer not null default 2027,
  phone text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  tenth_board text,
  tenth_school text,
  tenth_year integer,
  tenth_percentage numeric(5,2),
  twelfth_board text,
  twelfth_college text,
  twelfth_year integer,
  twelfth_percentage numeric(5,2),
  current_backlogs integer not null default 0,
  cgpa_sem1 numeric(4,2),
  cgpa_sem2 numeric(4,2),
  cgpa_sem3 numeric(4,2),
  cgpa_sem4 numeric(4,2),
  cgpa_sem5 numeric(4,2),
  cgpa_sem6 numeric(4,2),
  cgpa_sem7 numeric(4,2),
  cgpa_sem8 numeric(4,2),
  overall_cgpa numeric(4,2) generated always as (
    case
      when (
        (case when cgpa_sem1 is not null then 1 else 0 end) +
        (case when cgpa_sem2 is not null then 1 else 0 end) +
        (case when cgpa_sem3 is not null then 1 else 0 end) +
        (case when cgpa_sem4 is not null then 1 else 0 end) +
        (case when cgpa_sem5 is not null then 1 else 0 end) +
        (case when cgpa_sem6 is not null then 1 else 0 end) +
        (case when cgpa_sem7 is not null then 1 else 0 end) +
        (case when cgpa_sem8 is not null then 1 else 0 end)
      ) = 0 then null
      else round(
        (
          coalesce(cgpa_sem1, 0) + coalesce(cgpa_sem2, 0) + coalesce(cgpa_sem3, 0) + coalesce(cgpa_sem4, 0) +
          coalesce(cgpa_sem5, 0) + coalesce(cgpa_sem6, 0) + coalesce(cgpa_sem7, 0) + coalesce(cgpa_sem8, 0)
        ) /
        nullif(
          (
            (case when cgpa_sem1 is not null then 1 else 0 end) +
            (case when cgpa_sem2 is not null then 1 else 0 end) +
            (case when cgpa_sem3 is not null then 1 else 0 end) +
            (case when cgpa_sem4 is not null then 1 else 0 end) +
            (case when cgpa_sem5 is not null then 1 else 0 end) +
            (case when cgpa_sem6 is not null then 1 else 0 end) +
            (case when cgpa_sem7 is not null then 1 else 0 end) +
            (case when cgpa_sem8 is not null then 1 else 0 end)
          ),
          0
        ),
        2
      )
    end
  ) stored,
  documents_uploaded integer not null default 0,
  profile_complete boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  doc_type text not null check (doc_type in ('tenth', 'twelfth', 'sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8', 'resume', 'other')),
  file_url text not null,
  file_name text,
  file_size integer,
  verified boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create unique index idx_documents_required_unique
on public.documents(student_id, doc_type)
where doc_type in ('tenth', 'twelfth', 'sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text,
  company_type text not null default 'Service' check (company_type in ('Service', 'Product', 'Startup', 'Government')),
  job_type text not null default 'Full-time' check (job_type in ('Full-time', 'Internship', 'Both')),
  location text,
  package_range text,
  criteria_json jsonb not null default '{"cgpa_min": 0, "branches": ["CSE", "ECE", "ENTC", "CIVIL", "AERO", "MECH"], "backlogs_allowed": 0}'::jsonb,
  application_form_fields jsonb not null default '[]'::jsonb,
  process_timeline jsonb not null default '[]'::jsonb,
  application_deadline timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (jsonb_typeof(criteria_json) = 'object'),
  check (jsonb_typeof(application_form_fields) = 'array'),
  check (jsonb_typeof(process_timeline) = 'array')
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  template_type text not null default 'modern' check (template_type in ('modern', 'classic', 'minimalist', 'creative')),
  resume_data jsonb not null default '{}'::jsonb,
  file_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(resume_data) = 'object')
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'interview', 'rejected', 'selected')),
  cover_letter text,
  additional_info jsonb not null default '{}'::jsonb,
  admin_notes text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, company_id),
  check (jsonb_typeof(additional_info) = 'object')
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  subject text,
  message text not null,
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now(),
  check ((is_broadcast = true and recipient_id is null) or (is_broadcast = false))
);

create table public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(message_id, recipient_id)
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text check (from_status in ('applied', 'shortlisted', 'interview', 'rejected', 'selected')),
  to_status text not null check (to_status in ('applied', 'shortlisted', 'interview', 'rejected', 'selected')),
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.student_activity_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index idx_students_branch on public.students(branch);
create index idx_students_profile_complete on public.students(profile_complete);
create index idx_students_documents_uploaded on public.students(documents_uploaded);
create index idx_documents_student_id on public.documents(student_id);
create index idx_companies_active on public.companies(active);
create index idx_companies_deadline on public.companies(application_deadline);
create index idx_applications_student_id on public.applications(student_id);
create index idx_applications_company_id on public.applications(company_id);
create index idx_applications_status on public.applications(status);
create index idx_message_recipients_recipient on public.message_recipients(recipient_id, read_at);

-- Trigger functions

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_student_document_state()
returns trigger
language plpgsql
as $$
declare
  sid uuid;
  required_docs_count integer;
  should_complete boolean;
begin
  sid := coalesce(new.student_id, old.student_id);

  select count(distinct d.doc_type)
  into required_docs_count
  from public.documents d
  where d.student_id = sid
    and d.doc_type in ('tenth', 'twelfth', 'sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8');

  select (
    required_docs_count >= 10
    and s.phone is not null
    and s.tenth_percentage is not null
    and s.twelfth_percentage is not null
    and s.overall_cgpa is not null
  )
  into should_complete
  from public.students s
  where s.id = sid;

  update public.students
  set documents_uploaded = required_docs_count,
      profile_complete = coalesce(should_complete, false),
      updated_at = now()
  where id = sid;

  return null;
end;
$$;

create or replace function public.check_resume_limit()
returns trigger
language plpgsql
as $$
declare
  resume_count integer;
begin
  select count(*) into resume_count from public.resumes where student_id = new.student_id;
  if tg_op = 'INSERT' and resume_count >= 4 then
    raise exception 'Maximum 4 resumes allowed per student';
  end if;
  return new;
end;
$$;

create or replace function public.manage_default_resume()
returns trigger
language plpgsql
as $$
declare
  has_default boolean;
begin
  if new.is_default then
    update public.resumes
    set is_default = false,
        updated_at = now()
    where student_id = new.student_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_default = true;
  else
    select exists(
      select 1 from public.resumes where student_id = new.student_id and is_default = true and id <> new.id
    ) into has_default;

    if not has_default then
      new.is_default = true;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.log_application_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.application_events (application_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

create or replace function public.seed_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_broadcast then
    insert into public.message_recipients (message_id, recipient_id)
    select new.id, s.user_id
    from public.students s
    where s.is_active = true
    on conflict (message_id, recipient_id) do nothing;
  elsif new.recipient_id is not null then
    insert into public.message_recipients (message_id, recipient_id)
    values (new.id, new.recipient_id)
    on conflict (message_id, recipient_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger trg_students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

create trigger trg_resumes_touch_updated_at
before update on public.resumes
for each row execute function public.touch_updated_at();

create trigger trg_applications_touch_updated_at
before update on public.applications
for each row execute function public.touch_updated_at();

create trigger trg_documents_sync_student_after_insert
after insert on public.documents
for each row execute function public.sync_student_document_state();

create trigger trg_documents_sync_student_after_update
after update on public.documents
for each row execute function public.sync_student_document_state();

create trigger trg_documents_sync_student_after_delete
after delete on public.documents
for each row execute function public.sync_student_document_state();

create trigger trg_resumes_limit
before insert on public.resumes
for each row execute function public.check_resume_limit();

create trigger trg_resumes_default_insert
before insert on public.resumes
for each row execute function public.manage_default_resume();

create trigger trg_resumes_default_update
before update on public.resumes
for each row execute function public.manage_default_resume();

create trigger trg_applications_log_event
after insert or update on public.applications
for each row execute function public.log_application_status_change();

create trigger trg_messages_seed_recipients
after insert on public.messages
for each row execute function public.seed_message_recipients();

-- Eligibility functions

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

  if coalesce(criteria->>'other_requirements', '') <> '' then
    reasons_acc := reasons_acc || format('Other requirement: %s', criteria->>'other_requirements');
  end if;

  return query select (array_length(reasons_acc, 1) is null), coalesce(reasons_acc, '{}');
end;
$$;

create or replace function public.get_eligible_students_for_company(company_id uuid)
returns table(
  student_id uuid,
  name text,
  email text,
  prn text,
  branch text,
  overall_cgpa numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.email,
    s.prn,
    s.branch,
    s.overall_cgpa
  from public.students s
  cross join lateral public.check_eligibility(s.id, company_id) e
  where e.eligible = true
    and s.is_active = true;
$$;

-- Enable RLS
alter table public.user_roles enable row level security;
alter table public.students enable row level security;
alter table public.documents enable row level security;
alter table public.companies enable row level security;
alter table public.resumes enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.application_events enable row level security;
alter table public.student_activity_logs enable row level security;

-- user_roles policies
create policy "user_roles_select_all"
on public.user_roles
for select
using (true);

create policy "user_roles_insert_self_student"
on public.user_roles
for insert
to authenticated
with check (
  (user_id = auth.uid() and role = 'student')
  or public.is_admin(auth.uid())
);

create policy "user_roles_admin_update"
on public.user_roles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- students policies
create policy "students_select_own_or_admin"
on public.students
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "students_insert_own_or_admin"
on public.students
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "students_update_own_or_admin"
on public.students
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "students_admin_delete"
on public.students
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- documents policies
create policy "documents_select_own_or_admin"
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = documents.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

create policy "documents_insert_own_or_admin"
on public.documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.id = documents.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

create policy "documents_update_own_or_admin"
on public.documents
for update
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = documents.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
)
with check (
  exists (
    select 1
    from public.students s
    where s.id = documents.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

create policy "documents_delete_own_or_admin"
on public.documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = documents.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

-- companies policies
create policy "companies_select_active_or_admin"
on public.companies
for select
using (active = true or public.is_admin(auth.uid()));

create policy "companies_admin_insert"
on public.companies
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "companies_admin_update"
on public.companies
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "companies_admin_delete"
on public.companies
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- resumes policies
create policy "resumes_select_own_or_admin"
on public.resumes
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = resumes.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

create policy "resumes_insert_own"
on public.resumes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.id = resumes.student_id
      and s.user_id = auth.uid()
  )
);

create policy "resumes_update_own"
on public.resumes
for update
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = resumes.student_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.students s
    where s.id = resumes.student_id
      and s.user_id = auth.uid()
  )
);

create policy "resumes_delete_own"
on public.resumes
for delete
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = resumes.student_id
      and s.user_id = auth.uid()
  )
);

-- applications policies
create policy "applications_select_own_or_admin"
on public.applications
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = applications.student_id
      and s.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

create policy "applications_insert_own"
on public.applications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.id = applications.student_id
      and s.user_id = auth.uid()
  )
);

create policy "applications_update_own_or_admin"
on public.applications
for update
to authenticated
using (
  (
    exists (
      select 1
      from public.students s
      where s.id = applications.student_id
        and s.user_id = auth.uid()
    )
    and applications.status = 'applied'
  )
  or public.is_admin(auth.uid())
)
with check (
  (
    exists (
      select 1
      from public.students s
      where s.id = applications.student_id
        and s.user_id = auth.uid()
    )
  )
  or public.is_admin(auth.uid())
);

create policy "applications_delete_own_applied"
on public.applications
for delete
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = applications.student_id
      and s.user_id = auth.uid()
  )
  and applications.status = 'applied'
);

-- messages policies
create policy "messages_admin_insert"
on public.messages
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "messages_select_admin_or_recipient"
on public.messages
for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.message_recipients mr
    where mr.message_id = messages.id
      and mr.recipient_id = auth.uid()
  )
);

-- message_recipients policies
create policy "message_recipients_select_own_or_admin"
on public.message_recipients
for select
to authenticated
using (recipient_id = auth.uid() or public.is_admin(auth.uid()));

create policy "message_recipients_update_read_own"
on public.message_recipients
for update
to authenticated
using (recipient_id = auth.uid() or public.is_admin(auth.uid()))
with check (recipient_id = auth.uid() or public.is_admin(auth.uid()));

create policy "message_recipients_admin_insert"
on public.message_recipients
for insert
to authenticated
with check (public.is_admin(auth.uid()));

-- application events policies
create policy "application_events_select_own_or_admin"
on public.application_events
for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.applications a
    join public.students s on s.id = a.student_id
    where a.id = application_events.application_id
      and s.user_id = auth.uid()
  )
);

create policy "application_events_admin_insert"
on public.application_events
for insert
to authenticated
with check (public.is_admin(auth.uid()));

-- activity log policies
create policy "student_activity_logs_select_own_or_admin"
on public.student_activity_logs
for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.students s
    where s.id = student_activity_logs.student_id
      and s.user_id = auth.uid()
  )
);

create policy "student_activity_logs_insert_admin_or_owner"
on public.student_activity_logs
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.students s
    where s.id = student_activity_logs.student_id
      and s.user_id = auth.uid()
  )
);

-- Buckets
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('resumes', 'resumes', false),
  ('company-logos', 'company-logos', true)
on conflict (id) do update
set public = excluded.public;

-- Storage policies
create policy "v2_documents_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_documents_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_documents_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_documents_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_documents_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and public.is_admin(auth.uid())
);

create policy "v2_resumes_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_resumes_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_resumes_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_resumes_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resumes'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and s.user_id = auth.uid()
  )
);

create policy "v2_resumes_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and public.is_admin(auth.uid())
);

create policy "v2_company_logos_public_read"
on storage.objects
for select
using (bucket_id = 'company-logos');

create policy "v2_company_logos_admin_write"
on storage.objects
for all
to authenticated
using (bucket_id = 'company-logos' and public.is_admin(auth.uid()))
with check (bucket_id = 'company-logos' and public.is_admin(auth.uid()));
