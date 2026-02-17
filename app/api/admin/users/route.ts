import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is super_admin
    const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", user.id)
        .single();

    if (roleRow?.role !== "super_admin" || !roleRow?.is_active) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Fetch all users with admin or super_admin roles
    const { data: adminRoles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role, is_active")
        .in("role", ["admin", "super_admin"]);

    if (rolesError) {
        return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    // Fetch user details from auth.users (requires service role)
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();

    if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const adminUsers = adminRoles.map(role => {
        const authUser = users.find(u => u.id === role.user_id);
        return {
            id: role.user_id,
            email: authUser?.email,
            name: authUser?.user_metadata?.name,
            avatar_url: authUser?.user_metadata?.avatar_url,
            role: role.role,
            is_active: role.is_active,
            last_sign_in_at: authUser?.last_sign_in_at,
            created_at: authUser?.created_at
        };
    });

    return NextResponse.json(adminUsers);
}

export async function POST(request: Request) {
    const supabase = await createServerClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", currentUser.id)
        .single();

    if (roleRow?.role !== "super_admin" || !roleRow?.is_active) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, name, password, role } = await request.json();

    if (!email || !name || !password || !role) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Create user in auth
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role }
    });

    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Set role in user_roles
    const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({
            user_id: authUser.user.id,
            role: role,
            is_active: true
        });

    if (roleError) {
        // Cleanup if role insertion fails
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json({ error: roleError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: authUser.user });
}
