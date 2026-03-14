import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      Enrollment_No: "ADT23SOCB0741",
      Email: "student1@example.com",
      Phone: "+919876543210"
    },
    {
      Enrollment_No: "ADT23SOCB0742",
      Email: "student2@example.com",
      Phone: "+919876543211"
    },
    {
      Enrollment_No: "ADT23SOCB0743",
      Email: "student3@example.com",
      Phone: "+919876543212"
    }
  ]);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Reminder Template");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="placepro_reminder_template.xlsx"',
      "Cache-Control": "no-store"
    }
  });
}
