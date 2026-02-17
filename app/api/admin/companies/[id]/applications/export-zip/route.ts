import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

type JsZipConstructor = new () => {
  file: (name: string, data: Buffer) => void;
  generateAsync: (options: { type: "nodebuffer" }) => Promise<Buffer>;
};

function loadJsZip() {
  try {
    const runtimeRequire = eval("require") as NodeRequire;
    const loaded = runtimeRequire("jszip") as JsZipConstructor | { default?: JsZipConstructor };

    if (typeof loaded === "function") {
      return loaded;
    }

    if (loaded.default && typeof loaded.default === "function") {
      return loaded.default;
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow?.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { applicationIds?: string[] };
  const applicationIds = Array.isArray(body.applicationIds) ? body.applicationIds : [];

  let query = admin
    .from("applications")
    .select("id, resume_id, student_id, students!inner(name, prn), resumes!inner(file_url, title)")
    .eq("company_id", id)
    .not("resume_id", "is", null);

  if (applicationIds.length) {
    query = query.in("id", applicationIds);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const JSZip = loadJsZip();
  if (!JSZip) {
    return NextResponse.json(
      { error: "Resume export dependency is not installed. Install jszip and redeploy." },
      { status: 503 }
    );
  }

  const zip = new JSZip();

  for (const row of rows) {
    const resume = row.resumes as { file_url: string | null; title: string } | null;
    const student = row.students as { name: string; prn: string | null } | null;

    if (!resume?.file_url || !student) {
      continue;
    }

    const { data: fileData, error: downloadError } = await admin.storage
      .from("resumes")
      .download(resume.file_url);

    if (downloadError || !fileData) {
      continue;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName = sanitizeFileName(`${student.name}_${student.prn ?? "no-prn"}_${resume.title}.pdf`);
    zip.file(fileName, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipBytes = new Uint8Array(zipBuffer);

  return new NextResponse(zipBytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=selected-resumes.zip"
    }
  });
}
