import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { reminderSendRequestSchema } from "@/lib/reminders/schema";
import { ReminderChannel, ReminderSendSummary, UploadedReminderRecipient } from "@/lib/reminders/types";
import { dedupeUploadedReminderRecipients, normalizeEnrollmentNo, normalizeOptionalValue } from "@/lib/reminders/utils";
import { sendWhatsApp } from "@/lib/whatsapp/sendWhatsApp";
import { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_EMAIL_FROM);
const WHATSAPP_ENABLED = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM
);

type StudentRecord = Pick<
  Database["public"]["Tables"]["students"]["Row"],
  "id" | "name" | "email" | "prn" | "phone" | "is_active"
>;

type ResolvedRecipient = {
  student_id: string;
  name: string;
  enrollment_no: string;
  email: string | null;
  phone: string | null;
};

async function requireActiveAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: 401 as const, user: null };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !roleRow.is_active || (roleRow.role !== "admin" && roleRow.role !== "super_admin")) {
    return { status: 403 as const, user: null };
  }

  return { status: 200 as const, user };
}

function buildSummary(): ReminderSendSummary {
  return {
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    channelSummary: {
      email: { sent: 0, failed: 0 },
      whatsapp: { sent: 0, failed: 0 }
    }
  };
}

function mergeUploadContacts(student: StudentRecord, uploadRow?: UploadedReminderRecipient): ResolvedRecipient {
  return {
    student_id: student.id,
    name: student.name,
    enrollment_no: normalizeEnrollmentNo(student.prn),
    email: normalizeOptionalValue(student.email) ?? uploadRow?.email ?? null,
    phone: normalizeOptionalValue(student.phone) ?? uploadRow?.phone ?? null
  };
}

async function resolveRecipients(params: {
  admin: ReturnType<typeof createAdminClient>;
  recipientMode: "selected" | "upload" | "all";
  studentIds?: string[];
  uploadedRecipients?: UploadedReminderRecipient[];
}) {
  const { admin, recipientMode, studentIds, uploadedRecipients } = params;
  let recipients: ResolvedRecipient[] = [];
  let skippedCount = 0;

  if (recipientMode === "all") {
    const { data, error } = await admin
      .from("students")
      .select("id, name, email, prn, phone, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    recipients = (data ?? []).map((student) => mergeUploadContacts(student));
    return { recipients, skippedCount };
  }

  if (recipientMode === "selected") {
    const uniqueIds = Array.from(new Set(studentIds ?? []));
    const { data, error } = await admin
      .from("students")
      .select("id, name, email, prn, phone, is_active")
      .in("id", uniqueIds);

    if (error) {
      throw new Error(error.message);
    }

    recipients = (data ?? [])
      .filter((student) => student.is_active)
      .map((student) => mergeUploadContacts(student));

    return { recipients, skippedCount };
  }

  const dedupedUploads = dedupeUploadedReminderRecipients(uploadedRecipients ?? []);
  if (dedupedUploads.length === 0) {
    return { recipients, skippedCount };
  }

  const uploadMap = new Map(dedupedUploads.map((row) => [normalizeEnrollmentNo(row.enrollment_no), row]));
  const enrollmentNos = Array.from(uploadMap.keys());

  const { data, error } = await admin
    .from("students")
    .select("id, name, email, prn, phone, is_active")
    .in("prn", enrollmentNos);

  if (error) {
    throw new Error(error.message);
  }

  const studentMap = new Map(
    (data ?? [])
      .filter((student) => student.is_active)
      .map((student) => [normalizeEnrollmentNo(student.prn), student] as const)
  );

  recipients = dedupedUploads.flatMap((row) => {
    const matchedStudent = studentMap.get(normalizeEnrollmentNo(row.enrollment_no));
    if (!matchedStudent) {
      skippedCount += 1;
      return [];
    }

    return [mergeUploadContacts(matchedStudent, row)];
  });

  return { recipients, skippedCount };
}

export async function POST(request: Request) {
  const auth = await requireActiveAdmin();
  if (auth.status === 401) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (auth.status === 403 || !auth.user) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = reminderSendRequestSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstIssue?.message ?? "Invalid reminder request." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const summary = buildSummary();

  try {
    if (parsed.data.channels.includes("email") && !EMAIL_ENABLED) {
      return NextResponse.json(
        { success: false, error: "Email reminders are not configured yet." },
        { status: 400 }
      );
    }

    if (parsed.data.channels.includes("whatsapp") && !WHATSAPP_ENABLED) {
      return NextResponse.json(
        { success: false, error: "WhatsApp reminders are not configured yet." },
        { status: 400 }
      );
    }

    const { recipients, skippedCount } = await resolveRecipients({
      admin,
      recipientMode: parsed.data.recipientMode,
      studentIds: parsed.data.studentIds,
      uploadedRecipients: parsed.data.uploadedRecipients?.map((row) => ({
        enrollment_no: row.enrollment_no,
        email: row.email ?? null,
        phone: row.phone ?? null
      }))
    });

    summary.recipientCount = recipients.length;
    summary.skippedCount = skippedCount;

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matched students were found for this reminder." },
        { status: 400 }
      );
    }

    const { data: reminderRow, error: reminderError } = await admin
      .from("reminders")
      .insert({
        email_subject: parsed.data.channels.includes("email") ? parsed.data.emailSubject?.trim() ?? null : null,
        email_title: parsed.data.channels.includes("email") ? parsed.data.emailTitle?.trim() ?? null : null,
        message_email: parsed.data.channels.includes("email") ? parsed.data.messageEmail?.trim() ?? null : null,
        message_whatsapp: parsed.data.channels.includes("whatsapp")
          ? parsed.data.messageWhatsApp?.trim() ?? null
          : null,
        created_by: auth.user.id
      })
      .select("id")
      .single();

    if (reminderError || !reminderRow) {
      throw new Error(reminderError?.message ?? "Unable to create reminder log.");
    }

    const reminderRecipientPayload: Database["public"]["Tables"]["reminder_recipients"]["Insert"][] = [];

    for (const recipient of recipients) {
      for (const channel of parsed.data.channels) {
        try {
          if (channel === "email") {
            if (!recipient.email) {
              throw new Error("Recipient email is missing.");
            }

            await sendEmail({
              to: recipient.email,
              subject: parsed.data.emailSubject!.trim(),
              title: parsed.data.emailTitle!.trim(),
              message: parsed.data.messageEmail!.trim()
            });
          }

          if (channel === "whatsapp") {
            if (!recipient.phone) {
              throw new Error("Recipient phone number is missing.");
            }

            await sendWhatsApp({
              phone: recipient.phone,
              message: parsed.data.messageWhatsApp!.trim()
            });
          }

          summary.sentCount += 1;
          summary.channelSummary[channel].sent += 1;
          reminderRecipientPayload.push({
            reminder_id: reminderRow.id,
            student_id: recipient.student_id,
            channel,
            status: "sent",
            sent_at: new Date().toISOString()
          });
        } catch (error) {
          summary.failedCount += 1;
          summary.channelSummary[channel].failed += 1;
          console.error(`Reminder ${channel} send failed for ${recipient.student_id}`, error);
          reminderRecipientPayload.push({
            reminder_id: reminderRow.id,
            student_id: recipient.student_id,
            channel,
            status: "failed",
            sent_at: null
          });
        }
      }
    }

    const { error: reminderRecipientsError } = await admin
      .from("reminder_recipients")
      .insert(reminderRecipientPayload);

    if (reminderRecipientsError) {
      throw new Error(reminderRecipientsError.message);
    }

    return NextResponse.json(
      {
        success: true,
        summary
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Reminder send failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Reminder Failed"
      },
      { status: 500 }
    );
  }
}
