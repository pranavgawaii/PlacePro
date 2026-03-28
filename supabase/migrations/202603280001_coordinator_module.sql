create extension if not exists pgcrypto;

create table if not exists public.placement_coordinators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enrollment_no text not null unique,
  email text,
  department text not null,
  year text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coordinator_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  is_public boolean not null default false,
  theme_settings jsonb not null default '{}'::jsonb,
  deadline timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coordinator_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.coordinator_forms(id) on delete cascade,
  label text not null,
  field_type text not null check (field_type in ('short_text', 'long_text', 'email', 'number', 'select')),
  required boolean not null default true,
  options jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.coordinator_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.coordinator_forms(id) on delete cascade,
  answers jsonb not null,
  status text not null default 'new' check (status in ('new', 'shortlisted', 'rejected', 'on_hold')),
  notes text,
  applicant_name text,
  applicant_email text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_placement_coordinators_enrollment_no on public.placement_coordinators(enrollment_no);
create index if not exists idx_placement_coordinators_name on public.placement_coordinators(name);
create index if not exists idx_coordinator_forms_slug on public.coordinator_forms(slug);
create index if not exists idx_coordinator_forms_status_public on public.coordinator_forms(status, is_public);
create index if not exists idx_coordinator_form_fields_form_order on public.coordinator_form_fields(form_id, sort_order);
create index if not exists idx_coordinator_form_responses_form_submitted on public.coordinator_form_responses(form_id, submitted_at desc);
create index if not exists idx_coordinator_form_responses_form_status on public.coordinator_form_responses(form_id, status);

create or replace function public.set_coordinator_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_placement_coordinators_updated_at on public.placement_coordinators;
create trigger trg_placement_coordinators_updated_at
before update on public.placement_coordinators
for each row execute function public.set_coordinator_updated_at();

drop trigger if exists trg_coordinator_forms_updated_at on public.coordinator_forms;
create trigger trg_coordinator_forms_updated_at
before update on public.coordinator_forms
for each row execute function public.set_coordinator_updated_at();

alter table public.placement_coordinators enable row level security;
alter table public.coordinator_forms enable row level security;
alter table public.coordinator_form_fields enable row level security;
alter table public.coordinator_form_responses enable row level security;

drop policy if exists placement_coordinators_admin_all on public.placement_coordinators;
create policy placement_coordinators_admin_all
on public.placement_coordinators
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists coordinator_forms_admin_all on public.coordinator_forms;
create policy coordinator_forms_admin_all
on public.coordinator_forms
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists coordinator_form_fields_admin_all on public.coordinator_form_fields;
create policy coordinator_form_fields_admin_all
on public.coordinator_form_fields
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists coordinator_form_responses_admin_all on public.coordinator_form_responses;
create policy coordinator_form_responses_admin_all
on public.coordinator_form_responses
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists coordinator_forms_public_read on public.coordinator_forms;
create policy coordinator_forms_public_read
on public.coordinator_forms
for select to anon, authenticated
using (
  is_public = true
  and status = 'active'
  and (deadline is null or deadline > now())
);

drop policy if exists coordinator_form_fields_public_read on public.coordinator_form_fields;
create policy coordinator_form_fields_public_read
on public.coordinator_form_fields
for select to anon, authenticated
using (
  exists (
    select 1
    from public.coordinator_forms f
    where f.id = coordinator_form_fields.form_id
      and f.is_public = true
      and f.status = 'active'
      and (f.deadline is null or f.deadline > now())
  )
);

drop policy if exists coordinator_form_responses_public_insert on public.coordinator_form_responses;
create policy coordinator_form_responses_public_insert
on public.coordinator_form_responses
for insert to anon, authenticated
with check (
  exists (
    select 1
    from public.coordinator_forms f
    where f.id = coordinator_form_responses.form_id
      and f.is_public = true
      and f.status = 'active'
      and (f.deadline is null or f.deadline > now())
  )
);

grant select, insert, update, delete on public.placement_coordinators to authenticated;
grant select, insert, update, delete on public.coordinator_forms to authenticated;
grant select, insert, update, delete on public.coordinator_form_fields to authenticated;
grant select, insert, update, delete on public.coordinator_form_responses to authenticated;
grant select on public.coordinator_forms to anon;
grant select on public.coordinator_form_fields to anon;
grant insert on public.coordinator_form_responses to anon;

notify pgrst, 'reload schema';
