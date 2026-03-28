import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import { coordinatorResponseUpdateSchema } from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ responseId: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = coordinatorResponseUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { responseId } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coordinator_form_responses")
    .update({
      status: parsed.data.status,
      notes: parsed.data.notes
    })
    .eq("id", responseId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Response not found" }, { status: 404 });
  }

  return NextResponse.json({ response: data });
}
