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

    // Fetch all auth users (paginated) to avoid missing admins when user count > default page size.
    const users: Array<{
        id: string;
        user_metadata?: { name?: string; avatar_url?: string | null } | null;
    }> = [];
    const perPage = 200;
    let page = 1;

    while (true) {
        const { data, error: usersError } = await adminClient.auth.admin.listUsers({
            page,
            perPage,
        });

        if (usersError) {
            return NextResponse.json({ error: usersError.message }, { status: 500 });
        }

        const batch = data.users ?? [];
        users.push(...batch);

        if (batch.length < perPage) {
            break;
        }

        page += 1;
        if (page > 20) {
            break;
        }
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
