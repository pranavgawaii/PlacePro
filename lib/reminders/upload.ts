import type { UploadedReminderRecipient } from "@/lib/reminders/types";
import { normalizeEnrollmentNo, normalizeOptionalValue } from "@/lib/reminders/utils";

const REQUIRED_COLUMNS = ["enrollment_no", "email", "phone"] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export async function parseReminderWorkbook(file: File): Promise<UploadedReminderRecipient[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The Excel file is empty.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  if (rows.length === 0) {
    throw new Error("The Excel file is empty.");
  }

  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const headers = headerRow.map(normalizeHeader);
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<string, number>;

  for (const requiredColumn of REQUIRED_COLUMNS) {
    if (typeof headerIndex[requiredColumn] !== "number") {
      throw new Error("Excel must include Enrollment_No, Email, and Phone columns.");
    }
  }

  const parsedRows: UploadedReminderRecipient[] = [];

  rows.slice(1).forEach((row, index) => {
    if (!Array.isArray(row)) {
      return;
    }

    const enrollmentNo = normalizeEnrollmentNo(row[headerIndex.enrollment_no]);
    const email = normalizeOptionalValue(row[headerIndex.email]);
    const phone = normalizeOptionalValue(row[headerIndex.phone]);
    const hasAnyValue = Boolean(enrollmentNo || email || phone);

    if (!hasAnyValue) {
      return;
    }

    if (!enrollmentNo) {
      throw new Error(`Row ${index + 2} is missing Enrollment_No.`);
    }

    parsedRows.push({
      enrollment_no: enrollmentNo,
      email,
      phone,
      rowNumber: index + 2
    });
  });

  if (parsedRows.length === 0) {
    throw new Error("No recipients were found in the Excel file.");
  }

  return parsedRows;
}
