import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePatternPassword, generateRandomPassword } from "@/lib/utils/password-generator";
import { PasswordStrategy, StudentInput } from "@/lib/validations/student";
import { Database, TablesInsert } from "@/types/database.types";

type AdminClient = SupabaseClient<Database>;

export type StudentProvisionInput = {
  student: StudentInput;
  passwordStrategy: PasswordStrategy;
  forcePasswordChange: boolean;
};

export type StudentProvisionSuccess = {
  id: string;
  name: string;
  email: string;
  enrollment_no: string;
  password: string;
};

export type StudentProvisionResult =
  | {
      ok: true;
      data: StudentProvisionSuccess;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeSupabaseErrorMessage(message: string) {
  if (message.toLowerCase().includes("already registered")) {
    return "Email already exists in authentication system";
  }
  if (message.toLowerCase().includes("duplicate")) {
    return "Student already exists";
  }
  return message;
}

function generateFallbackMobile() {
  const firstDigit = String(6 + Math.floor(Math.random() * 4));
  const remaining = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `${firstDigit}${remaining}`;
}

function normalizeStudentMobile(mobile: string) {
  const trimmed = mobile.trim();
  if (/^[6-9]\d{9}$/.test(trimmed)) {
    return trimmed;
  }
  return generateFallbackMobile();
}

async function cleanupAuthUser(admin: AdminClient, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  return !error;
}

export async function provisionStudentAccount(
  admin: AdminClient,
  input: StudentProvisionInput
): Promise<StudentProvisionResult> {
  const { student, passwordStrategy, forcePasswordChange } = input;
  const resolvedMobile = normalizeStudentMobile(student.mobile);
  const password =
    passwordStrategy === "random"
      ? generateRandomPassword(8)
      : generatePatternPassword(student.branch, student.enrollment_no, resolvedMobile);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: student.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: student.name,
      role: "student",
      force_password_change: forcePasswordChange,
      password_strategy: passwordStrategy
    }
  });

  if (authError || !authData.user) {
    return {
      ok: false,
      error: normalizeSupabaseErrorMessage(authError?.message ?? "Failed to create auth user")
    };
  }

  const studentInsert: TablesInsert<"students"> = {
    user_id: authData.user.id,
    name: student.name,
    email: student.email,
    prn: student.enrollment_no,
    phone: resolvedMobile,
    branch: student.branch,
    batch_year: student.batch_year,
    documents_uploaded: 0,
    profile_complete: false,
    is_active: true
  };

  const { data: insertedStudent, error: studentError } = await admin
    .from("students")
    .insert(studentInsert)
    .select("id, name, email, prn")
    .single();

  if (studentError || !insertedStudent) {
    const cleaned = await cleanupAuthUser(admin, authData.user.id);
    return {
      ok: false,
      error: cleaned
        ? normalizeSupabaseErrorMessage(studentError?.message ?? "Failed to create student record")
        : "Failed to create student record and failed to rollback auth user"
    };
  }

  const { error: roleError } = await admin.from("user_roles").upsert({
    user_id: authData.user.id,
    role: "student"
  });

  if (roleError) {
    const cleaned = await cleanupAuthUser(admin, authData.user.id);
    return {
      ok: false,
      error: cleaned
        ? normalizeSupabaseErrorMessage(roleError.message)
        : "Failed to create role mapping and failed to rollback auth user"
    };
  }

  return {
    ok: true,
    data: {
      id: insertedStudent.id,
      name: insertedStudent.name,
      email: insertedStudent.email,
      enrollment_no: insertedStudent.prn ?? student.enrollment_no,
      password
    }
  };
}
