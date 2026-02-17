-- Add avatar_url to students table
alter table public.students add column if not exists avatar_url text;

-- Create avatars bucket if not exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage Policies for Avatars

-- Allow public read access
create policy "avatars_select_public"
on storage.objects
for select
using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload files
-- We restrict the folder structure to avatars/{user_id}/* to ensure users can only write to their own folder
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
