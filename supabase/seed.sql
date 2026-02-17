-- PlacePro V2 seed data
-- Includes admin, 10 sample students (2027 batch), companies, resumes, applications and broadcasts.

create extension if not exists pgcrypto;

-- Auth users (admin + 10 students)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  -- Admin
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@placepro.in',
    crypt('admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "PlacePro Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  -- 10 Students for 2027 batch
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222201',
    'authenticated',
    'authenticated',
    'student1@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Aarav Sharma"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222202',
    'authenticated',
    'authenticated',
    'student2@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Siya Mehta"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222203',
    'authenticated',
    'authenticated',
    'student3@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Advait Rao"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222204',
    'authenticated',
    'authenticated',
    'student4@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Anaya Kulkarni"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222205',
    'authenticated',
    'authenticated',
    'student5@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Vihaan Patel"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222206',
    'authenticated',
    'authenticated',
    'student6@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Ishani Joshi"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222207',
    'authenticated',
    'authenticated',
    'student7@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Kabir Das"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222208',
    'authenticated',
    'authenticated',
    'student8@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Myra Singh"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222209',
    'authenticated',
    'authenticated',
    'student9@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Arjun Reddy"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222210',
    'authenticated',
    'authenticated',
    'student10@placepro.in',
    crypt('student123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Kyra Iyer"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  now(),
  now(),
  now()
from auth.users u
where u.email ilike '%@placepro.in'
on conflict (provider_id, provider) do nothing;

insert into public.user_roles (user_id, role)
select id, case when email = 'admin@placepro.in' then 'admin' else 'student' end
from auth.users
where email ilike '%@placepro.in'
on conflict (user_id) do update set role = excluded.role;

insert into public.students (
  user_id,
  name,
  email,
  prn,
  branch,
  batch_year,
  phone,
  tenth_percentage,
  twelfth_percentage,
  current_backlogs,
  cgpa_sem1,
  cgpa_sem2,
  cgpa_sem3,
  cgpa_sem4,
  documents_uploaded,
  profile_complete
)
values
  ('22222222-2222-2222-2222-222222222201', 'Aarav Sharma', 'student1@placepro.in', 'ADT23SOCB0001', 'CSE', 2027, '9876543210', 88.40, 91.20, 0, 8.3, 8.5, 8.2, 8.1, 10, true),
  ('22222222-2222-2222-2222-222222222202', 'Siya Mehta', 'student2@placepro.in', 'ADT23SOCB0002', 'ECE', 2027, '9876500001', 82.0, 84.5, 0, 7.1, 7.2, 7.0, 7.3, 8, false),
  ('22222222-2222-2222-2222-222222222203', 'Advait Rao', 'student3@placepro.in', 'ADT23SOCB0003', 'CSE', 2027, '9876500002', 95.0, 93.2, 0, 9.0, 8.9, 8.8, 9.1, 10, true),
  ('22222222-2222-2222-2222-222222222204', 'Anaya Kulkarni', 'student4@placepro.in', 'ADT23SOCB0004', 'ENTC', 2027, '9876500003', 76.5, 78.2, 1, 6.6, 6.8, 6.9, 6.7, 6, false),
  ('22222222-2222-2222-2222-222222222205', 'Vihaan Patel', 'student5@placepro.in', 'ADT23SOCB0005', 'ECE', 2027, '9876500004', 86.0, 82.1, 0, 7.8, 7.6, 7.7, 7.9, 9, false),
  ('22222222-2222-2222-2222-222222222206', 'Ishani Joshi', 'student6@placepro.in', 'ADT23SOCB0006', 'CSE', 2027, '9876500005', 92.0, 89.0, 0, 8.8, 8.7, 8.9, 9.0, 10, true),
  ('22222222-2222-2222-2222-222222222207', 'Kabir Das', 'student7@placepro.in', 'ADT23SOCB0007', 'MECH', 2027, '9876500006', 78.0, 75.0, 0, 7.2, 7.1, 7.3, 7.4, 7, false),
  ('22222222-2222-2222-2222-222222222208', 'Myra Singh', 'student8@placepro.in', 'ADT23SOCB0008', 'AERO', 2027, '9876500007', 84.5, 87.2, 0, 8.1, 8.3, 8.2, 8.4, 10, true),
  ('22222222-2222-2222-2222-222222222209', 'Arjun Reddy', 'student9@placepro.in', 'ADT23SOCB0009', 'CIVIL', 2027, '9876500008', 75.0, 72.0, 2, 6.5, 6.4, 6.6, 6.7, 5, false),
  ('22222222-2222-2222-2222-222222222210', 'Kyra Iyer', 'student10@placepro.in', 'ADT23SOCB0010', 'CSE', 2027, '9876500009', 91.0, 93.0, 0, 9.2, 9.1, 9.3, 9.4, 10, true)
on conflict (email) do update
set
  name = excluded.name,
  prn = excluded.prn,
  branch = excluded.branch,
  batch_year = excluded.batch_year,
  phone = excluded.phone,
  tenth_percentage = excluded.tenth_percentage,
  twelfth_percentage = excluded.twelfth_percentage,
  current_backlogs = excluded.current_backlogs,
  cgpa_sem1 = excluded.cgpa_sem1,
  cgpa_sem2 = excluded.cgpa_sem2,
  cgpa_sem3 = excluded.cgpa_sem3,
  cgpa_sem4 = excluded.cgpa_sem4,
  documents_uploaded = excluded.documents_uploaded,
  profile_complete = excluded.profile_complete;

insert into public.companies (
  name,
  description,
  company_type,
  job_type,
  location,
  package_range,
  criteria_json,
  application_form_fields,
  process_timeline,
  application_deadline,
  active,
  created_by
)
values
  (
    'TCS',
    '<p>Mass recruiter with opportunities across engineering branches.</p>',
    'Service',
    'Full-time',
    'Pune, Onsite',
    '5-8 LPA',
    '{"cgpa_min": 7.0, "branches": ["CSE", "ECE", "ENTC", "CIVIL", "AERO", "MECH"], "backlogs_allowed": 1}'::jsonb,
    '[{"id":"expected_ctc","label":"Expected CTC","type":"text","required":false}]'::jsonb,
    '[{"id":"apply","title":"Apply"},{"id":"screening","title":"Screening"},{"id":"interview","title":"Interview"},{"id":"offer","title":"Offer"}]'::jsonb,
    now() + interval '10 days',
    true,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'Google',
    '<p>Software engineering roles for high-performing students.</p>',
    'Product',
    'Internship',
    'Bangalore, Hybrid',
    '15k-25k/month',
    '{"cgpa_min": 8.5, "tenth_min": 85, "twelfth_min": 85, "branches": ["CSE"], "backlogs_allowed": 0, "other_requirements":"Strong DSA"}'::jsonb,
    '[{"id":"why_join","label":"Why do you want to join us?","type":"textarea","required":true}]'::jsonb,
    '[{"id":"apply","title":"Apply"},{"id":"oa","title":"Online Assessment"},{"id":"interview","title":"Interviews"},{"id":"offer","title":"Offer"}]'::jsonb,
    now() + interval '5 days',
    true,
    '11111111-1111-1111-1111-111111111111'
  )
on conflict do nothing;

insert into public.messages (sender_id, recipient_id, subject, message, is_broadcast)
values
  (
    '11111111-1111-1111-1111-111111111111',
    null,
    'TCS Drive Alert',
    'Placement drive for TCS starts tomorrow at 10 AM in Seminar Hall.',
    true
  )
on conflict do nothing;
