import { NextResponse } from "next/server";

import { coordinatorPublicSubmitSchema, extractCoordinatorApplicantSnapshots } from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

const isLive = (status: string, isPublic: boolean, deadline: string | null) => {
  if (!isPublic || status !== "active") {
    return false;
  }

  if (!deadline) {
    return true;
  }

  const deadlineDate = new Date(deadline);
  return Number.isNaN(deadlineDate.getTime()) ? true : deadlineDate.getTime() > Date.now();
};

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  const parsed = coordinatorPublicSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { slug } = await context.params;
  const admin = createAdminClient();
  const [{ data: form, error: formError }, { data: fields, error: fieldsError }] = await Promise.all([
    admin.from("coordinator_forms").select("*").eq("slug", slug).maybeSingle(),
    admin.from("coordinator_form_fields").select("*").order("sort_order", { ascending: true })
  ]);

  if (formError || fieldsError) {
    return NextResponse.json({ error: formError?.message ?? fieldsError?.message ?? "Failed to load form" }, { status: 500 });
  }

  if (!form || !isLive(form.status, form.is_public, form.deadline)) {
    return NextResponse.json({ error: "This form is no longer accepting responses." }, { status: 404 });
  }

  const formFields = (fields ?? []).filter((field) => field.form_id === form.id);
  const missingRequired = formFields.find((field) => {
    if (!field.required) {
      return false;
    }

    const value = parsed.data.answers[field.id];
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  });

  if (missingRequired) {
    return NextResponse.json({ error: `${missingRequired.label} is required.` }, { status: 400 });
  }

  const snapshots = extractCoordinatorApplicantSnapshots(parsed.data.answers, formFields);
  const { data, error } = await admin
    .from("coordinator_form_responses")
    .insert({
      form_id: form.id,
      answers: parsed.data.answers,
      applicant_name: snapshots.applicantName,
      applicant_email: snapshots.applicantEmail
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, responseId: data.id }, { status: 201 });
}
