import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFDocument as PDFDocumentType, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

import type { CoordinatorRecord } from "@/lib/coordinator/types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 52;
const MARGIN_RIGHT = 52;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 54;
const HEADER_HEIGHT = 88;
const TABLE_HEADER_HEIGHT = 26;
const MIN_ROW_HEIGHT = 24;
const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 6;

const DEFAULT_LOGO_CANDIDATES = [
  path.join(process.cwd(), "coordinator/assets/MIT_ADTU.png"),
  path.join(process.cwd(), "public/mit-adt-logo-transparent.png"),
  path.join(process.cwd(), "public/mitadt_logo.png")
];

type AttendanceLetterInput = {
  event_title: string;
  event_date: string;
  time_from: string;
  time_to: string;
  coordinators: Array<Pick<CoordinatorRecord, "name" | "enrollment_no"> & { year: string }>;
};

async function loadLogo(pdfDoc: PDFDocumentType): Promise<PDFImage | null> {
  for (const candidate of DEFAULT_LOGO_CANDIDATES) {
    try {
      const bytes = await readFile(candidate);
      if (candidate.toLowerCase().endsWith(".jpg") || candidate.toLowerCase().endsWith(".jpeg")) {
        return pdfDoc.embedJpg(bytes);
      }
      return pdfDoc.embedPng(bytes);
    } catch {
      continue;
    }
  }

  return null;
}

function drawRightAlignedText(page: PDFPage, font: PDFFont, text: string, size: number, x: number, y: number, color = rgb(0.1, 0.1, 0.1)) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x - width,
    y,
    size,
    font,
    color
  });
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function drawParagraph(page: PDFPage, font: PDFFont, text: string, x: number, y: number, width: number, size = 12, lineGap = 4) {
  const lines = wrapLines(font, text, size, width);
  let cursor = y;
  lines.forEach((line) => {
    page.drawText(line, { x, y: cursor, size, font, color: rgb(0.16, 0.16, 0.18) });
    cursor -= size + lineGap;
  });
  return cursor;
}

function measureRowHeight(font: PDFFont, values: string[], widths: number[], size: number) {
  const heights = values.map((value, index) => {
    const lines = wrapLines(font, value || "", size, widths[index] - CELL_PADDING_X * 2);
    return Math.max(MIN_ROW_HEIGHT, lines.length * (size + 2) + CELL_PADDING_Y * 2);
  });

  return Math.max(...heights, MIN_ROW_HEIGHT);
}

function drawTableHeader(page: PDFPage, boldFont: PDFFont, y: number, widths: number[]) {
  const labels = ["Sr.", "Name", "Enrollment No.", "Year"];
  let x = MARGIN_LEFT;
  page.drawRectangle({
    x,
    y,
    width: widths.reduce((sum, value) => sum + value, 0),
    height: TABLE_HEADER_HEIGHT,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.65, 0.68, 0.73),
    borderWidth: 1
  });

  labels.forEach((label, index) => {
    page.drawText(label, {
      x: x + CELL_PADDING_X,
      y: y + 8,
      size: 10,
      font: boldFont,
      color: rgb(0.1, 0.12, 0.16)
    });
    x += widths[index];
    if (index < labels.length - 1) {
      page.drawLine({
        start: { x, y },
        end: { x, y: y + TABLE_HEADER_HEIGHT },
        thickness: 1,
        color: rgb(0.72, 0.74, 0.78)
      });
    }
  });

  return y - TABLE_HEADER_HEIGHT;
}

function drawTableRow(page: PDFPage, font: PDFFont, y: number, widths: number[], values: string[], rowHeight: number, rowIndex: number) {
  let x = MARGIN_LEFT;
  page.drawRectangle({
    x,
    y: y - rowHeight,
    width: widths.reduce((sum, value) => sum + value, 0),
    height: rowHeight,
    color: rowIndex % 2 === 0 ? rgb(1, 1, 1) : rgb(0.985, 0.985, 0.99),
    borderColor: rgb(0.72, 0.74, 0.78),
    borderWidth: 1
  });

  values.forEach((value, index) => {
    const lines = wrapLines(font, value || "", 10.5, widths[index] - CELL_PADDING_X * 2);
    let cursor = y - 14;
    lines.forEach((line) => {
      page.drawText(line, {
        x: x + CELL_PADDING_X,
        y: cursor,
        size: 10.5,
        font,
        color: rgb(0.16, 0.17, 0.19)
      });
      cursor -= 12;
    });

    x += widths[index];
    if (index < values.length - 1) {
      page.drawLine({
        start: { x, y },
        end: { x, y: y - rowHeight },
        thickness: 1,
        color: rgb(0.72, 0.74, 0.78)
      });
    }
  });

  return y - rowHeight;
}

function formatLongDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function drawHeader(page: PDFPage, regular: PDFFont, bold: PDFFont, logo: PDFImage | null) {
  if (logo) {
    const scaled = logo.scale(0.24);
    page.drawImage(logo, {
      x: PAGE_WIDTH - MARGIN_RIGHT - scaled.width,
      y: PAGE_HEIGHT - MARGIN_TOP - scaled.height,
      width: scaled.width,
      height: scaled.height
    });
  }

  page.drawText("Central Corporate Relations, Training", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - MARGIN_TOP - 6,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.09, 0.12)
  });
  page.drawText("and Placement Cell (CN-CRTP)", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - MARGIN_TOP - 26,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.09, 0.12)
  });
  page.drawLine({
    start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT },
    thickness: 1,
    color: rgb(0.16, 0.18, 0.23)
  });

  return PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT - 18;
}

export async function generateCoordinatorAttendanceLetterPdf(input: AttendanceLetterInput) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdfDoc);
  const widths = [42, 220, 148, PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 42 - 220 - 148];

  const drawPage = () => {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, cursor: drawHeader(page, regular, sansBold, logo) };
  };

  let { page, cursor } = drawPage();

  page.drawText("To,", { x: MARGIN_LEFT, y: cursor, size: 12, font: regular, color: rgb(0.15, 0.16, 0.18) });
  cursor -= 18;
  page.drawText("The Concerned Faculty / Teacher", {
    x: MARGIN_LEFT,
    y: cursor,
    size: 12,
    font: bold,
    color: rgb(0.15, 0.16, 0.18)
  });
  cursor -= 26;

  page.drawText(`Subject: Request to Consider Attendance on ${formatLongDate(input.event_date)}`, {
    x: MARGIN_LEFT,
    y: cursor,
    size: 12,
    font: bold,
    color: rgb(0.08, 0.09, 0.12),
    maxWidth: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
  });
  cursor -= 30;

  page.drawText("Dear Sir/Madam,", {
    x: MARGIN_LEFT,
    y: cursor,
    size: 12,
    font: regular,
    color: rgb(0.15, 0.16, 0.18)
  });
  cursor -= 22;

  cursor = drawParagraph(
    page,
    regular,
    `This is to respectfully inform you that the undersigned students could not attend the scheduled lectures/labs on ${formatLongDate(input.event_date)} due to Training & Placement Cell coordination work for the \"${input.event_title}\" from ${input.time_from} to ${input.time_to}.`,
    MARGIN_LEFT,
    cursor,
    PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT,
    12,
    4
  );
  cursor -= 12;
  cursor = drawParagraph(
    page,
    regular,
    "We kindly request you to grant them attendance for the mentioned day. Below is the list of student coordinators:",
    MARGIN_LEFT,
    cursor,
    PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT,
    12,
    4
  );
  cursor -= 18;

  page.drawText("List of Student Coordinators", {
    x: MARGIN_LEFT,
    y: cursor,
    size: 11,
    font: sansBold,
    color: rgb(0.1, 0.12, 0.16)
  });
  cursor -= 18;

  cursor = drawTableHeader(page, sansBold, cursor, widths);

  input.coordinators.forEach((coordinator, index) => {
    const rowHeight = measureRowHeight(regular, [String(index + 1), coordinator.name, coordinator.enrollment_no, coordinator.year], widths, 10.5);

    if (cursor - rowHeight < MARGIN_BOTTOM + 90) {
      ({ page, cursor } = drawPage());
      cursor = drawTableHeader(page, sansBold, cursor, widths);
    }

    cursor = drawTableRow(
      page,
      regular,
      cursor,
      widths,
      [String(index + 1), coordinator.name, coordinator.enrollment_no, coordinator.year],
      rowHeight,
      index
    );
  });

  if (cursor < MARGIN_BOTTOM + 90) {
    ({ page, cursor } = drawPage());
  }

  cursor -= 34;
  page.drawText("Regards,", { x: MARGIN_LEFT, y: cursor, size: 12, font: regular, color: rgb(0.15, 0.16, 0.18) });
  cursor -= 18;
  page.drawText("CN-CRTP", { x: MARGIN_LEFT, y: cursor, size: 12, font: bold, color: rgb(0.1, 0.12, 0.16) });
  drawRightAlignedText(page, regular, `Generated on ${new Date().toLocaleString("en-IN")}`, 9, PAGE_WIDTH - MARGIN_RIGHT, MARGIN_BOTTOM - 6, rgb(0.45, 0.47, 0.52));

  return pdfDoc.save();
}
