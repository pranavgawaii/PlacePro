-- Migration: Promote admin to super_admin
UPDATE public.user_roles 
SET role = 'super_admin' 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'admin@placepro.in'
);
