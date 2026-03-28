import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import { coordinatorPayloadSchema } from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("placement_coordinators")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const payload = coordinatorPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("placement_coordinators")
    .select("id")
    .eq("enrollment_no", payload.data.enrollment_no)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ error: "Enrollment number already exists" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("placement_coordinators")
    .insert({
      name: payload.data.name,
      enrollment_no: payload.data.enrollment_no,
      email: payload.data.email,
      department: payload.data.department,
      year: payload.data.year
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
