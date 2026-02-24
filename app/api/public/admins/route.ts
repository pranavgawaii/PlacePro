import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicAdminInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
  role: "admin" | "super_admin";
};

type AdminRoleRow = {
  user_id: string;
  role: "admin" | "super_admin" | "student";
  is_active?: boolean | null;
};

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const requesterAllowed =
    !roleError &&
    (roleRow?.role === "student" || roleRow?.role === "admin" || roleRow?.role === "super_admin");

  if (!requesterAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const primaryRolesQuery = await adminClient
    .from("user_roles")
    .select("user_id, role, is_active")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true);

  let adminRoles: AdminRoleRow[] | null = primaryRolesQuery.data as AdminRoleRow[] | null;

  if (primaryRolesQuery.error) {
    const fallbackRolesQuery = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin"]);

    if (fallbackRolesQuery.error) {
      return NextResponse.json({ error: "Unable to load admin directory" }, { status: 500 });
    }

    adminRoles = (fallbackRolesQuery.data as AdminRoleRow[] | null) ?? [];
  }

  const adminInfos = await Promise.all(
    (adminRoles ?? [])
      .filter((row) => row.role === "admin" || row.role === "super_admin")
      .filter((row) => (typeof row.is_active === "boolean" ? row.is_active : true))
      .map(async ({ user_id, role }) => {
      const normalizedRole: "admin" | "super_admin" = role === "super_admin" ? "super_admin" : "admin";
      const { data, error } = await adminClient.auth.admin.getUserById(user_id);

      if (error || !data.user) {
        return {
          id: user_id,
          name: "Placement Official",
          avatar_url: null,
          role: normalizedRole
        } satisfies PublicAdminInfo;
      }

      const name =
        typeof data.user.user_metadata?.name === "string" && data.user.user_metadata.name.trim().length > 0
          ? data.user.user_metadata.name.trim()
          : "Placement Official";

      const avatarUrl =
        typeof data.user.user_metadata?.avatar_url === "string" && data.user.user_metadata.avatar_url.trim().length > 0
          ? data.user.user_metadata.avatar_url.trim()
          : null;

      return {
        id: user_id,
        name,
        avatar_url: avatarUrl,
        role: normalizedRole
      } satisfies PublicAdminInfo;
    })
  );

  adminInfos.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(adminInfos, {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
