import * as XLSX from 'npm:xlsx@0.18.5';
import type { AllocationMode, ParsedStudentRow } from './types.ts';

const NAME_HEADERS = [
  'name',
  'student name',
  'full name',
  'name of student',
  'name of the student',
  'candidate name',
  'student',
];
const ROLL_HEADERS = [
  'roll no',
  'roll number',
  'roll',
  'id',
  'student id',
  'enrollment no',
  'enrollment number',
  'enrolment no',
  'enrolment number',
  'registration no',
  'reg no',
  'prn',
];
const DEPARTMENT_HEADERS = ['department', 'dept', 'branch', 'program', 'programme', 'class'];

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeValue = (value: unknown) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim());

const findHeader = (headers: string[], aliases: string[]) => {
  const normalized = aliases.map(normalizeHeader);
  return headers.find((header) => normalized.includes(normalizeHeader(header))) ?? null;
};

const rowLabel = (index: number): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let remaining = index;
  let label = '';

  do {
    label = alphabet[remaining % 26] + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);

  return label;
};

export const parseXlsxRows = (buffer: ArrayBuffer): Record<string, unknown>[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
};

export const parseCsvRows = (text: string): Record<string, unknown>[] => {
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
};

export const normalizeRows = (
  rows: Record<string, unknown>[],
): {
  validRows: ParsedStudentRow[];
  invalidRows: Array<{ row_index: number; reason: string; raw_row: Record<string, unknown> }>;
  duplicatesInPayload: string[];
} => {
  if (rows.length === 0) {
    return {
      validRows: [],
      invalidRows: [],
      duplicatesInPayload: [],
    };
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const nameKey = findHeader(headers, NAME_HEADERS);
  const rollKey = findHeader(headers, ROLL_HEADERS);
  const departmentKey = findHeader(headers, DEPARTMENT_HEADERS);

  if (!nameKey || !rollKey) {
    return {
      validRows: [],
      invalidRows: rows.map((row, index) => ({
        row_index: index + 1,
        reason: 'Missing accepted name/roll columns.',
        raw_row: row,
      })),
      duplicatesInPayload: [],
    };
  }

  const validRows: ParsedStudentRow[] = [];
  const invalidRows: Array<{ row_index: number; reason: string; raw_row: Record<string, unknown> }> = [];
  const localRolls = new Set<string>();
  const duplicatesInPayload = new Set<string>();

  rows.forEach((row, index) => {
    const rawName = normalizeValue(row[nameKey]);
    const rawRoll = normalizeValue(row[rollKey]);
    const rawDepartment = departmentKey ? normalizeValue(row[departmentKey]) : '';

    const isBlank = Object.values(row).every((value) => normalizeValue(value) === '');
    if (isBlank) {
      return;
    }

    if (!rawName || !rawRoll) {
      invalidRows.push({
        row_index: index + 1,
        reason: 'Missing required name or roll number.',
        raw_row: row,
      });
      return;
    }

    const key = rawRoll.toLowerCase();
    if (localRolls.has(key)) {
      duplicatesInPayload.add(rawRoll);
      invalidRows.push({
        row_index: index + 1,
        reason: `Duplicate roll number in payload: ${rawRoll}`,
        raw_row: row,
      });
      return;
    }

    localRolls.add(key);
    validRows.push({
      name: rawName,
      roll_number: rawRoll,
      department: rawDepartment || null,
      row_index: index + 1,
      raw_row: row,
    });
  });

  return {
    validRows,
    invalidRows,
    duplicatesInPayload: Array.from(duplicatesInPayload.values()),
  };
};

export const sortStudents = (students: ParsedStudentRow[], mode: AllocationMode, seed: number): ParsedStudentRow[] => {
  const list = [...students];

  if (mode === 'random') {
    let state = seed % 2147483647;
    if (state <= 0) {
      state += 2147483646;
    }

    const next = () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };

    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    return list;
  }

  return list.sort((a, b) => {
    const rollCompare = a.roll_number.localeCompare(b.roll_number, undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    if (rollCompare !== 0) {
      return rollCompare;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
};

export const generateSeatNumbers = (params: {
  totalSeats: number;
  rows?: number | null;
  columns?: number | null;
}): string[] => {
  const total = Math.max(0, params.totalSeats || 0);
  if (total === 0) {
    return [];
  }

  const rowCount = params.rows ?? 0;
  const colCount = params.columns ?? 0;

  if (rowCount > 0 && colCount > 0) {
    const labels: string[] = [];
    let rowIndex = 0;

    while (labels.length < total) {
      for (let col = 1; col <= colCount && labels.length < total; col += 1) {
        labels.push(`${rowLabel(rowIndex)}${col}`);
      }
      rowIndex += 1;
    }

    return labels;
  }

  return Array.from({ length: total }, (_, index) => `${index + 1}`);
};

export const sanitizeSheetName = (input: string) =>
  input
    .replace(/[\\/*?:\[\]]/g, ' ')
    .trim()
    .slice(0, 28) || 'Sheet';

const splitSeatToken = (value: string) => {
  const token = String(value ?? '').trim();
  const match = token.match(/^([A-Za-z]+)?(\d+)$/);
  if (!match) {
    return {
      prefix: '',
      number: Number.NaN,
      raw: token,
    };
  }

  return {
    prefix: (match[1] ?? '').toUpperCase(),
    number: Number(match[2]),
    raw: token,
  };
};

export const compareSeatNumbers = (left: string, right: string): number => {
  const a = splitSeatToken(left);
  const b = splitSeatToken(right);

  const aNumeric = a.prefix === '' && Number.isFinite(a.number);
  const bNumeric = b.prefix === '' && Number.isFinite(b.number);
  if (aNumeric && bNumeric) {
    return a.number - b.number;
  }

  const aStructured = Number.isFinite(a.number);
  const bStructured = Number.isFinite(b.number);
  if (aStructured && bStructured) {
    const prefixCompare = a.prefix.localeCompare(b.prefix, undefined, { sensitivity: 'base' });
    if (prefixCompare !== 0) {
      return prefixCompare;
    }
    return a.number - b.number;
  }

  return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: 'base' });
};
