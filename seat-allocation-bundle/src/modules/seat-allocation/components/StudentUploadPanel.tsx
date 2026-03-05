import { useMemo, useState } from 'react';
import {
  detectHeaderMapping,
  detectParseSource,
  extractRowHeaders,
  normalizeParsedRowsWithMapping,
  parsePdfRows,
  parseSpreadsheetTables,
  type SpreadsheetTableCandidate,
  type HeaderMapping,
} from '../lib/seatParsing';
import type { InvalidParsedRow, ParseStudentsResult, ParsedRow } from '../types/seat';

interface StudentUploadPanelProps {
  uploadSessionId: string | null;
  onParsed: (result: ParseStudentsResult, previewRows: ParsedRow[]) => void;
  onSubmitRows: (params: {
    rows: ParsedRow[];
    source: 'xlsx' | 'csv' | 'pdf';
    uploadSessionId?: string;
    fileName?: string;
  }) => Promise<ParseStudentsResult>;
}

const StudentUploadPanel = ({ uploadSessionId, onParsed, onSubmitRows }: StudentUploadPanelProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<HeaderMapping>({ nameKey: null, rollKey: null, departmentKey: null });
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseStudentsResult | null>(null);
  const [tables, setTables] = useState<SpreadsheetTableCandidate[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const hasPreview = useMemo(() => previewRows.length > 0 || invalidRows.length > 0, [previewRows, invalidRows]);
  const hasRequiredMapping = Boolean(mapping.nameKey && mapping.rollKey);

  const rebuildPreview = (rows: Record<string, unknown>[], nextMapping: HeaderMapping) => {
    const normalized = normalizeParsedRowsWithMapping(rows, nextMapping);
    setPreviewRows(normalized.parsedRows);
    setInvalidRows(normalized.invalidRows);
  };

  const buildMergedTable = (candidates: SpreadsheetTableCandidate[]): SpreadsheetTableCandidate => {
    const mergedRows = candidates.flatMap((table) => table.rows);
    const mergedHeaders = extractRowHeaders(mergedRows);
    return {
      id: '__all__',
      label: 'All detected tables (Merged)',
      sheet_name: 'Merged',
      table_index: 0,
      row_count: mergedRows.length,
      headers: mergedHeaders,
      rows: mergedRows,
    };
  };

  const applyTableSelection = (table: SpreadsheetTableCandidate) => {
    const extractedHeaders = table.headers.length > 0 ? table.headers : extractRowHeaders(table.rows);
    const detectedMapping = detectHeaderMapping(extractedHeaders);
    setSelectedTableId(table.id);
    setRawRows(table.rows);
    setHeaders(extractedHeaders);
    setMapping(detectedMapping);
    rebuildPreview(table.rows, detectedMapping);
  };

  const pickBestTable = (candidates: SpreadsheetTableCandidate[]) => {
    if (candidates.length === 0) {
      return null;
    }

    const scored = [...candidates].sort((a, b) => {
      const mappingA = detectHeaderMapping(a.headers);
      const mappingB = detectHeaderMapping(b.headers);
      const scoreA = (mappingA.nameKey && mappingA.rollKey ? 1000 : 0) + a.row_count;
      const scoreB = (mappingB.nameKey && mappingB.rollKey ? 1000 : 0) + b.row_count;
      return scoreB - scoreA;
    });

    return scored[0];
  };

  const buildPreview = async (targetFile: File) => {
    const source = detectParseSource(targetFile.name);
    if (!source) {
      throw new Error('Unsupported file type. Upload .xlsx, .csv, or .pdf');
    }

    let detectedTables: SpreadsheetTableCandidate[] = [];
    if (source === 'pdf') {
      const rows = await parsePdfRows(targetFile);
      detectedTables = [
        {
          id: 'pdf::1',
          label: 'PDF - Extracted Table',
          sheet_name: 'PDF',
          table_index: 1,
          row_count: rows.length,
          headers: extractRowHeaders(rows),
          rows,
        },
      ];
    } else {
      detectedTables = await parseSpreadsheetTables(targetFile);
    }

    if (detectedTables.length === 0) {
      throw new Error('No tables detected in this file. Upload a file that contains at least one tabular block.');
    }

    const finalTables =
      source !== 'pdf' && detectedTables.length > 1
        ? [buildMergedTable(detectedTables), ...detectedTables]
        : detectedTables;

    setTables(finalTables);
    const bestTable =
      finalTables.find((table) => table.id === '__all__') ?? pickBestTable(finalTables);
    if (!bestTable) {
      throw new Error('No usable table was found.');
    }
    applyTableSelection(bestTable);
  };

  const submit = async () => {
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    const source = detectParseSource(file.name);
    if (!source) {
      setError('Unsupported file type. Upload .xlsx, .csv, or .pdf');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!hasRequiredMapping) {
        throw new Error('Map Name and Roll Number columns before uploading.');
      }

      if (previewRows.length === 0) {
        throw new Error('No valid rows found with current mapping. Update column mapping or verify file data.');
      }

      const payload = await onSubmitRows({
        rows: previewRows,
        source,
        uploadSessionId: uploadSessionId ?? undefined,
        fileName: file.name,
      });

      setResult(payload);
      onParsed(payload, previewRows);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="premium-panel rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Student Upload</h3>
        <p className="text-sm text-ink-600">Upload XLSX/CSV/PDF. System auto-detects all tabular blocks and extracts needed student fields.</p>
      </div>

      <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={async (event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);
            setResult(null);
            setError(null);
            setRawRows([]);
            setHeaders([]);
            setMapping({ nameKey: null, rollKey: null, departmentKey: null });
            setPreviewRows([]);
            setInvalidRows([]);
            setTables([]);
            setSelectedTableId(null);

            if (!nextFile) {
              return;
            }

            try {
              await buildPreview(nextFile);
            } catch (previewError) {
              setError((previewError as Error).message);
            }
          }}
          className="w-full text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-2 text-xs text-ink-500">
          Any sheet headers are allowed. Map Name and Roll Number columns below. Each upload creates a fresh session.
        </p>
      </div>

      {tables.length > 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Detected Tables</p>
            <p className="text-xs text-ink-500">All detected tables (Merged) is selected by default for full coverage.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {tables.map((table) => {
              const active = selectedTableId === table.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => applyTableSelection(table)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${active ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700'}`}
                >
                  <p className="text-sm font-semibold">{table.label}</p>
                  <p className={`text-xs ${active ? 'text-ink-100' : 'text-ink-500'}`}>
                    Rows: {table.row_count} · Columns: {table.headers.length}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {headers.length > 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Column Mapping</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Name Column</span>
              <select
                value={mapping.nameKey ?? ''}
                className="premium-input w-full px-3 py-2 text-sm"
                onChange={(event) => {
                  const next = { ...mapping, nameKey: event.target.value || null };
                  setMapping(next);
                  rebuildPreview(rawRows, next);
                }}
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`name-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Roll Number Column</span>
              <select
                value={mapping.rollKey ?? ''}
                className="premium-input w-full px-3 py-2 text-sm"
                onChange={(event) => {
                  const next = { ...mapping, rollKey: event.target.value || null };
                  setMapping(next);
                  rebuildPreview(rawRows, next);
                }}
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`roll-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Department Column (Optional)</span>
              <select
                value={mapping.departmentKey ?? ''}
                className="premium-input w-full px-3 py-2 text-sm"
                onChange={(event) => {
                  const next = { ...mapping, departmentKey: event.target.value || null };
                  setMapping(next);
                  rebuildPreview(rawRows, next);
                }}
              >
                <option value="">None</option>
                {headers.map((header) => (
                  <option key={`dept-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={submit}
          disabled={busy || !file || (headers.length > 0 && !hasRequiredMapping)}
        >
          {busy ? 'Processing...' : 'Upload & Validate'}
        </button>
        {uploadSessionId ? (
          <span className="text-xs text-ink-500">Session: {uploadSessionId}</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
          Parsed {result.parsed_count} records. Duplicates: {result.duplicate_rolls.length}. Invalid rows: {result.invalid_rows.length}.
        </div>
      ) : null}

      {hasPreview ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Parsed Preview</div>
            <div className="text-xs text-ink-500">Showing {Math.min(previewRows.length, 30)} of {previewRows.length} rows</div>
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Roll Number</th>
                  <th className="px-3 py-2 text-left">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {previewRows.slice(0, 30).map((row, idx) => (
                  <tr key={`${row.roll_number}-${idx}`}>
                    <td className="px-3 py-2 text-ink-500">{row.row_index ?? idx + 1}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.roll_number}</td>
                    <td className="px-3 py-2">{row.department ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidRows.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Invalid rows detected: {invalidRows.length}</p>
              <ul className="mt-2 space-y-1">
                {invalidRows.slice(0, 5).map((row) => (
                  <li key={`invalid-${row.row_index}`}>Row {row.row_index}: {row.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default StudentUploadPanel;
