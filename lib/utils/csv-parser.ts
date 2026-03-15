import Papa from "papaparse";

export const STUDENT_TEMPLATE_COLUMNS = ["name", "email", "enrollment_no", "mobile", "branch", "batch_year"] as const;

export type StudentTemplateColumn = (typeof STUDENT_TEMPLATE_COLUMNS)[number];

type CsvSerializable = string | number | boolean | null | undefined;

export type ParsedStudentCsvRow = {
  rowNumber: number;
  name: string;
  email: string;
  enrollment_no: string;
  mobile: string;
  branch: string;
  batch_year: string;
};

export type ParsedStudentCsv = {
  rows: ParsedStudentCsvRow[];
  parseErrors: string[];
  missingColumns: StudentTemplateColumn[];
};

type RowRecord = Record<string, string | undefined>;

const TEMPLATE_SAMPLE_ROWS: Array<Record<StudentTemplateColumn, CsvSerializable>> = [
  {
    name: "Kyra Iyer",
    email: "student10@placepro.in",
    enrollment_no: "ADT23SOCB0010",
    mobile: "",
    branch: "CSE",
    batch_year: 2027
  },
  {
    name: "Vihaan Patel",
    email: "student5@placepro.in",
    enrollment_no: "ADT23SOCB0005",
    mobile: "9876543211",
    branch: "ECE",
    batch_year: 2027
  },
  {
    name: "Ishani Joshi",
    email: "student6@placepro.in",
    enrollment_no: "ADT23SOCB0006",
    mobile: "9123456789",
    branch: "CSE",
    batch_year: 2027
  },
  {
    name: "Kabir Das",
    email: "student7@placepro.in",
    enrollment_no: "ADT23SOCB0007",
    mobile: "8765432100",
    branch: "MECH",
    batch_year: 2027
  },
  {
    name: "Myra Singh",
    email: "student8@placepro.in",
    enrollment_no: "ADT23SOCB0008",
    mobile: "7654321000",
    branch: "AERO",
    batch_year: 2027
  },
  {
    name: "Arjun Reddy",
    email: "student9@placepro.in",
    enrollment_no: "ADT23SOCB0009",
    mobile: "6543210000",
    branch: "CIVIL",
    batch_year: 2027
  }
];

export function getStudentTemplateCsv() {
  return serializeCsvRows(TEMPLATE_SAMPLE_ROWS, STUDENT_TEMPLATE_COLUMNS);
}

export function parseStudentCsvText(csvText: string): ParsedStudentCsv {
  const parsed = Papa.parse<RowRecord>(csvText, {
    header: true,
    skipEmptyLines: "greedy"
  });

  const fields = (parsed.meta.fields ?? []).map((field) => field.trim());
  const missingColumns = STUDENT_TEMPLATE_COLUMNS.filter((column) => !fields.includes(column));
  const rows: ParsedStudentCsvRow[] = parsed.data.map((row, index) => ({
    rowNumber: index + 2,
    name: (row.name ?? "").trim(),
    email: (row.email ?? "").trim(),
    enrollment_no: (row.enrollment_no ?? "").trim(),
    mobile: (row.mobile ?? "").trim(),
    branch: (row.branch ?? "").trim(),
    batch_year: (row.batch_year ?? "").trim()
  }));

  const parseErrors = parsed.errors.map((error) => {
    const rowIndex = typeof error.row === "number" ? error.row : -1;
    const rowNumber = rowIndex >= 0 ? rowIndex + 2 : 0;
    return rowNumber > 0 ? `Row ${rowNumber}: ${error.message}` : error.message;
  });

  return {
    rows,
    parseErrors,
    missingColumns
  };
}

export function serializeCsvRows<T extends Record<string, CsvSerializable>>(
  rows: T[],
  columns: ReadonlyArray<keyof T & string>
) {
  const data = rows.map((row) => columns.map((column) => row[column] ?? ""));
  return Papa.unparse({
    fields: [...columns],
    data
  });
}
