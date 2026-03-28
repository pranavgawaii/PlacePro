import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
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
  const [{ data: form, error: formError }, { data: fields, error: fieldsError }, { data: responses, error: responsesError }] =
    await Promise.all([
      admin.from("coordinator_forms").select("*").eq("id", id).maybeSingle(),
      admin.from("coordinator_form_fields").select("*").eq("form_id", id).order("sort_order", { ascending: true }),
      admin.from("coordinator_form_responses").select("*").eq("form_id", id).order("submitted_at", { ascending: false })
    ]);

  if (formError || fieldsError || responsesError) {
    return NextResponse.json(
      { error: formError?.message ?? fieldsError?.message ?? responsesError?.message ?? "Failed to load responses" },
      { status: 500 }
    );
  }

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({
    form,
    fields: fields ?? [],
    responses: responses ?? []
  });
}
