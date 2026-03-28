import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import { COORDINATOR_FORM_STATUSES } from "@/lib/coordinator/types";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum(COORDINATOR_FORM_STATUSES)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coordinator_forms")
    .update({
      status: parsed.data.status,
      is_public: parsed.data.status === "active"
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ form: data });
}
