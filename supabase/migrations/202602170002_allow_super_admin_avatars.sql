-- Allow Super Admins to manage all avatars
create policy "avatars_super_admin_manage"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'avatars'
  and (
    select role from public.user_roles where user_id = auth.uid()
  ) = 'super_admin'
)
with check (
  bucket_id = 'avatars'
  and (
    select role from public.user_roles where user_id = auth.uid()
  ) = 'super_admin'
);
