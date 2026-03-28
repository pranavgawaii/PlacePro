import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COORDINATOR_DEPARTMENTS,
  COORDINATOR_FIELD_TYPES,
  COORDINATOR_FORM_STATUSES,
  COORDINATOR_RESPONSE_STATUSES,
  COORDINATOR_YEARS,
  type CoordinatorFormField,
  type CoordinatorFormThemeSettings
} from "@/lib/coordinator/types";
import { slugifyCoordinatorFormTitle } from "@/lib/coordinator/utils";
import type { Database, Json } from "@/types/database.types";

const departmentSchema = z.enum(COORDINATOR_DEPARTMENTS);
const yearSchema = z.enum(COORDINATOR_YEARS);
const formStatusSchema = z.enum(COORDINATOR_FORM_STATUSES);
const responseStatusSchema = z.enum(COORDINATOR_RESPONSE_STATUSES);
const fieldTypeSchema = z.enum(COORDINATOR_FIELD_TYPES);

export const coordinatorPayloadSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120, "Name is too long"),
  enrollment_no: z.string().trim().toUpperCase().min(3, "Enrollment number is required").max(30, "Enrollment number is too long"),
  email: z
    .preprocess((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim().toLowerCase();
      return trimmed.length ? trimmed : null;
    }, z.string().email("Enter a valid email address").nullable())
    .optional()
    .transform((value) => value ?? null),
  department: departmentSchema,
  year: yearSchema
});

const themeSchema = z.object({
  primaryColor: z.string().trim().optional(),
  backgroundColor: z.string().trim().optional()
});

const fieldOptionsSchema = z.object({
  choices: z.array(z.string().trim().min(1)).min(1)
});

export const coordinatorFormFieldInputSchema = z.object({
  label: z.string().trim().min(1, "Field label is required").max(120, "Field label is too long"),
  field_type: fieldTypeSchema,
  required: z.boolean(),
  options: fieldOptionsSchema.nullable().optional(),
  sort_order: z.coerce.number().int().min(0)
});

export const coordinatorFormPayloadSchema = z.object({
  title: z.string().trim().min(3, "Form title is required").max(120, "Form title is too long"),
  description: z
    .preprocess((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }, z.string().max(500).nullable())
    .optional()
    .transform((value) => value ?? null),
  status: formStatusSchema,
  is_public: z.boolean(),
  deadline: z
    .preprocess((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }, z.string().datetime().nullable())
    .optional()
    .transform((value) => value ?? null),
  theme_settings: themeSchema.optional().transform((value) => value ?? {}),
  fields: z.array(coordinatorFormFieldInputSchema).min(1, "Add at least one field")
});

export const coordinatorResponseUpdateSchema = z.object({
  status: responseStatusSchema,
  notes: z
    .preprocess((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }, z.string().max(2000).nullable())
    .optional()
    .transform((value) => value ?? null)
});

export const coordinatorPublicSubmitSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]))
});

export const coordinatorAttendanceSchema = z.object({
  event_title: z.string().trim().min(3, "Event title is required").max(160, "Event title is too long"),
  event_date: z.string().trim().min(1, "Event date is required"),
  time_from: z.string().trim().min(1, "Start time is required"),
  time_to: z.string().trim().min(1, "End time is required"),
  coordinator_ids: z.array(z.string().uuid()).min(1, "Select at least one coordinator")
});

export function normalizeCoordinatorThemeSettings(value: CoordinatorFormThemeSettings) {
  return {
    primaryColor: value.primaryColor?.trim() || "#111827",
    backgroundColor: value.backgroundColor?.trim() || "#F8FAFC"
  } satisfies CoordinatorFormThemeSettings;
}

export async function buildUniqueCoordinatorFormSlug(
  admin: SupabaseClient<Database>,
  title: string,
  excludeId?: string
) {
  const base = slugifyCoordinatorFormTitle(title);
  let slug = base;
  let attempt = 1;

  while (true) {
    let query = admin.from("coordinator_forms").select("id").eq("slug", slug);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return slug;
    }

    attempt += 1;
    slug = `${base}-${attempt}`;
  }
}

export function sortCoordinatorFields<T extends Pick<CoordinatorFormField, "sort_order">>(fields: T[]) {
  return [...fields].sort((left, right) => left.sort_order - right.sort_order);
}

export function extractCoordinatorApplicantSnapshots(
  answers: Record<string, Json>,
  fields: Array<Pick<CoordinatorFormField, "id" | "label">>
) {
  let applicantName: string | null = null;
  let applicantEmail: string | null = null;

  for (const field of fields) {
    const raw = answers[field.id];
    if (raw === undefined || raw === null) {
      continue;
    }

    const label = field.label.toLowerCase();
    if (!applicantName && label.includes("name") && typeof raw === "string") {
      applicantName = raw.trim();
    }
    if (!applicantEmail && label.includes("email") && typeof raw === "string") {
      applicantEmail = raw.trim();
    }
  }

  return { applicantName, applicantEmail };
}

export function serializeCoordinatorFieldsForInsert(
  fields: z.infer<typeof coordinatorFormPayloadSchema>["fields"]
) {
  return fields.map((field, index) => ({
    label: field.label.trim(),
    field_type: field.field_type,
    required: field.required,
    options: field.field_type === "select" ? field.options ?? { choices: [] } : null,
    sort_order: index
  }));
}
