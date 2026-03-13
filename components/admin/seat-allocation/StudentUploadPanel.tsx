"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CandidateHeaderMapping,
  ImportSeatCandidatesResult,
  ParseSource,
  SeatSession,
  SeatUploadRow,
  SpreadsheetTableCandidate
} from "@/lib/seat-allocation/types";

const loadSeatParsing = () => import("@/lib/seat-allocation/seatParsing");

interface StudentUploadPanelProps {
  session: SeatSession | null;
  onImportRows: (params: {
    sessionId: string;
    rows: SeatUploadRow[];
    source: ParseSource;
  }) => Promise<ImportSeatCandidatesResult>;
  onImported: (result: ImportSeatCandidatesResult) => void;
  onDownloadTemplate: () => Promise<void>;
}

export function StudentUploadPanel({ session, onImportRows, onImported, onDownloadTemplate }: StudentUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<SpreadsheetTableCandidate[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CandidateHeaderMapping>({
    prnKey: null,
    nameKey: null,
    branchKey: null
  });
  const [previewRows, setPreviewRows] = useState<SeatUploadRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<Array<{ row_index: number; reason: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableUploadSession = session && session.source_mode === "upload" && !session.is_published ? session : null;
  const summaryText = useMemo(() => {
    if (previewRows.length === 0 && invalidRows.length === 0) {
      return "Upload a file to preview Enrollment Numbers before importing them into a draft session.";
    }

    return `${previewRows.length} rows ready, ${invalidRows.length} invalid rows`;
  }, [invalidRows.length, previewRows.length]);

  const clearState = () => {
    setTables([]);
    setSelectedTableId(null);
    setRawRows([]);
    setHeaders([]);
    setMapping({ prnKey: null, nameKey: null, branchKey: null });
    setPreviewRows([]);
    setInvalidRows([]);
  };

  const applyPreview = async (rows: Record<string, unknown>[], nextMapping: CandidateHeaderMapping) => {
    const { normalizeParsedRowsWithMapping } = await loadSeatParsing();
    const normalized = normalizeParsedRowsWithMapping(rows, nextMapping);
    setPreviewRows(normalized.parsedRows);
    setInvalidRows(
      normalized.invalidRows.map((row) => ({
        row_index: row.row_index,
        reason: row.reason
      }))
    );
  };

  const chooseTable = async (table: SpreadsheetTableCandidate) => {
    const { detectHeaderMapping, extractRowHeaders } = await loadSeatParsing();
    const extractedHeaders = table.headers.length > 0 ? table.headers : extractRowHeaders(table.rows);
    const detectedMapping = detectHeaderMapping(extractedHeaders);

    setSelectedTableId(table.id);
    setRawRows(table.rows);
    setHeaders(extractedHeaders);
    setMapping(detectedMapping);
    await applyPreview(table.rows, detectedMapping);
  };

  const buildMergedTable = async (candidates: SpreadsheetTableCandidate[]): Promise<SpreadsheetTableCandidate> => {
    const { extractRowHeaders } = await loadSeatParsing();
    const mergedRows = candidates.flatMap((table) => table.rows);

    return {
      id: "__all__",
      label: "All detected tables (Merged)",
      sheet_name: "Merged",
      table_index: 0,
      row_count: mergedRows.length,
      headers: extractRowHeaders(mergedRows),
      rows: mergedRows
    };
  };

  const detectBestTable = (candidates: SpreadsheetTableCandidate[]): SpreadsheetTableCandidate | null => {
    if (candidates.length === 0) {
      return null;
    }

    const sorted = [...candidates].sort((left, right) => {
      const leftHeaders = left.headers.map((header) => header.toLowerCase());
      const rightHeaders = right.headers.map((header) => header.toLowerCase());
      const leftScore =
        (leftHeaders.some((header) => header.includes("prn") || header.includes("enroll") || header.includes("enrol"))
          ? 1000
          : 0) + left.row_count;
      const rightScore =
        (rightHeaders.some((header) => header.includes("prn") || header.includes("enroll") || header.includes("enrol"))
          ? 1000
          : 0) + right.row_count;
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
      const seatParsing = await loadSeatParsing();
      const source = seatParsing.detectParseSource(nextFile.name);
      if (!source) {
        throw new Error("Unsupported file type. Use .xlsx, .xls, .csv, or .pdf.");
      }

      let detectedTables: SpreadsheetTableCandidate[];

      if (source === "pdf") {
        const rows = await seatParsing.parsePdfRows(nextFile);
        detectedTables = [
          {
            id: "pdf::1",
            label: "PDF - Extracted Table",
            sheet_name: "PDF",
            table_index: 1,
            row_count: rows.length,
            headers: seatParsing.extractRowHeaders(rows),
            rows
          }
        ];
      } else {
        detectedTables = await seatParsing.parseSpreadsheetTables(nextFile);
      }

      if (detectedTables.length === 0) {
        throw new Error("No usable student table was found in this file.");
      }

      const tablesToUse =
        source !== "pdf" && detectedTables.length > 1
          ? [await buildMergedTable(detectedTables), ...detectedTables]
          : detectedTables;

      setTables(tablesToUse);

      const best = tablesToUse.find((table) => table.id === "__all__") ?? detectBestTable(tablesToUse);
      if (!best) {
        throw new Error("Could not detect a usable table.");
      }

      await chooseTable(best);
    } catch (fileError) {
      const nextError = fileError instanceof Error ? fileError.message : "Failed to read file.";
      setError(nextError);
    }
  };

  const handleImport = async () => {
    if (!editableUploadSession) {
      setError("Create or open an upload draft session before importing rows.");
      return;
    }

    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    const seatParsing = await loadSeatParsing();
    const source = seatParsing.detectParseSource(file.name);
    if (!source) {
      setError("Unsupported file type. Use .xlsx, .xls, .csv, or .pdf.");
      return;
    }

    if (!mapping.prnKey) {
      setError("Map the Enrollment No column before importing.");
      return;
    }

    if (previewRows.length === 0) {
      setError("No valid Enrollment No rows are available to import.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onImportRows({
        sessionId: editableUploadSession.id,
        rows: previewRows,
        source
      });

      onImported(result);
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Import failed.";
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateDownload = async () => {
    setDownloadingTemplate(true);

    try {
      await onDownloadTemplate();
    } catch (downloadError) {
      const nextError = downloadError instanceof Error ? downloadError.message : "Template download failed.";
      setError(nextError);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Upload Candidate List</h3>
          <p className="text-sm text-neutral-600">
            Import candidates from Excel, CSV, or PDF using Name, Enrollment No, and Branch, then review matches before allocation.
          </p>
        </div>
        <Button variant="outline" onClick={() => void handleTemplateDownload()} disabled={downloadingTemplate}>
          <Download className="h-4 w-4" />
          {downloadingTemplate ? "Preparing..." : "Download Template"}
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label htmlFor="seat-upload-file" className="text-sm font-medium text-neutral-700">
              Upload file
            </Label>
            <p className="mt-1 text-xs text-neutral-500">Accepted: .xlsx, .xls, .csv, .pdf</p>
          </div>
        {editableUploadSession ? (
          <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Upload draft ready
            </Badge>
          ) : (
            <Badge variant="outline">Upload draft required</Badge>
          )}
        </div>
        <Input
          id="seat-upload-file"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(event) => {
            void handleFileChange(event.target.files?.[0] ?? null);
          }}
          className="mt-3"
          disabled={submitting}
        />
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
                  onClick={() => {
                    void chooseTable(table);
                  }}
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
              <Label htmlFor="map-prn">Enrollment No column</Label>
              <select
                id="map-prn"
                value={mapping.prnKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, prnKey: event.target.value || null };
                  setMapping(next);
                  void applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`prn-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-name">Name column (optional)</Label>
              <select
                id="map-name"
                value={mapping.nameKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, nameKey: event.target.value || null };
                  setMapping(next);
                  void applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              >
                <option value="">None</option>
                {headers.map((header) => (
                  <option key={`name-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-branch">Branch column (optional)</Label>
              <select
                id="map-branch"
                value={mapping.branchKey ?? ""}
                onChange={(event) => {
                  const next = { ...mapping, branchKey: event.target.value || null };
                  setMapping(next);
                  void applyPreview(rawRows, next);
                }}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
              >
                <option value="">None</option>
                {headers.map((header) => (
                  <option key={`branch-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-medium text-neutral-900">{summaryText}</p>
          </div>
          <Button onClick={() => void handleImport()} disabled={submitting || previewRows.length === 0}>
            {submitting ? "Importing..." : "Import Into Draft"}
          </Button>
        </div>

        {previewRows.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Enrollment No</th>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {previewRows.slice(0, 8).map((row) => (
                  <tr key={`${row.prn}-${row.row_index}`}>
                    <td className="px-3 py-2.5 font-medium text-neutral-900">{row.prn}</td>
                    <td className="px-3 py-2.5 text-neutral-700">{row.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-neutral-700">{row.branch ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {invalidRows.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">Invalid rows: {invalidRows.length}</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {invalidRows.slice(0, 5).map((row) => (
                <li key={`invalid-${row.row_index}`}>
                  Row {row.row_index}: {row.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
