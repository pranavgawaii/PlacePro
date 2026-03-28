import type { Json } from "@/types/database.types";

export const COORDINATOR_DEPARTMENTS = ["SOC", "SOE", "SODT", "SOM"] as const;
export const COORDINATOR_YEARS = ["FY", "SY", "TY", "LY"] as const;
export const COORDINATOR_FORM_STATUSES = ["draft", "active", "closed"] as const;
export const COORDINATOR_RESPONSE_STATUSES = ["new", "shortlisted", "rejected", "on_hold"] as const;
export const COORDINATOR_FIELD_TYPES = ["short_text", "long_text", "email", "number", "select"] as const;

export type CoordinatorDepartment = (typeof COORDINATOR_DEPARTMENTS)[number];
export type CoordinatorYear = (typeof COORDINATOR_YEARS)[number];
export type CoordinatorFormStatus = (typeof COORDINATOR_FORM_STATUSES)[number];
export type CoordinatorResponseStatus = (typeof COORDINATOR_RESPONSE_STATUSES)[number];
export type CoordinatorFieldType = (typeof COORDINATOR_FIELD_TYPES)[number];

export type CoordinatorFormThemeSettings = {
  primaryColor?: string;
  backgroundColor?: string;
};

export type CoordinatorFormField = {
  id: string;
  form_id: string;
  label: string;
  field_type: CoordinatorFieldType;
  required: boolean;
  options: { choices: string[] } | null;
  sort_order: number;
  created_at: string;
};

export type CoordinatorRecord = {
  id: string;
  name: string;
  enrollment_no: string;
  email: string | null;
  department: CoordinatorDepartment;
  year: CoordinatorYear;
  created_at: string;
  updated_at: string;
};

export type CoordinatorFormRecord = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: CoordinatorFormStatus;
  is_public: boolean;
  theme_settings: CoordinatorFormThemeSettings;
  deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CoordinatorFormResponseRecord = {
  id: string;
  form_id: string;
  answers: Record<string, Json>;
  status: CoordinatorResponseStatus;
  notes: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  submitted_at: string;
};

export type CoordinatorFormTemplateField = {
  label: string;
  field_type: CoordinatorFieldType;
  required: boolean;
  options?: { choices: string[] } | null;
};

export const COORDINATOR_TEMPLATE_FIELDS: CoordinatorFormTemplateField[] = [
  { label: "Full Name", field_type: "short_text", required: true },
  { label: "Email Address", field_type: "email", required: true },
  { label: "Phone Number", field_type: "short_text", required: true },
  { label: "Department", field_type: "select", required: true, options: { choices: ["SOC", "SOE", "SODT", "SOM"] } },
  { label: "Year", field_type: "select", required: true, options: { choices: ["FY", "SY", "TY", "LY"] } },
  { label: "CGPA", field_type: "number", required: true },
  { label: "Why do you want to be a Coordinator?", field_type: "long_text", required: true },
  { label: "Any past experience in coordination/events?", field_type: "long_text", required: false }
];

export type CoordinatorFormWithCount = CoordinatorFormRecord & {
  response_count: number;
};

export type CoordinatorResponseSummary = CoordinatorFormResponseRecord & {
  field_answers: Array<{ id: string; label: string; value: string }>;
};

export type CoordinatorAttendancePayload = {
  event_title: string;
  event_date: string;
  time_from: string;
  time_to: string;
  coordinator_ids: string[];
};
