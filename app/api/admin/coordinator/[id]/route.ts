import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import { coordinatorPayloadSchema } from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const payload = coordinatorPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("placement_coordinators")
    .select("id")
    .eq("enrollment_no", payload.data.enrollment_no)
    .neq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ error: "Enrollment number already exists" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("placement_coordinators")
    .update({
      name: payload.data.name,
      enrollment_no: payload.data.enrollment_no,
      email: payload.data.email,
      department: payload.data.department,
      year: payload.data.year
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Coordinator not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { error } = await admin.from("placement_coordinators").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
