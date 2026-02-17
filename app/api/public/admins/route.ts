import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch all users with admin or super_admin roles from user_roles
    const { data: adminRoles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin"])
        .eq("is_active", true);

    if (rolesError) {
        return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    // Fetch user details from auth.users (requires service role)
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();

    if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const publicAdminInfo = adminRoles.map(role => {
        const authUser = users.find(u => u.id === role.user_id);
        return {
            id: role.user_id,
            name: authUser?.user_metadata?.name || "Placement Official",
            avatar_url: authUser?.user_metadata?.avatar_url || null,
            role: role.role
        };
    });

    return NextResponse.json(publicAdminInfo);
}
