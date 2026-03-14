"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, History, Mail, MessageSquareText, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { normalizeEnrollmentNo } from "@/lib/reminders/utils";
import type { ReminderChannel, ReminderChannelSummary } from "@/lib/reminders/types";
import type { Database } from "@/types/database.types";

type ReminderRow = Pick<
  Database["public"]["Tables"]["reminders"]["Row"],
  "id" | "created_at" | "email_subject" | "email_title" | "message_email" | "message_whatsapp"
>;
type ReminderRecipientRow = Pick<
  Database["public"]["Tables"]["reminder_recipients"]["Row"],
  "id" | "reminder_id" | "student_id" | "channel" | "status" | "sent_at"
>;
type StudentRow = Pick<Database["public"]["Tables"]["students"]["Row"], "id" | "name" | "prn">;

type HistoryRecipient = {
  id: string;
  studentName: string;
  enrollmentNo: string;
  channel: ReminderChannel;
  status: "sent" | "failed";
  sentAt: string | null;
};

type ReminderHistoryItem = {
  id: string;
  createdAt: string;
  subject: string | null;
  title: string | null;
  emailMessage: string | null;
  whatsappMessage: string | null;
  totalStudents: number;
  channelSummary: Record<ReminderChannel, ReminderChannelSummary>;
  recipients: HistoryRecipient[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

function createEmptyChannelSummary(): Record<ReminderChannel, ReminderChannelSummary> {
  return {
    email: { sent: 0, failed: 0 },
    whatsapp: { sent: 0, failed: 0 }
  };
}

function buildHistoryItems(
  reminders: ReminderRow[],
  reminderRecipients: ReminderRecipientRow[],
  studentMap: Map<string, StudentRow>
): ReminderHistoryItem[] {
  const recipientsByReminder = new Map<string, HistoryRecipient[]>();

  for (const recipient of reminderRecipients) {
    const student = studentMap.get(recipient.student_id);
    const current = recipientsByReminder.get(recipient.reminder_id) ?? [];
    current.push({
      id: recipient.id,
      studentName: student?.name ?? "Unknown student",
      enrollmentNo: normalizeEnrollmentNo(student?.prn ?? "") || "Enrollment unavailable",
      channel: recipient.channel,
      status: recipient.status,
      sentAt: recipient.sent_at
    });
    recipientsByReminder.set(recipient.reminder_id, current);
  }

  return reminders.map((reminder) => {
    const recipients = recipientsByReminder.get(reminder.id) ?? [];
    const channelSummary = createEmptyChannelSummary();

    for (const recipient of recipients) {
      channelSummary[recipient.channel][recipient.status === "sent" ? "sent" : "failed"] += 1;
    }

    return {
      id: reminder.id,
      createdAt: reminder.created_at,
      subject: reminder.email_subject,
      title: reminder.email_title,
      emailMessage: reminder.message_email,
      whatsappMessage: reminder.message_whatsapp,
      totalStudents: new Set(recipients.map((recipient) => `${recipient.studentName}-${recipient.enrollmentNo}`)).size,
      channelSummary,
      recipients
    };
  });
}

function getReminderLabel(item: ReminderHistoryItem) {
  return item.subject || item.title || item.whatsappMessage || "Reminder batch";
}

export function ReminderHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ReminderHistoryItem[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadHistory() {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (ignore) {
        return;
      }

      if (authError || !user) {
        toast.error(authError?.message ?? "Unable to verify admin session.");
        setLoading(false);
        return;
      }

      const { data: reminderRows, error: reminderError } = await supabase
        .from("reminders")
        .select("id, created_at, email_subject, email_title, message_email, message_whatsapp")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (ignore) {
        return;
      }

      if (reminderError) {
        toast.error(reminderError.message);
        setLoading(false);
        return;
      }

      const reminderIds = (reminderRows ?? []).map((item) => item.id);
      if (reminderIds.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const { data: recipientRows, error: recipientError } = await supabase
        .from("reminder_recipients")
        .select("id, reminder_id, student_id, channel, status, sent_at")
        .in("reminder_id", reminderIds)
        .order("sent_at", { ascending: false });

      if (ignore) {
        return;
      }

      if (recipientError) {
        toast.error(recipientError.message);
        setLoading(false);
        return;
      }

      const studentIds = Array.from(new Set((recipientRows ?? []).map((row) => row.student_id)));
      let studentMap = new Map<string, StudentRow>();

      if (studentIds.length > 0) {
        const { data: studentRows, error: studentError } = await supabase.from("students").select("id, name, prn").in("id", studentIds);

        if (ignore) {
          return;
        }

        if (studentError) {
          toast.error(studentError.message);
          setLoading(false);
          return;
        }

        studentMap = new Map((studentRows ?? []).map((student) => [student.id, student] as const));
      }

      setHistory(buildHistoryItems(reminderRows ?? [], recipientRows ?? [], studentMap));
      setLoading(false);
    }

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, [supabase]);

  const totals = useMemo(() => {
    return history.reduce(
      (acc, item) => {
        acc.reminders += 1;
        acc.students += item.totalStudents;
        acc.emailSent += item.channelSummary.email.sent;
        acc.whatsappSent += item.channelSummary.whatsapp.sent;
        acc.failed += item.channelSummary.email.failed + item.channelSummary.whatsapp.failed;
        return acc;
      },
      { reminders: 0, students: 0, emailSent: 0, whatsappSent: 0, failed: 0 }
    );
  }, [history]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-[720px] rounded-3xl" />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            <Link href="/admin/messages" className="inline-flex items-center gap-1.5 text-neutral-500 transition hover:text-neutral-900">
              <ArrowLeft className="h-4 w-4" />
              Broadcasts
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-900">Reminder History</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Reminder History</h1>
          <p className="max-w-3xl text-sm leading-6 text-neutral-500">
            Review every reminder batch in one place, including who received it, which channel was used, and what succeeded or failed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10 rounded-xl border-neutral-200">
            <Link href="/admin/messages/reminders/new">Create Reminder</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl border-neutral-200">
            <Link href="/admin/messages">Back to Broadcasts</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardContent className="px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Reminder batches</div>
            <div className="mt-3 text-2xl font-semibold text-neutral-950">{totals.reminders}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardContent className="px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Students reached</div>
            <div className="mt-3 text-2xl font-semibold text-neutral-950">{totals.students}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardContent className="px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Email sent</div>
            <div className="mt-3 flex items-center gap-2 text-2xl font-semibold text-neutral-950">
              <Mail className="h-5 w-5 text-blue-600" />
              {totals.emailSent}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardContent className="px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">WhatsApp sent</div>
            <div className="mt-3 flex items-center gap-2 text-2xl font-semibold text-neutral-950">
              <MessageSquareText className="h-5 w-5 text-blue-600" />
              {totals.whatsappSent}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-neutral-200 shadow-sm">
          <CardContent className="px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Failed attempts</div>
            <div className="mt-3 flex items-center gap-2 text-2xl font-semibold text-red-600">
              <XCircle className="h-5 w-5" />
              {totals.failed}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {history.length === 0 ? (
          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardContent className="px-6 py-8 text-sm text-neutral-500">No reminder history yet. Your first reminder send will appear here.</CardContent>
          </Card>
        ) : (
          history.map((item) => (
            <Card key={item.id} className="rounded-3xl border-neutral-200 shadow-sm">
              <CardHeader className="space-y-3 border-b border-neutral-100 pb-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-neutral-950">{getReminderLabel(item)}</CardTitle>
                    <CardDescription className="mt-2">Sent on {formatDateTime(item.createdAt)}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                      <Users className="mr-1 h-3.5 w-3.5" />
                      {item.totalStudents} students
                    </Badge>
                    {item.channelSummary.email.sent + item.channelSummary.email.failed > 0 ? (
                      <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                        Email {item.channelSummary.email.sent}/{item.channelSummary.email.sent + item.channelSummary.email.failed}
                      </Badge>
                    ) : null}
                    {item.channelSummary.whatsapp.sent + item.channelSummary.whatsapp.failed > 0 ? (
                      <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                        WhatsApp {item.channelSummary.whatsapp.sent}/{item.channelSummary.whatsapp.sent + item.channelSummary.whatsapp.failed}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {(item.subject || item.title) && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    {item.subject ? <div className="text-sm font-medium text-neutral-900">Subject: {item.subject}</div> : null}
                    {item.title ? <div className="mt-1 text-sm text-neutral-600">Title: {item.title}</div> : null}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Enrollment No</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell className="font-medium text-neutral-900">{recipient.studentName}</TableCell>
                          <TableCell>{recipient.enrollmentNo}</TableCell>
                          <TableCell>{recipient.channel === "email" ? "Email" : "WhatsApp"}</TableCell>
                          <TableCell>
                            <span className={recipient.status === "sent" ? "inline-flex items-center gap-1 text-green-700" : "inline-flex items-center gap-1 text-red-600"}>
                              {recipient.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {recipient.status === "sent" ? "Sent" : "Failed"}
                            </span>
                          </TableCell>
                          <TableCell>{formatDateTime(recipient.sentAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
