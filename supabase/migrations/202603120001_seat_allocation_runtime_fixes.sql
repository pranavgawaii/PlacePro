-- Seat allocation runtime hardening:
-- 1) Students must be able to read the single published session metadata.
-- 2) Publish must fail unless every allocation row in the session is mapped.

drop policy if exists allocation_sessions_student_published_read on public.allocation_sessions;
create policy allocation_sessions_student_published_read on public.allocation_sessions
for select to authenticated
using (is_published = true);

create or replace function public.publish_seat_allocation_session(p_session_id uuid)
returns public.allocation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  total_allocations integer;
  mapped_allocations integer;
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

  select count(*), count(matched_student_id)
  into total_allocations, mapped_allocations
  from public.allocations
  where session_id = p_session_id;

  if total_allocations = 0 then
    raise exception 'Cannot publish an empty seat allocation session';
  end if;

  if mapped_allocations <> total_allocations then
    raise exception 'Complete student mapping for every seat before publishing';
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
