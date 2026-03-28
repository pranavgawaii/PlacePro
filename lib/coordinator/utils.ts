import { COORDINATOR_TEMPLATE_FIELDS, type CoordinatorFieldType, type CoordinatorFormField } from "@/lib/coordinator/types";
import type { Json } from "@/types/database.types";

export function slugifyCoordinatorFormTitle(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "coordinator-form";
}

export function buildCoordinatorTemplateFields() {
  return COORDINATOR_TEMPLATE_FIELDS.map((field, index) => ({
    id: `temp-${Date.now()}-${index}`,
    form_id: "",
    label: field.label,
    field_type: field.field_type,
    required: field.required,
    options: field.options ?? null,
    sort_order: index,
    created_at: new Date().toISOString()
  })) satisfies CoordinatorFormField[];
}

export function normalizeFieldChoices(value: string) {
  return value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function formatFieldAnswer(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function getFieldTypeLabel(type: CoordinatorFieldType) {
  switch (type) {
    case "short_text":
      return "Short Text";
    case "long_text":
      return "Long Text";
    case "email":
      return "Email";
    case "number":
      return "Number";
    case "select":
      return "Dropdown Select";
    default:
      return type;
  }
}

export function parseCoordinatorThemeSettings(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { primaryColor: "#111827", backgroundColor: "#F8FAFC" };
  }

  return {
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : "#111827",
    backgroundColor: typeof value.backgroundColor === "string" ? value.backgroundColor : "#F8FAFC"
  };
}
