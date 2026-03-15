create or replace function public.generate_random_student_phone()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate :=
      (floor(random() * 4)::int + 6)::text ||
      lpad(floor(random() * 1000000000)::bigint::text, 9, '0');

    exit when not exists (
      select 1
      from public.students
      where phone = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.students
set phone = public.generate_random_student_phone()
where phone is null
   or btrim(phone) = ''
   or phone !~ '^[6-9][0-9]{9}$';

alter table public.students
  drop constraint if exists students_phone_format_check;

alter table public.students
  add constraint students_phone_format_check
  check (phone ~ '^[6-9][0-9]{9}$');

create or replace function public.ensure_student_phone()
returns trigger
language plpgsql
as $$
begin
  if new.phone is null
     or btrim(new.phone) = ''
     or new.phone !~ '^[6-9][0-9]{9}$' then
    new.phone := public.generate_random_student_phone();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_students_ensure_phone on public.students;

create trigger trg_students_ensure_phone
before insert or update on public.students
for each row execute function public.ensure_student_phone();

alter table public.students
  alter column phone set not null;

notify pgrst, 'reload schema';
