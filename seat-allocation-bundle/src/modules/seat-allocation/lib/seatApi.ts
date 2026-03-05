import { supabase } from '../../../lib/supabase';
import { buildSeatNumbersForLab, compareSeatNumbers, sortStudents } from './seatAllocationEngine';
import type {
  AllocationMode,
  AllocationPreviewGroup,
  AllocationRecord,
  AllocationSession,
  EdgeFunctionsHealth,
  DocumentGenerationResult,
  DocumentSettings,
  GenerateDocumentsPayload,
  Lab,
  ParseStudentsResult,
  ParsedRow,
  SeatAllocationResult,
  StudentTemp,
  TableColumnAlign,
  TableColumnConfig,
  TableStyleConfig,
} from '../types/seat';

const DEFAULT_DOCUMENT_SETTINGS: Omit<DocumentSettings, 'id' | 'owner_id' | 'created_at' | 'updated_at'> = {
  institute_name: 'Central Corporate Relations, Training and Placement Cell (CN-CRTP)',
  exam_title: 'MIT ADT University',
  subject: 'Seat Allocation & Attendance',
  logo_url: null,
  footer_text: 'MIT ADT University',
};

const EDGE_UNREACHABLE_TEXT = 'Failed to send a request to the Edge Function';
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

export const DEFAULT_TABLE_STYLE: TableStyleConfig = {
  font_size: 10,
  header_font_size: 10.5,
  row_height: 19,
  header_row_height: 20,
  cell_padding_x: 4,
  cell_padding_y: 4,
  line_width: 0.5,
  section_gap: 18,
};

const isEdgeFunctionUnreachable = (error: unknown): boolean => {
  const message = (error as { message?: string })?.message ?? String(error ?? '');
  const normalized = message.toLowerCase();
  return (
    normalized.includes(EDGE_UNREACHABLE_TEXT.toLowerCase()) ||
    normalized.includes('network error') ||
    normalized.includes('failed to fetch')
  );
};

const requireUserId = async (): Promise<string> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('You must be logged in to continue.');
  }

  return user.id;
};

const toApiError = (error: any): Error => {
  const message = error?.message ?? (typeof error === 'string' ? error : '');
  if (typeof message === 'string' && message.includes(EDGE_UNREACHABLE_TEXT)) {
    return new Error(
      'Failed to reach Supabase Edge Function. Deploy functions (`parse-students`, `allocate-seats`, `generate-documents`) and verify project URL/anon key.',
    );
  }

  if (error?.message) {
    return new Error(error.message);
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Unexpected API error');
};

const unwrapFunctionResult = <T>(payload: any): T => {
  if (payload?.error) {
    throw toApiError(payload.error);
  }

  return payload as T;
};

const normalizeLab = (row: any): Lab => ({
  id: row.id,
  owner_id: row.owner_id,
  lab_name: row.lab_name,
  total_seats: row.total_seats,
  rows: row.rows,
  columns: row.columns,
  seat_pattern: row.seat_pattern,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const normalizeStudent = (row: any): StudentTemp => ({
  id: row.id,
  owner_id: row.owner_id,
  upload_session_id: row.upload_session_id,
  name: row.name,
  roll_number: row.roll_number,
  department: row.department,
  parse_source: row.parse_source,
  raw_row: row.raw_row,
  created_at: row.created_at,
});

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

const buildExtraValues = (student?: StudentTemp): Record<string, string> => {
  const values: Record<string, string> = {};
  if (!student) {
    return values;
  }

  const raw = student.raw_row && typeof student.raw_row === 'object' ? student.raw_row : null;
  if (raw) {
    Object.entries(raw).forEach(([key, value]) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return;
      }
      values[normalizedKey] = stringifyCellValue(value);
    });
  }

  if (student.department && !values.Department) {
    values.Department = student.department;
  }

  return values;
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
const VALID_ALIGNS: TableColumnAlign[] = ['left', 'center', 'right'];
const MIN_COLUMN_WIDTH = 56;
const MAX_COLUMN_WIDTH = 280;
const DEFAULT_EXTRA_COLUMN_WIDTH = 88;
const DEFAULT_COLUMN_PADDING_X = 4;
const DEFAULT_COLUMN_PADDING_Y = 4;
const SYSTEM_COLUMN_DEFAULTS: TableColumnConfig[] = [
  {
    key: 'seat_no',
    label: 'Seat No',
    align: 'left',
    width: 66,
    padding_x: 4,
    padding_y: 4,
    enabled: true,
    source: 'system',
    applies_to: 'both',
  },
  {
    key: 'roll_no',
    label: 'Roll No',
    align: 'center',
    width: 76,
    padding_x: 4,
    padding_y: 4,
    enabled: true,
    source: 'system',
    applies_to: 'both',
  },
  {
    key: 'student_name',
    label: 'Student Name',
    align: 'left',
    width: 176,
    padding_x: 4,
    padding_y: 4,
    enabled: true,
    source: 'system',
    applies_to: 'both',
  },
  {
    key: 'class_room_no',
    label: 'Class Room No',
    align: 'center',
    width: 114,
    padding_x: 4,
    padding_y: 4,
    enabled: true,
    source: 'system',
    applies_to: 'both',
  },
  {
    key: 'signature',
    label: 'Signature',
    align: 'center',
    width: 98,
    padding_x: 4,
    padding_y: 4,
    enabled: true,
    source: 'system',
    applies_to: 'attendance',
  },
];

const isValidAlign = (value: unknown): value is TableColumnAlign => VALID_ALIGNS.includes(value as TableColumnAlign);
const isSystemColumnKey = (key: string) => SYSTEM_COLUMN_DEFAULTS.some((column) => column.key === key);
const normalizeColumnWidth = (value: unknown, fallback: number) => {
  const width = Number(value);
  if (!Number.isFinite(width)) {
    return fallback;
  }
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
};
const normalizeColumnPadding = (value: unknown, fallback: number) => {
  const padding = Number(value);
  if (!Number.isFinite(padding)) {
    return fallback;
  }
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, Math.round(padding)));
};
const normalizeTableNumber = (value: unknown, fallback: number, min: number, max: number, decimals = 0) => {
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

export const sanitizeTableStyle = (style?: Partial<TableStyleConfig> | null): TableStyleConfig => ({
  font_size: normalizeTableNumber(style?.font_size, DEFAULT_TABLE_STYLE.font_size, MIN_FONT_SIZE, MAX_FONT_SIZE, 1),
  header_font_size: normalizeTableNumber(
    style?.header_font_size,
    DEFAULT_TABLE_STYLE.header_font_size,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    1,
  ),
  row_height: normalizeTableNumber(style?.row_height, DEFAULT_TABLE_STYLE.row_height, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT),
  header_row_height: normalizeTableNumber(
    style?.header_row_height,
    DEFAULT_TABLE_STYLE.header_row_height,
    MIN_ROW_HEIGHT,
    MAX_ROW_HEIGHT,
  ),
  cell_padding_x: normalizeTableNumber(style?.cell_padding_x, DEFAULT_TABLE_STYLE.cell_padding_x, MIN_PADDING, MAX_PADDING),
  cell_padding_y: normalizeTableNumber(style?.cell_padding_y, DEFAULT_TABLE_STYLE.cell_padding_y, MIN_PADDING, MAX_PADDING),
  line_width: normalizeTableNumber(style?.line_width, DEFAULT_TABLE_STYLE.line_width, MIN_LINE_WIDTH, MAX_LINE_WIDTH, 2),
  section_gap: normalizeTableNumber(style?.section_gap, DEFAULT_TABLE_STYLE.section_gap, MIN_SECTION_GAP, MAX_SECTION_GAP),
});

const sanitizeColumnSelection = (columns?: string[]) => {
  const unique: string[] = [];
  (columns ?? []).forEach((column) => {
    const key = String(column ?? '').trim();
    if (!key) {
      return;
    }
    if (RESERVED_COLUMN_KEYS.has(key.toLowerCase())) {
      return;
    }
    if (!unique.includes(key)) {
      unique.push(key);
    }
  });
  return unique;
};

const sanitizeExtraColumnName = (name: string): string | null => {
  const key = String(name ?? '').trim();
  if (!key) {
    return null;
  }
  if (RESERVED_COLUMN_KEYS.has(key.toLowerCase())) {
    return null;
  }
  return key;
};

const toExtraColumnKey = (name: string) => `${EXTRA_COLUMN_PREFIX}${name}`;
const fromExtraColumnKey = (key: string) => key.slice(EXTRA_COLUMN_PREFIX.length);

export const buildColumnConfigs = (
  extraColumns: string[],
  inputConfigs?: TableColumnConfig[],
  selectedColumns?: string[],
): TableColumnConfig[] => {
  const allowedExtras = sanitizeColumnSelection(extraColumns);
  const allowedExtraSet = new Set(allowedExtras.map((column) => column.toLowerCase()));
  const base = SYSTEM_COLUMN_DEFAULTS.map((column) => ({ ...column }));

  if (Array.isArray(inputConfigs) && inputConfigs.length > 0) {
    const normalized: TableColumnConfig[] = [];
    const seenKeys = new Set<string>();

    inputConfigs.forEach((item) => {
      const rawKey = String(item?.key ?? '').trim();
      if (!rawKey || seenKeys.has(rawKey)) {
        return;
      }

      let key = rawKey;
      if (!isSystemColumnKey(rawKey) && !rawKey.startsWith(EXTRA_COLUMN_PREFIX)) {
        const sanitizedName = sanitizeExtraColumnName(rawKey);
        if (!sanitizedName) {
          return;
        }
        key = toExtraColumnKey(sanitizedName);
      }

      if (key.startsWith(EXTRA_COLUMN_PREFIX)) {
        const extraName = sanitizeExtraColumnName(fromExtraColumnKey(key));
        if (!extraName) {
          return;
        }
        if (!allowedExtraSet.has(extraName.toLowerCase())) {
          return;
        }
        key = toExtraColumnKey(extraName);
      }

      const defaultConfig = base.find((column) => column.key === key);
      const label = String(item?.label ?? defaultConfig?.label ?? '').trim();

      normalized.push({
        key,
        label: label || defaultConfig?.label || (key.startsWith(EXTRA_COLUMN_PREFIX) ? fromExtraColumnKey(key) : key),
        align: isValidAlign(item?.align) ? item.align : defaultConfig?.align ?? 'left',
        width: normalizeColumnWidth(item?.width, defaultConfig?.width ?? DEFAULT_EXTRA_COLUMN_WIDTH),
        padding_x: normalizeColumnPadding(item?.padding_x, defaultConfig?.padding_x ?? DEFAULT_COLUMN_PADDING_X),
        padding_y: normalizeColumnPadding(item?.padding_y, defaultConfig?.padding_y ?? DEFAULT_COLUMN_PADDING_Y),
        enabled: item?.enabled !== false,
        source: key.startsWith(EXTRA_COLUMN_PREFIX) ? 'extra' : 'system',
        applies_to: key === 'signature' ? 'attendance' : 'both',
      });
      seenKeys.add(key);
    });

    base.forEach((systemColumn) => {
      if (!seenKeys.has(systemColumn.key)) {
        normalized.push(systemColumn);
        seenKeys.add(systemColumn.key);
      }
    });

    allowedExtras.forEach((columnName) => {
      const key = toExtraColumnKey(columnName);
      if (!seenKeys.has(key)) {
        normalized.push({
          key,
          label: columnName,
          align: 'left',
          width: DEFAULT_EXTRA_COLUMN_WIDTH,
          padding_x: DEFAULT_COLUMN_PADDING_X,
          padding_y: DEFAULT_COLUMN_PADDING_Y,
          enabled: false,
          source: 'extra',
          applies_to: 'both',
        });
      }
    });

    return normalized;
  }

  const selected = sanitizeColumnSelection(selectedColumns);
  const selectedSet = new Set(selected.map((column) => column.toLowerCase()));
  const extras = allowedExtras.map((columnName) => ({
    key: toExtraColumnKey(columnName),
    label: columnName,
    align: 'left' as TableColumnAlign,
    width: DEFAULT_EXTRA_COLUMN_WIDTH,
    padding_x: DEFAULT_COLUMN_PADDING_X,
    padding_y: DEFAULT_COLUMN_PADDING_Y,
    enabled: selectedSet.has(columnName.toLowerCase()),
    source: 'extra' as const,
    applies_to: 'both' as const,
  }));

  return [...base, ...extras];
};

const normalizeSession = (row: any): AllocationSession => ({
  id: row.id,
  owner_id: row.owner_id,
  upload_session_id: row.upload_session_id,
  mode: row.mode as AllocationMode,
  status: row.status,
  seed: row.seed,
  metadata: row.metadata,
  created_at: row.created_at,
});

const probeFunctionReachability = async (fnName: string, body: Record<string, unknown>) => {
  const { error } = await supabase.functions.invoke(fnName, { body });
  if (!error) {
    return true;
  }
  return !isEdgeFunctionUnreachable(error);
};

export const listLabs = async (): Promise<Lab[]> => {
  const { data, error } = await supabase
    .from('labs')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw toApiError(error);
  }

  return (data ?? []).map(normalizeLab);
};

export const createLab = async (payload: {
  lab_name: string;
  total_seats: number;
  rows?: number | null;
  columns?: number | null;
  seat_pattern?: string;
}): Promise<Lab> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be logged in to create a lab.');
  }
  const totalSeats = Number(payload.total_seats);
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    throw new Error('Total seats must be a positive integer.');
  }

  const { data, error } = await supabase
    .from('labs')
    .insert({
      owner_id: user.id,
      lab_name: payload.lab_name.trim(),
      total_seats: totalSeats,
      rows: payload.rows ?? null,
      columns: payload.columns ?? null,
      seat_pattern: payload.seat_pattern ?? 'numeric',
    })
    .select('*')
    .single();

  if (error) {
    throw toApiError(error);
  }

  return normalizeLab(data);
};

export const updateLab = async (
  labId: string,
  payload: {
    lab_name: string;
    total_seats: number;
    rows?: number | null;
    columns?: number | null;
    seat_pattern?: string;
  },
): Promise<Lab> => {
  const totalSeats = Number(payload.total_seats);
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
    throw new Error('Total seats must be a positive integer.');
  }

  const { data, error } = await supabase
    .from('labs')
    .update({
      lab_name: payload.lab_name.trim(),
      total_seats: totalSeats,
      rows: payload.rows ?? null,
      columns: payload.columns ?? null,
      seat_pattern: payload.seat_pattern ?? 'numeric',
      updated_at: new Date().toISOString(),
    })
    .eq('id', labId)
    .select('*')
    .single();

  if (error) {
    throw toApiError(error);
  }

  return normalizeLab(data);
};

export const deleteLab = async (labId: string): Promise<void> => {
  const { error } = await supabase.from('labs').delete().eq('id', labId);
  if (error) {
    throw toApiError(error);
  }
};

export const getDocumentSettings = async (): Promise<DocumentSettings | null> => {
  const { data, error } = await supabase
    .from('document_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw toApiError(error);
  }

  if (!data) {
    return null;
  }

  return data as DocumentSettings;
};

export const uploadBrandLogo = async (file: File): Promise<string> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be logged in to upload a logo.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `owner/${user.id}/branding/logo.${ext}`;

  const { error: uploadError } = await supabase.storage.from('seat-assets').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw toApiError(uploadError);
  }

  const { data } = supabase.storage.from('seat-assets').getPublicUrl(path);
  return data.publicUrl;
};

export const saveDocumentSettings = async (payload: {
  institute_name?: string;
  exam_title?: string;
  subject?: string;
  logo_url?: string | null;
  footer_text?: string | null;
}): Promise<DocumentSettings> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be logged in to update document settings.');
  }

  const current = await getDocumentSettings();
  const next = {
    ...(current ?? DEFAULT_DOCUMENT_SETTINGS),
    ...payload,
  };

  const upsertPayload: Record<string, unknown> = {
    owner_id: user.id,
    institute_name: next.institute_name,
    exam_title: next.exam_title,
    subject: next.subject,
    logo_url: next.logo_url,
    footer_text: next.footer_text,
    updated_at: new Date().toISOString(),
  };
  if (current?.id) {
    upsertPayload.id = current.id;
  }

  const { data, error } = await supabase
    .from('document_settings')
    .upsert(upsertPayload)
    .select('*')
    .single();

  if (error) {
    throw toApiError(error);
  }

  return data as DocumentSettings;
};

export const parseStudentsFromNormalizedRows = async (
  params: {
    rows: ParsedRow[];
    source: 'xlsx' | 'csv' | 'pdf';
    upload_session_id?: string;
    file_name?: string;
  },
): Promise<ParseStudentsResult> => {
  const { data, error } = await supabase.functions.invoke('parse-students', {
    body: {
      source: params.source,
      rows: params.rows,
      upload_session_id: params.upload_session_id,
      file_name: params.file_name,
    },
  });

  if (error) {
    if (isEdgeFunctionUnreachable(error)) {
      console.warn('parse-students edge function unreachable. Using client fallback.');
      return parseStudentsFallback(params);
    }
    throw toApiError(error);
  }

  return unwrapFunctionResult<ParseStudentsResult>(data);
};

const parseStudentsFallback = async (params: {
  rows: ParsedRow[];
  source: 'xlsx' | 'csv' | 'pdf';
  upload_session_id?: string;
}): Promise<ParseStudentsResult> => {
  const userId = await requireUserId();
  const uploadSessionId = params.upload_session_id ?? crypto.randomUUID();

  const { data: existingRows, error: existingError } = await supabase
    .from('students_temp')
    .select('roll_number')
    .eq('owner_id', userId)
    .eq('upload_session_id', uploadSessionId);

  if (existingError) {
    throw toApiError(existingError);
  }

  const existingRolls = new Set((existingRows ?? []).map((row: any) => String(row.roll_number).toLowerCase()));
  const seenPayload = new Set<string>();
  const duplicateRolls: string[] = [];
  const invalidRows: ParseStudentsResult['invalid_rows'] = [];

  const validRows = params.rows
    .map((row, index) => ({
      row_index: row.row_index ?? index + 1,
      name: String(row.name ?? '').trim(),
      roll_number: String(row.roll_number ?? '').trim(),
      department: row.department?.trim() || null,
      raw_row: (row.raw_row ?? { ...row }) as Record<string, unknown>,
    }))
    .filter((row) => {
      if (!row.name || !row.roll_number) {
        invalidRows.push({
          row_index: row.row_index,
          reason: 'Missing required name or roll number.',
          raw_row: (row.raw_row ?? {}) as Record<string, unknown>,
        });
        return false;
      }

      const payloadKey = row.roll_number.toLowerCase();
      if (seenPayload.has(payloadKey)) {
        duplicateRolls.push(row.roll_number);
        invalidRows.push({
          row_index: row.row_index,
          reason: `Duplicate roll number in payload: ${row.roll_number}`,
          raw_row: (row.raw_row ?? {}) as Record<string, unknown>,
        });
        return false;
      }

      seenPayload.add(payloadKey);

      if (existingRolls.has(payloadKey)) {
        duplicateRolls.push(row.roll_number);
        return false;
      }

      existingRolls.add(payloadKey);
      return true;
    });

  if (validRows.length > 0) {
    const insertPayload = validRows.map((row) => ({
      owner_id: userId,
      name: row.name,
      roll_number: row.roll_number,
      department: row.department,
      upload_session_id: uploadSessionId,
      parse_source: params.source,
      raw_row: row.raw_row,
    }));

    const { error: insertError } = await supabase.from('students_temp').insert(insertPayload);
    if (insertError) {
      throw toApiError(insertError);
    }
  }

  return {
    upload_session_id: uploadSessionId,
    parsed_count: validRows.length,
    duplicate_rolls: Array.from(new Set(duplicateRolls)),
    invalid_rows: invalidRows,
  };
};

export const listStudentsByUploadSession = async (uploadSessionId: string): Promise<StudentTemp[]> => {
  const { data, error } = await supabase
    .from('students_temp')
    .select('*')
    .eq('upload_session_id', uploadSessionId)
    .order('roll_number', { ascending: true });

  if (error) {
    throw toApiError(error);
  }

  return (data ?? []).map(normalizeStudent);
};

export const runSeatAllocation = async (payload: {
  lab_ids: string[];
  mode?: AllocationMode;
  upload_session_id: string;
}): Promise<SeatAllocationResult> => {
  const { data, error } = await supabase.functions.invoke('allocate-seats', {
    body: payload,
  });

  if (error) {
    if (isEdgeFunctionUnreachable(error)) {
      console.warn('allocate-seats edge function unreachable. Using client fallback.');
      return runSeatAllocationFallback(payload);
    }
    throw toApiError(error);
  }

  return unwrapFunctionResult<SeatAllocationResult>(data);
};

const runSeatAllocationFallback = async (payload: {
  lab_ids: string[];
  mode?: AllocationMode;
  upload_session_id: string;
}): Promise<SeatAllocationResult> => {
  const userId = await requireUserId();
  const mode: AllocationMode = payload.mode === 'random' ? 'random' : 'alphabetical';
  const uniqueLabIds = Array.from(new Set(payload.lab_ids.filter(Boolean)));

  if (uniqueLabIds.length === 0) {
    throw new Error('Select at least one lab.');
  }

  const [{ data: labsData, error: labsError }, { data: studentsData, error: studentsError }] = await Promise.all([
    supabase
      .from('labs')
      .select('id, lab_name, total_seats, rows, columns, owner_id, seat_pattern, created_at, updated_at')
      .eq('owner_id', userId)
      .in('id', uniqueLabIds),
    supabase
      .from('students_temp')
      .select('*')
      .eq('owner_id', userId)
      .eq('upload_session_id', payload.upload_session_id),
  ]);

  if (labsError) {
    throw toApiError(labsError);
  }
  if (studentsError) {
    throw toApiError(studentsError);
  }

  const labs = (labsData ?? []).map(normalizeLab);
  const students = (studentsData ?? []).map(normalizeStudent);

  if (labs.length !== uniqueLabIds.length) {
    throw new Error('One or more selected labs are invalid.');
  }
  if (students.length === 0) {
    throw new Error('No students found for this upload session.');
  }

  const labOrder = new Map(uniqueLabIds.map((labId, index) => [labId, index]));
  const orderedLabs = [...labs].sort((a, b) => (labOrder.get(a.id) ?? 0) - (labOrder.get(b.id) ?? 0));
  const seed = mode === 'random' ? Math.floor(Math.random() * 1_000_000_000) : 0;

  const sortedStudents = sortStudents(
    students.map((student) => ({
      id: student.id,
      name: student.name,
      roll_number: student.roll_number,
      department: student.department ?? undefined,
    })) as Array<ParsedRow & { id: string }>,
    mode,
    seed,
  ) as Array<ParsedRow & { id: string }>;

  const totalCapacity = orderedLabs.reduce((sum, lab) => sum + lab.total_seats, 0);

  const { data: sessionRow, error: sessionError } = await supabase
    .from('allocation_sessions')
    .insert({
      owner_id: userId,
      upload_session_id: payload.upload_session_id,
      mode,
      status: sortedStudents.length > totalCapacity ? 'completed_with_overflow' : 'completed',
      seed: mode === 'random' ? seed : null,
      metadata: {
        generated_by: 'client_fallback',
        lab_ids: uniqueLabIds,
        total_students: sortedStudents.length,
        total_capacity: totalCapacity,
      },
    })
    .select('id')
    .single();

  if (sessionError || !sessionRow) {
    throw toApiError(sessionError);
  }

  const seatSummary = orderedLabs.map((lab) => ({
    lab_id: lab.id,
    lab_name: lab.lab_name,
    allocated_count: 0,
    total_seats: lab.total_seats,
  }));

  const allocationRows: Array<{
    owner_id: string;
    student_id: string;
    lab_id: string;
    seat_number: string;
    session_id: string;
  }> = [];

  let pointer = 0;
  for (const lab of orderedLabs) {
    const seats = buildSeatNumbersForLab(lab);
    for (const seat of seats) {
      const student = sortedStudents[pointer];
      if (!student) {
        break;
      }

      allocationRows.push({
        owner_id: userId,
        student_id: student.id,
        lab_id: lab.id,
        seat_number: seat,
        session_id: sessionRow.id,
      });

      const summary = seatSummary.find((item) => item.lab_id === lab.id);
      if (summary) {
        summary.allocated_count += 1;
      }
      pointer += 1;
    }

    if (pointer >= sortedStudents.length) {
      break;
    }
  }

  if (allocationRows.length > 0) {
    const { error: insertError } = await supabase.from('allocations').insert(allocationRows);
    if (insertError) {
      throw toApiError(insertError);
    }
  }

  return {
    session_id: sessionRow.id,
    mode,
    upload_session_id: payload.upload_session_id,
    seat_summary: seatSummary,
    overflow_students: sortedStudents.slice(pointer).map((student) => ({
      student_id: student.id,
      name: student.name,
      roll_number: student.roll_number,
    })),
  };
};

export const listAllocationSessions = async (limit = 20): Promise<AllocationSession[]> => {
  const { data, error } = await supabase
    .from('allocation_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw toApiError(error);
  }

  return (data ?? []).map(normalizeSession);
};

const getSessionLabOrder = async (sessionId: string): Promise<Map<string, number>> => {
  const { data, error } = await supabase
    .from('allocation_sessions')
    .select('metadata')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw toApiError(error);
  }

  const metadata = data?.metadata as Record<string, unknown> | null | undefined;
  const labIds = Array.isArray(metadata?.lab_ids) ? metadata.lab_ids.map((value) => String(value)).filter(Boolean) : [];
  return new Map(labIds.map((labId, index) => [labId, index]));
};

export const getAllocationRecords = async (sessionId: string): Promise<AllocationRecord[]> => {
  const [labOrder, recordsQuery] = await Promise.all([
    getSessionLabOrder(sessionId),
    supabase
      .from('allocations')
      .select(
        `
        id,
        owner_id,
        student_id,
        lab_id,
        seat_number,
        session_id,
        created_at,
        students_temp!allocations_student_id_fkey(id, name, roll_number, department, upload_session_id, owner_id, parse_source, raw_row, created_at),
        labs!allocations_lab_id_fkey(id, owner_id, lab_name, total_seats, rows, columns, seat_pattern, created_at, updated_at)
      `,
      )
      .eq('session_id', sessionId),
  ]);

  const { data, error } = recordsQuery;

  if (error) {
    throw toApiError(error);
  }

  const records = (data ?? []).map((row: any) => ({
    id: row.id,
    owner_id: row.owner_id,
    student_id: row.student_id,
    lab_id: row.lab_id,
    seat_number: row.seat_number,
    session_id: row.session_id,
    created_at: row.created_at,
    student: row.students_temp ? normalizeStudent(row.students_temp) : undefined,
    lab: row.labs ? normalizeLab(row.labs) : undefined,
  }));

  records.sort((a, b) => {
    const aLab = a.lab?.id ?? a.lab_id;
    const bLab = b.lab?.id ?? b.lab_id;
    const aRank = labOrder.get(aLab);
    const bRank = labOrder.get(bLab);

    if (typeof aRank === 'number' && typeof bRank === 'number' && aRank !== bRank) {
      return aRank - bRank;
    }

    if (typeof aRank === 'number' && typeof bRank !== 'number') {
      return -1;
    }

    if (typeof aRank !== 'number' && typeof bRank === 'number') {
      return 1;
    }

    const labNameCompare = (a.lab?.lab_name ?? aLab).localeCompare(b.lab?.lab_name ?? bLab, undefined, {
      sensitivity: 'base',
    });
    if (labNameCompare !== 0) {
      return labNameCompare;
    }

    return compareSeatNumbers(a.seat_number, b.seat_number);
  });

  return records;
};

export const getAllocationPreview = async (sessionId: string): Promise<AllocationPreviewGroup[]> => {
  const records = await getAllocationRecords(sessionId);
  const grouped = new Map<string, AllocationPreviewGroup>();

  records.forEach((record) => {
    const labId = record.lab?.id ?? record.lab_id;
    const labName = record.lab?.lab_name ?? 'Unknown Lab';

    if (!grouped.has(labId)) {
      grouped.set(labId, {
        lab: { id: labId, name: labName },
        rows: [],
      });
    }

    grouped.get(labId)?.rows.push({
      seat_number: record.seat_number,
      roll_number: record.student?.roll_number ?? '-',
      student_name: record.student?.name ?? '-',
      department: record.student?.department ?? null,
      extra_values: buildExtraValues(record.student),
    });
  });

  const groups = Array.from(grouped.values());
  groups.forEach((group) => {
    group.rows.sort((a, b) => compareSeatNumbers(a.seat_number, b.seat_number));
  });
  return groups;
};

export const listSessionColumnOptions = async (sessionId: string): Promise<string[]> => {
  const records = await getAllocationRecords(sessionId);
  const discovered: string[] = [];

  records.forEach((record) => {
    const extras = buildExtraValues(record.student);
    Object.keys(extras).forEach((key) => {
      const normalized = key.trim();
      if (!normalized) {
        return;
      }
      if (RESERVED_COLUMN_KEYS.has(normalized.toLowerCase())) {
        return;
      }
      if (!discovered.includes(normalized)) {
        discovered.push(normalized);
      }
    });
  });

  return discovered;
};

export const generateDocuments = async (payload: GenerateDocumentsPayload): Promise<DocumentGenerationResult> => {
  const { data, error } = await supabase.functions.invoke('generate-documents', {
    body: payload,
  });

  if (error) {
    if (isEdgeFunctionUnreachable(error)) {
      console.warn('generate-documents edge function unreachable. Using client fallback.');
      return generateDocumentsFallback(payload);
    }
    throw toApiError(error);
  }

  return unwrapFunctionResult<DocumentGenerationResult>(data);
};

export const deleteGeneratedDocuments = async (sessionId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('generate-documents', {
    body: {
      action: 'delete',
      session_id: sessionId,
    },
  });

  if (!error) {
    return;
  }

  if (!isEdgeFunctionUnreachable(error)) {
    throw toApiError(error);
  }

  const userId = await requireUserId();
  const paths = [
    `owner/${userId}/allocation/${sessionId}/seating.pdf`,
    `owner/${userId}/allocation/${sessionId}/attendance.pdf`,
    `owner/${userId}/allocation/${sessionId}/allocation-attendance.xlsx`,
  ];

  const { error: storageError } = await supabase.storage.from('seat-documents').remove(paths);
  if (storageError) {
    throw toApiError(storageError);
  }
};

const generateDocumentsFallback = async (payload: GenerateDocumentsPayload): Promise<DocumentGenerationResult> => {
  const previewGroups = await getAllocationPreview(payload.session_id);
  const tableStyle = sanitizeTableStyle(payload.table_style);
  const discoveredExtraColumns = Array.from(
    new Set(
      previewGroups.flatMap((group) =>
        group.rows.flatMap((row) =>
          Object.keys(row.extra_values ?? {}).filter((key) => !RESERVED_COLUMN_KEYS.has(key.toLowerCase())),
        ),
      ),
    ),
  );
  const columnConfigs = buildColumnConfigs(discoveredExtraColumns, payload.column_configs, payload.selected_columns);
  const seatingColumns = columnConfigs.filter((column) => column.enabled && column.applies_to === 'both');
  const attendanceColumns = columnConfigs.filter((column) => column.enabled);

  if (previewGroups.length === 0) {
    throw new Error('No allocations found for document generation.');
  }

  if (seatingColumns.length === 0) {
    throw new Error('Enable at least one column for seating document.');
  }

  if (attendanceColumns.length === 0) {
    throw new Error('Enable at least one column for attendance document.');
  }

  const settings = await getDocumentSettings();
  const resolveHeaderText = (value: string | null | undefined, fallback: string) => {
    const normalized = String(value ?? '').trim();
    if (!normalized || /placepro/i.test(normalized)) {
      return fallback;
    }
    return normalized;
  };

  const eventTitle = resolveHeaderText(settings?.exam_title, '');
  const footerText = resolveHeaderText(settings?.footer_text, DEFAULT_DOCUMENT_SETTINGS.footer_text ?? '');
  const normalizeDateValue = (value: string | null | undefined) => {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return new Date().toISOString().slice(0, 10);
    }
    return raw;
  };
  const formatDocumentDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return value;
  };
  const documentDate = formatDocumentDate(normalizeDateValue(settings?.subject));

  let seatPdfUrl: string | undefined;
  let attendancePdfUrl: string | undefined;
  let workbookUrl: string | undefined;
  const headlineLines = [
    'Central Corporate Relations, Training and Placement',
    'Cell (CN-CRTP)',
  ];

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Unable to read logo file.'));
      reader.readAsDataURL(blob);
    });

  const resolveLogoDataUrl = async (): Promise<string | null> => {
    try {
      const response = await fetch('/mit-adt-logo-transparent.png');
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch {
      return null;
    }
  };

  const logoDataUrl = await resolveLogoDataUrl();

  if (payload.formats.includes('pdf')) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const resolveCellValue = (
      row: AllocationPreviewGroup['rows'][number],
      labName: string,
      columnKey: string,
    ) => {
      if (columnKey === 'seat_no') return row.seat_number;
      if (columnKey === 'roll_no') return row.roll_number;
      if (columnKey === 'student_name') return row.student_name;
      if (columnKey === 'class_room_no') return labName;
      if (columnKey === 'signature') return '';
      if (columnKey.startsWith(EXTRA_COLUMN_PREFIX)) {
        return row.extra_values?.[fromExtraColumnKey(columnKey)] ?? '';
      }
      return '';
    };

    const buildColumnStyles = (columns: TableColumnConfig[]) => {
      const styles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {};
      columns.forEach((column, index) => {
        styles[index] = { cellWidth: normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH), halign: column.align };
      });
      return styles;
    };

    const buildPdf = (mode: 'seating' | 'attendance') => {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const cleanEventTitle = eventTitle.trim();
      const hasEventTitle = cleanEventTitle.length > 0;
      const tableStartY = hasEventTitle ? 130 + tableStyle.section_gap : 124 + tableStyle.section_gap;
      const activeColumns = mode === 'seating' ? seatingColumns : attendanceColumns;
      const columnStyles = buildColumnStyles(activeColumns);
      const alignmentByIndex = new Map(activeColumns.map((column, index) => [index, column.align]));
      const paddingByIndex = new Map(
        activeColumns.map((column, index) => [
          index,
          {
            left: normalizeColumnPadding(column.padding_x, tableStyle.cell_padding_x),
            right: normalizeColumnPadding(column.padding_x, tableStyle.cell_padding_x),
            top: normalizeColumnPadding(column.padding_y, tableStyle.cell_padding_y),
            bottom: normalizeColumnPadding(column.padding_y, tableStyle.cell_padding_y),
          },
        ]),
      );

      const fitFontSize = (text: string, maxWidth: number, preferred: number, min: number) => {
        let size = preferred;
        while (size > min) {
          doc.setFontSize(size);
          if (doc.getTextWidth(text) <= maxWidth) {
            return size;
          }
          size -= 0.5;
        }
        return min;
      };

      const drawHeader = (labName: string) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, hasEventTitle ? 170 : 150, 'F');
        doc.setDrawColor(20, 20, 20);
        doc.setLineWidth(1);
        doc.line(40, 112, pageWidth - 40, 112);

        let logoLeftEdge = pageWidth - 40;

        doc.setFont('times', 'bold');
        if (logoDataUrl) {
          const format = logoDataUrl.includes('image/jpeg') || logoDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
          try {
            const props = doc.getImageProperties(logoDataUrl);
            const maxWidth = 128;
            const maxHeight = 72;
            const widthScale = maxWidth / props.width;
            const heightScale = maxHeight / props.height;
            const scale = Math.min(1, widthScale, heightScale);
            const drawWidth = props.width * scale;
            const drawHeight = props.height * scale;
            const drawX = pageWidth - 48 - drawWidth;
            logoLeftEdge = drawX;
            doc.addImage(logoDataUrl, format, drawX, 24, drawWidth, drawHeight);
          } catch {
            // Ignore invalid image type issues.
          }
        }

        const headingMaxWidth = Math.max(250, logoLeftEdge - 56);
        const headingSize = Math.min(
          fitFontSize(headlineLines[0], headingMaxWidth, 17, 12),
          fitFontSize(headlineLines[1], headingMaxWidth, 17, 12),
        );

        doc.setTextColor(10, 10, 10);
        doc.setFontSize(headingSize);
        doc.text(headlineLines[0], 40, 42);
        doc.setFontSize(headingSize);
        doc.text(headlineLines[1], 40, 64);

        doc.setTextColor(20, 20, 20);
        doc.setFontSize(10.5);
        doc.text(`${mode === 'seating' ? 'Seating Allocation Sheet' : 'Attendance Sheet'} | Lab: ${labName}`, 40, 88);

        doc.setFontSize(9.5);
        doc.setTextColor(33, 33, 33);
        doc.text(`Date: ${documentDate}`, 40, 102);

        if (hasEventTitle) {
          doc.setTextColor(14, 30, 72);
          doc.setFontSize(10.5);
          doc.text(cleanEventTitle, pageWidth / 2, 130, { align: 'center' });
        }
      };

      previewGroups.forEach((group, index) => {
        if (index > 0) {
          doc.addPage();
        }

        autoTable(doc, {
          startY: tableStartY,
          head: [activeColumns.map((column) => column.label)],
          body: group.rows.map((row) => activeColumns.map((column) => resolveCellValue(row, group.lab.name, column.key))),
          theme: 'grid',
          styles: {
            fontSize: tableStyle.font_size,
            cellPadding: {
              top: tableStyle.cell_padding_y,
              right: tableStyle.cell_padding_x,
              bottom: tableStyle.cell_padding_y,
              left: tableStyle.cell_padding_x,
            },
            textColor: [20, 20, 20],
            lineColor: [75, 75, 75],
            lineWidth: tableStyle.line_width,
            font: 'times',
            overflow: 'linebreak',
            valign: 'middle',
            minCellHeight: tableStyle.row_height,
          },
          tableWidth: pageWidth - 80,
          columnStyles,
          headStyles: {
            fillColor: [245, 245, 245],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            fontSize: tableStyle.header_font_size,
            minCellHeight: tableStyle.header_row_height,
          },
          didParseCell: (hookData) => {
            const align = alignmentByIndex.get(hookData.column.index);
            if (align) {
              hookData.cell.styles.halign = align;
            }
            const padding = paddingByIndex.get(hookData.column.index);
            if (padding) {
              hookData.cell.styles.cellPadding = padding;
            }
          },
          margin: { top: tableStartY, left: 40, right: 40, bottom: 42 },
          willDrawPage: () => {
            drawHeader(group.lab.name);
          },
        });
      });

      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(72, 80, 96);

        if (footerText) {
          doc.text(footerText, 40, pageHeight - 20);
        }

        doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 108, pageHeight - 20);
      }

      return doc.output('blob');
    };

    seatPdfUrl = URL.createObjectURL(buildPdf('seating'));
    attendancePdfUrl = URL.createObjectURL(buildPdf('attendance'));
  }

  if (payload.formats.includes('xlsx')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    const buildUniqueLabels = (columns: TableColumnConfig[]) => {
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

    const resolveCellValue = (
      row: AllocationPreviewGroup['rows'][number],
      labName: string,
      columnKey: string,
    ): string => {
      if (columnKey === 'seat_no') return row.seat_number;
      if (columnKey === 'roll_no') return row.roll_number;
      if (columnKey === 'student_name') return row.student_name;
      if (columnKey === 'class_room_no') return labName;
      if (columnKey === 'signature') return '';
      if (columnKey.startsWith(EXTRA_COLUMN_PREFIX)) {
        return row.extra_values?.[fromExtraColumnKey(columnKey)] ?? '';
      }
      return '';
    };

    previewGroups.forEach((group) => {
      const allocationRows = group.rows.map((row) =>
        Object.fromEntries(
          seatingColumns.map((column) => [seatingLabels[column.key], resolveCellValue(row, group.lab.name, column.key)]),
        ),
      );

      const attendanceRows = group.rows.map((row) =>
        Object.fromEntries(
          attendanceColumns.map((column) => [
            attendanceLabels[column.key],
            resolveCellValue(row, group.lab.name, column.key),
          ]),
        ),
      );

      const safeLab = group.lab.name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 22);
      const allocationSheet = XLSX.utils.json_to_sheet(allocationRows);
      const attendanceSheet = XLSX.utils.json_to_sheet(attendanceRows);
      allocationSheet['!cols'] = seatingColumns.map((column) => ({
        wch: Math.max(8, Math.round(normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH) / 7)),
      }));
      attendanceSheet['!cols'] = attendanceColumns.map((column) => ({
        wch: Math.max(8, Math.round(normalizeColumnWidth(column.width, DEFAULT_EXTRA_COLUMN_WIDTH) / 7)),
      }));
      const headerRowPt = Math.max(10, Math.round(tableStyle.header_row_height * 0.75));
      const bodyRowPt = Math.max(10, Math.round(tableStyle.row_height * 0.75));
      allocationSheet['!rows'] = [{ hpt: headerRowPt }, ...allocationRows.map(() => ({ hpt: bodyRowPt }))];
      attendanceSheet['!rows'] = [{ hpt: headerRowPt }, ...attendanceRows.map(() => ({ hpt: bodyRowPt }))];

      XLSX.utils.book_append_sheet(workbook, allocationSheet, `Allocation_${safeLab}`);
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, `Attendance_${safeLab}`);
    });

    const workbookData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    workbookUrl = URL.createObjectURL(
      new Blob([workbookData], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  }

  return {
    seat_pdf_url: seatPdfUrl,
    attendance_pdf_url: attendancePdfUrl,
    workbook_url: workbookUrl,
    generated_at: new Date().toISOString(),
  };
};

export const checkSeatEdgeFunctionsHealth = async (): Promise<EdgeFunctionsHealth> => {
  const [parseOk, allocateOk, generateOk] = await Promise.all([
    probeFunctionReachability('parse-students', {
      source: 'csv',
      rows: [],
      upload_session_id: crypto.randomUUID(),
    }),
    probeFunctionReachability('allocate-seats', {
      lab_ids: [],
      mode: 'alphabetical',
      upload_session_id: crypto.randomUUID(),
    }),
    probeFunctionReachability('generate-documents', {
      session_id: crypto.randomUUID(),
      formats: ['pdf'],
      excel_mode: 'per_lab',
    }),
  ]);

  return {
    parse_students: parseOk,
    allocate_seats: allocateOk,
    generate_documents: generateOk,
  };
};
