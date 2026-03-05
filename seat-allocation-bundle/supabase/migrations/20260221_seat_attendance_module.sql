-- PlacePro- MIT ADT Seat Allocation & Attendance Module
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
  created_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students_temp(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
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
create index if not exists idx_allocation_sessions_created_at_desc on public.allocation_sessions(created_at desc);

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

alter table public.labs enable row level security;
alter table public.students_temp enable row level security;
alter table public.allocation_sessions enable row level security;
alter table public.allocations enable row level security;
alter table public.document_settings enable row level security;

-- labs policies

drop policy if exists labs_select_own on public.labs;
create policy labs_select_own on public.labs
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists labs_insert_own on public.labs;
create policy labs_insert_own on public.labs
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists labs_update_own on public.labs;
create policy labs_update_own on public.labs
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists labs_delete_own on public.labs;
create policy labs_delete_own on public.labs
for delete to authenticated
using (owner_id = auth.uid());

-- students_temp policies

drop policy if exists students_temp_select_own on public.students_temp;
create policy students_temp_select_own on public.students_temp
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists students_temp_insert_own on public.students_temp;
create policy students_temp_insert_own on public.students_temp
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists students_temp_update_own on public.students_temp;
create policy students_temp_update_own on public.students_temp
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists students_temp_delete_own on public.students_temp;
create policy students_temp_delete_own on public.students_temp
for delete to authenticated
using (owner_id = auth.uid());

-- allocation_sessions policies

drop policy if exists allocation_sessions_select_own on public.allocation_sessions;
create policy allocation_sessions_select_own on public.allocation_sessions
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists allocation_sessions_insert_own on public.allocation_sessions;
create policy allocation_sessions_insert_own on public.allocation_sessions
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists allocation_sessions_update_own on public.allocation_sessions;
create policy allocation_sessions_update_own on public.allocation_sessions
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists allocation_sessions_delete_own on public.allocation_sessions;
create policy allocation_sessions_delete_own on public.allocation_sessions
for delete to authenticated
using (owner_id = auth.uid());

-- allocations policies

drop policy if exists allocations_select_own on public.allocations;
create policy allocations_select_own on public.allocations
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists allocations_insert_own on public.allocations;
create policy allocations_insert_own on public.allocations
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists allocations_update_own on public.allocations;
create policy allocations_update_own on public.allocations
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists allocations_delete_own on public.allocations;
create policy allocations_delete_own on public.allocations
for delete to authenticated
using (owner_id = auth.uid());

-- document_settings policies

drop policy if exists document_settings_select_own on public.document_settings;
create policy document_settings_select_own on public.document_settings
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists document_settings_insert_own on public.document_settings;
create policy document_settings_insert_own on public.document_settings
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists document_settings_update_own on public.document_settings;
create policy document_settings_update_own on public.document_settings
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists document_settings_delete_own on public.document_settings;
create policy document_settings_delete_own on public.document_settings
for delete to authenticated
using (owner_id = auth.uid());

grant select, insert, update, delete on public.labs to authenticated;
grant select, insert, update, delete on public.students_temp to authenticated;
grant select, insert, update, delete on public.allocation_sessions to authenticated;
grant select, insert, update, delete on public.allocations to authenticated;
grant select, insert, update, delete on public.document_settings to authenticated;

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('seat-uploads', 'seat-uploads', false),
  ('seat-assets', 'seat-assets', true),
  ('seat-documents', 'seat-documents', false)
on conflict (id) do nothing;

-- Storage policies: authenticated users only under owner/{uid}/...

drop policy if exists seat_uploads_select_own on storage.objects;
create policy seat_uploads_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'seat-uploads'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_uploads_insert_own on storage.objects;
create policy seat_uploads_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'seat-uploads'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_uploads_update_own on storage.objects;
create policy seat_uploads_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'seat-uploads'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'seat-uploads'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_uploads_delete_own on storage.objects;
create policy seat_uploads_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'seat-uploads'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_assets_select_own on storage.objects;
create policy seat_assets_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'seat-assets'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_assets_insert_own on storage.objects;
create policy seat_assets_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'seat-assets'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_assets_update_own on storage.objects;
create policy seat_assets_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'seat-assets'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'seat-assets'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_assets_delete_own on storage.objects;
create policy seat_assets_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'seat-assets'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_documents_select_own on storage.objects;
create policy seat_documents_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'seat-documents'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_documents_insert_own on storage.objects;
create policy seat_documents_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'seat-documents'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_documents_update_own on storage.objects;
create policy seat_documents_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'seat-documents'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'seat-documents'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists seat_documents_delete_own on storage.objects;
create policy seat_documents_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'seat-documents'
  and (storage.foldername(name))[1] = 'owner'
  and (storage.foldername(name))[2] = auth.uid()::text
);
