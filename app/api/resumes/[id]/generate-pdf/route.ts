import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildResumeHtml } from "@/lib/resume-templates";
import { ResumeData, ResumeTemplateType } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChromiumModule = {
  args: string[];
  defaultViewport: { width: number; height: number } | null;
  executablePath: () => Promise<string>;
  headless: boolean | "shell";
};

type PuppeteerModule = {
  launch: (options: {
    args?: string[];
    defaultViewport?: { width: number; height: number } | null;
    executablePath?: string;
    headless?: boolean | "shell";
  }) => Promise<{
    newPage: () => Promise<{
      setContent: (html: string, options?: { waitUntil?: string }) => Promise<void>;
      pdf: (options?: { format?: string; printBackground?: boolean }) => Promise<Buffer>;
    }>;
    close: () => Promise<void>;
  }>;
};

async function loadPdfDependencies(): Promise<{ puppeteer: PuppeteerModule; chromium: ChromiumModule } | null> {
  try {
    const [puppeteerModule, chromiumModule] = await Promise.all([
      import("puppeteer-core"),
      import("@sparticuz/chromium")
    ]);

    const puppeteer = (("default" in puppeteerModule ? puppeteerModule.default : puppeteerModule) ??
      puppeteerModule) as unknown as PuppeteerModule;
    const chromium = (("default" in chromiumModule ? chromiumModule.default : chromiumModule) ??
      chromiumModule) as unknown as ChromiumModule;

    return { puppeteer, chromium };
  } catch {
    return null;
  }
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: resumeRow, error: resumeError } = await supabase
    .from("resumes")
    .select("id, student_id, title, template_type, resume_data")
    .eq("id", id)
    .single();

  if (resumeError || !resumeRow) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const { data: ownerRow, error: ownerError } = await supabase
    .from("students")
    .select("user_id")
    .eq("id", resumeRow.student_id)
    .single();

  if (ownerError || !ownerRow) {
    return NextResponse.json({ error: ownerError?.message ?? "Resume owner not found" }, { status: 404 });
  }

  const ownerUserId = ownerRow.user_id;
  const isAdmin = !!roleRow?.is_active && (roleRow.role === "admin" || roleRow.role === "super_admin");

  if (!isAdmin && ownerUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const html = buildResumeHtml(
    resumeRow.resume_data as ResumeData,
    (resumeRow.template_type as ResumeTemplateType) ?? "modern"
  );

  const deps = await loadPdfDependencies();
  if (!deps) {
    return NextResponse.json(
      {
        error:
          "Resume PDF dependencies are not installed. Install puppeteer-core and @sparticuz/chromium and redeploy."
      },
      { status: 503 }
    );
  }

  const browser = await deps.puppeteer.launch({
    args: deps.chromium.args,
    defaultViewport: deps.chromium.defaultViewport,
    executablePath: await deps.chromium.executablePath(),
    headless: deps.chromium.headless
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  const path = `${resumeRow.student_id}/resume_${resumeRow.id}_${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage.from("resumes").upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("resumes")
    .update({ file_url: path })
    .eq("id", resumeRow.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ file_url: path });
}
