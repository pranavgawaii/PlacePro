-- Fix RLS violation for application_events
-- The log_application_status_change trigger fails for students because they don't have insert permissions on application_events.
-- Making the function SECURITY DEFINER allows it to write to the table with owner privileges, bypassing RLS for the trigger action.

create or replace function public.log_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
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


