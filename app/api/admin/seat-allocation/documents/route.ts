import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFDocument as PDFDocumentType, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import * as XLSX from "xlsx";
import { compareSeatNumbers } from "@/lib/seat-allocation/seatAllocationEngine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { SeatExportMode } from "@/lib/seat-allocation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "pdf" | "xlsx";
type ExportKind = "seating" | "attendance";

type SeatExportRow = {
  rowId: string;
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

type DocumentSettings = {
  institute_name: string;
  exam_title: string;
  subject: string;
  footer_text: string;
  logo_url: string | null;
};

type TableColumn = {
  label: string;
  width: number;
  align: "left" | "center" | "right";
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 36;
const PAGE_MARGIN_BOTTOM = 48;
const HEADER_TOP_Y = PAGE_HEIGHT - 36;
const HEADER_DIVIDER_Y = PAGE_HEIGHT - 112;
const SESSION_TITLE_Y = PAGE_HEIGHT - 132;
const SECTION_LABEL_Y = PAGE_HEIGHT - 152;
const TABLE_TOP_Y = PAGE_HEIGHT - 182;
const HEADER_ROW_HEIGHT = 22;
const BODY_ROW_HEIGHT = 20;
const TABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const DEFAULT_LOGO_NAMES = ["mit-adt-logo-transparent.png", "mitadt_logo.png"];
const SEATING_COLUMNS: TableColumn[] = [
  { label: "Seat No", width: 56, align: "center" },
  { label: "Enrollment No", width: 96, align: "center" },
  { label: "Candidate Name", width: 185, align: "left" },
  { label: "Branch", width: 60, align: "center" },
  { label: "Lab", width: 126, align: "center" }
];
const ATTENDANCE_COLUMNS: TableColumn[] = [
  { label: "Seat No", width: 54, align: "center" },
  { label: "Enrollment No", width: 92, align: "center" },
  { label: "Candidate Name", width: 150, align: "left" },
  { label: "Branch", width: 52, align: "center" },
  { label: "Lab", width: 90, align: "center" },
  { label: "Signature", width: 85, align: "center" }
];
const DEFAULT_SETTINGS: DocumentSettings = {
  institute_name: "Central Corporate Relations, Training and Placement Cell (CN-CRTP)",
  exam_title: "MIT ADT University",
  subject: "Seat Allocation & Attendance",
  footer_text: "MIT ADT University",
  logo_url: null
};

const normalizeEnrollmentNo = (value: string | null | undefined): string => String(value ?? "").trim().toUpperCase();

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seat-session";

const sanitizeSheetName = (value: string): string => {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, " ").trim();
  return cleaned.slice(0, 31) || "Sheet";
};

const resolveHeaderText = (value: string | null | undefined, fallback: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || /placepro/i.test(normalized)) {
    return fallback;
  }
  return normalized;
};

const formatGeneratedLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
};

const formatDocumentDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const fitPdfFontSize = (font: PDFFont, text: string, maxWidth: number, preferred: number, minimum: number) => {
  let size = preferred;
  while (size > minimum) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return size;
    }
    size -= 0.5;
  }
  return minimum;
};

const withEllipsis = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const value = String(text ?? "").trim();
  if (!value) {
    return "";
  }

  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value;
  }

  const ellipsis = "...";
  let trimmed = value;
  while (trimmed.length > 0 && font.widthOfTextAtSize(`${trimmed}${ellipsis}`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
};

function sortRows(rows: SeatExportRow[]): SeatExportRow[] {
  return [...rows].sort((left, right) => {
    const labCompare = left.labName.localeCompare(right.labName, undefined, { sensitivity: "base" });
    if (labCompare !== 0) {
      return labCompare;
    }

    return compareSeatNumbers(left.seatNumber, right.seatNumber);
  });
}

function buildGroups(rows: SeatExportRow[], exportMode: SeatExportMode): SeatExportGroup[] {
  if (exportMode === "full_list") {
    return [
      {
        key: "all",
        title: "Full List",
        rows
      }
    ];
  }

  const grouped = new Map<string, SeatExportGroup>();
  rows.forEach((row) => {
    if (!grouped.has(row.labName)) {
      grouped.set(row.labName, {
        key: row.labName,
        title: row.labName,
        rows: []
      });
    }
    grouped.get(row.labName)?.rows.push(row);
  });

  return Array.from(grouped.values()).sort((left, right) =>
    left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
  );
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

async function loadLogoImage(pdfDoc: PDFDocumentType, logoUrl: string | null): Promise<PDFImage | null> {
  const tryEmbed = async (bytes: Uint8Array, filenameHint: string) => {
    if (filenameHint.toLowerCase().endsWith(".jpg") || filenameHint.toLowerCase().endsWith(".jpeg")) {
      return pdfDoc.embedJpg(bytes);
    }
    return pdfDoc.embedPng(bytes);
  };

  const normalizedUrl = String(logoUrl ?? "").trim();
  if (normalizedUrl) {
    try {
      if (/^https?:\/\//i.test(normalizedUrl)) {
        const response = await fetch(normalizedUrl);
        if (response.ok) {
          return await tryEmbed(new Uint8Array(await response.arrayBuffer()), normalizedUrl);
        }
      } else if (normalizedUrl.startsWith("/")) {
        const filePath = path.join(process.cwd(), "public", normalizedUrl.replace(/^\/+/, ""));
        return await tryEmbed(await readFile(filePath), normalizedUrl);
      }
    } catch {
      // Fallback to bundled logo below.
    }
  }

  for (const logoName of DEFAULT_LOGO_NAMES) {
    try {
      const filePath = path.join(process.cwd(), "public", logoName);
      return await tryEmbed(await readFile(filePath), logoName);
    } catch {
      // Try next fallback.
    }
  }

  return null;
}

function drawHeader(params: {
  page: PDFPage;
  boldFont: PDFFont;
  regularFont: PDFFont;
  settings: DocumentSettings;
  sessionTitle: string;
  groupTitle: string;
  generatedAt: string;
  kind: ExportKind;
  logoImage: PDFImage | null;
}) {
  const { page, boldFont, regularFont, settings, sessionTitle, groupTitle, generatedAt, kind, logoImage } = params;

  const instituteSize = fitPdfFontSize(boldFont, settings.institute_name, 360, 15, 10);
  const examSize = fitPdfFontSize(boldFont, settings.exam_title, 360, 12.5, 10);
  const subjectSize = fitPdfFontSize(regularFont, settings.subject, 360, 10, 8.5);

  if (logoImage) {
    const maxWidth = 120;
    const maxHeight = 64;
    const widthScale = maxWidth / logoImage.width;
    const heightScale = maxHeight / logoImage.height;
    const scale = Math.min(1, widthScale, heightScale);
    const width = logoImage.width * scale;
    const height = logoImage.height * scale;

    page.drawImage(logoImage, {
      x: PAGE_WIDTH - PAGE_MARGIN_X - width,
      y: HEADER_TOP_Y - height + 6,
      width,
      height
    });
  }

  page.drawText(settings.institute_name, {
    x: PAGE_MARGIN_X,
    y: HEADER_TOP_Y,
    size: instituteSize,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08)
  });

  page.drawText(settings.exam_title, {
    x: PAGE_MARGIN_X,
    y: HEADER_TOP_Y - 22,
    size: examSize,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08)
  });

  page.drawText(settings.subject, {
    x: PAGE_MARGIN_X,
    y: HEADER_TOP_Y - 40,
    size: subjectSize,
    font: regularFont,
    color: rgb(0.2, 0.24, 0.3)
  });

  page.drawLine({
    start: { x: PAGE_MARGIN_X, y: HEADER_DIVIDER_Y },
    end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: HEADER_DIVIDER_Y },
    thickness: 1,
    color: rgb(0.15, 0.15, 0.15)
  });

  const safeSessionTitle = sessionTitle.trim() || "Seat Allocation Session";
  const sessionTitleSize = fitPdfFontSize(boldFont, safeSessionTitle, TABLE_WIDTH, 11, 9);
  const sessionTitleWidth = boldFont.widthOfTextAtSize(safeSessionTitle, sessionTitleSize);

  page.drawText(safeSessionTitle, {
    x: Math.max(PAGE_MARGIN_X, (PAGE_WIDTH - sessionTitleWidth) / 2),
    y: SESSION_TITLE_Y,
    size: sessionTitleSize,
    font: boldFont,
    color: rgb(0.06, 0.12, 0.24)
  });

  const sectionLabel = `${kind === "seating" ? "Seating Allocation Sheet" : "Attendance Sheet"} | ${groupTitle}`;
  page.drawText(sectionLabel, {
    x: PAGE_MARGIN_X,
    y: SECTION_LABEL_Y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.12, 0.12)
  });

  page.drawText(`Generated: ${formatGeneratedLabel(generatedAt)} | Date: ${formatDocumentDate(generatedAt)}`, {
    x: PAGE_MARGIN_X,
    y: SECTION_LABEL_Y - 14,
    size: 9,
    font: regularFont,
    color: rgb(0.3, 0.35, 0.45)
  });
}

function drawFooter(params: {
  page: PDFPage;
  regularFont: PDFFont;
  footerText: string;
  pageNumber: number;
  totalPages: number;
}) {
  const { page, regularFont, footerText, pageNumber, totalPages } = params;

  page.drawLine({
    start: { x: PAGE_MARGIN_X, y: 38 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: 38 },
    thickness: 0.5,
    color: rgb(0.78, 0.8, 0.84)
  });

  page.drawText(footerText, {
    x: PAGE_MARGIN_X,
    y: 24,
    size: 8.5,
    font: regularFont,
    color: rgb(0.45, 0.5, 0.6)
  });

  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  const labelWidth = regularFont.widthOfTextAtSize(pageLabel, 8.5);
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - PAGE_MARGIN_X - labelWidth,
    y: 24,
    size: 8.5,
    font: regularFont,
    color: rgb(0.45, 0.5, 0.6)
  });
}

function drawTableText(params: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  align: "left" | "center" | "right";
}) {
  const { page, font, text, x, y, width, fontSize, align } = params;
  const paddingX = 4;
  const innerWidth = Math.max(width - paddingX * 2, 0);
  const value = withEllipsis(font, text, fontSize, innerWidth);
  const textWidth = font.widthOfTextAtSize(value, fontSize);

  let textX = x + paddingX;
  if (align === "center") {
    textX = x + Math.max((width - textWidth) / 2, paddingX);
  } else if (align === "right") {
    textX = x + Math.max(width - textWidth - paddingX, paddingX);
  }

  page.drawText(value, {
    x: textX,
    y,
    size: fontSize,
    font,
    color: rgb(0.1, 0.13, 0.2)
  });
}

function drawTablePage(params: {
  page: PDFPage;
  rows: SeatExportRow[];
  columns: TableColumn[];
  kind: ExportKind;
  boldFont: PDFFont;
  regularFont: PDFFont;
}) {
  const { page, rows, columns, kind, boldFont, regularFont } = params;
  const headerBottomY = TABLE_TOP_Y - HEADER_ROW_HEIGHT;
  const tableHeight = HEADER_ROW_HEIGHT + rows.length * BODY_ROW_HEIGHT;
  const tableBottomY = TABLE_TOP_Y - tableHeight;

  page.drawRectangle({
    x: PAGE_MARGIN_X,
    y: tableBottomY,
    width: TABLE_WIDTH,
    height: tableHeight,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.6
  });

  page.drawRectangle({
    x: PAGE_MARGIN_X,
    y: headerBottomY,
    width: TABLE_WIDTH,
    height: HEADER_ROW_HEIGHT,
    color: rgb(0.95, 0.95, 0.95)
  });

  let xCursor = PAGE_MARGIN_X;
  columns.forEach((column, index) => {
    const isLast = index === columns.length - 1;

    drawTableText({
      page,
      font: boldFont,
      text: column.label,
      x: xCursor,
      y: TABLE_TOP_Y - 14,
      width: column.width,
      fontSize: 9.5,
      align: column.align
    });

    if (!isLast) {
      page.drawLine({
        start: { x: xCursor + column.width, y: TABLE_TOP_Y },
        end: { x: xCursor + column.width, y: tableBottomY },
        thickness: 0.5,
        color: rgb(0.32, 0.32, 0.32)
      });
    }

    xCursor += column.width;
  });

  for (let index = 0; index <= rows.length; index += 1) {
    const y = headerBottomY - index * BODY_ROW_HEIGHT;
    page.drawLine({
      start: { x: PAGE_MARGIN_X, y },
      end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y },
      thickness: 0.5,
      color: rgb(0.32, 0.32, 0.32)
    });
  }

  rows.forEach((row, rowIndex) => {
    let cellX = PAGE_MARGIN_X;
    const values =
      kind === "attendance"
        ? [row.seatNumber, row.enrollmentNo, row.studentName, row.branch ?? "-", row.labName, ""]
        : [row.seatNumber, row.enrollmentNo, row.studentName, row.branch ?? "-", row.labName];

    values.forEach((value, index) => {
      const column = columns[index];
      drawTableText({
        page,
        font: regularFont,
        text: value,
        x: cellX,
        y: headerBottomY - rowIndex * BODY_ROW_HEIGHT - 14,
        width: column.width,
        fontSize: 9,
        align: column.align
      });
      cellX += column.width;
    });
  });
}

async function buildStyledPdf(params: {
  sessionTitle: string;
  groups: SeatExportGroup[];
  kind: ExportKind;
  exportMode: SeatExportMode;
  generatedAt: string;
  settings: DocumentSettings;
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await loadLogoImage(pdfDoc, params.settings.logo_url);
  const columns = params.kind === "attendance" ? ATTENDANCE_COLUMNS : SEATING_COLUMNS;
  const rowsPerPage = Math.max(
    1,
    Math.floor((TABLE_TOP_Y - PAGE_MARGIN_BOTTOM - HEADER_ROW_HEIGHT) / BODY_ROW_HEIGHT)
  );

  for (const group of params.groups) {
    for (let cursor = 0; cursor < group.rows.length; cursor += rowsPerPage) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const chunk = group.rows.slice(cursor, cursor + rowsPerPage);

      drawHeader({
        page,
        boldFont,
        regularFont,
        settings: params.settings,
        sessionTitle: params.sessionTitle,
        groupTitle: params.exportMode === "full_list" ? "Full List" : group.title,
        generatedAt: params.generatedAt,
        kind: params.kind,
        logoImage
      });

      drawTablePage({
        page,
        rows: chunk,
        columns,
        kind: params.kind,
        boldFont,
        regularFont
      });
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    drawFooter({
      page,
      regularFont,
      footerText: params.settings.footer_text,
      pageNumber: index + 1,
      totalPages: pages.length
    });
  });

  return Buffer.from(await pdfDoc.save());
}

function buildWorkbook(params: {
  sessionTitle: string;
  groups: SeatExportGroup[];
  exportMode: SeatExportMode;
  generatedAt: string;
  settings: DocumentSettings;
}) {
  const workbook = XLSX.utils.book_new();

  const appendSheet = (sheetName: string, groupTitle: string, kind: ExportKind, rows: SeatExportRow[]) => {
    const headers =
      kind === "attendance"
        ? ["Seat No", "Enrollment No", "Candidate Name", "Branch", "Lab", "Signature"]
        : ["Seat No", "Enrollment No", "Candidate Name", "Branch", "Lab"];

    const bodyRows = rows.map((row) =>
      kind === "attendance"
        ? [row.seatNumber, row.enrollmentNo, row.studentName, row.branch ?? "", row.labName, ""]
        : [row.seatNumber, row.enrollmentNo, row.studentName, row.branch ?? "", row.labName]
    );

    const sheetRows: Array<Array<string>> = [
      [params.settings.institute_name],
      [params.settings.exam_title],
      [params.settings.subject],
      [`${params.sessionTitle} | ${kind === "attendance" ? "Attendance Sheet" : "Seating Allocation Sheet"} | ${groupTitle}`],
      [`Generated: ${formatGeneratedLabel(params.generatedAt)}`],
      [],
      headers,
      ...bodyRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    const mergeEnd = headers.length - 1;
    worksheet["!merges"] = [0, 1, 2, 3, 4].map((rowIndex) => ({
      s: { r: rowIndex, c: 0 },
      e: { r: rowIndex, c: mergeEnd }
    }));
    worksheet["!cols"] =
      kind === "attendance"
        ? [{ wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 18 }]
        : [{ wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 18 }];
    worksheet["!rows"] = [
      { hpt: 18 },
      { hpt: 16 },
      { hpt: 14 },
      { hpt: 16 },
      { hpt: 14 },
      { hpt: 8 },
      { hpt: 18 },
      ...bodyRows.map(() => ({ hpt: 16 }))
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
  };

  params.groups.forEach((group) => {
    const suffix = params.exportMode === "full_list" ? "Full List" : group.title;
    appendSheet(`Allocation_${suffix}`, group.title, "seating", group.rows);
    appendSheet(`Attendance_${suffix}`, group.title, "attendance", group.rows);
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
  const formats = Array.isArray(body?.formats)
    ? body.formats.filter((value): value is ExportFormat => value === "pdf" || value === "xlsx")
    : [];
  const exportMode: SeatExportMode = body?.exportMode === "full_list" ? "full_list" : "per_lab";

  if (!sessionId || formats.length === 0) {
    return NextResponse.json({ error: "Expected sessionId and at least one export format." }, { status: 400 });
  }

  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const { data: session, error: sessionError } = await admin
    .from("seat_sessions")
    .select("id, owner_id, title")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Seat session not found." }, { status: 404 });
  }

  const { data: settingsRow } = await admin
    .from("document_settings")
    .select("institute_name, exam_title, subject, logo_url, footer_text")
    .eq("owner_id", session.owner_id)
    .maybeSingle();

  const settings: DocumentSettings = {
    institute_name: resolveHeaderText(settingsRow?.institute_name, DEFAULT_SETTINGS.institute_name),
    exam_title: resolveHeaderText(settingsRow?.exam_title, DEFAULT_SETTINGS.exam_title),
    subject: resolveHeaderText(settingsRow?.subject, DEFAULT_SETTINGS.subject),
    footer_text: resolveHeaderText(settingsRow?.footer_text, DEFAULT_SETTINGS.footer_text),
    logo_url: settingsRow?.logo_url ?? DEFAULT_SETTINGS.logo_url
  };

  const { data: assignmentRows, error: assignmentError } = await admin
    .from("seat_assignments")
    .select(`
      id,
      candidate_id,
      student_id,
      seat_number,
      labs!seat_assignments_lab_id_fkey(lab_name),
      students!seat_assignments_student_id_fkey(name, prn, branch),
      seat_session_candidates!seat_assignments_candidate_id_fkey(prn, name_snapshot, branch_snapshot)
    `)
    .eq("session_id", sessionId);

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message || "Unable to load seat assignments." }, { status: 500 });
  }

  const rows = sortRows(
    ((assignmentRows ?? []) as Array<{
      id: string;
      candidate_id: string | null;
      student_id: string | null;
      seat_number: string;
      labs: { lab_name: string } | null;
      students: { name: string; prn: string | null; branch: string | null } | null;
      seat_session_candidates: { prn: string; name_snapshot: string | null; branch_snapshot: string | null } | null;
    }>).map((row) => ({
      rowId: row.candidate_id ?? row.student_id ?? row.id,
      seatNumber: row.seat_number,
      enrollmentNo: normalizeEnrollmentNo(row.students?.prn ?? row.seat_session_candidates?.prn),
      studentName: row.students?.name ?? row.seat_session_candidates?.name_snapshot ?? "Candidate",
      branch: row.students?.branch ?? row.seat_session_candidates?.branch_snapshot ?? null,
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
    const seatingPdf = await buildStyledPdf({
      sessionTitle: session.title,
      groups,
      kind: "seating",
      exportMode,
      generatedAt,
      settings
    });
    const attendancePdf = await buildStyledPdf({
      sessionTitle: session.title,
      groups,
      kind: "attendance",
      exportMode,
      generatedAt,
      settings
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
    const workbookBuffer = buildWorkbook({
      sessionTitle: session.title,
      groups,
      exportMode,
      generatedAt,
      settings
    });
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
