import { NextResponse } from "next/server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export async function requireAdminForRoute(): Promise<AdminAuthResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !roleRow.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { ok: true, user };
}
