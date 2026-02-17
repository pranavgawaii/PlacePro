-- Migration: Admin Management Upgrade
-- Description: Adds super_admin role and admin management capabilities

-- Update user_roles check constraint
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('student', 'admin', 'super_admin'));

-- Add is_active column
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update is_admin function to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- Update RLS policies for user_roles
DROP POLICY IF EXISTS "user_roles_admin_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_self_student" ON public.user_roles;

-- Anyone can see roles (needed for auth checks client-side)
-- Already exists: "user_roles_select_all"

-- Self-registration for students
CREATE POLICY "user_roles_insert_self_student"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND role = 'student')
  OR public.is_super_admin(auth.uid())
);

-- Only super admins can manage user roles (admin/super_admin/student)
CREATE POLICY "user_roles_super_admin_all"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
