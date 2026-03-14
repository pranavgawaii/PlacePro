alter table public.reminders
add column if not exists email_subject text,
add column if not exists email_title text;

notify pgrst, 'reload schema';
