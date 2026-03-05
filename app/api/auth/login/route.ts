import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required.")
});

const isAdminRole = (role: UserRole | null) => role === "admin" || role === "super_admin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid login payload."
      },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerClient();
    const { email, password } = parsed.data;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message ?? "Invalid login credentials."
        },
        { status: 401 }
      );
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleError || !roleRow || !roleRow.is_active) {
      await supabase.auth.signOut();

      return NextResponse.json(
        {
          success: false,
          error: "Your account is inactive or role is missing."
        },
        { status: 403 }
      );
    }

    const role = roleRow.role as UserRole;

    return NextResponse.json(
      {
        success: true,
        role,
        redirectTo: isAdminRole(role) ? "/admin/students" : "/student/dashboard"
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
