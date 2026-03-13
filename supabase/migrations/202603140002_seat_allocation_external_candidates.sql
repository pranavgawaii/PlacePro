alter table public.seat_assignments
add column if not exists candidate_id uuid references public.seat_session_candidates(id) on delete cascade;

update public.seat_assignments sa
set candidate_id = candidate_match.id
from public.seat_session_candidates candidate_match
where sa.candidate_id is null
  and candidate_match.session_id = sa.session_id
  and candidate_match.student_id = sa.student_id
  and candidate_match.match_status = 'matched';

alter table public.seat_assignments
alter column student_id drop not null;

create index if not exists idx_seat_assignments_candidate_id on public.seat_assignments(candidate_id);

alter table public.seat_assignments
  drop constraint if exists seat_assignments_session_id_student_id_key;

alter table public.seat_assignments
  drop constraint if exists seat_assignments_session_id_lab_id_seat_number_key;

create unique index if not exists idx_seat_assignments_session_candidate_unique
  on public.seat_assignments(session_id, candidate_id)
  where candidate_id is not null;

create unique index if not exists idx_seat_assignments_session_student_unique
  on public.seat_assignments(session_id, student_id)
  where student_id is not null;

create unique index if not exists idx_seat_assignments_session_lab_seat_unique
  on public.seat_assignments(session_id, lab_id, seat_number);

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
    and match_status = 'matched';

  if matched_count = 0 then
    raise exception 'No matched candidates are available to publish';
  end if;

  select count(*)
  into assigned_count
  from public.seat_assignments
  where session_id = p_session_id;

  if assigned_count <> matched_count then
    raise exception 'Every matched candidate must have exactly one seat assignment before publishing';
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

drop policy if exists seat_assignments_student_read_published on public.seat_assignments;
create policy seat_assignments_student_read_published on public.seat_assignments
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.seat_sessions ss on ss.id = seat_assignments.session_id
    where s.user_id = auth.uid()
      and ss.is_published = true
      and (
        s.id = seat_assignments.student_id
        or exists (
          select 1
          from public.seat_session_candidates candidate_row
          where candidate_row.id = seat_assignments.candidate_id
            and candidate_row.student_id = s.id
        )
      )
  )
);

drop policy if exists labs_student_read_allocated on public.labs;
create policy labs_student_read_allocated on public.labs
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.seat_assignments sa on sa.lab_id = labs.id
    join public.seat_sessions ss on ss.id = sa.session_id
    left join public.seat_session_candidates candidate_row on candidate_row.id = sa.candidate_id
    where s.user_id = auth.uid()
      and ss.is_published = true
      and (
        s.id = sa.student_id
        or candidate_row.student_id = s.id
      )
  )
);

grant execute on function public.publish_seat_session(uuid) to authenticated;

notify pgrst, 'reload schema';
