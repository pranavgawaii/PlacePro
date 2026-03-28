import type {
  CoordinatorAttendancePayload,
  CoordinatorFormField,
  CoordinatorFormRecord,
  CoordinatorFormResponseRecord,
  CoordinatorFormWithCount,
  CoordinatorRecord
} from "@/lib/coordinator/types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? "Request failed");
  }
  return body as T;
}

export async function listCoordinators() {
  const response = await fetch("/api/admin/coordinator", { cache: "no-store" });
  return parseJson<CoordinatorRecord[]>(response);
}

export async function createCoordinator(payload: Omit<CoordinatorRecord, "id" | "created_at" | "updated_at">) {
  const response = await fetch("/api/admin/coordinator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<CoordinatorRecord>(response);
}

export async function updateCoordinator(id: string, payload: Omit<CoordinatorRecord, "id" | "created_at" | "updated_at">) {
  const response = await fetch(`/api/admin/coordinator/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<CoordinatorRecord>(response);
}

export async function deleteCoordinator(id: string) {
  const response = await fetch(`/api/admin/coordinator/${id}`, { method: "DELETE" });
  return parseJson<{ success: true }>(response);
}

export async function generateCoordinatorAttendanceLetter(payload: CoordinatorAttendancePayload) {
  const response = await fetch("/api/admin/coordinator/attendance-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? "Failed to generate attendance letter");
  }

  return response.blob();
}

export async function listCoordinatorForms() {
  const response = await fetch("/api/admin/coordinator/forms", { cache: "no-store" });
  return parseJson<CoordinatorFormWithCount[]>(response);
}

export async function getCoordinatorForm(id: string) {
  const response = await fetch(`/api/admin/coordinator/forms/${id}`, { cache: "no-store" });
  return parseJson<{ form: CoordinatorFormRecord; fields: CoordinatorFormField[] }>(response);
}

export async function createCoordinatorForm(payload: {
  title: string;
  description: string | null;
  status: CoordinatorFormRecord["status"];
  is_public: boolean;
  deadline: string | null;
  theme_settings: CoordinatorFormRecord["theme_settings"];
  fields: Array<Pick<CoordinatorFormField, "label" | "field_type" | "required" | "options" | "sort_order">>;
}) {
  const response = await fetch("/api/admin/coordinator/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<{ form: CoordinatorFormRecord }>(response);
}

export async function updateCoordinatorForm(id: string, payload: {
  title: string;
  description: string | null;
  status: CoordinatorFormRecord["status"];
  is_public: boolean;
  deadline: string | null;
  theme_settings: CoordinatorFormRecord["theme_settings"];
  fields: Array<Pick<CoordinatorFormField, "label" | "field_type" | "required" | "options" | "sort_order">>;
}) {
  const response = await fetch(`/api/admin/coordinator/forms/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<{ form: CoordinatorFormRecord }>(response);
}

export async function updateCoordinatorFormStatus(id: string, status: CoordinatorFormRecord["status"]) {
  const response = await fetch(`/api/admin/coordinator/forms/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  return parseJson<{ form: CoordinatorFormRecord }>(response);
}

export async function listCoordinatorFormResponses(id: string) {
  const response = await fetch(`/api/admin/coordinator/forms/${id}/responses`, { cache: "no-store" });
  return parseJson<{
    form: CoordinatorFormRecord;
    fields: CoordinatorFormField[];
    responses: CoordinatorFormResponseRecord[];
  }>(response);
}

export async function updateCoordinatorResponse(responseId: string, payload: { status: CoordinatorFormResponseRecord["status"]; notes: string | null }) {
  const response = await fetch(`/api/admin/coordinator/forms/responses/${responseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<{ response: CoordinatorFormResponseRecord }>(response);
}
