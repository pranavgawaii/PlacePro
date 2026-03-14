create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  message_email text,
  message_whatsapp text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_recipients (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null check (status in ('sent', 'failed')),
  sent_at timestamptz
);

create index if not exists idx_reminders_created_by_created_at
  on public.reminders(created_by, created_at desc);

create index if not exists idx_reminder_recipients_reminder_id
  on public.reminder_recipients(reminder_id);

create index if not exists idx_reminder_recipients_student_id
  on public.reminder_recipients(student_id);

alter table public.reminders enable row level security;
alter table public.reminder_recipients enable row level security;

drop policy if exists reminders_admin_all on public.reminders;
create policy reminders_admin_all
on public.reminders
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists reminder_recipients_admin_all on public.reminder_recipients;
create policy reminder_recipients_admin_all
on public.reminder_recipients
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.reminder_recipients to authenticated;

notify pgrst, 'reload schema';
