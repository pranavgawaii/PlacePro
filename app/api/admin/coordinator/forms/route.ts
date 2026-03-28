import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import {
  buildUniqueCoordinatorFormSlug,
  coordinatorFormPayloadSchema,
  normalizeCoordinatorThemeSettings,
  serializeCoordinatorFieldsForInsert
} from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const admin = createAdminClient();
  const [{ data: forms, error: formsError }, { data: responses, error: responsesError }] = await Promise.all([
    admin.from("coordinator_forms").select("*").order("created_at", { ascending: false }),
    admin.from("coordinator_form_responses").select("id, form_id")
  ]);

  if (formsError || responsesError) {
    return NextResponse.json({ error: formsError?.message ?? responsesError?.message ?? "Failed to load forms" }, { status: 500 });
  }

  const counts = new Map<string, number>();
  (responses ?? []).forEach((row) => {
    counts.set(row.form_id, (counts.get(row.form_id) ?? 0) + 1);
  });

  return NextResponse.json(
    (forms ?? []).map((form) => ({
      ...form,
      response_count: counts.get(form.id) ?? 0
    }))
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = coordinatorFormPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const slug = await buildUniqueCoordinatorFormSlug(admin, parsed.data.title);
  const theme = normalizeCoordinatorThemeSettings(parsed.data.theme_settings);

  const { data: form, error: formError } = await admin
    .from("coordinator_forms")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      slug,
      status: parsed.data.status,
      is_public: parsed.data.is_public,
      deadline: parsed.data.deadline,
      theme_settings: theme,
      created_by: auth.user.id
    })
    .select("*")
    .single();

  if (formError) {
    return NextResponse.json({ error: formError.message }, { status: 500 });
  }

  const fieldRows = serializeCoordinatorFieldsForInsert(parsed.data.fields).map((field) => ({
    ...field,
    form_id: form.id
  }));

  const { error: fieldError } = await admin.from("coordinator_form_fields").insert(fieldRows);
  if (fieldError) {
    return NextResponse.json({ error: fieldError.message }, { status: 500 });
  }

  return NextResponse.json({ form }, { status: 201 });
}
