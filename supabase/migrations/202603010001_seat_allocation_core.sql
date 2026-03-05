create extension if not exists pgcrypto;

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lab_name text not null,
  total_seats integer not null check (total_seats > 0),
  rows integer,
  columns integer,
  seat_pattern text not null default 'numeric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students_temp (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  roll_number text not null,
  department text,
  upload_session_id uuid not null,
  parse_source text check (parse_source in ('xlsx', 'csv', 'pdf')),
  raw_row jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.allocation_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  upload_session_id uuid not null,
  mode text not null default 'alphabetical' check (mode in ('alphabetical', 'random')),
  status text not null default 'completed',
  seed integer,
  metadata jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students_temp(id) on delete cascade,
  matched_student_id uuid references public.students(id) on delete set null,
  lab_id uuid not null references public.labs(id) on delete cascade,
  lab_name_snapshot text not null,
  seat_number text not null,
  session_id uuid not null references public.allocation_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.document_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  institute_name text not null,
  exam_title text not null,
  subject text not null,
  logo_url text,
  footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists idx_students_temp_upload_session on public.students_temp(upload_session_id);
create unique index if not exists idx_students_temp_upload_roll_unique
  on public.students_temp(upload_session_id, owner_id, lower(roll_number));
create index if not exists idx_allocations_session_id on public.allocations(session_id);
create index if not exists idx_allocations_lab_id on public.allocations(lab_id);
create index if not exists idx_allocations_student_id on public.allocations(student_id);
create index if not exists idx_allocations_matched_student_id on public.allocations(matched_student_id);
create unique index if not exists idx_allocations_session_matched_unique
  on public.allocations(session_id, matched_student_id)
  where matched_student_id is not null;
create index if not exists idx_allocation_sessions_created_at_desc on public.allocation_sessions(created_at desc);
create index if not exists idx_allocation_sessions_is_published on public.allocation_sessions(is_published);
create unique index if not exists idx_allocation_sessions_single_published
  on public.allocation_sessions ((1))
  where is_published = true;

create or replace function public.set_seat_module_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_labs_set_updated_at on public.labs;
create trigger trg_labs_set_updated_at
before update on public.labs
for each row execute function public.set_seat_module_updated_at();

drop trigger if exists trg_document_settings_set_updated_at on public.document_settings;
create trigger trg_document_settings_set_updated_at
before update on public.document_settings
for each row execute function public.set_seat_module_updated_at();

create or replace function public.publish_seat_allocation_session(p_session_id uuid)
returns public.allocation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_session public.allocation_sessions%rowtype;
begin
  actor_id := auth.uid();

  if actor_id is null or not public.is_admin(actor_id) then
    raise exception 'Not authorized to publish seat allocation sessions';
  end if;

  select *
  into target_session
  from public.allocation_sessions
  where id = p_session_id;

  if target_session.id is null then
    raise exception 'Allocation session not found';
  end if;

  update public.allocation_sessions
  set is_published = false,
      published_at = null,
      published_by = null
  where is_published = true
    and id <> p_session_id;

  update public.allocation_sessions
  set is_published = true,
      published_at = now(),
      published_by = actor_id
  where id = p_session_id
  returning * into target_session;

  return target_session;
end;
$$;

grant execute on function public.publish_seat_allocation_session(uuid) to authenticated;

alter table public.labs enable row level security;
alter table public.students_temp enable row level security;
alter table public.allocation_sessions enable row level security;
alter table public.allocations enable row level security;
alter table public.document_settings enable row level security;

-- Admin/super_admin full access.
drop policy if exists labs_admin_all on public.labs;
create policy labs_admin_all on public.labs
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists students_temp_admin_all on public.students_temp;
create policy students_temp_admin_all on public.students_temp
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists allocation_sessions_admin_all on public.allocation_sessions;
create policy allocation_sessions_admin_all on public.allocation_sessions
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists allocations_admin_all on public.allocations;
create policy allocations_admin_all on public.allocations
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists document_settings_admin_all on public.document_settings;
create policy document_settings_admin_all on public.document_settings
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Student can only read their own mapped allocation in the currently published session.
drop policy if exists allocations_student_read_published on public.allocations;
create policy allocations_student_read_published on public.allocations
for select to authenticated
using (
  matched_student_id is not null
  and exists (
    select 1
    from public.students s
    where s.id = allocations.matched_student_id
      and s.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.allocation_sessions session_row
    where session_row.id = allocations.session_id
      and session_row.is_published = true
  )
);

grant select, insert, update, delete on public.labs to authenticated;
grant select, insert, update, delete on public.students_temp to authenticated;
grant select, insert, update, delete on public.allocation_sessions to authenticated;
grant select, insert, update, delete on public.allocations to authenticated;
grant select, insert, update, delete on public.document_settings to authenticated;
