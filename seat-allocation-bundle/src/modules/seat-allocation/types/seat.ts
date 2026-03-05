export type AllocationMode = 'alphabetical' | 'random';
export type ParseSource = 'xlsx' | 'csv' | 'pdf';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface Lab {
  id: string;
  owner_id: string;
  lab_name: string;
  total_seats: number;
  rows: number | null;
  columns: number | null;
  seat_pattern: string;
  created_at: string;
  updated_at: string;
}

export interface StudentTemp {
  id: string;
  owner_id: string;
  upload_session_id: string;
  name: string;
  roll_number: string;
  department: string | null;
  parse_source: ParseSource | null;
  raw_row: Record<string, unknown> | null;
  created_at: string;
}

export interface AllocationSession {
  id: string;
  owner_id: string;
  upload_session_id: string;
  mode: AllocationMode;
  status: string;
  seed: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AllocationRecord {
  id: string;
  owner_id: string;
  student_id: string;
  lab_id: string;
  seat_number: string;
  session_id: string;
  created_at: string;
  student?: StudentTemp;
  lab?: Lab;
}

export interface SeatSummaryItem {
  lab_id: string;
  lab_name: string;
  allocated_count: number;
  total_seats: number;
}

export interface OverflowStudent {
  student_id: string;
  name: string;
  roll_number: string;
}

export interface SeatAllocationResult {
  session_id: string;
  mode: AllocationMode;
  upload_session_id: string;
  seat_summary: SeatSummaryItem[];
  overflow_students: OverflowStudent[];
}

export interface ParsedRow {
  name: string;
  roll_number: string;
  department?: string;
  raw_row?: Record<string, unknown>;
  row_index?: number;
}

export interface InvalidParsedRow {
  row_index: number;
  reason: string;
  raw_row: Record<string, unknown>;
}

export interface ParseStudentsResult {
  upload_session_id: string;
  parsed_count: number;
  duplicate_rolls: string[];
  invalid_rows: InvalidParsedRow[];
  preview_rows?: ParsedRow[];
}

export interface AllocationPreviewGroup {
  lab: {
    id: string;
    name: string;
  };
  rows: Array<{
    seat_number: string;
    roll_number: string;
    student_name: string;
    department: string | null;
    extra_values?: Record<string, string>;
  }>;
}

export interface DocumentSettings {
  id: string;
  owner_id: string;
  institute_name: string;
  exam_title: string;
  subject: string;
  logo_url: string | null;
  footer_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentGenerationResult {
  seat_pdf_url?: string;
  attendance_pdf_url?: string;
  workbook_url?: string;
  generated_at: string;
}

export interface GenerateDocumentsPayload {
  session_id: string;
  formats: Array<'pdf' | 'xlsx'>;
  excel_mode: 'per_lab';
  selected_columns?: string[];
  column_configs?: TableColumnConfig[];
  table_style?: TableStyleConfig;
}

export interface SessionColumnOption {
  key: string;
  label: string;
}

export type TableColumnAlign = 'left' | 'center' | 'right';
export type TableColumnSource = 'system' | 'extra';
export type TableColumnAppliesTo = 'both' | 'attendance';

export interface TableColumnConfig {
  key: string;
  label: string;
  align: TableColumnAlign;
  enabled: boolean;
  source: TableColumnSource;
  applies_to: TableColumnAppliesTo;
  width: number;
  padding_x: number;
  padding_y: number;
}

export interface TableStyleConfig {
  font_size: number;
  header_font_size: number;
  row_height: number;
  header_row_height: number;
  cell_padding_x: number;
  cell_padding_y: number;
  line_width: number;
  section_gap: number;
}

export interface EdgeFunctionsHealth {
  parse_students: boolean;
  allocate_seats: boolean;
  generate_documents: boolean;
}
