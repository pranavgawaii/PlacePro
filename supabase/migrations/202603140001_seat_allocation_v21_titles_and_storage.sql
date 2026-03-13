alter table public.seat_sessions
add column if not exists title text;

update public.seat_sessions
set title = case
  when source_mode = 'direct' then 'New Direct Draft'
  else 'New Upload Draft'
end
where title is null or btrim(title) = '';

alter table public.seat_sessions
alter column title set default 'New Direct Draft';

alter table public.seat_sessions
alter column title set not null;

insert into storage.buckets (id, name, public)
values ('seat-documents', 'seat-documents', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
