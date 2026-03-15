import { NextResponse } from "next/server";
import { z } from "zod";

import { BRANCHES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Branch } from "@/types/database.types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const branchSchema = z.enum(BRANCHES as [Branch, ...Branch[]]);
const enrollmentSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(8, "Enrollment number must be at least 8 characters")
  .max(20, "Enrollment number must be 20 characters or fewer")
  .regex(/^[A-Z0-9]+$/, "Enrollment number can contain only letters and numbers");

const mobileSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[6-9]\d{9}$/.test(value), "Mobile number must be a valid 10-digit number");

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().nullable()
);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().url("Enter a valid URL").nullable()
);

const optionalInteger = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().int().nullable());

const optionalPercentage = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().min(0).max(100).nullable());

const optionalCgpa = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().min(0).max(10).nullable());

const studentUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be 100 characters or fewer"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  enrollment_no: enrollmentSchema,
  mobile: mobileSchema,
  branch: branchSchema,
  batch_year: z.coerce.number().int().min(2024).max(2035),
  is_active: z.boolean(),
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  portfolio_url: optionalUrl,
  tenth_board: optionalText,
  tenth_school: optionalText,
  tenth_year: optionalInteger,
  tenth_percentage: optionalPercentage,
  twelfth_board: optionalText,
  twelfth_college: optionalText,
  twelfth_year: optionalInteger,
  twelfth_percentage: optionalPercentage,
  current_backlogs: z.coerce.number().int().min(0).max(50),
  cgpa_sem1: optionalCgpa,
  cgpa_sem2: optionalCgpa,
  cgpa_sem3: optionalCgpa,
  cgpa_sem4: optionalCgpa,
  cgpa_sem5: optionalCgpa,
  cgpa_sem6: optionalCgpa,
  cgpa_sem7: optionalCgpa,
  cgpa_sem8: optionalCgpa,
  overall_cgpa: optionalCgpa
});

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 401 as const, user: null };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !roleRow.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return { status: 403 as const, user: null };
  }

  return { status: 200 as const, user };
}

function generateFallbackMobile() {
  const firstDigit = String(6 + Math.floor(Math.random() * 4));
  const remainingDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstDigit}${remainingDigits}`;
}

function normalizeMobile(value: string) {
  const trimmed = value.trim();
  return /^[6-9]\d{9}$/.test(trimmed) ? trimmed : generateFallbackMobile();
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const [{ data: documents, error: documentsError }, { data: applications, error: applicationsError }] = await Promise.all([
    admin.from("documents").select("*").eq("student_id", id).order("uploaded_at", { ascending: false }),
    admin.from("applications").select("*").eq("student_id", id).order("updated_at", { ascending: false })
  ]);

  if (documentsError || applicationsError) {
    return NextResponse.json(
      { error: documentsError?.message ?? applicationsError?.message ?? "Failed to load student details" },
      { status: 500 }
    );
  }

  const companyIds = [...new Set((applications ?? []).map((application) => application.company_id))];
  const { data: companies, error: companiesError } = companyIds.length
    ? await admin.from("companies").select("*").in("id", companyIds)
    : { data: [], error: null };

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  return NextResponse.json({
    student,
    documents: documents ?? [],
    applications: applications ?? [],
    companies: companies ?? []
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = studentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existingStudent, error: existingStudentError } = await admin
    .from("students")
    .select("id, user_id, name, email, prn, is_active")
    .eq("id", id)
    .maybeSingle();

  if (existingStudentError) {
    return NextResponse.json({ error: existingStudentError.message }, { status: 500 });
  }

  if (!existingStudent) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const payload = parsed.data;

  const [{ data: emailConflict, error: emailConflictError }, { data: prnConflict, error: prnConflictError }] = await Promise.all([
    admin.from("students").select("id, name").eq("email", payload.email).neq("id", id).maybeSingle(),
    admin.from("students").select("id, name").eq("prn", payload.enrollment_no).neq("id", id).maybeSingle()
  ]);

  if (emailConflictError || prnConflictError) {
    return NextResponse.json({ error: "Failed to validate unique fields" }, { status: 500 });
  }

  if (emailConflict) {
    return NextResponse.json({ error: `Email already belongs to ${emailConflict.name}` }, { status: 409 });
  }

  if (prnConflict) {
    return NextResponse.json({ error: `Enrollment number already belongs to ${prnConflict.name}` }, { status: 409 });
  }

  const nextPhone = normalizeMobile(payload.mobile);

  const updatePayload = {
    name: payload.name,
    email: payload.email,
    prn: payload.enrollment_no,
    phone: nextPhone,
    branch: payload.branch,
    batch_year: payload.batch_year,
    is_active: payload.is_active,
    linkedin_url: payload.linkedin_url,
    github_url: payload.github_url,
    portfolio_url: payload.portfolio_url,
    tenth_board: payload.tenth_board,
    tenth_school: payload.tenth_school,
    tenth_year: payload.tenth_year,
    tenth_percentage: payload.tenth_percentage,
    twelfth_board: payload.twelfth_board,
    twelfth_college: payload.twelfth_college,
    twelfth_year: payload.twelfth_year,
    twelfth_percentage: payload.twelfth_percentage,
    current_backlogs: payload.current_backlogs,
    cgpa_sem1: payload.cgpa_sem1,
    cgpa_sem2: payload.cgpa_sem2,
    cgpa_sem3: payload.cgpa_sem3,
    cgpa_sem4: payload.cgpa_sem4,
    cgpa_sem5: payload.cgpa_sem5,
    cgpa_sem6: payload.cgpa_sem6,
    cgpa_sem7: payload.cgpa_sem7,
    cgpa_sem8: payload.cgpa_sem8,
    overall_cgpa: payload.overall_cgpa
  };

  const { data: updatedStudent, error: updateStudentError } = await admin
    .from("students")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (updateStudentError) {
    return NextResponse.json({ error: updateStudentError.message }, { status: 500 });
  }

  const { error: roleUpdateError } = await admin
    .from("user_roles")
    .update({ is_active: payload.is_active })
    .eq("user_id", existingStudent.user_id)
    .eq("role", "student");

  if (roleUpdateError) {
    return NextResponse.json({ error: roleUpdateError.message }, { status: 500 });
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(existingStudent.user_id, {
    email: payload.email,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      role: "student"
    }
  });

  if (authUpdateError) {
    await admin
      .from("students")
      .update({
        name: existingStudent.name,
        email: existingStudent.email,
        prn: existingStudent.prn,
        is_active: existingStudent.is_active
      })
      .eq("id", id);

    await admin
      .from("user_roles")
      .update({ is_active: existingStudent.is_active })
      .eq("user_id", existingStudent.user_id)
      .eq("role", "student");

    return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, student: updatedStudent });
}
