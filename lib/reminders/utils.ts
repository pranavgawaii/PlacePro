import type { UploadedReminderRecipient } from "@/lib/reminders/types";

export function normalizeEnrollmentNo(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function normalizeOptionalValue(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function dedupeUploadedReminderRecipients(
  rows: UploadedReminderRecipient[]
): UploadedReminderRecipient[] {
  const map = new Map<string, UploadedReminderRecipient>();

  for (const row of rows) {
    const enrollmentNo = normalizeEnrollmentNo(row.enrollment_no);
    if (!enrollmentNo) {
      continue;
    }

    const existing = map.get(enrollmentNo);
    if (existing) {
      map.set(enrollmentNo, {
        ...existing,
        email: existing.email ?? row.email ?? null,
        phone: existing.phone ?? row.phone ?? null,
        rowNumber: existing.rowNumber ?? row.rowNumber
      });
      continue;
    }

    map.set(enrollmentNo, {
      ...row,
      enrollment_no: enrollmentNo
    });
  }

  return Array.from(map.values());
}

export function formatWhatsAppPhone(phone: string): string {
  const compact = phone.trim().replace(/[\s()-]/g, "");
  return compact.startsWith("whatsapp:") ? compact : `whatsapp:${compact}`;
}
