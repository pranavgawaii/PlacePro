import type { Branch, Database } from "@/types/database.types";

export type ParseSource = "xlsx" | "csv" | "pdf";
export type SeatSourceMode = "direct" | "upload";
export type SeatSessionStatus = "draft" | "ready" | "published";
export type CandidateMatchStatus = "matched" | "unmatched" | "duplicate" | "overflow" | "removed";
export type SeatExportMode = "per_lab" | "full_list";
export type SeatDocumentKind = "seating" | "attendance";

export type Lab = Database["public"]["Tables"]["labs"]["Row"];
export type SeatSession = Database["public"]["Tables"]["seat_sessions"]["Row"];
export type SeatSessionCandidate = Database["public"]["Tables"]["seat_session_candidates"]["Row"];
export type SeatAssignment = Database["public"]["Tables"]["seat_assignments"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export interface SeatUploadRow {
  row_index: number;
  prn: string;
  name?: string;
  branch?: string;
  raw_row?: Record<string, unknown>;
}

export interface SeatUploadInvalidRow {
  row_index: number;
  reason: string;
  raw_row: Record<string, unknown>;
}

export interface CandidateHeaderMapping {
  prnKey: string | null;
  nameKey: string | null;
  branchKey: string | null;
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

export interface SeatUploadParsePreview {
  parsedRows: SeatUploadRow[];
  invalidRows: SeatUploadInvalidRow[];
}

export interface ImportSeatCandidatesResult {
  inserted_count: number;
  matched_count: number;
  unmatched_count: number;
  duplicate_count: number;
}

export interface AddDirectCandidatesResult {
  added_count: number;
  skipped_count: number;
}

export interface SeatStudentOption {
  id: string;
  name: string;
  email: string;
  prn: string | null;
  branch: Branch | null;
  batch_year: number;
}

export interface SeatSessionListItem {
  id: string;
  title: string;
  source_mode: SeatSourceMode;
  status: SeatSessionStatus;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  stats: {
    total_candidates: number;
    matched_candidates: number;
    overflow_candidates: number;
    assigned_candidates: number;
  };
}

export interface SeatSessionCandidateView {
  id: string;
  session_id: string;
  student_id: string | null;
  prn: string;
  name_snapshot: string | null;
  branch_snapshot: string | null;
  source_mode: SeatSourceMode;
  source_row_no: number | null;
  match_status: CandidateMatchStatus;
  error_message: string | null;
  student_name: string | null;
  student_email: string | null;
  student_branch: Branch | null;
}

export interface SeatAssignmentEditorRow {
  candidate_id: string;
  student_id: string | null;
  student_name: string;
  prn: string;
  branch: string | null;
  lab_id: string | null;
  seat_number: string | null;
}

export interface SeatSummaryItem {
  lab_id: string;
  lab_name: string;
  allocated_count: number;
  total_seats: number;
}

export interface SeatSessionStats {
  total_candidates: number;
  matched_candidates: number;
  unmatched_candidates: number;
  duplicate_candidates: number;
  overflow_candidates: number;
  removed_candidates: number;
  assigned_candidates: number;
  unassigned_matched_candidates: number;
}

export interface SeatSessionDetails {
  session: SeatSession;
  stats: SeatSessionStats;
  lab_summary: SeatSummaryItem[];
}

export interface AutoAllocateSeatsResult {
  session_id: string;
  assigned_count: number;
  overflow_count: number;
  seat_summary: SeatSummaryItem[];
}

export interface PublishedSeatAssignment {
  session_id: string;
  session_title: string;
  seat_number: string;
  lab_name: string;
  published_at: string | null;
  created_at: string;
}

export interface SeatPreviewRow {
  student_id: string;
  seat_number: string;
  enrollment_no: string;
  student_name: string;
  branch: string | null;
  lab_name: string;
}

export interface SeatPreviewGroup {
  key: string;
  title: string;
  rows: SeatPreviewRow[];
}

export interface SeatDocumentPreview {
  export_mode: SeatExportMode;
  seating_groups: SeatPreviewGroup[];
  attendance_groups: SeatPreviewGroup[];
}

export interface SeatDocumentGenerationResult {
  seat_pdf_url?: string;
  attendance_pdf_url?: string;
  workbook_url?: string;
  generated_at: string;
}
