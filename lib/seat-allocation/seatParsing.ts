import * as XLSX from "xlsx";
import type {
  HeaderMapping,
  InvalidParsedRow,
  ParsedRow,
  SpreadsheetTableCandidate
} from "@/lib/seat-allocation/types";

const NAME_HEADERS = [
  "name",
  "student name",
  "full name",
  "name of student",
  "name of the student",
  "candidate name",
  "student"
];
const ROLL_HEADERS = [
  "roll no",
  "roll number",
  "roll",
  "id",
  "student id",
  "enrollment no",
  "enrollment number",
  "enrolment no",
  "enrolment number",
  "registration no",
  "reg no",
  "prn"
];
const DEPARTMENT_HEADERS = ["department", "dept", "branch", "program", "programme", "class"];

const normalizeCell = (value: unknown) =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const normalizeHeaderToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findHeaderKey = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeaderToken);
  return headers.find((header) => normalizedAliases.includes(normalizeHeaderToken(header))) ?? null;
};

export const extractRowHeaders = (rows: Record<string, unknown>[]): string[] =>
  Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

export const detectHeaderMapping = (headers: string[]): HeaderMapping => ({
  nameKey: findHeaderKey(headers, NAME_HEADERS),
  rollKey: findHeaderKey(headers, ROLL_HEADERS),
  departmentKey: findHeaderKey(headers, DEPARTMENT_HEADERS)
});

export const normalizeParsedRows = (rows: Record<string, unknown>[]) => {
  return normalizeParsedRowsWithMapping(rows, detectHeaderMapping(extractRowHeaders(rows)));
};

export const normalizeParsedRowsWithMapping = (
  rows: Record<string, unknown>[],
  mapping: HeaderMapping
): {
  parsedRows: ParsedRow[];
  invalidRows: InvalidParsedRow[];
} => {
  if (rows.length === 0) {
    return { parsedRows: [], invalidRows: [] };
  }

  const { nameKey, rollKey, departmentKey } = mapping;

  if (!nameKey || !rollKey) {
    return {
      parsedRows: [],
      invalidRows: rows.map((row, index) => ({
        row_index: index + 1,
        reason: "Missing required mapped columns (Name and Roll Number).",
        raw_row: row
      }))
    };
  }

  const parsedRows: ParsedRow[] = [];
  const invalidRows: InvalidParsedRow[] = [];
  const localDuplicateTracker = new Set<string>();

  rows.forEach((row, index) => {
    const name = normalizeCell(row[nameKey]);
    const roll_number = normalizeCell(row[rollKey]);
    const department = departmentKey ? normalizeCell(row[departmentKey]) : "";

    const isBlank = Object.values(row).every((value) => normalizeCell(value) === "");
    if (isBlank) {
      return;
    }

    if (!name || !roll_number) {
      invalidRows.push({
        row_index: index + 1,
        reason: "Missing required field values.",
        raw_row: row
      });
      return;
    }

    const duplicateKey = roll_number.toLowerCase();
    if (localDuplicateTracker.has(duplicateKey)) {
      invalidRows.push({
        row_index: index + 1,
        reason: `Duplicate roll number in file: ${roll_number}`,
        raw_row: row
      });
      return;
    }

    localDuplicateTracker.add(duplicateKey);
    parsedRows.push({
      row_index: index + 1,
      name,
      roll_number,
      department: department || undefined,
      raw_row: row
    });
  });

  return { parsedRows, invalidRows };
};

export const parseSpreadsheetTables = async (file: File): Promise<SpreadsheetTableCandidate[]> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const workbook =
    extension === "csv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const tables: SpreadsheetTableCandidate[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }

    const detected = parseWorksheetTables(sheet, sheetName);
    detected.forEach((table) => tables.push(table));
  });

  return tables;
};

export const parsePdfRows = async (file: File): Promise<Record<string, unknown>[]> => {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const lines: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const text = await page.getTextContent();
    const pageLines = (text.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ")
      .split(/\s{2,}|\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    lines.push(...pageLines);
  }

  const rows: Record<string, unknown>[] = [];

  for (const line of lines) {
    const tokens = line
      .split(/\s{2,}|\t|,\s*/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (tokens.length < 2) {
      continue;
    }

    const rollCandidate = tokens[0];
    const nameCandidate = tokens.slice(1).join(" ");

    if (!rollCandidate || !nameCandidate) {
      continue;
    }

    rows.push({
      "Roll Number": rollCandidate,
      "Student Name": nameCandidate
    });
  }

  return rows;
};

export const detectParseSource = (filename: string): "csv" | "xlsx" | "pdf" | null => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return "csv";
  }
  if (ext === "xlsx" || ext === "xls") {
    return "xlsx";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  return null;
};

const hasAlias = (value: string, aliases: string[]) =>
  aliases.map(normalizeHeaderToken).includes(normalizeHeaderToken(value));

const findHeaderRowIndex = (matrix: unknown[][]): number => {
  const limit = Math.min(matrix.length, 40);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const cells = row.map((cell) => normalizeCell(cell));
    const hasName = cells.some((cell) => hasAlias(cell, NAME_HEADERS));
    const hasRoll = cells.some((cell) => hasAlias(cell, ROLL_HEADERS));

    if (hasName && hasRoll) {
      return rowIndex;
    }
  }

  return -1;
};

const rowHasValue = (row: unknown[] = []) => row.some((cell) => normalizeCell(cell) !== "");

const buildRowsFromHeader = (
  matrix: unknown[][],
  headerRowIndex: number,
  fromIndex: number,
  toIndex: number
): Record<string, unknown>[] => {
  const headerRow = matrix[headerRowIndex] ?? [];
  const headers = headerRow.map((value, index) => {
    const text = normalizeCell(value);
    return text || `Column_${index + 1}`;
  });

  const rows: Record<string, unknown>[] = [];

  for (let index = fromIndex; index <= toIndex; index += 1) {
    const row = matrix[index] ?? [];
    if (!rowHasValue(row)) {
      continue;
    }

    const objectRow: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      objectRow[header] = normalizeCell(row[columnIndex]);
    });
    rows.push(objectRow);
  }

  return rows;
};

const detectHeaderInsideBlock = (block: unknown[][]): number => {
  const maxScan = Math.min(block.length, 6);
  let bestIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < maxScan; index += 1) {
    const cells = (block[index] ?? []).map((cell) => normalizeCell(cell)).filter(Boolean);
    if (cells.length < 2) {
      continue;
    }

    const hasName = cells.some((cell) => hasAlias(cell, NAME_HEADERS));
    const hasRoll = cells.some((cell) => hasAlias(cell, ROLL_HEADERS));
    const score = cells.length + (hasName ? 3 : 0) + (hasRoll ? 3 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
};

const parseWorksheetTables = (sheet: XLSX.WorkSheet, sheetName: string): SpreadsheetTableCandidate[] => {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true
  });

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return [];
  }

  const blocks: Array<{ start: number; end: number }> = [];
  let start = -1;

  for (let index = 0; index < matrix.length; index += 1) {
    const hasValue = rowHasValue(matrix[index] ?? []);
    if (hasValue && start < 0) {
      start = index;
    }

    if (!hasValue && start >= 0) {
      blocks.push({ start, end: index - 1 });
      start = -1;
    }
  }

  if (start >= 0) {
    blocks.push({ start, end: matrix.length - 1 });
  }

  const tables: SpreadsheetTableCandidate[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockRows = matrix.slice(block.start, block.end + 1);
    if (blockRows.length < 2) {
      return;
    }

    const headerOffset = detectHeaderInsideBlock(blockRows);
    const headerRowIndex = block.start + headerOffset;
    const dataStart = headerRowIndex + 1;

    if (dataStart > block.end) {
      return;
    }

    const rows = buildRowsFromHeader(matrix, headerRowIndex, dataStart, block.end);
    const headers = extractRowHeaders(rows);

    if (rows.length === 0 || headers.length < 2) {
      return;
    }

    tables.push({
      id: `${sheetName}::${blockIndex + 1}`,
      label: `${sheetName} - Table ${blockIndex + 1}`,
      sheet_name: sheetName,
      table_index: blockIndex + 1,
      row_count: rows.length,
      headers,
      rows
    });
  });

  if (tables.length > 0) {
    return tables;
  }

  const headerRowIndex = findHeaderRowIndex(matrix);

  if (headerRowIndex < 0) {
    const fallbackRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const fallbackHeaders = extractRowHeaders(fallbackRows);

    if (fallbackRows.length === 0) {
      return [];
    }

    return [
      {
        id: `${sheetName}::1`,
        label: `${sheetName} - Table 1`,
        sheet_name: sheetName,
        table_index: 1,
        row_count: fallbackRows.length,
        headers: fallbackHeaders,
        rows: fallbackRows
      }
    ];
  }

  const rows = buildRowsFromHeader(matrix, headerRowIndex, headerRowIndex + 1, matrix.length - 1);
  const headers = extractRowHeaders(rows);

  if (rows.length === 0) {
    return [];
  }

  return [
    {
      id: `${sheetName}::1`,
      label: `${sheetName} - Table 1`,
      sheet_name: sheetName,
      table_index: 1,
      row_count: rows.length,
      headers,
      rows
    }
  ];
};
