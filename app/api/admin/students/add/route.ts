import { NextResponse } from "next/server";
import { provisionStudentAccount } from "@/lib/admin/student-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { manualAddSchema } from "@/lib/validations/student";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = manualAddSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstIssue?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const admin = createAdminClient();

  const [{ data: existingByEmail, error: emailCheckError }, { data: existingByEnrollment, error: enrollmentCheckError }] =
    await Promise.all([
      admin.from("students").select("name, email").eq("email", payload.email).maybeSingle(),
      admin.from("students").select("name, prn").eq("prn", payload.enrollment_no).maybeSingle()
    ]);

  if (emailCheckError || enrollmentCheckError) {
    return NextResponse.json(
      { success: false, error: "Failed to validate duplicates. Please try again." },
      { status: 500 }
    );
  }

  if (existingByEmail) {
    return NextResponse.json(
      {
        success: false,
        error: `Email already exists in system (Student: ${existingByEmail.name})`
      },
      { status: 409 }
    );
  }

  if (existingByEnrollment) {
    return NextResponse.json(
      {
        success: false,
        error: `Enrollment ${payload.enrollment_no} already exists (Student: ${existingByEnrollment.name})`
      },
      { status: 409 }
    );
  }

  const result = await provisionStudentAccount(admin, {
    student: {
      name: payload.name,
      email: payload.email,
      enrollment_no: payload.enrollment_no,
      mobile: payload.mobile,
      branch: payload.branch,
      batch_year: payload.batch_year
    },
    passwordStrategy: payload.passwordStrategy,
    forcePasswordChange: payload.forcePasswordChange
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      success: true,
      student: {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email,
        enrollment_no: result.data.enrollment_no
      },
      generatedPassword: result.data.password
    },
    { status: 200 }
  );
}
