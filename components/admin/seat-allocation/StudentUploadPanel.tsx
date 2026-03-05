"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  detectHeaderMapping,
  detectParseSource,
  extractRowHeaders,
  normalizeParsedRowsWithMapping,
  parsePdfRows,
  parseSpreadsheetTables
} from "@/lib/seat-allocation/seatParsing";
import type {
  HeaderMapping,
  ParseStudentsResult,
  ParsedRow,
  SpreadsheetTableCandidate
} from "@/lib/seat-allocation/types";

interface StudentUploadPanelProps {
  uploadSessionId: string | null;
  onParsed: (result: ParseStudentsResult, previewRows: ParsedRow[]) => void;
  onSubmitRows: (params: {
    rows: ParsedRow[];
    source: "xlsx" | "csv" | "pdf";
    upload_session_id?: string;
  }) => Promise<ParseStudentsResult>;
}

export function StudentUploadPanel({ uploadSessionId, onParsed, onSubmitRows }: StudentUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<SpreadsheetTableCandidate[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<HeaderMapping>({
    nameKey: null,
    rollKey: null,
    departmentKey: null
  });
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ParseStudentsResult["invalid_rows"]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRequiredMapping = Boolean(mapping.nameKey && mapping.rollKey);
  const validCount = previewRows.length;
  const invalidCount = invalidRows.length;

  const summaryText = useMemo(() => {
    if (validCount === 0 && invalidCount === 0) {
      return "Upload a file to preview and validate student rows.";
    }

    return `${validCount} valid rows, ${invalidCount} invalid rows`;
  }, [invalidCount, validCount]);

  const clearState = () => {
    setTables([]);
    setSelectedTableId(null);
    setRawRows([]);
    setHeaders([]);
    setMapping({ nameKey: null, rollKey: null, departmentKey: null });
    setPreviewRows([]);
    setInvalidRows([]);
  };

  const applyPreview = (rows: Record<string, unknown>[], nextMapping: HeaderMapping) => {
    const normalized = normalizeParsedRowsWithMapping(rows, nextMapping);
    setPreviewRows(normalized.parsedRows);
    setInvalidRows(normalized.invalidRows);
  };

  const chooseTable = (table: SpreadsheetTableCandidate) => {
    const extractedHeaders = table.headers.length > 0 ? table.headers : extractRowHeaders(table.rows);
    const detectedMapping = detectHeaderMapping(extractedHeaders);

    setSelectedTableId(table.id);
    setRawRows(table.rows);
    setHeaders(extractedHeaders);
    setMapping(detectedMapping);
    applyPreview(table.rows, detectedMapping);
  };

  const buildMergedTable = (candidates: SpreadsheetTableCandidate[]): SpreadsheetTableCandidate => {
    const mergedRows = candidates.flatMap((table) => table.rows);
    const mergedHeaders = extractRowHeaders(mergedRows);

    return {
      id: "__all__",
      label: "All detected tables (Merged)",
      sheet_name: "Merged",
      table_index: 0,
      row_count: mergedRows.length,
      headers: mergedHeaders,
      rows: mergedRows
    };
  };

  const detectBestTable = (candidates: SpreadsheetTableCandidate[]): SpreadsheetTableCandidate | null => {
    if (candidates.length === 0) {
      return null;
    }

    const sorted = [...candidates].sort((left, right) => {
      const leftMap = detectHeaderMapping(left.headers);
      const rightMap = detectHeaderMapping(right.headers);
      const leftScore = (leftMap.nameKey && leftMap.rollKey ? 1_000 : 0) + left.row_count;
      const rightScore = (rightMap.nameKey && rightMap.rollKey ? 1_000 : 0) + right.row_count;
      return rightScore - leftScore;
    });

    return sorted[0] ?? null;
  };

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
    clearState();

    if (!nextFile) {
      return;
    }

    try {
      const source = detectParseSource(nextFile.name);
      if (!source) {
        throw new Error("Unsupported file type. Use .xlsx, .csv, or .pdf.");
      }

      let detectedTables: SpreadsheetTableCandidate[];

      if (source === "pdf") {
        const rows = await parsePdfRows(nextFile);
        detectedTables = [
          {
            id: "pdf::1",
            label: "PDF - Extracted Table",
            sheet_name: "PDF",
            table_index: 1,
            row_count: rows.length,
            headers: extractRowHeaders(rows),
            rows
          }
        ];
      } else {
        detectedTables = await parseSpreadsheetTables(nextFile);
      }

      if (detectedTables.length === 0) {
        throw new Error("No valid table found in this file.");
      }

      const tablesToUse = source !== "pdf" && detectedTables.length > 1
        ? [buildMergedTable(detectedTables), ...detectedTables]
        : detectedTables;

      setTables(tablesToUse);

      const best = tablesToUse.find((table) => table.id === "__all__") ?? detectBestTable(tablesToUse);
      if (!best) {
        throw new Error("Could not detect a usable table.");
      }

      chooseTable(best);
    } catch (fileError) {
      const nextError = fileError instanceof Error ? fileError.message : "Failed to read file.";
      setError(nextError);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    const source = detectParseSource(file.name);
    if (!source) {
      setError("Unsupported file type. Use .xlsx, .csv, or .pdf.");
      return;
    }

    if (!hasRequiredMapping) {
      setError("Map Name and Roll Number columns before uploading.");
      return;
    }

    if (previewRows.length === 0) {
      setError("No valid rows available for upload.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onSubmitRows({
        rows: previewRows,
        source,
        upload_session_id: uploadSessionId ?? undefined
      });

      onParsed(result, previewRows);
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Upload failed.";
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Student Upload</h3>
          <p className="text-sm text-neutral-600">Upload CSV/XLSX/PDF and map Name + Roll Number columns.</p>
        </div>
        <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Session {uploadSessionId ? "active" : "new"}
        </Badge>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <Label htmlFor="seat-upload-file" className="text-sm font-medium text-neutral-700">
          Upload file
        </Label>
        <Input
          id="seat-upload-file"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(event) => {
            void handleFileChange(event.target.files?.[0] ?? null);
          }}
          className="mt-2"
          disabled={submitting}
        />
        <p className="mt-2 text-xs text-neutral-500">Auto-detects tables and validates duplicates before save.</p>
      </div>

      {tables.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Detected tables</p>
          <div className="grid gap-2 md:grid-cols-2">
            {tables.map((table) => {
              const isActive = table.id === selectedTableId;
              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => chooseTable(table)}
                  className={[
                    "rounded-md border px-3 py-2 text-left transition",
                    isActive
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold">{table.label}</p>
                  <p className="text-xs text-neutral-500">
                    Rows: {table.row_count} | Columns: {table.headers.length}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {headers.length > 0 ? (
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Column mapping</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="map-name">Name column</Label>
              <select
                id="map-name"
                value={mapping.nameKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, nameKey: event.target.value || null };
                  setMapping(next);
                  applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-300"
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`name-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-roll">Roll column</Label>
              <select
                id="map-roll"
                value={mapping.rollKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, rollKey: event.target.value || null };
                  setMapping(next);
                  applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-300"
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`roll-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-dept">Department column (optional)</Label>
              <select
                id="map-dept"
                value={mapping.departmentKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, departmentKey: event.target.value || null };
                  setMapping(next);
                  applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-300"
              >
                <option value="">None</option>
                {headers.map((header) => (
                  <option key={`dept-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void handleSubmit()} disabled={submitting || !file || !hasRequiredMapping}>
          <UploadCloud className="h-4 w-4" />
          {submitting ? "Uploading..." : "Upload & Validate"}
        </Button>
        <span className="text-xs text-neutral-600">{summaryText}</span>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {(previewRows.length > 0 || invalidRows.length > 0) ? (
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Row</th>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Roll Number</th>
                <th className="px-3 py-2 text-left font-semibold">Department</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {previewRows.slice(0, 30).map((row) => (
                <tr key={`valid-${row.row_index}-${row.roll_number}`}>
                  <td className="px-3 py-2 text-neutral-600">{row.row_index ?? "-"}</td>
                  <td className="px-3 py-2 text-neutral-900">{row.name}</td>
                  <td className="px-3 py-2 text-neutral-800">{row.roll_number}</td>
                  <td className="px-3 py-2 text-neutral-700">{row.department ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Valid
                    </span>
                  </td>
                </tr>
              ))}
              {invalidRows.slice(0, 20).map((row) => (
                <tr key={`invalid-${row.row_index}-${row.reason}`} className="bg-red-50/50">
                  <td className="px-3 py-2 text-red-700">{row.row_index}</td>
                  <td className="px-3 py-2 text-red-700" colSpan={3}>
                    {row.reason}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-700">
                      Invalid
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
