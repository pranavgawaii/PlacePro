import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow?.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: company, error: companyError }, { data: eligible, error: eligibleError }] = await Promise.all([
    admin.from("companies").select("name").eq("id", id).single(),
    admin.rpc("get_eligible_students_for_company", { company_id: id })
  ]);

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (eligibleError) {
    return NextResponse.json({ error: eligibleError.message }, { status: 500 });
  }

  const header = ["Name", "PRN", "Email", "Branch", "Overall CGPA"];
  const lines = [
    header,
    ...eligible.map((row) => [
      row.name,
      row.prn ?? "",
      row.email,
      row.branch ?? "",
      row.overall_cgpa?.toString() ?? ""
    ])
  ];

  const csv = lines
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${company.name.toLowerCase().replace(/\s+/g, "-")}-eligible.csv"`
    }
  });
}
