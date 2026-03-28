import { NextResponse } from "next/server";

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

export async function GET(_request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({
    form,
    fields: (fields ?? []).filter((field) => field.form_id === form.id)
  });
}
