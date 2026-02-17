-- Fix storage policies to be simpler and more robust

-- Ensure bucket is public
update storage.buckets
set public = true
where id = 'avatars';

-- Drop old policies to avoid conflicts/confusion
drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Create simplified policies

-- Public read access
create policy "avatars_select_public"
on storage.objects
for select
using ( bucket_id = 'avatars' );

-- Authenticated upload (insert)
-- Checks if the file name starts with the user's UUID + /
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name like (auth.uid() || '/%')
);

-- Authenticated update
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and name like (auth.uid() || '/%')
)
with check (
  bucket_id = 'avatars'
  and name like (auth.uid() || '/%')
);

-- Authenticated delete
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name like (auth.uid() || '/%')
);
