import { Database } from "@/types/database.types";

export type AllocationMode = "alphabetical" | "random";
export type ParseSource = "xlsx" | "csv" | "pdf";

export type Lab = Database["public"]["Tables"]["labs"]["Row"];
export type StudentTemp = Database["public"]["Tables"]["students_temp"]["Row"];
export type AllocationSession = Database["public"]["Tables"]["allocation_sessions"]["Row"];
export type AllocationRow = Database["public"]["Tables"]["allocations"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export interface ParsedRow {
  id?: string;
  row_index?: number;
  name: string;
  roll_number: string;
  department?: string;
  raw_row?: Record<string, unknown>;
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

export interface SessionAllocationDetails {
  session: AllocationSession;
  seat_summary: SeatSummaryItem[];
  overflow_students: OverflowStudent[];
}

export interface SessionMappingRow {
  allocation_id: string;
  seat_number: string;
  lab_name: string;
  temp_student_id: string;
  temp_name: string;
  temp_roll_number: string;
  temp_department: string | null;
  matched_student_id: string | null;
  matched_student_name: string | null;
  matched_student_prn: string | null;
  matched_student_email: string | null;
}

export interface StudentMappingOption {
  id: string;
  name: string;
  prn: string | null;
  email: string;
  branch: Database["public"]["Tables"]["students"]["Row"]["branch"];
}

export interface PublishedSeatAssignment {
  session_id: string;
  seat_number: string;
  lab_name: string;
  published_at: string | null;
  created_at: string;
}

export interface HeaderMapping {
  nameKey: string | null;
  rollKey: string | null;
  departmentKey: string | null;
}

export interface SpreadsheetTableCandidate {
  id: string;
  label: string;
  sheet_name: string;
  table_index: number;
  row_count: number;
  headers: string[];
  rows: Record<string, unknown>[];
}
