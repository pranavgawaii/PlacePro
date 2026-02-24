import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000)
});

async function requireStudent() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 401 as const, user: null };
  }

  const primaryRoleQuery = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  let role = primaryRoleQuery.data?.role ?? null;
  let isActive = Boolean(primaryRoleQuery.data?.is_active);

  if (primaryRoleQuery.error) {
    const fallbackRoleQuery = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    role = fallbackRoleQuery.data?.role ?? null;
    isActive = true;

    if (fallbackRoleQuery.error) {
      return { status: 403 as const, user: null };
    }
  }

  if (role !== "student" || !isActive) {
    return { status: 403 as const, user: null };
  }

  return { status: 200 as const, user };
}

export async function POST(request: Request) {
  const auth = await requireStudent();
  if (auth.status === 401) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403 || !auth.user) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = supportSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstIssue?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("name, email, prn")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const adminClient = createAdminClient();
  const primaryAdminRolesQuery = await adminClient
    .from("user_roles")
    .select("user_id, role, is_active")
    .eq("role", "admin")
    .eq("is_active", true);

  let adminUserIds =
    primaryAdminRolesQuery.data
      ?.map((row) => row.user_id)
      .filter((id): id is string => Boolean(id && id !== auth.user?.id)) ?? [];

  if (primaryAdminRolesQuery.error) {
    const fallbackAdminRolesQuery = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");

    if (fallbackAdminRolesQuery.error) {
      return NextResponse.json(
        { success: false, error: "Unable to route your support request. Please try again." },
        { status: 500 }
      );
    }

    adminUserIds =
      fallbackAdminRolesQuery.data
        ?.map((row) => row.user_id)
        .filter((id): id is string => Boolean(id && id !== auth.user?.id)) ?? [];
  }

  const uniqueAdminUserIds = Array.from(new Set(adminUserIds));

  if (uniqueAdminUserIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "Support team is unavailable right now. Please email admin@placepro.in." },
      { status: 503 }
    );
  }

  const payload = parsed.data;
  const studentName = student?.name?.trim() || "Student";
  const studentPrn = student?.prn?.trim() || "Not available";
  const studentEmail = student?.email?.trim() || auth.user.email || "Not available";
  const normalizedSubject = `[HELP] ${payload.subject}`;
  const composedMessage = [
    `Support request from ${studentName}`,
    `PRN: ${studentPrn}`,
    `Email: ${studentEmail}`,
    "",
    payload.message
  ].join("\n");

  const messagesPayload = uniqueAdminUserIds.map((adminUserId) => ({
    sender_id: auth.user.id,
    recipient_id: adminUserId,
    subject: normalizedSubject,
    message: composedMessage,
    is_broadcast: false
  }));

  const { error: insertError } = await adminClient.from("messages").insert(messagesPayload);
  if (insertError) {
    return NextResponse.json(
      { success: false, error: "Unable to submit support request. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, sentTo: uniqueAdminUserIds.length },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
