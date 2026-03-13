alter table public.seat_sessions
add column if not exists scheduled_at timestamptz;

notify pgrst, 'reload schema';
