create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  prn text unique,
  branch text check (branch in ('CSE', 'ECE', 'ENTC', 'CIVIL', 'AERO', 'MECH')),
  batch_year integer not null default 2027,
  tenth_percentage numeric(5,2),
  twelfth_percentage numeric(5,2),
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
          coalesce(cgpa_sem1, 0) +
          coalesce(cgpa_sem2, 0) +
          coalesce(cgpa_sem3, 0) +
          coalesce(cgpa_sem4, 0) +
          coalesce(cgpa_sem5, 0) +
          coalesce(cgpa_sem6, 0) +
          coalesce(cgpa_sem7, 0) +
          coalesce(cgpa_sem8, 0)
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
  profile_complete_percentage integer not null default 0 check (profile_complete_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  doc_type text not null check (doc_type in ('tenth', 'twelfth', 'sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8')),
  file_url text not null,
  file_name text,
  file_size integer,
  verified boolean not null default false,
  uploaded_at timestamptz not null default now(),
  unique(student_id, doc_type)
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin'))
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
      and role = 'admin'
  );
$$;

create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  description text,
  criteria_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (jsonb_typeof(criteria_json) = 'object')
);

create table if not exists public.applications (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'rejected')),
  applied_at timestamptz not null default now(),
  unique(student_id, company_id)
);

create index if not exists idx_students_branch on public.students(branch);
create index if not exists idx_students_overall_cgpa on public.students(overall_cgpa);
create index if not exists idx_documents_student_id on public.documents(student_id);
create index if not exists idx_companies_active on public.companies(active);
create index if not exists idx_applications_student_id on public.applications(student_id);
create index if not exists idx_applications_company_id on public.applications(company_id);

alter table public.students enable row level security;
alter table public.documents enable row level security;
alter table public.companies enable row level security;
alter table public.applications enable row level security;
alter table public.user_roles enable row level security;

create policy "students_select_own"
  on public.students
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "students_update_own"
  on public.students
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "students_insert_own"
  on public.students
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "students_admin_all"
  on public.students
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "documents_select_own"
  on public.documents
  for select
  to authenticated
  using (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

create policy "documents_insert_own"
  on public.documents
  for insert
  to authenticated
  with check (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
  );

create policy "documents_update_own_or_admin"
  on public.documents
  for update
  to authenticated
  using (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  )
  with check (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

create policy "documents_delete_own_or_admin"
  on public.documents
  for delete
  to authenticated
  using (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

create policy "companies_select_public"
  on public.companies
  for select
  using (true);

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

create policy "applications_select_own_or_admin"
  on public.applications
  for select
  to authenticated
  using (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

create policy "applications_insert_own"
  on public.applications
  for insert
  to authenticated
  with check (
    student_id in (
      select id from public.students where user_id = auth.uid()
    )
  );

create policy "applications_update_admin"
  on public.applications
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "user_roles_select_public"
  on public.user_roles
  for select
  using (true);

create policy "user_roles_insert_own_student"
  on public.user_roles
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'student'
  );

create policy "user_roles_admin_all"
  on public.user_roles
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

create policy "documents_bucket_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
        from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.user_id = auth.uid()
      )
      or public.is_admin(auth.uid())
    )
  );

create policy "documents_bucket_insert"
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

create policy "documents_bucket_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
        from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.user_id = auth.uid()
      )
      or public.is_admin(auth.uid())
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      exists (
        select 1
        from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.user_id = auth.uid()
      )
      or public.is_admin(auth.uid())
    )
  );

create policy "documents_bucket_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1
        from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.user_id = auth.uid()
      )
      or public.is_admin(auth.uid())
    )
  );

create policy "company_logos_select_public"
  on storage.objects
  for select
  using (bucket_id = 'company-logos');

create policy "company_logos_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'company-logos' and public.is_admin(auth.uid()));

create policy "company_logos_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'company-logos' and public.is_admin(auth.uid()))
  with check (bucket_id = 'company-logos' and public.is_admin(auth.uid()));

create policy "company_logos_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'company-logos' and public.is_admin(auth.uid()));
