import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import {
  buildUniqueCoordinatorFormSlug,
  coordinatorFormPayloadSchema,
  normalizeCoordinatorThemeSettings,
  serializeCoordinatorFieldsForInsert,
  sortCoordinatorFields
} from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const [{ data: form, error: formError }, { data: fields, error: fieldsError }] = await Promise.all([
    admin.from("coordinator_forms").select("*").eq("id", id).maybeSingle(),
    admin.from("coordinator_form_fields").select("*").eq("form_id", id).order("sort_order", { ascending: true })
  ]);

  if (formError || fieldsError) {
    return NextResponse.json({ error: formError?.message ?? fieldsError?.message ?? "Failed to load form" }, { status: 500 });
  }

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ form, fields: fields ?? [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = coordinatorFormPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const slug = await buildUniqueCoordinatorFormSlug(admin, parsed.data.title, id);
  const theme = normalizeCoordinatorThemeSettings(parsed.data.theme_settings);

  const { data: form, error: formError } = await admin
    .from("coordinator_forms")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      slug,
      status: parsed.data.status,
      is_public: parsed.data.is_public,
      deadline: parsed.data.deadline,
      theme_settings: theme
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (formError) {
    return NextResponse.json({ error: formError.message }, { status: 500 });
  }

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const { error: deleteError } = await admin.from("coordinator_form_fields").delete().eq("form_id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const fieldRows = serializeCoordinatorFieldsForInsert(parsed.data.fields).map((field) => ({
    ...field,
    form_id: id
  }));
  const { error: insertError } = await admin.from("coordinator_form_fields").insert(fieldRows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ form, fields: sortCoordinatorFields(fieldRows) });
}
