import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import * as XLSX from "xlsx";
import { compareSeatNumbers } from "@/lib/seat-allocation/seatAllocationEngine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { SeatExportMode } from "@/lib/seat-allocation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "pdf" | "xlsx";

type SeatExportRow = {
  studentId: string;
  seatNumber: string;
  enrollmentNo: string;
  studentName: string;
  branch: string | null;
  labName: string;
};

type SeatExportGroup = {
  key: string;
  title: string;
  rows: SeatExportRow[];
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_Y = 36;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 26;
const GROUP_GAP = 18;
const TABLE_COLUMNS = [
  { key: "seatNumber", label: "Seat No", width: 70 },
  { key: "enrollmentNo", label: "Enrollment No", width: 145 },
  { key: "studentName", label: "Student Name", width: 235 },
  { key: "branch", label: "Branch", width: 80 },
  { key: "labName", label: "Lab", width: 120 }
] as const;
const ATTENDANCE_EXTRA_WIDTH = 110;

const normalizeEnrollmentNo = (value: string | null | undefined): string => String(value ?? "").trim().toUpperCase();

const formatExportDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const sanitizeFileSegment = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seat-session";
};

const sanitizeSheetName = (value: string): string => {
  return value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
};

function buildGroups(rows: SeatExportRow[], exportMode: SeatExportMode): SeatExportGroup[] {
  if (exportMode === "full_list") {
    return [{ key: "all", title: "Full List", rows }];
  }

  const map = new Map<string, SeatExportGroup>();
  rows.forEach((row) => {
    if (!map.has(row.labName)) {
      map.set(row.labName, {
        key: row.labName,
        title: row.labName,
        rows: []
      });
    }

    map.get(row.labName)?.rows.push(row);
  });

  return Array.from(map.values()).sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

function sortRows(rows: SeatExportRow[]): SeatExportRow[] {
  return [...rows].sort((left, right) => {
    const labCompare = left.labName.localeCompare(right.labName, undefined, { sensitivity: "base" });
    if (labCompare !== 0) {
      return labCompare;
    }

    return compareSeatNumbers(left.seatNumber, right.seatNumber);
  });
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 401 as const, user: null };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !roleRow.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return { status: 403 as const, user: null };
  }

  return { status: 200 as const, user };
}

async function buildPdf(params: {
  sessionTitle: string;
  groups: SeatExportGroup[];
  kind: "seating" | "attendance";
  exportMode: SeatExportMode;
  generatedAt: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const columns = params.kind === "attendance"
    ? [...TABLE_COLUMNS, { key: "signature", label: "Signature", width: ATTENDANCE_EXTRA_WIDTH } as const]
    : TABLE_COLUMNS;

  const renderHeader = (page: PDFPage, groupTitle: string, pageNumber: number) => {
    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: PAGE_HEIGHT - PAGE_MARGIN_Y - 44,
      width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
      height: 44,
      color: rgb(0.95, 0.97, 1)
    });

    page.drawText(params.sessionTitle, {
      x: PAGE_MARGIN_X + 12,
      y: PAGE_HEIGHT - PAGE_MARGIN_Y - 18,
      size: 18,
      font: boldFont,
      color: rgb(0.06, 0.1, 0.2)
    });

    page.drawText(
      `${params.kind === "seating" ? "Seating Preview" : "Attendance Preview"} • ${params.exportMode === "per_lab" ? groupTitle : "Full List"}`,
      {
        x: PAGE_MARGIN_X + 12,
        y: PAGE_HEIGHT - PAGE_MARGIN_Y - 34,
        size: 10,
        font: regularFont,
        color: rgb(0.3, 0.35, 0.45)
      }
    );

    page.drawText(`Generated ${formatExportDate(params.generatedAt)} • Page ${pageNumber}`, {
      x: PAGE_WIDTH - PAGE_MARGIN_X - 210,
      y: PAGE_HEIGHT - PAGE_MARGIN_Y - 30,
      size: 10,
      font: regularFont,
      color: rgb(0.3, 0.35, 0.45)
    });
  };

  const drawTableHeader = (page: PDFPage, y: number) => {
    let cursorX = PAGE_MARGIN_X;
    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: y - HEADER_HEIGHT + 6,
      width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
      height: HEADER_HEIGHT,
      color: rgb(0.12, 0.16, 0.28)
    });

    columns.forEach((column) => {
      page.drawText(column.label, {
        x: cursorX + 6,
        y: y - 11,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1)
      });
      cursorX += column.width;
    });
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN_Y - 70;

  for (const group of params.groups) {
    if (cursorY < PAGE_MARGIN_Y + 80) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber += 1;
      cursorY = PAGE_HEIGHT - PAGE_MARGIN_Y - 70;
    }

    renderHeader(page, group.title, pageNumber);
    page.drawText(group.title, {
      x: PAGE_MARGIN_X,
      y: cursorY,
      size: 13,
      font: boldFont,
      color: rgb(0.09, 0.11, 0.18)
    });
    cursorY -= 18;
    drawTableHeader(page, cursorY);
    cursorY -= HEADER_HEIGHT;

    for (const row of group.rows) {
      if (cursorY < PAGE_MARGIN_Y + ROW_HEIGHT) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageNumber += 1;
        cursorY = PAGE_HEIGHT - PAGE_MARGIN_Y - 70;
        renderHeader(page, group.title, pageNumber);
        drawTableHeader(page, cursorY);
        cursorY -= HEADER_HEIGHT;
      }

      page.drawRectangle({
        x: PAGE_MARGIN_X,
        y: cursorY - 4,
        width: PAGE_WIDTH - PAGE_MARGIN_X * 2,
        height: ROW_HEIGHT,
        borderColor: rgb(0.86, 0.88, 0.92),
        borderWidth: 0.6
      });

      let cursorX = PAGE_MARGIN_X;
      const values = [
        row.seatNumber,
        row.enrollmentNo,
        row.studentName,
        row.branch ?? "—",
        row.labName,
        ...(params.kind === "attendance" ? [""] : [])
      ];

      values.forEach((value, index) => {
        page.drawText(String(value), {
          x: cursorX + 6,
          y: cursorY + 3,
          size: 9,
          font: regularFont,
          color: rgb(0.1, 0.11, 0.14),
          maxWidth: columns[index]?.width ? columns[index].width - 12 : 100
        });
        cursorX += columns[index]?.width ?? 100;
      });

      cursorY -= ROW_HEIGHT;
    }

    cursorY -= GROUP_GAP;
  }

  return Buffer.from(await pdfDoc.save());
}

function buildWorkbook(params: {
  groups: SeatExportGroup[];
  exportMode: SeatExportMode;
}) {
  const workbook = XLSX.utils.book_new();

  const appendSheet = (name: string, rows: Array<Record<string, string>>) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 28 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(name));
  };

  params.groups.forEach((group) => {
    const seatingRows = group.rows.map((row) => ({
      "Seat No": row.seatNumber,
      "Enrollment No": row.enrollmentNo,
      Name: row.studentName,
      Branch: row.branch ?? "",
      Lab: row.labName
    }));

    const attendanceRows = group.rows.map((row) => ({
      "Seat No": row.seatNumber,
      "Enrollment No": row.enrollmentNo,
      Name: row.studentName,
      Branch: row.branch ?? "",
      Lab: row.labName,
      Signature: ""
    }));

    const suffix = params.exportMode === "full_list" ? "All" : group.title;
    appendSheet(`Allocation_${suffix}`, seatingRows);
    appendSheet(`Attendance_${suffix}`, attendanceRows);
  });

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: string;
    formats?: ExportFormat[];
    exportMode?: SeatExportMode;
  } | null;

  const sessionId = body?.sessionId?.trim();
  const formats = Array.isArray(body?.formats) ? body?.formats.filter((value): value is ExportFormat => value === "pdf" || value === "xlsx") : [];
  const exportMode: SeatExportMode = body?.exportMode === "full_list" ? "full_list" : "per_lab";

  if (!sessionId || formats.length === 0) {
    return NextResponse.json({ error: "Expected sessionId and at least one export format." }, { status: 400 });
  }

  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const { data: session, error: sessionError } = await admin
    .from("seat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Seat session not found." }, { status: 404 });
  }

  const { data: assignmentRows, error: assignmentError } = await admin
    .from("seat_assignments")
    .select(`
      student_id,
      seat_number,
      labs!seat_assignments_lab_id_fkey(lab_name),
      students!seat_assignments_student_id_fkey(name, prn, branch)
    `)
    .eq("session_id", sessionId);

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message || "Unable to load seat assignments." }, { status: 500 });
  }

  const rows = sortRows(
    ((assignmentRows ?? []) as Array<{
      student_id: string;
      seat_number: string;
      labs: { lab_name: string } | null;
      students: { name: string; prn: string | null; branch: string | null } | null;
    }>).map((row) => ({
      studentId: row.student_id,
      seatNumber: row.seat_number,
      enrollmentNo: normalizeEnrollmentNo(row.students?.prn),
      studentName: row.students?.name ?? "Student",
      branch: row.students?.branch ?? null,
      labName: row.labs?.lab_name ?? "Unknown Lab"
    }))
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "No assigned seats available for export." }, { status: 400 });
  }

  const groups = buildGroups(rows, exportMode);
  const basePath = `owner/${auth.user.id}/seat/${sessionId}/${exportMode}`;
  const storage = admin.storage.from("seat-documents");
  const fileBase = sanitizeFileSegment(session.title);

  let seatPdfUrl: string | undefined;
  let attendancePdfUrl: string | undefined;
  let workbookUrl: string | undefined;

  if (formats.includes("pdf")) {
    const seatingPdf = await buildPdf({
      sessionTitle: session.title,
      groups,
      kind: "seating",
      exportMode,
      generatedAt
    });
    const attendancePdf = await buildPdf({
      sessionTitle: session.title,
      groups,
      kind: "attendance",
      exportMode,
      generatedAt
    });

    const seatingPath = `${basePath}/${fileBase}-${exportMode}-seating.pdf`;
    const attendancePath = `${basePath}/${fileBase}-${exportMode}-attendance.pdf`;

    const { error: seatingUploadError } = await storage.upload(seatingPath, seatingPdf, {
      upsert: true,
      contentType: "application/pdf"
    });
    if (seatingUploadError) {
      return NextResponse.json({ error: seatingUploadError.message || "Failed to upload seating PDF." }, { status: 500 });
    }

    const { error: attendanceUploadError } = await storage.upload(attendancePath, attendancePdf, {
      upsert: true,
      contentType: "application/pdf"
    });
    if (attendanceUploadError) {
      return NextResponse.json({ error: attendanceUploadError.message || "Failed to upload attendance PDF." }, { status: 500 });
    }

    const [{ data: seatSigned }, { data: attendanceSigned }] = await Promise.all([
      storage.createSignedUrl(seatingPath, 60 * 60),
      storage.createSignedUrl(attendancePath, 60 * 60)
    ]);

    seatPdfUrl = seatSigned?.signedUrl;
    attendancePdfUrl = attendanceSigned?.signedUrl;
  }

  if (formats.includes("xlsx")) {
    const workbookBuffer = buildWorkbook({ groups, exportMode });
    const workbookPath = `${basePath}/${fileBase}-${exportMode}-allocation-attendance.xlsx`;

    const { error: workbookUploadError } = await storage.upload(workbookPath, workbookBuffer, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    if (workbookUploadError) {
      return NextResponse.json({ error: workbookUploadError.message || "Failed to upload workbook." }, { status: 500 });
    }

    const { data: workbookSigned } = await storage.createSignedUrl(workbookPath, 60 * 60);
    workbookUrl = workbookSigned?.signedUrl;
  }

  return NextResponse.json({
    seat_pdf_url: seatPdfUrl,
    attendance_pdf_url: attendancePdfUrl,
    workbook_url: workbookUrl,
    generated_at: generatedAt
  });
}
