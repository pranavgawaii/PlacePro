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

create table if not exists public.seat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_mode text not null check (source_mode in ('direct', 'upload')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'published')),
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.seat_session_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.seat_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  prn text not null,
  name_snapshot text,
  branch_snapshot text,
  source_mode text not null check (source_mode in ('direct', 'upload')),
  source_row_no integer,
  match_status text not null check (match_status in ('matched', 'unmatched', 'duplicate', 'overflow', 'removed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.seat_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
  seat_number text not null,
  created_at timestamptz not null default now(),
  unique (session_id, student_id),
  unique (session_id, lab_id, seat_number)
);

create index if not exists idx_labs_created_at on public.labs(created_at desc);
create index if not exists idx_seat_sessions_created_at on public.seat_sessions(created_at desc);
create index if not exists idx_seat_sessions_owner_id on public.seat_sessions(owner_id);
create index if not exists idx_seat_sessions_is_published on public.seat_sessions(is_published);
create unique index if not exists idx_seat_sessions_single_published
  on public.seat_sessions ((1))
  where is_published = true;
create index if not exists idx_seat_session_candidates_session_id on public.seat_session_candidates(session_id);
create index if not exists idx_seat_session_candidates_student_id on public.seat_session_candidates(student_id);
create index if not exists idx_seat_session_candidates_prn on public.seat_session_candidates(prn);
create index if not exists idx_seat_session_candidates_match_status on public.seat_session_candidates(match_status);
create index if not exists idx_seat_assignments_session_id on public.seat_assignments(session_id);
create index if not exists idx_seat_assignments_student_id on public.seat_assignments(student_id);
create index if not exists idx_seat_assignments_lab_id on public.seat_assignments(lab_id);

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

create or replace function public.publish_seat_session(p_session_id uuid)
returns public.seat_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_session public.seat_sessions%rowtype;
  unresolved_count integer;
  matched_count integer;
  assigned_count integer;
begin
  actor_id := auth.uid();

  if actor_id is null or not public.is_admin(actor_id) then
    raise exception 'Not authorized to publish seat sessions';
  end if;

  select *
  into target_session
  from public.seat_sessions
  where id = p_session_id;

  if target_session.id is null then
    raise exception 'Seat session not found';
  end if;

  select count(*)
  into unresolved_count
  from public.seat_session_candidates
  where session_id = p_session_id
    and match_status in ('unmatched', 'duplicate', 'overflow');

  if unresolved_count > 0 then
    raise exception 'Resolve unmatched, duplicate, and overflow rows before publishing';
  end if;

  select count(*)
  into matched_count
  from public.seat_session_candidates
  where session_id = p_session_id
    and match_status = 'matched'
    and student_id is not null;

  if matched_count = 0 then
    raise exception 'No matched students are available to publish';
  end if;

  select count(*)
  into assigned_count
  from public.seat_assignments
  where session_id = p_session_id;

  if assigned_count <> matched_count then
    raise exception 'Every matched student must have exactly one seat assignment before publishing';
  end if;

  update public.seat_sessions
  set is_published = false,
      status = 'ready',
      published_at = null,
      published_by = null
  where is_published = true
    and id <> p_session_id;

  update public.seat_sessions
  set is_published = true,
      status = 'published',
      published_at = now(),
      published_by = actor_id
  where id = p_session_id
  returning * into target_session;

  return target_session;
end;
$$;

grant execute on function public.publish_seat_session(uuid) to authenticated;

alter table public.labs enable row level security;
alter table public.seat_sessions enable row level security;
alter table public.seat_session_candidates enable row level security;
alter table public.seat_assignments enable row level security;

drop policy if exists labs_admin_all on public.labs;
create policy labs_admin_all on public.labs
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists labs_student_read_allocated on public.labs;
create policy labs_student_read_allocated on public.labs
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.seat_assignments sa on sa.student_id = s.id
    join public.seat_sessions ss on ss.id = sa.session_id
    where s.user_id = auth.uid()
      and sa.lab_id = labs.id
      and ss.is_published = true
  )
);

drop policy if exists seat_sessions_admin_all on public.seat_sessions;
create policy seat_sessions_admin_all on public.seat_sessions
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists seat_sessions_student_read_published on public.seat_sessions;
create policy seat_sessions_student_read_published on public.seat_sessions
for select to authenticated
using (is_published = true);

drop policy if exists seat_session_candidates_admin_all on public.seat_session_candidates;
create policy seat_session_candidates_admin_all on public.seat_session_candidates
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists seat_assignments_admin_all on public.seat_assignments;
create policy seat_assignments_admin_all on public.seat_assignments
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists seat_assignments_student_read_published on public.seat_assignments;
create policy seat_assignments_student_read_published on public.seat_assignments
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.seat_sessions ss on ss.id = seat_assignments.session_id
    where s.id = seat_assignments.student_id
      and s.user_id = auth.uid()
      and ss.is_published = true
  )
);

grant select, insert, update, delete on public.labs to authenticated;
grant select, insert, update, delete on public.seat_sessions to authenticated;
grant select, insert, update, delete on public.seat_session_candidates to authenticated;
grant select, insert, update, delete on public.seat_assignments to authenticated;

notify pgrst, 'reload schema';
