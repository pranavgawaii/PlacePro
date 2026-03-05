export type AllocationMode = 'alphabetical' | 'random';

export interface ParsedStudentRow {
  name: string;
  roll_number: string;
  department?: string | null;
  row_index?: number;
  raw_row?: Record<string, unknown>;
}

export interface ParseStudentsResponse {
  upload_session_id: string;
  parsed_count: number;
  duplicate_rolls: string[];
  invalid_rows: Array<{
    row_index: number;
    reason: string;
    raw_row: Record<string, unknown>;
  }>;
}

export interface AllocateSeatsRequest {
  lab_ids: string[];
  mode?: AllocationMode;
  upload_session_id: string;
}

export interface GenerateDocumentsRequest {
  session_id: string;
  formats?: Array<'pdf' | 'xlsx'>;
  excel_mode?: 'per_lab';
  action?: 'generate' | 'delete';
  selected_columns?: string[];
  column_configs?: Array<{
    key: string;
    label?: string;
    align?: 'left' | 'center' | 'right';
    width?: number;
    padding_x?: number;
    padding_y?: number;
    enabled?: boolean;
    source?: 'system' | 'extra';
    applies_to?: 'both' | 'attendance';
  }>;
  table_style?: {
    font_size?: number;
    header_font_size?: number;
    row_height?: number;
    header_row_height?: number;
    cell_padding_x?: number;
    cell_padding_y?: number;
    line_width?: number;
    section_gap?: number;
  };
}
