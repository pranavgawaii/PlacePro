import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent self-lockout or deactivating self
    if (currentUser.id === id) {
        return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
    }

    const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", currentUser.id)
        .single();

    if (roleRow?.role !== "super_admin" || !roleRow?.is_active) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { role, is_active, avatar_url, name } = await request.json();

    if (role !== undefined && role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Update role and status
    const { error: updateError } = await adminClient
        .from("user_roles")
        .update({
            role: role !== undefined ? role : undefined,
            is_active: is_active !== undefined ? is_active : undefined
        })
        .eq("user_id", id);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update user metadata in auth
    if (role !== undefined || avatar_url !== undefined || name !== undefined) {
        await adminClient.auth.admin.updateUserById(id, {
            user_metadata: {
                ...(role !== undefined ? { role } : {}),
                ...(avatar_url !== undefined ? { avatar_url } : {}),
                ...(name !== undefined ? { name } : {})
            }
        });
    }

    return NextResponse.json({ success: true });
}
