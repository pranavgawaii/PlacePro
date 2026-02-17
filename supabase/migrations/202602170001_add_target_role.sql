-- Add target_role column to companies table
alter table public.companies add column if not exists target_role text;

-- Update existing records with default roles based on company name/type
update public.companies 
set target_role = 'Systems Engineer / Ninja' 
where name ilike '%TCS%';

update public.companies 
set target_role = 'Software Engineering Intern' 
where name ilike '%Google%';

update public.companies 
set target_role = job_type 
where target_role is null;
