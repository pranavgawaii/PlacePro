import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import * as XLSX from 'npm:xlsx@0.18.5';
import { createServiceClient, requireUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { compareSeatNumbers, sanitizeSheetName } from '../_shared/seat-utils.ts';
import type { GenerateDocumentsRequest } from '../_shared/types.ts';

type AllocationView = {
  labId: string;
  labName: string;
  seatNo: string;
  rollNo: string;
  studentName: string;
  extraValues: Record<string, string>;
};

type ColumnAlign = 'left' | 'center' | 'right';
type ColumnConfig = {
  key: string;
  label: string;
  align: ColumnAlign;
  width: number;
  paddingX: number;
  paddingY: number;
  enabled: boolean;
  source: 'system' | 'extra';
  appliesTo: 'both' | 'attendance';
};

type TableStyleConfig = {
  fontSize: number;
  headerFontSize: number;
  rowHeight: number;
  headerRowHeight: number;
  cellPaddingX: number;
  cellPaddingY: number;
  lineWidth: number;
  sectionGap: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

const defaultSettings = {
  institute_name: 'Central Corporate Relations, Training and Placement Cell (CN-CRTP)',
  exam_title: 'MIT ADT University',
  subject: 'Seat Allocation & Attendance',
  footer_text: 'MIT ADT University',
};

const RESERVED_COLUMN_KEYS = new Set(
  [
    'seat no',
    'seat number',
    'roll no',
    'roll number',
    'student name',
    'name',
    'class room no',
    'classroom no',
    'classroom',
    'signature',
  ].map((value) => value.toLowerCase()),
);

const EXTRA_COLUMN_PREFIX = 'extra:';
const VALID_ALIGNS: ColumnAlign[] = ['left', 'center', 'right'];
const MIN_COLUMN_WIDTH = 56;
const MAX_COLUMN_WIDTH = 280;
const DEFAULT_EXTRA_COLUMN_WIDTH = 88;
const MIN_LINE_WIDTH = 0.25;
const MAX_LINE_WIDTH = 2;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 14;
const MIN_ROW_HEIGHT = 14;
const MAX_ROW_HEIGHT = 40;
const MIN_PADDING = 2;
const MAX_PADDING = 14;
const MIN_SECTION_GAP = 6;
const MAX_SECTION_GAP = 42;
const SYSTEM_COLUMN_DEFAULTS: ColumnConfig[] = [
  { key: 'seat_no', label: 'Seat No', align: 'left', width: 66, paddingX: 4, paddingY: 4, enabled: true, source: 'system', appliesTo: 'both' },
  { key: 'roll_no', label: 'Roll No', align: 'center', width: 76, paddingX: 4, paddingY: 4, enabled: true, source: 'system', appliesTo: 'both' },
  { key: 'student_name', label: 'Student Name', align: 'left', width: 176, paddingX: 4, paddingY: 4, enabled: true, source: 'system', appliesTo: 'both' },
  { key: 'class_room_no', label: 'Class Room No', align: 'center', width: 114, paddingX: 4, paddingY: 4, enabled: true, source: 'system', appliesTo: 'both' },
  { key: 'signature', label: 'Signature', align: 'center', width: 98, paddingX: 4, paddingY: 4, enabled: true, source: 'system', appliesTo: 'attendance' },
];

const DEFAULT_TABLE_STYLE: TableStyleConfig = {
  fontSize: 10,
  headerFontSize: 10.5,
  rowHeight: 19,
  headerRowHeight: 20,
  cellPaddingX: 4,
  cellPaddingY: 4,
  lineWidth: 0.5,
  sectionGap: 18,
};

const fitPdfFontSize = (font: any, text: string, maxWidth: number, preferred: number, min: number): number => {
  let size = preferred;
  while (size > min) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return size;
    }
    size -= 0.5;
  }
  return min;
};

const stringifyCellValue = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyCellValue(item)).filter(Boolean).join(', ');
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const sanitizeSelectedColumns = (columns?: string[]) => {
  const selected: string[] = [];
  (columns ?? []).forEach((column) => {
    const key = String(column ?? '').trim();
    if (!key || RESERVED_COLUMN_KEYS.has(key.toLowerCase())) {
      return;
    }
    if (!selected.includes(key)) {
      selected.push(key);
    }
  });
  return selected;
};

const sanitizeExtraColumnName = (name: string): string | null => {
  const normalized = String(name ?? '').trim();
  if (!normalized) {
    return null;
  }
  if (RESERVED_COLUMN_KEYS.has(normalized.toLowerCase())) {
    return null;
  }
  return normalized;
};

const isValidAlign = (value: unknown): value is ColumnAlign => VALID_ALIGNS.includes(value as ColumnAlign);
const isSystemColumnKey = (key: string) => SYSTEM_COLUMN_DEFAULTS.some((column) => column.key === key);
const toExtraColumnKey = (name: string) => `${EXTRA_COLUMN_PREFIX}${name}`;
const fromExtraColumnKey = (key: string) => key.slice(EXTRA_COLUMN_PREFIX.length);
const normalizeColumnWidth = (value: unknown, fallback: number): number => {
  const width = Number(value);
  if (!Number.isFinite(width)) {
    return fallback;
  }
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
};
const normalizeColumnPadding = (value: unknown, fallback: number): number => {
  const padding = Number(value);
  if (!Number.isFinite(padding)) {
    return fallback;
  }
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, Math.round(padding)));
};
const normalizeTableNumber = (value: unknown, fallback: number, min: number, max: number, decimals = 0): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, num));
  if (decimals <= 0) {
    return Math.round(clamped);
  }
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
};

const sanitizeTableStyle = (style?: GenerateDocumentsRequest['table_style'] | null): TableStyleConfig => ({
  fontSize: normalizeTableNumber(style?.font_size, DEFAULT_TABLE_STYLE.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE, 1),
  headerFontSize: normalizeTableNumber(
    style?.header_font_size,
    DEFAULT_TABLE_STYLE.headerFontSize,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    1,
  ),
  rowHeight: normalizeTableNumber(style?.row_height, DEFAULT_TABLE_STYLE.rowHeight, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT),
  headerRowHeight: normalizeTableNumber(
    style?.header_row_height,
    DEFAULT_TABLE_STYLE.headerRowHeight,
    MIN_ROW_HEIGHT,
    MAX_ROW_HEIGHT,
  ),
  cellPaddingX: normalizeTableNumber(style?.cell_padding_x, DEFAULT_TABLE_STYLE.cellPaddingX, MIN_PADDING, MAX_PADDING),
  cellPaddingY: normalizeTableNumber(style?.cell_padding_y, DEFAULT_TABLE_STYLE.cellPaddingY, MIN_PADDING, MAX_PADDING),
  lineWidth: normalizeTableNumber(style?.line_width, DEFAULT_TABLE_STYLE.lineWidth, MIN_LINE_WIDTH, MAX_LINE_WIDTH, 2),
  sectionGap: normalizeTableNumber(style?.section_gap, DEFAULT_TABLE_STYLE.sectionGap, MIN_SECTION_GAP, MAX_SECTION_GAP),
});

const normalizeColumnConfigs = (
  availableExtraColumns: string[],
  inputConfigs?: GenerateDocumentsRequest['column_configs'],
  selectedColumns?: string[],
): ColumnConfig[] => {
  const allowedExtras = sanitizeSelectedColumns(availableExtraColumns);
  const allowedSet = new Set(allowedExtras.map((column) => column.toLowerCase()));
  const base = SYSTEM_COLUMN_DEFAULTS.map((column) => ({ ...column }));

  if (Array.isArray(inputConfigs) && inputConfigs.length > 0) {
    const output: ColumnConfig[] = [];
    const seen = new Set<string>();

    inputConfigs.forEach((item) => {
      const rawKey = String(item?.key ?? '').trim();
      if (!rawKey || seen.has(rawKey)) {
        return;
      }

      let key = rawKey;
      if (!isSystemColumnKey(key) && !key.startsWith(EXTRA_COLUMN_PREFIX)) {
        const normalizedName = sanitizeExtraColumnName(key);
        if (!normalizedName) {
          return;
        }
        key = toExtraColumnKey(normalizedName);
      }

      if (key.startsWith(EXTRA_COLUMN_PREFIX)) {
        const normalizedName = sanitizeExtraColumnName(fromExtraColumnKey(key));
        if (!normalizedName || !allowedSet.has(normalizedName.toLowerCase())) {
          return;
        }
        key = toExtraColumnKey(normalizedName);
      }

      const defaultConfig = base.find((column) => column.key === key);
      const label = String(item?.label ?? defaultConfig?.label ?? '').trim();

      output.push({
        key,
        label: label || defaultConfig?.label || (key.startsWith(EXTRA_COLUMN_PREFIX) ? fromExtraColumnKey(key) : key),
        align: isValidAlign(item?.align) ? item.align : defaultConfig?.align ?? 'left',
        width: normalizeColumnWidth(item?.width, defaultConfig?.width ?? DEFAULT_EXTRA_COLUMN_WIDTH),
        paddingX: normalizeColumnPadding(item?.padding_x, defaultConfig?.paddingX ?? DEFAULT_TABLE_STYLE.cellPaddingX),
        paddingY: normalizeColumnPadding(item?.padding_y, defaultConfig?.paddingY ?? DEFAULT_TABLE_STYLE.cellPaddingY),
        enabled: item?.enabled !== false,
        source: key.startsWith(EXTRA_COLUMN_PREFIX) ? 'extra' : 'system',
        appliesTo: key === 'signature' ? 'attendance' : 'both',
      });
      seen.add(key);
    });

    base.forEach((column) => {
      if (!seen.has(column.key)) {
        output.push(column);
        seen.add(column.key);
      }
    });

    allowedExtras.forEach((columnName) => {
      const key = toExtraColumnKey(columnName);
      if (!seen.has(key)) {
        output.push({
          key,
          label: columnName,
          align: 'left',
          width: DEFAULT_EXTRA_COLUMN_WIDTH,
          paddingX: DEFAULT_TABLE_STYLE.cellPaddingX,
          paddingY: DEFAULT_TABLE_STYLE.cellPaddingY,
          enabled: false,
          source: 'extra',
          appliesTo: 'both',
        });
      }
    });

    return output;
  }

  const selected = new Set(sanitizeSelectedColumns(selectedColumns).map((column) => column.toLowerCase()));
  const extras: ColumnConfig[] = allowedExtras.map((columnName) => ({
    key: toExtraColumnKey(columnName),
    label: columnName,
    align: 'left',
    width: DEFAULT_EXTRA_COLUMN_WIDTH,
    paddingX: DEFAULT_TABLE_STYLE.cellPaddingX,
    paddingY: DEFAULT_TABLE_STYLE.cellPaddingY,
    enabled: selected.has(columnName.toLowerCase()),
    source: 'extra',
    appliesTo: 'both',
  }));

  return [...base, ...extras];
};

const sortAllocationRows = (rows: AllocationView[], labOrder: Map<string, number>): AllocationView[] =>
  [...rows].sort((a, b) => {
    const aRank = labOrder.get(a.labId);
    const bRank = labOrder.get(b.labId);

    if (typeof aRank === 'number' && typeof bRank === 'number' && aRank !== bRank) {
      return aRank - bRank;
    }

    if (typeof aRank === 'number' && typeof bRank !== 'number') {
      return -1;
    }

    if (typeof aRank !== 'number' && typeof bRank === 'number') {
      return 1;
    }

    const labCompare = a.labName.localeCompare(b.labName, undefined, { sensitivity: 'base' });
    if (labCompare !== 0) {
      return labCompare;
    }
    return compareSeatNumbers(a.seatNo, b.seatNo);
  });

const loadLogoImage = async (pdfDoc: PDFDocument, logoUrl: string | null) => {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg')) {
      return await pdfDoc.embedJpg(bytes);
    }
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
};

const drawHeader = (params: {
  page: any;
  boldFont: any;
  eventTitle: string;
  documentDate: string;
  sheetTitle: string;
  labName: string;
  logoImage: any | null;
}) => {
  const { page, boldFont, eventTitle, documentDate, sheetTitle, labName, logoImage } = params;
  const cleanEventTitle = eventTitle.trim();
  const headlineLines = [
    'Central Corporate Relations, Training and Placement',
    'Cell (CN-CRTP)',
  ];

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 170,
    width: PAGE_WIDTH,
    height: 170,
    color: rgb(1, 1, 1),
  });

  page.drawLine({
    start: { x: 40, y: PAGE_HEIGHT - 112 },
    end: { x: PAGE_WIDTH - 40, y: PAGE_HEIGHT - 112 },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  });

  let logoLeftEdge = PAGE_WIDTH - 40;

  if (logoImage) {
    const maxWidth = 128;
    const maxHeight = 72;
    const widthScale = maxWidth / logoImage.width;
    const heightScale = maxHeight / logoImage.height;
    const scale = Math.min(1, widthScale, heightScale);
    const scaled = {
      width: logoImage.width * scale,
      height: logoImage.height * scale,
    };
    const drawX = PAGE_WIDTH - 40 - scaled.width;
    logoLeftEdge = drawX;
    page.drawImage(logoImage, {
      x: drawX,
      y: PAGE_HEIGHT - 32 - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
  }

  const headingMaxWidth = Math.max(250, logoLeftEdge - 56);
  const headingSize = Math.min(
    fitPdfFontSize(boldFont, headlineLines[0], headingMaxWidth, 17, 12),
    fitPdfFontSize(boldFont, headlineLines[1], headingMaxWidth, 17, 12),
  );

  page.drawText(headlineLines[0], {
    x: 40,
    y: PAGE_HEIGHT - 36,
    size: headingSize,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });

  page.drawText(headlineLines[1], {
    x: 40,
    y: PAGE_HEIGHT - 56,
    size: headingSize,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });

  const sectionTitle = `${sheetTitle} | Lab: ${labName}`;
  page.drawText(sectionTitle, {
    x: 40,
    y: PAGE_HEIGHT - 88,
    size: 10.5,
    font: boldFont,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText(`Date: ${documentDate}`, {
    x: 40,
    y: PAGE_HEIGHT - 102,
    size: 9.5,
    font: boldFont,
    color: rgb(0.16, 0.16, 0.16),
  });

  if (cleanEventTitle) {
    page.drawText(cleanEventTitle, {
      x: PAGE_WIDTH / 2 - boldFont.widthOfTextAtSize(cleanEventTitle, 10.5) / 2,
      y: PAGE_HEIGHT - 130,
      size: 10.5,
      font: boldFont,
      color: rgb(0.06, 0.12, 0.24),
    });
  }
};

const drawFooter = (params: {
  page: any;
  font: any;
  footer: string;
  pageNo: number;
  totalPages: number;
}) => {
  const { page, font, footer, pageNo, totalPages } = params;

  if (footer) {
    page.drawText(footer, {
      x: 40,
      y: 24,
      size: 9,
      font,
      color: rgb(0.45, 0.5, 0.6),
    });
  }

  page.drawText(`Page ${pageNo} of ${totalPages}`, {
    x: PAGE_WIDTH - 120,
    y: 24,
    size: 9,
    font,
    color: rgb(0.45, 0.5, 0.6),
  });
};

const drawTableText = (params: {
  page: any;
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  font: any;
  align: ColumnAlign;
  paddingX: number;
  color: [number, number, number];
}) => {
  const { page, text, x, y, width, size, font, align, paddingX, color } = params;
  const raw = String(text ?? '');
  const ellipsis = '...';
  const innerWidth = Math.max(width - paddingX * 2, 0);
  let value = raw;

  if (font.widthOfTextAtSize(value, size) > innerWidth) {
    let trimmed = value;
    while (trimmed.length > 0 && font.widthOfTextAtSize(`${trimmed}${ellipsis}`, size) > innerWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    value = trimmed.length > 0 ? `${trimmed}${ellipsis}` : ellipsis;
  }

  const textWidth = font.widthOfTextAtSize(value, size);
  const textX = align === 'center'
    ? x + Math.max((width - textWidth) / 2, 0)
    : align === 'right'
      ? x + Math.max(width - textWidth - paddingX, 0)
      : x + paddingX;
  page.drawText(value, {
    x: textX,
    y,
    size,
    font,
    color: rgb(color[0], color[1], color[2]),
  });
};

const drawTable = (params: {
  pdfDoc: PDFDocument;
  groupedRows: Array<{ labName: string; rows: AllocationView[] }>;
  eventTitle: string;
  documentDate: string;
  columnConfigs: ColumnConfig[];
  tableStyle: TableStyleConfig;
  tableType: 'allocation' | 'attendance';
  logoImage: any | null;
}) => {
  const { pdfDoc, groupedRows, eventTitle, documentDate, columnConfigs, tableType, logoImage, tableStyle } = params;
  const hasEventTitle = eventTitle.trim().length > 0;
  const activeColumns = columnConfigs.filter((column) =>
    tableType === 'allocation' ? column.enabled && column.appliesTo === 'both' : column.enabled,
  );

  if (activeColumns.length === 0) {
    return;
  }

  const rowHeight = Math.max(tableStyle.rowHeight, tableStyle.fontSize + tableStyle.cellPaddingY * 2 + 2);
  const headerRowHeight = Math.max(
    tableStyle.headerRowHeight,
    tableStyle.headerFontSize + tableStyle.cellPaddingY * 2 + 2,
  );
  const tableStartY = hasEventTitle
    ? PAGE_HEIGHT - (138 + tableStyle.sectionGap)
    : PAGE_HEIGHT - (126 + tableStyle.sectionGap);
  const tableBottomMargin = 48;
  const availableHeight = tableStartY - tableBottomMargin;
  const rowsPerPage = Math.max(1, Math.floor((availableHeight - headerRowHeight) / rowHeight));
  const tableWidth = PAGE_WIDTH - 72;

  let widths = activeColumns.map((column) => normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH));
  let totalWidth = widths.reduce((sum, width) => sum + width, 0);

  if (totalWidth > tableWidth) {
    const scale = tableWidth / totalWidth;
    widths = widths.map((width) => Math.max(52, width * scale));
    totalWidth = widths.reduce((sum, width) => sum + width, 0);
  }

  if (totalWidth < tableWidth) {
    const growBy = tableWidth - totalWidth;
    const studentIndex = activeColumns.findIndex((column) => column.key === 'student_name');
    const targetIndex = studentIndex >= 0 ? studentIndex : activeColumns.length - 1;
    widths[targetIndex] += growBy;
  }

  let xCursor = 40;
  const columns = activeColumns.map((column, index) => {
    const output = { ...column, x: xCursor, width: widths[index] };
    xCursor += widths[index];
    return output;
  });

  const resolveValue = (row: AllocationView, columnKey: string) => {
    if (columnKey === 'seat_no') return row.seatNo;
    if (columnKey === 'roll_no') return row.rollNo;
    if (columnKey === 'student_name') return row.studentName;
    if (columnKey === 'class_room_no') return row.labName;
    if (columnKey === 'signature') return '';
    if (columnKey.startsWith(EXTRA_COLUMN_PREFIX)) return row.extraValues[fromExtraColumnKey(columnKey)] ?? '';
    return '';
  };

  const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  const boldFont = pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

  for (const group of groupedRows) {
    let cursor = 0;
    while (cursor < group.rows.length) {
      const rowsChunk = group.rows.slice(cursor, cursor + rowsPerPage);
      cursor += rowsChunk.length;

      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      drawHeader({
        page,
        boldFont,
        eventTitle,
        documentDate,
        sheetTitle: tableType === 'allocation' ? 'Seating Allocation Sheet' : 'Attendance Sheet',
        labName: group.labName,
        logoImage,
      });

      const tableHeight = headerRowHeight + rowsChunk.length * rowHeight;
      const tableTopY = tableStartY;
      const tableBottomY = tableTopY - tableHeight;

      page.drawRectangle({
        x: 36,
        y: tableBottomY,
        width: PAGE_WIDTH - 72,
        height: tableHeight,
        borderColor: rgb(0.25, 0.25, 0.25),
        borderWidth: tableStyle.lineWidth,
      });

      page.drawRectangle({
        x: 36,
        y: tableTopY - headerRowHeight,
        width: PAGE_WIDTH - 72,
        height: headerRowHeight,
        color: rgb(0.95, 0.95, 0.95),
      });

      let xLine = 40;
      for (let i = 0; i < columns.length - 1; i += 1) {
        xLine += columns[i].width;
        page.drawLine({
          start: { x: xLine, y: tableTopY },
          end: { x: xLine, y: tableBottomY },
          thickness: tableStyle.lineWidth,
          color: rgb(0.32, 0.32, 0.32),
        });
      }

      for (let rowIndex = 0; rowIndex <= rowsChunk.length; rowIndex += 1) {
        const yLine = tableTopY - headerRowHeight - rowIndex * rowHeight;
        page.drawLine({
          start: { x: 36, y: yLine },
          end: { x: PAGE_WIDTH - 36, y: yLine },
          thickness: tableStyle.lineWidth,
          color: rgb(0.32, 0.32, 0.32),
        });
      }

      columns.forEach((column) => {
        const headerPaddingY = normalizeColumnPadding(column.paddingY, tableStyle.cellPaddingY);
        const headerMinY = tableTopY - headerRowHeight + headerPaddingY;
        const headerMaxY = tableTopY - headerPaddingY - tableStyle.headerFontSize;
        const headerCenterY = tableTopY - headerRowHeight / 2 - tableStyle.headerFontSize * 0.35;
        const headerTextY = Math.min(headerMaxY, Math.max(headerMinY, headerCenterY));
        drawTableText({
          page,
          text: column.label,
          x: column.x,
          y: headerTextY,
          width: column.width,
          size: tableStyle.headerFontSize,
          font: boldFont,
          align: column.align,
          paddingX: normalizeColumnPadding(column.paddingX, tableStyle.cellPaddingX),
          color: [0.06, 0.12, 0.24],
        });
      });

      rowsChunk.forEach((row, rowIndex) => {
        columns.forEach((column) => {
          const rowTop = tableTopY - headerRowHeight - rowIndex * rowHeight;
          const rowBottom = rowTop - rowHeight;
          const rowPaddingY = normalizeColumnPadding(column.paddingY, tableStyle.cellPaddingY);
          const rowMinY = rowBottom + rowPaddingY;
          const rowMaxY = rowTop - rowPaddingY - tableStyle.fontSize;
          const rowCenterY = rowTop - rowHeight / 2 - tableStyle.fontSize * 0.35;
          const rowTextY = Math.min(rowMaxY, Math.max(rowMinY, rowCenterY));
          drawTableText({
            page,
            text: resolveValue(row, column.key),
            x: column.x,
            y: rowTextY,
            width: column.width,
            size: tableStyle.fontSize,
            font,
            align: column.align,
            paddingX: normalizeColumnPadding(column.paddingX, tableStyle.cellPaddingX),
            color: [0.1, 0.13, 0.2],
          });
        });
      });
    }
  }
};

const stampFooters = (pdfDoc: PDFDocument, footer: string) => {
  const pages = pdfDoc.getPages();
  const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  pages.forEach((page, index) => {
    drawFooter({
      page,
      font,
      footer,
      pageNo: index + 1,
      totalPages: pages.length,
    });
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST for this endpoint.', null, 405);
  }

  const { user, client, error } = await requireUser(req);
  if (error || !user) {
    return error;
  }

  const payload = (await req.json().catch(() => null)) as GenerateDocumentsRequest | null;
  if (!payload || !payload.session_id) {
    return errorResponse('INVALID_PAYLOAD', 'Expected payload with session_id.');
  }

  const action = payload.action === 'delete' ? 'delete' : 'generate';
  if (action === 'generate' && (!Array.isArray(payload.formats) || payload.formats.length === 0)) {
    return errorResponse(
      'INVALID_PAYLOAD',
      'Expected payload { session_id, formats: ["pdf"|"xlsx"], excel_mode: "per_lab" }.',
    );
  }

  const { data: session, error: sessionError } = await client
    .from('allocation_sessions')
    .select('id, upload_session_id, owner_id, mode, metadata')
    .eq('id', payload.session_id)
    .eq('owner_id', user.id)
    .single();

  if (sessionError || !session) {
    return errorResponse('SESSION_NOT_FOUND', 'Allocation session not found.', sessionError?.message, 404);
  }

  const storage = createServiceClient();
  const basePath = `owner/${user.id}/allocation/${payload.session_id}`;

  if (action === 'delete') {
    const removablePaths = [
      `${basePath}/seating.pdf`,
      `${basePath}/attendance.pdf`,
      `${basePath}/allocation-attendance.xlsx`,
    ];

    const { error: removeError } = await storage.storage.from('seat-documents').remove(removablePaths);
    if (removeError) {
      return errorResponse('DELETE_FAILED', 'Failed to delete generated files for this session.', removeError.message, 500);
    }

    return jsonResponse({
      deleted: true,
      deleted_paths: removablePaths,
      session_id: payload.session_id,
      generated_at: new Date().toISOString(),
    });
  }

  const { data: settingsRow } = await client
    .from('document_settings')
    .select('institute_name, exam_title, subject, footer_text')
    .eq('owner_id', user.id)
    .maybeSingle();

  const resolveHeaderText = (value: string | null | undefined, fallback: string) => {
    const normalized = String(value ?? '').trim();
    if (!normalized || /placepro/i.test(normalized)) {
      return fallback;
    }
    return normalized;
  };

  const settings = {
    ...defaultSettings,
    ...(settingsRow ?? {}),
    institute_name: resolveHeaderText(settingsRow?.institute_name, defaultSettings.institute_name),
    exam_title: resolveHeaderText(settingsRow?.exam_title, defaultSettings.exam_title),
    subject: resolveHeaderText(settingsRow?.subject, defaultSettings.subject),
    footer_text: resolveHeaderText(settingsRow?.footer_text, defaultSettings.footer_text),
  };
  const eventTitle = resolveHeaderText(settingsRow?.exam_title, '');
  const normalizeDateValue = (value: string | null | undefined) => {
    const raw = String(value ?? '').trim();
    if (!raw) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      return `${day}/${month}/${year}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return raw;
  };
  const documentDate = normalizeDateValue(settingsRow?.subject);

  const requestOrigin = req.headers.get('origin')?.trim();
  const fixedLogoUrl = requestOrigin ? `${requestOrigin.replace(/\/$/, '')}/mit-adt-logo-transparent.png` : null;

  const metadata = session.metadata && typeof session.metadata === 'object' ? (session.metadata as Record<string, unknown>) : {};
  const selectedLabIds = Array.isArray(metadata.lab_ids)
    ? metadata.lab_ids.map((item) => String(item)).filter(Boolean)
    : [];
  const labOrder = new Map(selectedLabIds.map((labId, index) => [labId, index]));

  const { data: rows, error: rowError } = await client
    .from('allocations')
    .select(
      `
      seat_number,
      lab_id,
      students_temp!allocations_student_id_fkey(name, roll_number, department, raw_row),
      labs!allocations_lab_id_fkey(lab_name)
    `,
    )
    .eq('session_id', payload.session_id)
    .eq('owner_id', user.id);

  if (rowError) {
    return errorResponse('ALLOCATIONS_NOT_FOUND', 'Unable to load allocations for session.', rowError.message, 500);
  }

  if (!rows || rows.length === 0) {
    return errorResponse('EMPTY_ALLOCATION', 'No allocations available for document generation.');
  }

  const allocationRows = sortAllocationRows(
    rows.map((row: any) => ({
      labId: row.lab_id,
      labName: row.labs?.lab_name ?? 'Unknown Lab',
      seatNo: row.seat_number,
      rollNo: row.students_temp?.roll_number ?? '-',
      studentName: row.students_temp?.name ?? '-',
      extraValues: (() => {
        const values: Record<string, string> = {};
        const raw = row.students_temp?.raw_row && typeof row.students_temp.raw_row === 'object'
          ? (row.students_temp.raw_row as Record<string, unknown>)
          : {};
        Object.entries(raw).forEach(([key, value]) => {
          values[key] = stringifyCellValue(value);
        });
        if (row.students_temp?.department && !values.Department) {
          values.Department = String(row.students_temp.department);
        }
        return values;
      })(),
    })),
    labOrder,
  );
  const availableExtraColumns = Array.from(
    new Set(
      allocationRows.flatMap((row) =>
        Object.keys(row.extraValues).filter((key) => !RESERVED_COLUMN_KEYS.has(key.toLowerCase())),
      ),
    ),
  );
  const columnConfigs = normalizeColumnConfigs(availableExtraColumns, payload.column_configs, payload.selected_columns);
  const tableStyle = sanitizeTableStyle(payload.table_style);
  const seatingColumns = columnConfigs.filter((column) => column.enabled && column.appliesTo === 'both');
  const attendanceColumns = columnConfigs.filter((column) => column.enabled);

  if (seatingColumns.length === 0) {
    return errorResponse('INVALID_COLUMNS', 'Enable at least one column for seating document.');
  }
  if (attendanceColumns.length === 0) {
    return errorResponse('INVALID_COLUMNS', 'Enable at least one column for attendance document.');
  }

  const groupedMap = new Map<string, { labName: string; rows: AllocationView[] }>();
  for (const row of allocationRows) {
    if (!groupedMap.has(row.labId)) {
      groupedMap.set(row.labId, { labName: row.labName, rows: [] });
    }
    groupedMap.get(row.labId)?.rows.push(row);
  }
  const groupedRows = Array.from(groupedMap.values());

  let seatPdfUrl: string | undefined;
  let attendancePdfUrl: string | undefined;
  let workbookUrl: string | undefined;

  if (payload.formats?.includes('pdf')) {
    const seatingDoc = await PDFDocument.create();
    const seatingLogo = await loadLogoImage(seatingDoc, fixedLogoUrl);
    drawTable({
      pdfDoc: seatingDoc,
      groupedRows,
      eventTitle,
      documentDate,
      columnConfigs,
      tableStyle,
      tableType: 'allocation',
      logoImage: seatingLogo,
    });
    stampFooters(seatingDoc, settings.footer_text || defaultSettings.footer_text);

    const attendanceDoc = await PDFDocument.create();
    const attendanceLogo = await loadLogoImage(attendanceDoc, fixedLogoUrl);
    drawTable({
      pdfDoc: attendanceDoc,
      groupedRows,
      eventTitle,
      documentDate,
      columnConfigs,
      tableStyle,
      tableType: 'attendance',
      logoImage: attendanceLogo,
    });
    stampFooters(attendanceDoc, settings.footer_text || defaultSettings.footer_text);

    const seatingBytes = await seatingDoc.save();
    const attendanceBytes = await attendanceDoc.save();

    const seatingPath = `${basePath}/seating.pdf`;
    const attendancePath = `${basePath}/attendance.pdf`;

    const { error: seatingUploadError } = await storage.storage
      .from('seat-documents')
      .upload(seatingPath, seatingBytes, { upsert: true, contentType: 'application/pdf' });

    if (seatingUploadError) {
      return errorResponse('PDF_UPLOAD_FAILED', 'Failed to upload seating PDF.', seatingUploadError.message, 500);
    }

    const { error: attendanceUploadError } = await storage.storage
      .from('seat-documents')
      .upload(attendancePath, attendanceBytes, { upsert: true, contentType: 'application/pdf' });

    if (attendanceUploadError) {
      return errorResponse('PDF_UPLOAD_FAILED', 'Failed to upload attendance PDF.', attendanceUploadError.message, 500);
    }

    const seatingSigned = await storage.storage.from('seat-documents').createSignedUrl(seatingPath, 60 * 60);
    const attendanceSigned = await storage.storage.from('seat-documents').createSignedUrl(attendancePath, 60 * 60);

    seatPdfUrl = seatingSigned.data?.signedUrl;
    attendancePdfUrl = attendanceSigned.data?.signedUrl;
  }

  if (payload.formats?.includes('xlsx')) {
    const wb = XLSX.utils.book_new();
    const resolveCellValue = (row: AllocationView, columnKey: string) => {
      if (columnKey === 'seat_no') return row.seatNo;
      if (columnKey === 'roll_no') return row.rollNo;
      if (columnKey === 'student_name') return row.studentName;
      if (columnKey === 'class_room_no') return row.labName;
      if (columnKey === 'signature') return '';
      if (columnKey.startsWith(EXTRA_COLUMN_PREFIX)) return row.extraValues[fromExtraColumnKey(columnKey)] ?? '';
      return '';
    };

    const buildUniqueLabels = (columns: ColumnConfig[]) => {
      const seen = new Map<string, number>();
      const output: Record<string, string> = {};
      columns.forEach((column) => {
        const base = String(column.label ?? '').trim() || column.key;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        output[column.key] = count === 0 ? base : `${base} (${count + 1})`;
      });
      return output;
    };

    const seatingLabels = buildUniqueLabels(seatingColumns);
    const attendanceLabels = buildUniqueLabels(attendanceColumns);

    for (const group of groupedRows) {
      const sortedRows = [...group.rows];
      const allocationSheetRows = sortedRows.map((row) =>
        Object.fromEntries(
          seatingColumns.map((column) => [seatingLabels[column.key], resolveCellValue(row, column.key)]),
        ),
      );

      const attendanceSheetRows = sortedRows.map((row) =>
        Object.fromEntries(
          attendanceColumns.map((column) => [attendanceLabels[column.key], resolveCellValue(row, column.key)]),
        ),
      );

      const allocationSheetName = sanitizeSheetName(`Allocation_${group.labName}`);
      const attendanceSheetName = sanitizeSheetName(`Attendance_${group.labName}`);
      const allocationSheet = XLSX.utils.json_to_sheet(allocationSheetRows);
      const attendanceSheet = XLSX.utils.json_to_sheet(attendanceSheetRows);
      allocationSheet['!cols'] = seatingColumns.map((column) => ({
        wch: Math.max(8, Math.round(normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH) / 7)),
      }));
      attendanceSheet['!cols'] = attendanceColumns.map((column) => ({
        wch: Math.max(8, Math.round(normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH) / 7)),
      }));
      const headerRowPt = Math.max(10, Math.round(tableStyle.headerRowHeight * 0.75));
      const bodyRowPt = Math.max(10, Math.round(tableStyle.rowHeight * 0.75));
      allocationSheet['!rows'] = [{ hpt: headerRowPt }, ...allocationSheetRows.map(() => ({ hpt: bodyRowPt }))];
      attendanceSheet['!rows'] = [{ hpt: headerRowPt }, ...attendanceSheetRows.map(() => ({ hpt: bodyRowPt }))];

      XLSX.utils.book_append_sheet(wb, allocationSheet, allocationSheetName);
      XLSX.utils.book_append_sheet(wb, attendanceSheet, attendanceSheetName);
    }

    const workbookBytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const workbookPath = `${basePath}/allocation-attendance.xlsx`;

    const { error: workbookUploadError } = await storage.storage
      .from('seat-documents')
      .upload(workbookPath, workbookBytes, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    if (workbookUploadError) {
      return errorResponse('XLSX_UPLOAD_FAILED', 'Failed to upload workbook.', workbookUploadError.message, 500);
    }

    const workbookSigned = await storage.storage.from('seat-documents').createSignedUrl(workbookPath, 60 * 60);
    workbookUrl = workbookSigned.data?.signedUrl;
  }

  return jsonResponse({
    seat_pdf_url: seatPdfUrl,
    attendance_pdf_url: attendancePdfUrl,
    workbook_url: workbookUrl,
    generated_at: new Date().toISOString(),
  });
});
