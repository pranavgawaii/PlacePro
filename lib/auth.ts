import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/database.types";

export async function getCurrentSessionRole() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, role: null as UserRole | null };
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      // Log for debugging but return safe default
      console.error("Role fetch error:", roleError);
      return { user: null, role: null };
    }

    return {
      user,
      role: (roleRow?.role ?? null) as UserRole | null
    };
  } catch (e) {
    console.error("Auth session error:", e);
    return { user: null, role: null };
  }
}

export async function requireRole(expectedRole: UserRole) {
  const { user, role } = await getCurrentSessionRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== expectedRole) {
    // Allow super_admin for admin-protected routes
    if (expectedRole === "admin" && role === "super_admin") {
      return { user, role };
    }

    if (role === "admin" || role === "super_admin") {
      redirect("/admin/students");
    }
    if (role === "student") {
      redirect("/student/dashboard");
    }
    redirect("/login");
  }

  return { user, role };
}
