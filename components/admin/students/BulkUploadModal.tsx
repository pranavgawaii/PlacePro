"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import { FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordGenerator } from "@/components/admin/students/PasswordGenerator";
import { StudentPreviewRow, StudentPreviewTable } from "@/components/admin/students/StudentPreviewTable";
import { downloadCsv } from "@/lib/utils";
import { getStudentTemplateCsv, parseStudentCsvText, serializeCsvRows } from "@/lib/utils/csv-parser";
import { bulkUploadSchema, PasswordStrategy, studentSchema, StudentInput } from "@/lib/validations/student";

type BulkUploadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

type BulkUploadError = {
  row: number;
  student: {
    name: string;
    email: string;
    enrollment_no: string;
  };
  error: string;
};

type BulkUploadCredential = {
  row: number;
  name: string;
  email: string;
  enrollment_no: string;
  password: string;
};

type BulkUploadResponse = {
  success: number;
  failed: number;
  errors: BulkUploadError[];
  credentials: BulkUploadCredential[];
  errorLogCsv: string;
  credentialsCsv: string;
  error?: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function BulkUploadModal({ open, onOpenChange, onImported }: BulkUploadModalProps) {
  const [fileName, setFileName] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<StudentPreviewRow[]>([]);
  const [uploadRows, setUploadRows] = useState<StudentInput[]>([]);
  const [uploadRowNumbers, setUploadRowNumbers] = useState<number[]>([]);
  const [globalCsvErrors, setGlobalCsvErrors] = useState<string[]>([]);
  const [passwordStrategy, setPasswordStrategy] = useState<PasswordStrategy>("pattern");
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkUploadResponse | null>(null);

  const validCount = useMemo(() => previewRows.filter((row) => row.valid).length, [previewRows]);
  const invalidCount = previewRows.length - validCount;

  const resetState = () => {
    setFileName("");
    setPreviewRows([]);
    setUploadRows([]);
    setUploadRowNumbers([]);
    setGlobalCsvErrors([]);
    setPasswordStrategy("pattern");
    setForcePasswordChange(true);
    setImportResult(null);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleCloseChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleTemplateDownload = () => {
    downloadCsv("student_reference_sheet.csv", getStudentTemplateCsv());
  };

  const parseCsvFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setImportResult(null);
    setGlobalCsvErrors([]);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("File must be CSV format (.csv)");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large (max 2MB)");
        return;
      }

      const text = await file.text();
      if (!text.trim()) {
        toast.error("CSV is empty");
        return;
      }

      const parsed = parseStudentCsvText(text);
      if (parsed.missingColumns.length > 0) {
        toast.error(`Missing required columns: ${parsed.missingColumns.join(", ")}`);
        return;
      }

      const intermediate = parsed.rows.map((row) => {
        const candidate = {
          name: row.name,
          email: row.email,
          enrollment_no: row.enrollment_no,
          mobile: row.mobile,
          branch: row.branch,
          batch_year: row.batch_year
        };
        const validated = studentSchema.safeParse(candidate);
        return {
          row,
          parsedStudent: validated.success ? validated.data : null,
          errors: validated.success ? [] : validated.error.issues.map((issue) => issue.message)
        };
      });

      const seenEmails = new Map<string, number>();
      const seenEnrollment = new Map<string, number>();

      intermediate.forEach((entry) => {
        if (!entry.parsedStudent) {
          return;
        }
        const emailKey = entry.parsedStudent.email.toLowerCase();
        const enrollmentKey = entry.parsedStudent.enrollment_no;

        if (seenEmails.has(emailKey)) {
          entry.errors.push(`Duplicate email in file (already in row ${seenEmails.get(emailKey)})`);
        } else {
          seenEmails.set(emailKey, entry.row.rowNumber);
        }

        if (seenEnrollment.has(enrollmentKey)) {
          entry.errors.push(`Duplicate enrollment number in file (already in row ${seenEnrollment.get(enrollmentKey)})`);
        } else {
          seenEnrollment.set(enrollmentKey, entry.row.rowNumber);
        }
      });

      const nextPreviewRows: StudentPreviewRow[] = intermediate.map((entry) => ({
        rowNumber: entry.row.rowNumber,
        name: entry.row.name,
        email: entry.row.email,
        enrollment_no: entry.row.enrollment_no,
        mobile: entry.row.mobile,
        branch: entry.row.branch,
        batch_year: entry.row.batch_year,
        valid: entry.errors.length === 0 && entry.parsedStudent !== null,
        errors: entry.errors
      }));

      const validRows = intermediate.filter(
        (entry): entry is typeof entry & { parsedStudent: StudentInput } => entry.errors.length === 0 && entry.parsedStudent !== null
      );

      setFileName(file.name);
      setPreviewRows(nextPreviewRows);
      setUploadRows(validRows.map((entry) => entry.parsedStudent));
      setUploadRowNumbers(validRows.map((entry) => entry.row.rowNumber));
      setGlobalCsvErrors(parsed.parseErrors);

      if (nextPreviewRows.length === 0) {
        toast.error("CSV is empty");
        return;
      }
      toast.success(`CSV parsed: ${validRows.length} valid, ${nextPreviewRows.length - validRows.length} invalid`);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const hasOversized = fileRejections.some((rejection) => rejection.file.size > MAX_FILE_SIZE);
        toast.error(hasOversized ? "File too large (max 2MB)" : "File must be CSV format (.csv)");
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        return;
      }

      void parseCsvFile(file);
    },
    [parseCsvFile]
  );

  const dropzone = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"]
    },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_FILE_SIZE
  });

  const handleImport = async () => {
    if (uploadRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    const validatedPayload = bulkUploadSchema.safeParse({
      students: uploadRows,
      rowNumbers: uploadRowNumbers,
      passwordStrategy,
      forcePasswordChange
    });

    if (!validatedPayload.success) {
      toast.error("Invalid upload payload");
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch("/api/admin/students/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validatedPayload.data)
      });

      const data = (await response.json()) as BulkUploadResponse;

      if (!response.ok) {
        toast.error(data.error ?? "Failed to import students. Please try again.");
        return;
      }

      const localValidationErrors: BulkUploadError[] = previewRows
        .filter((row) => !row.valid)
        .map((row) => ({
          row: row.rowNumber,
          student: {
            name: row.name,
            email: row.email,
            enrollment_no: row.enrollment_no
          },
          error: row.errors.join(" | ")
        }));

      const combinedErrors = [...localValidationErrors, ...data.errors];
      const combinedErrorCsv =
        combinedErrors.length > 0
          ? serializeCsvRows(
              combinedErrors.map((entry) => ({
                row: entry.row,
                name: entry.student.name,
                email: entry.student.email,
                enrollment_no: entry.student.enrollment_no,
                error: entry.error
              })),
              ["row", "name", "email", "enrollment_no", "error"]
            )
          : data.errorLogCsv;

      const normalizedResult: BulkUploadResponse = {
        success: data.success,
        failed: combinedErrors.length,
        errors: combinedErrors,
        credentials: data.credentials,
        errorLogCsv: combinedErrorCsv,
        credentialsCsv: data.credentialsCsv
      };

      setImportResult(normalizedResult);
      if (data.success > 0) {
        onImported();
      }
      toast.success(`${data.success} students imported successfully`);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadCredentials = () => {
    if (!importResult) {
      return;
    }
    downloadCsv("student_credentials.csv", importResult.credentialsCsv);
  };

  const downloadErrors = () => {
    if (!importResult) {
      return;
    }
    downloadCsv("student_import_errors.csv", importResult.errorLogCsv);
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseChange}>
      <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Students</DialogTitle>
            <DialogDescription>
            Upload a CSV reference sheet, validate every row, and import student accounts in one step. Leave the mobile column blank if you want PlacePro to auto-assign a 10-digit number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-4 text-sm text-blue-900">
            <p className="font-medium">Reference sheet format</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Required columns: <span className="font-semibold">name</span>, <span className="font-semibold">email</span>,{" "}
              <span className="font-semibold">enrollment_no</span>, <span className="font-semibold">mobile</span>,{" "}
              <span className="font-semibold">branch</span>, <span className="font-semibold">batch_year</span>.
            </p>
            <p className="mt-2 text-xs leading-5 text-blue-800">
              If <span className="font-semibold">mobile</span> is blank, PlacePro will assign a valid 10-digit number automatically. If provided, it must be a valid 10-digit number.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-600">Use the reference sheet format for best results.</div>
            <Button type="button" variant="outline" onClick={handleTemplateDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download Reference Sheet
            </Button>
          </div>

          <div
            {...dropzone.getRootProps()}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
              dropzone.isDragActive ? "border-blue-500 bg-blue-50" : "border-neutral-300"
            }`}
          >
            <input {...dropzone.getInputProps()} aria-label="Upload CSV file" />
            <UploadCloud className="mx-auto mb-2 h-8 w-8 text-neutral-500" />
            <p className="text-sm font-medium">
              {dropzone.isDragActive ? "Drop the CSV file here" : "Drag and drop CSV here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Accepted format: .csv, max 2MB</p>
            {fileName ? <p className="mt-3 text-xs font-medium text-neutral-700">Selected file: {fileName}</p> : null}
          </div>

          <PasswordGenerator
            passwordStrategy={passwordStrategy}
            forcePasswordChange={forcePasswordChange}
            onPasswordStrategyChange={setPasswordStrategy}
            onForcePasswordChangeChange={setForcePasswordChange}
            showPreview={false}
          />

          {globalCsvErrors.length > 0 ? (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>CSV Parse Warnings</AlertTitle>
              <AlertDescription>{globalCsvErrors.join(" | ")}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm font-medium">Preview (first 50 rows)</Label>
            <Badge variant="success">{validCount} valid</Badge>
            <Badge variant={invalidCount > 0 ? "destructive" : "secondary"}>{invalidCount} invalid</Badge>
          </div>

          <StudentPreviewTable rows={previewRows.slice(0, 50)} />

          {importResult ? (
            <Alert variant={importResult.failed > 0 ? "warning" : "success"}>
              <FileUp className="h-4 w-4" />
              <AlertTitle>Import Completed</AlertTitle>
              <AlertDescription>
                {importResult.success} imported successfully | {importResult.failed} failed
              </AlertDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={downloadCredentials} disabled={importResult.success === 0}>
                  Download Credentials CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadErrors} disabled={importResult.failed === 0}>
                  Download Error Log
                </Button>
              </div>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleCloseChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={isParsing || isImporting || validCount === 0}
            aria-label="Import students"
          >
            {isParsing || isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isParsing ? "Parsing..." : isImporting ? "Importing..." : "Import Students"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
