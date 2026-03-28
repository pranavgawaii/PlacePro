import { NextResponse } from "next/server";

import { requireAdminForRoute } from "@/lib/admin/require-admin";
import { generateCoordinatorAttendanceLetterPdf } from "@/lib/coordinator/attendance-letter";
import { coordinatorAttendanceSchema } from "@/lib/coordinator/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminForRoute();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = coordinatorAttendanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: coordinators, error } = await admin
    .from("placement_coordinators")
    .select("name, enrollment_no, year")
    .in("id", parsed.data.coordinator_ids)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!coordinators || coordinators.length === 0) {
    return NextResponse.json({ error: "No valid coordinators found" }, { status: 400 });
  }

  const bytes = await generateCoordinatorAttendanceLetterPdf({
    event_title: parsed.data.event_title,
    event_date: parsed.data.event_date,
    time_from: parsed.data.time_from,
    time_to: parsed.data.time_to,
    coordinators
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Coordinator_Attendance_${parsed.data.event_date}.pdf"`
    }
  });
}
