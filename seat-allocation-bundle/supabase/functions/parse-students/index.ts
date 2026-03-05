import { errorResponse, jsonResponse, corsHeaders } from '../_shared/http.ts';
import { createServiceClient, requireUser } from '../_shared/auth.ts';
import { normalizeRows, parseCsvRows, parseXlsxRows } from '../_shared/seat-utils.ts';
import type { ParsedStudentRow, ParseStudentsResponse } from '../_shared/types.ts';

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const toObjectRows = (rows: unknown[]): Record<string, unknown>[] =>
  rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => row as Record<string, unknown>);

const normalizeInputRows = (rows: unknown[]): {
  validRows: ParsedStudentRow[];
  invalidRows: Array<{ row_index: number; reason: string; raw_row: Record<string, unknown> }>;
  duplicatesInPayload: string[];
} => {
  const fallbackObjectRows = toObjectRows(rows);

  if (fallbackObjectRows.length === 0) {
    return {
      validRows: [],
      invalidRows: [],
      duplicatesInPayload: [],
    };
  }

  const fullyNormalized = fallbackObjectRows.every((row) => 'name' in row && 'roll_number' in row);
  if (!fullyNormalized) {
    return normalizeRows(fallbackObjectRows);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const validRows: ParsedStudentRow[] = [];
  const invalidRows: Array<{ row_index: number; reason: string; raw_row: Record<string, unknown> }> = [];

  fallbackObjectRows.forEach((row, index) => {
    const name = String(row.name ?? '').trim();
    const roll_number = String(row.roll_number ?? '').trim();
    const department = String(row.department ?? '').trim();

    if (!name || !roll_number) {
      invalidRows.push({
        row_index: index + 1,
        reason: 'Missing required name or roll number.',
        raw_row: row,
      });
      return;
    }

    const key = roll_number.toLowerCase();
    if (seen.has(key)) {
      duplicates.add(roll_number);
      invalidRows.push({
        row_index: index + 1,
        reason: `Duplicate roll number in payload: ${roll_number}`,
        raw_row: row,
      });
      return;
    }

    seen.add(key);
    validRows.push({
      name,
      roll_number,
      department: department || null,
      row_index: index + 1,
      raw_row: row,
    });
  });

  return {
    validRows,
    invalidRows,
    duplicatesInPayload: Array.from(duplicates.values()),
  };
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

  const contentType = req.headers.get('content-type') ?? '';
  const uploadSessionId = crypto.randomUUID();

  let source: 'xlsx' | 'csv' | 'pdf' = 'csv';
  let validRows: ParsedStudentRow[] = [];
  let invalidRows: Array<{ row_index: number; reason: string; raw_row: Record<string, unknown> }> = [];
  let duplicateRolls: string[] = [];
  let targetUploadSessionId = uploadSessionId;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const providedUploadSession = form.get('upload_session_id');

      if (!(file instanceof File)) {
        return errorResponse('INVALID_FILE', 'File is required in multipart request.');
      }

      if (typeof providedUploadSession === 'string' && providedUploadSession.trim()) {
        targetUploadSessionId = providedUploadSession;
      }

      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'xlsx' || extension === 'xls') {
        source = 'xlsx';
      } else if (extension === 'csv') {
        source = 'csv';
      } else {
        return errorResponse('UNSUPPORTED_FILE_TYPE', 'Only .xlsx and .csv are accepted in multipart mode.');
      }

      const parsedRows =
        source === 'csv'
          ? parseCsvRows(await file.text())
          : parseXlsxRows(await file.arrayBuffer());

      const normalized = normalizeRows(parsedRows);
      validRows = normalized.validRows;
      invalidRows = normalized.invalidRows;
      duplicateRolls = normalized.duplicatesInPayload;

      const storagePath = `owner/${user.id}/session/${targetUploadSessionId}/${sanitizeFilename(file.name)}`;
      const storage = createServiceClient();
      const { error: uploadError } = await storage.storage
        .from('seat-uploads')
        .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) {
        return errorResponse('STORAGE_UPLOAD_FAILED', 'Failed to store uploaded file.', uploadError.message, 500);
      }
    } else {
      const payload = await req.json().catch(() => null);
      if (!payload || !Array.isArray(payload.rows)) {
        return errorResponse(
          'INVALID_PAYLOAD',
          'Expected JSON payload: { source: "xlsx"|"csv"|"pdf", rows: ParsedRow[], upload_session_id? }.',
        );
      }

      const payloadSource = String(payload.source ?? '').toLowerCase();
      if (payloadSource === 'xlsx' || payloadSource === 'csv' || payloadSource === 'pdf') {
        source = payloadSource;
      }

      if (typeof payload.upload_session_id === 'string' && payload.upload_session_id.trim()) {
        targetUploadSessionId = payload.upload_session_id;
      }

      const normalized = normalizeInputRows(payload.rows as unknown[]);
      validRows = normalized.validRows;
      invalidRows = normalized.invalidRows;
      duplicateRolls = normalized.duplicatesInPayload;
    }
  } catch (parseError) {
    return errorResponse('PARSE_FAILED', 'Unable to parse uploaded rows.', (parseError as Error).message);
  }

  if (validRows.length === 0) {
    const response: ParseStudentsResponse = {
      upload_session_id: targetUploadSessionId,
      parsed_count: 0,
      duplicate_rolls: duplicateRolls,
      invalid_rows: invalidRows,
    };

    return jsonResponse(response);
  }

  const { data: existingRows, error: existingError } = await client
    .from('students_temp')
    .select('roll_number')
    .eq('owner_id', user.id)
    .eq('upload_session_id', targetUploadSessionId);

  if (existingError) {
    return errorResponse('DB_READ_FAILED', 'Failed to validate existing upload rows.', existingError.message, 500);
  }

  const existingSet = new Set((existingRows ?? []).map((row: any) => String(row.roll_number).toLowerCase()));
  const insertRows = validRows.filter((row) => {
    const key = row.roll_number.toLowerCase();
    if (existingSet.has(key)) {
      duplicateRolls.push(row.roll_number);
      return false;
    }
    existingSet.add(key);
    return true;
  });

  if (insertRows.length > 0) {
    const payload = insertRows.map((row) => ({
      owner_id: user.id,
      name: row.name,
      roll_number: row.roll_number,
      department: row.department ?? null,
      upload_session_id: targetUploadSessionId,
      parse_source: source,
      raw_row: row.raw_row ?? null,
    }));

    const { error: insertError } = await client.from('students_temp').insert(payload);
    if (insertError) {
      return errorResponse('DB_INSERT_FAILED', 'Failed to store parsed student rows.', insertError.message, 500);
    }
  }

  const response: ParseStudentsResponse = {
    upload_session_id: targetUploadSessionId,
    parsed_count: insertRows.length,
    duplicate_rolls: Array.from(new Set(duplicateRolls.map((value) => value.trim()).filter(Boolean))),
    invalid_rows: invalidRows,
  };

  return jsonResponse(response);
});
