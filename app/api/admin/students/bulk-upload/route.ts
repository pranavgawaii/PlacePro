import { NextResponse } from "next/server";
import { provisionStudentAccount } from "@/lib/admin/student-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { serializeCsvRows } from "@/lib/utils/csv-parser";
import { bulkUploadSchema, StudentInput } from "@/lib/validations/student";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK_SIZE = 100;
const CONCURRENCY_LIMIT = 10;

type BulkError = {
  row: number;
  student: {
    name: string;
    email: string;
    enrollment_no: string;
  };
  error: string;
};

type BulkCredential = {
  row: number;
  name: string;
  email: string;
  enrollment_no: string;
  password: string;
};

type Candidate = {
  row: number;
  student: StudentInput;
};

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 401 as const };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !roleRow.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return { status: 403 as const };
  }

  return { status: 200 as const };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await handler(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ success: 0, failed: 0, errors: [], credentials: [], error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403) {
    return NextResponse.json({ success: 0, failed: 0, errors: [], credentials: [], error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = bulkUploadSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        success: 0,
        failed: 0,
        errors: [],
        credentials: [],
        error: firstIssue?.message ?? "Invalid request body"
      },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const admin = createAdminClient();

  const errors: BulkError[] = [];
  const credentials: BulkCredential[] = [];

  const seenEmails = new Map<string, number>();
  const seenEnrollment = new Map<string, number>();
  const validCandidates: Candidate[] = [];

  payload.students.forEach((student, index) => {
    const row = payload.rowNumbers?.[index] ?? index + 2;
    const emailKey = student.email.toLowerCase();
    const enrollmentKey = student.enrollment_no;

    if (seenEmails.has(emailKey)) {
      errors.push({
        row,
        student: { name: student.name, email: student.email, enrollment_no: student.enrollment_no },
        error: `Duplicate email in upload (already used in row ${seenEmails.get(emailKey)})`
      });
      return;
    }

    if (seenEnrollment.has(enrollmentKey)) {
      errors.push({
        row,
        student: { name: student.name, email: student.email, enrollment_no: student.enrollment_no },
        error: `Duplicate enrollment number in upload (already used in row ${seenEnrollment.get(enrollmentKey)})`
      });
      return;
    }

    seenEmails.set(emailKey, row);
    seenEnrollment.set(enrollmentKey, row);
    validCandidates.push({ row, student });
  });

  if (validCandidates.length > 0) {
    const uniqueEmails = [...new Set(validCandidates.map((candidate) => candidate.student.email))];
    const uniqueEnrollmentNos = [...new Set(validCandidates.map((candidate) => candidate.student.enrollment_no))];

    const [{ data: existingEmails, error: existingEmailsError }, { data: existingPrns, error: existingPrnsError }] =
      await Promise.all([
        admin.from("students").select("email, name").in("email", uniqueEmails),
        admin.from("students").select("prn, name").in("prn", uniqueEnrollmentNos)
      ]);

    if (existingEmailsError || existingPrnsError) {
      return NextResponse.json(
        {
          success: 0,
          failed: payload.students.length,
          errors: [
            {
              row: 0,
              student: { name: "-", email: "-", enrollment_no: "-" },
              error: "Failed to validate against existing students"
            }
          ],
          credentials: [],
          errorLogCsv: "",
          credentialsCsv: ""
        },
        { status: 500 }
      );
    }

    const emailConflictMap = new Map<string, string>();
    const enrollmentConflictMap = new Map<string, string>();

    (existingEmails ?? []).forEach((row) => {
      emailConflictMap.set(row.email.toLowerCase(), row.name);
    });

    (existingPrns ?? []).forEach((row) => {
      if (row.prn) {
        enrollmentConflictMap.set(row.prn, row.name);
      }
    });

    const remainingCandidates: Candidate[] = [];

    validCandidates.forEach((candidate) => {
      const emailOwner = emailConflictMap.get(candidate.student.email.toLowerCase());
      if (emailOwner) {
        errors.push({
          row: candidate.row,
          student: {
            name: candidate.student.name,
            email: candidate.student.email,
            enrollment_no: candidate.student.enrollment_no
          },
          error: `Email already exists in system (Student: ${emailOwner})`
        });
        return;
      }

      const enrollmentOwner = enrollmentConflictMap.get(candidate.student.enrollment_no);
      if (enrollmentOwner) {
        errors.push({
          row: candidate.row,
          student: {
            name: candidate.student.name,
            email: candidate.student.email,
            enrollment_no: candidate.student.enrollment_no
          },
          error: `Enrollment ${candidate.student.enrollment_no} already exists (Student: ${enrollmentOwner})`
        });
        return;
      }

      remainingCandidates.push(candidate);
    });

    for (let chunkStart = 0; chunkStart < remainingCandidates.length; chunkStart += CHUNK_SIZE) {
      const chunk = remainingCandidates.slice(chunkStart, chunkStart + CHUNK_SIZE);

      const chunkResults = await runWithConcurrency(chunk, CONCURRENCY_LIMIT, async (candidate) => {
        const result = await provisionStudentAccount(admin, {
          student: candidate.student,
          passwordStrategy: payload.passwordStrategy,
          forcePasswordChange: payload.forcePasswordChange
        });

        if (!result.ok) {
          return {
            type: "error" as const,
            row: candidate.row,
            student: candidate.student,
            error: result.error
          };
        }

        return {
          type: "success" as const,
          row: candidate.row,
          student: candidate.student,
          password: result.data.password
        };
      });

      chunkResults.forEach((result) => {
        if (result.type === "success") {
          credentials.push({
            row: result.row,
            name: result.student.name,
            email: result.student.email,
            enrollment_no: result.student.enrollment_no,
            password: result.password
          });
          return;
        }

        errors.push({
          row: result.row,
          student: {
            name: result.student.name,
            email: result.student.email,
            enrollment_no: result.student.enrollment_no
          },
          error: result.error
        });
      });
    }
  }

  const errorLogCsv = serializeCsvRows(
    errors.map((entry) => ({
      row: entry.row,
      name: entry.student.name,
      email: entry.student.email,
      enrollment_no: entry.student.enrollment_no,
      error: entry.error
    })),
    ["row", "name", "email", "enrollment_no", "error"]
  );

  const credentialsCsv = serializeCsvRows(
    credentials.map((entry) => ({
      row: entry.row,
      name: entry.name,
      email: entry.email,
      enrollment_no: entry.enrollment_no,
      password: entry.password
    })),
    ["row", "name", "email", "enrollment_no", "password"]
  );

  return NextResponse.json(
    {
      success: credentials.length,
      failed: errors.length,
      errors,
      credentials,
      errorLogCsv,
      credentialsCsv
    },
    { status: 200 }
  );
}
