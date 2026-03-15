"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Eye,
  FileSpreadsheet,
  Highlighter,
  History,
  Mail,
  MessageSquareText,
  Search,
  SendHorizontal,
  Type,
  Underline,
  Upload,
  Users
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { BRANCHES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { formatReminderMessageHtml } from "@/lib/reminders/emailFormatting";
import type {
  ReminderChannel,
  ReminderChannelAvailability,
  ReminderRecipientMode,
  ReminderSendRequest,
  ReminderSendResponse,
  UploadedReminderRecipient
} from "@/lib/reminders/types";
import { parseReminderWorkbook } from "@/lib/reminders/upload";
import { dedupeUploadedReminderRecipients, normalizeEnrollmentNo } from "@/lib/reminders/utils";
import type { Database } from "@/types/database.types";

type StudentRow = Pick<
  Database["public"]["Tables"]["students"]["Row"],
  "id" | "name" | "email" | "phone" | "prn" | "is_active" | "branch" | "batch_year"
>;

type SendReminderPageProps = ReminderChannelAvailability & {
  senderEmail?: string;
};

function buildSummaryDescription(summary: NonNullable<ReminderSendResponse["summary"]>) {
  return `${summary.sentCount} sent, ${summary.failedCount} failed, ${summary.skippedCount} skipped across ${summary.recipientCount} students.`;
}

export function SendReminderPage({ emailEnabled, whatsappEnabled, senderEmail }: SendReminderPageProps) {
  const supabase = useMemo(() => createClient(), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [recipientMode, setRecipientMode] = useState<ReminderRecipientMode>("selected");
  const [channels, setChannels] = useState<ReminderChannel[]>(emailEnabled ? ["email"] : whatsappEnabled ? ["whatsapp"] : []);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [uploadedRows, setUploadedRows] = useState<UploadedReminderRecipient[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailTitle, setEmailTitle] = useState("");
  const [messageEmail, setMessageEmail] = useState("");
  const [messageWhatsApp, setMessageWhatsApp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const senderIdentity = senderEmail?.trim() || "mitadt@contact.placepro.in";

  useEffect(() => {
    setChannels((current) => {
      const next = current.filter((channel) => {
        if (channel === "email") return emailEnabled;
        return whatsappEnabled;
      });

      if (next.length > 0) {
        return next;
      }

      if (emailEnabled) {
        return ["email"];
      }

      if (whatsappEnabled) {
        return ["whatsapp"];
      }

      return [];
    });
  }, [emailEnabled, whatsappEnabled]);

  useEffect(() => {
    let ignore = false;

    async function loadStudents() {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, email, phone, prn, is_active, branch, batch_year")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (ignore) {
        return;
      }

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      setStudents(data ?? []);
      setLoading(false);
    }

    void loadStudents();

    return () => {
      ignore = true;
    };
  }, [supabase]);

  const studentsByEnrollment = useMemo(() => {
    return new Map(
      students
        .map((student) => [normalizeEnrollmentNo(student.prn), student] as const)
        .filter(([enrollmentNo]) => Boolean(enrollmentNo))
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = studentSearchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const matchesBranch = branchFilter === "all" ? true : student.branch === branchFilter;
      const matchesBatch = batchFilter === "all" ? true : String(student.batch_year) === batchFilter;
      return (
        matchesBranch &&
        matchesBatch &&
        (!query ||
          student.name.toLowerCase().includes(query) ||
          (student.email ?? "").toLowerCase().includes(query) ||
          (student.prn ?? "").toLowerCase().includes(query) ||
          (student.phone ?? "").toLowerCase().includes(query))
      );
    });
  }, [batchFilter, branchFilter, studentSearchQuery, students]);

  const availableBatches = useMemo(() => {
    return [...new Set(students.map((student) => student.batch_year))].sort((left, right) => left - right);
  }, [students]);

  const selectedRecipients = useMemo(() => {
    const selectedSet = new Set(selectedStudentIds);
    return students.filter((student) => selectedSet.has(student.id));
  }, [selectedStudentIds, students]);

  const dedupedUploadRows = useMemo(() => dedupeUploadedReminderRecipients(uploadedRows), [uploadedRows]);

  const uploadPreview = useMemo(() => {
    let matchedCount = 0;
    let unmatchedCount = 0;
    let emailReadyCount = 0;
    let whatsappReadyCount = 0;

    for (const row of dedupedUploadRows) {
      const matchedStudent = studentsByEnrollment.get(normalizeEnrollmentNo(row.enrollment_no));
      if (!matchedStudent) {
        unmatchedCount += 1;
        continue;
      }

      matchedCount += 1;
      if (matchedStudent.email || row.email) {
        emailReadyCount += 1;
      }
      if (matchedStudent.phone || row.phone) {
        whatsappReadyCount += 1;
      }
    }

    return {
      total: dedupedUploadRows.length,
      matchedCount,
      unmatchedCount,
      emailReadyCount,
      whatsappReadyCount
    };
  }, [dedupedUploadRows, studentsByEnrollment]);

  const readiness = useMemo(() => {
    if (recipientMode === "upload") {
      return {
        audience: uploadPreview.total,
        matched: uploadPreview.matchedCount,
        emailReady: uploadPreview.emailReadyCount,
        whatsappReady: uploadPreview.whatsappReadyCount,
        unmatched: uploadPreview.unmatchedCount
      };
    }

    const recipientSet = recipientMode === "all" ? students : selectedRecipients;
    return {
      audience: recipientSet.length,
      matched: recipientSet.length,
      emailReady: recipientSet.filter((student) => Boolean(student.email)).length,
      whatsappReady: recipientSet.filter((student) => Boolean(student.phone)).length,
      unmatched: 0
    };
  }, [recipientMode, selectedRecipients, students, uploadPreview]);

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => {
      if (checked) {
        return current.includes(studentId) ? current : [...current, studentId];
      }

      return current.filter((value) => value !== studentId);
    });
  };

  const toggleChannel = (channel: ReminderChannel, checked: boolean) => {
    if ((channel === "email" && !emailEnabled) || (channel === "whatsapp" && !whatsappEnabled)) {
      return;
    }

    setChannels((current) => {
      if (checked) {
        return current.includes(channel) ? current : [...current, channel];
      }

      return current.filter((value) => value !== channel);
    });
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setUploadError("Only .xlsx files are supported.");
      setUploadedRows([]);
      return;
    }

    try {
      const parsedRows = await parseReminderWorkbook(file);
      setUploadedRows(parsedRows);
      setUploadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse the Excel file.";
      setUploadError(message);
      setUploadedRows([]);
    }
  };

  const updateEmailMessageWithSelection = (transform: (selected: string) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = messageEmail.slice(start, end);
    const fallback = selectedText || "text";
    const nextValue = `${messageEmail.slice(0, start)}${transform(fallback)}${messageEmail.slice(end)}`;

    setMessageEmail(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPosition = start + transform(fallback).length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    });
  };

  const applyBulletList = () => {
    updateEmailMessageWithSelection((selected) =>
      selected
        .split("\n")
        .map((line) => (line.trim() ? `- ${line.replace(/^[-•]\s*/, "")}` : "- text"))
        .join("\n")
    );
  };

  const handleSendReminder = async () => {
    if (channels.length === 0) {
      toast.error("Select at least one enabled channel.");
      return;
    }

    if (recipientMode === "selected" && selectedStudentIds.length === 0) {
      toast.error("Select at least one student.");
      return;
    }

    if (recipientMode === "upload" && dedupedUploadRows.length === 0) {
      toast.error("Upload an Excel file before sending reminders.");
      return;
    }

    if (channels.includes("email")) {
      if (!emailSubject.trim()) {
        toast.error("Email subject is required.");
        return;
      }
      if (!emailTitle.trim()) {
        toast.error("Email title is required.");
        return;
      }
      if (!messageEmail.trim()) {
        toast.error("Email message is required.");
        return;
      }
    }

    if (channels.includes("whatsapp") && !messageWhatsApp.trim()) {
      toast.error("WhatsApp message is required.");
      return;
    }

    const payload: ReminderSendRequest = {
      recipientMode,
      studentIds: recipientMode === "selected" ? selectedStudentIds : undefined,
      uploadedRecipients:
        recipientMode === "upload"
          ? dedupedUploadRows.map((row) => ({
              enrollment_no: row.enrollment_no,
              email: row.email,
              phone: row.phone
            }))
          : undefined,
      channels,
      emailSubject: channels.includes("email") ? emailSubject.trim() : undefined,
      emailTitle: channels.includes("email") ? emailTitle.trim() : undefined,
      messageEmail: channels.includes("email") ? messageEmail.trim() : undefined,
      messageWhatsApp: channels.includes("whatsapp") ? messageWhatsApp.trim() : undefined
    };

    setSubmitting(true);

    try {
      const response = await fetch("/api/reminders/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => null)) as ReminderSendResponse | null;
      if (!response.ok || !data?.success || !data.summary) {
        toast.error(data?.error ?? "Reminder Failed");
        return;
      }

      if (data.summary.failedCount > 0 || data.summary.skippedCount > 0) {
        toast.warning("Reminder Sent Successfully", {
          description: buildSummaryDescription(data.summary)
        });
      } else {
        toast.success("Reminder Sent Successfully", {
          description: buildSummaryDescription(data.summary)
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reminder Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-[760px] rounded-3xl" />
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              <Link href="/admin/messages" className="inline-flex items-center gap-1.5 text-neutral-500 transition hover:text-neutral-900">
                <ArrowLeft className="h-4 w-4" />
                Broadcasts
              </Link>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900">Send Reminder</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Send Reminder</h1>
            <p className="max-w-3xl text-sm leading-6 text-neutral-500">
              Draft official reminder emails and WhatsApp nudges from the broadcast desk, review recipient readiness, and send
              with a clear, professional workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="h-10 rounded-xl border-neutral-200">
              <Link href="/admin/messages/reminders/history">
                <History className="mr-2 h-4 w-4" />
                View History
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl border-neutral-200">
              <Link href="/admin/messages">Back to Broadcasts</Link>
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border-neutral-200 shadow-sm">
          <CardHeader className="space-y-2 border-b border-neutral-100 pb-5">
            <CardTitle className="text-xl text-neutral-950">Recipients</CardTitle>
            <CardDescription>
              Choose the audience first. We will always use the portal contact details when a student already has them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <RadioGroup
              value={recipientMode}
              onValueChange={(value) => setRecipientMode(value as ReminderRecipientMode)}
              className="grid gap-3 lg:grid-cols-3"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <RadioGroupItem value="selected" id="recipient-selected" className="mt-1" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">Selected Students</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Search and choose exact students from the portal directory.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <RadioGroupItem value="upload" id="recipient-upload" className="mt-1" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">Upload Excel</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Upload the approved `.xlsx` format and match rows by Enrollment No.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <RadioGroupItem value="all" id="recipient-all" className="mt-1" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">All Students</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Send this reminder to every active student profile in the portal.</p>
                </div>
              </label>
            </RadioGroup>

            {recipientMode === "selected" ? (
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      value={studentSearchQuery}
                      onChange={(event) => setStudentSearchQuery(event.target.value)}
                      placeholder="Search students..."
                      className="h-11 rounded-xl border-neutral-200 bg-white pl-9"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      className="h-11 min-w-[170px] rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-blue-500"
                      value={branchFilter}
                      onChange={(event) => setBranchFilter(event.target.value)}
                      aria-label="Filter by branch"
                    >
                      <option value="all">All Branches</option>
                      {BRANCHES.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 min-w-[170px] rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-blue-500"
                      value={batchFilter}
                      onChange={(event) => setBatchFilter(event.target.value)}
                      aria-label="Filter by batch"
                    >
                      <option value="all">All Batches</option>
                      {availableBatches.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <Badge variant="secondary" className="rounded-full border-neutral-200 bg-white text-neutral-600">
                    {filteredStudents.length} visible
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border-neutral-200 bg-white text-neutral-600">
                    {selectedStudentIds.length} selected
                  </Badge>
                </div>

                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pick</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Enrollment No</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Mobile No</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-neutral-500">
                            No students found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student) => {
                          const isChecked = selectedStudentIds.includes(student.id);
                          return (
                            <TableRow key={student.id}>
                              <TableCell>
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => toggleStudent(student.id, checked === true)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <div className="font-medium text-neutral-900">{student.name}</div>
                                  <div className="text-xs text-neutral-500">{student.email || "No email added"}</div>
                                </div>
                              </TableCell>
                              <TableCell>{student.branch || "Pending"}</TableCell>
                              <TableCell>{student.batch_year}</TableCell>
                              <TableCell>{student.prn ?? "Pending"}</TableCell>
                              <TableCell>{student.email || "Not available"}</TableCell>
                              <TableCell>{student.phone || "Not available"}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {recipientMode === "upload" ? (
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-neutral-600">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">Upload reminder recipients</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        Use the downloaded template with Enrollment_No, Email, and Phone.
                      </p>
                      <a
                        href="/api/reminders/template"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Download Template
                      </a>
                    </div>
                    <Label
                      htmlFor="reminder-upload-file"
                      className="inline-flex cursor-pointer items-center rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload .xlsx
                    </Label>
                  </div>
                  <Input id="reminder-upload-file" type="file" accept=".xlsx" onChange={handleUploadChange} className="hidden" />
                </div>

                {uploadError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{uploadError}</div> : null}

                {dedupedUploadRows.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Rows uploaded</div>
                      <div className="mt-2 text-2xl font-semibold text-neutral-950">{uploadPreview.total}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Matched</div>
                      <div className="mt-2 text-2xl font-semibold text-neutral-950">{uploadPreview.matchedCount}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Unmatched</div>
                      <div className="mt-2 text-2xl font-semibold text-neutral-950">{uploadPreview.unmatchedCount}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Ready</div>
                      <div className="mt-2 text-sm font-medium text-neutral-900">Email {uploadPreview.emailReadyCount} • WhatsApp {uploadPreview.whatsappReadyCount}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {recipientMode === "all" ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 px-4 py-4 text-sm leading-6 text-neutral-600">
                All active students in the portal will be included in this reminder send.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-neutral-200 shadow-sm">
          <CardHeader className="space-y-2 border-b border-neutral-100 pb-5">
            <CardTitle className="text-xl text-neutral-950">Channels</CardTitle>
            <CardDescription>Select the channels you want to prepare for this reminder send.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <label className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={channels.includes("email")}
                  onCheckedChange={(checked) => toggleChannel("email", checked === true)}
                  disabled={!emailEnabled}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">Email</p>
                  <p className="mt-1 text-xs text-neutral-500">Professional reminder mail through Resend.</p>
                </div>
              </div>
              <Badge variant="secondary" className={emailEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"}>
                {emailEnabled ? "Configured" : "Not configured"}
              </Badge>
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={channels.includes("whatsapp")}
                  onCheckedChange={(checked) => toggleChannel("whatsapp", checked === true)}
                  disabled={!whatsappEnabled}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">WhatsApp</p>
                  <p className="mt-1 text-xs text-neutral-500">Fast follow-up message for students with reachable numbers.</p>
                </div>
              </div>
              <Badge variant="secondary" className={whatsappEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-neutral-200 bg-neutral-50 text-neutral-500"}>
                {whatsappEnabled ? "Configured" : "Not configured"}
              </Badge>
            </label>
          </CardContent>
        </Card>

        {channels.includes("email") ? (
          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="space-y-2 border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Email Composer</CardTitle>
              <CardDescription>Draft the email the way you would in a real mail client, then open preview only when needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 text-sm">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-neutral-900">From</span>
                  <span className="text-neutral-500">MIT-ADT Placement Cell &lt;{senderIdentity}&gt;</span>
                </div>
                <div className="grid gap-0 border-b border-neutral-100 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="px-4 py-3 text-sm font-medium text-neutral-600">Email Subject</div>
                  <div className="px-4 py-2">
                    <Input
                      value={emailSubject}
                      onChange={(event) => setEmailSubject(event.target.value)}
                      placeholder="Placement update for shortlisted students"
                      className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="grid gap-0 border-b border-neutral-100 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="px-4 py-3 text-sm font-medium text-neutral-600">Email Title</div>
                  <div className="px-4 py-2">
                    <Input
                      value={emailTitle}
                      onChange={(event) => setEmailTitle(event.target.value)}
                      placeholder="Important next steps for your placement round"
                      className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="border-b border-neutral-100 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-neutral-200" onClick={() => updateEmailMessageWithSelection((selected) => `**${selected}**`)}>
                      <Type className="mr-2 h-4 w-4" />
                      Bold
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-neutral-200" onClick={() => updateEmailMessageWithSelection((selected) => `__${selected}__`)}>
                      <Underline className="mr-2 h-4 w-4" />
                      Underline
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-neutral-200" onClick={() => updateEmailMessageWithSelection((selected) => `==${selected}==`)}>
                      <Highlighter className="mr-2 h-4 w-4" />
                      Highlight
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-neutral-200" onClick={applyBulletList}>
                      <Users className="mr-2 h-4 w-4" />
                      Bullet List
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="ml-auto h-9 rounded-lg border-neutral-200" onClick={() => setPreviewOpen(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Email
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">Use **bold**, __underline__, ==highlight==, or bullets to make key instructions stand out.</p>
                </div>
                <div className="px-4 py-4">
                  <Textarea
                    ref={textareaRef}
                    value={messageEmail}
                    onChange={(event) => setMessageEmail(event.target.value)}
                    placeholder="Write the email body here. Include schedules, next steps, reporting instructions, and contact guidance."
                    className="min-h-[280px] resize-y rounded-2xl border-neutral-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {channels.includes("whatsapp") ? (
          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="space-y-2 border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">WhatsApp Composer</CardTitle>
              <CardDescription>Keep this concise and action-oriented for mobile reading.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Textarea
                value={messageWhatsApp}
                onChange={(event) => setMessageWhatsApp(event.target.value)}
                placeholder="Share the exact WhatsApp reminder message here."
                className="min-h-[180px] rounded-2xl border-neutral-200"
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-3xl border-neutral-200 shadow-sm">
          <CardHeader className="space-y-2 border-b border-neutral-100 pb-5">
            <CardTitle className="text-xl text-neutral-950">Send Readiness</CardTitle>
            <CardDescription>Check the audience and channel readiness once, then send with confidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Audience</div>
                <div className="mt-2 text-2xl font-semibold text-neutral-950">{readiness.audience}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Matched</div>
                <div className="mt-2 text-2xl font-semibold text-neutral-950">{readiness.matched}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Email-ready</div>
                <div className="mt-2 text-2xl font-semibold text-neutral-950">{readiness.emailReady}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">WhatsApp-ready</div>
                <div className="mt-2 text-2xl font-semibold text-neutral-950">{readiness.whatsappReady}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Channels</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {channels.length > 0 ? (
                    channels.map((channel) => (
                      <Badge key={channel} variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                        {channel === "email" ? "Email" : "WhatsApp"}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary" className="border-neutral-200 bg-white text-neutral-500">
                      None selected
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {readiness.unmatched > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {readiness.unmatched} uploaded row{readiness.unmatched === 1 ? "" : "s"} could not be matched and will be skipped during delivery.
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button asChild variant="outline" className="h-11 rounded-xl border-neutral-200">
                <Link href="/admin/messages/reminders/history">
                  <History className="mr-2 h-4 w-4" />
                  Reminder History
                </Link>
              </Button>
              <Button className="h-11 rounded-xl px-6" onClick={handleSendReminder} disabled={submitting || channels.length === 0}>
                <SendHorizontal className="mr-2 h-4 w-4" />
                {submitting ? "Sending Reminder..." : "Send Reminder"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl rounded-3xl border-neutral-200 p-0 shadow-2xl">
          <DialogHeader className="border-b border-neutral-100 px-6 py-5">
            <DialogTitle className="text-xl text-neutral-950">Email Preview</DialogTitle>
            <DialogDescription>Review the email card before sending through Resend.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-6">
            <div className="mx-auto max-w-3xl rounded-3xl border border-neutral-200 bg-white px-8 py-8 shadow-sm">
              <div className="border-b border-neutral-200 pb-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">MIT-ADT Placement Portal</div>
                <div className="mt-3 text-sm text-neutral-600">From: MIT-ADT Placement Cell &lt;{senderIdentity}&gt;</div>
                <div className="mt-3 text-sm text-neutral-700">{emailSubject.trim() || "Your reminder subject will appear here"}</div>
                <div className="mt-4 text-[32px] font-semibold leading-tight text-neutral-950">{emailTitle.trim() || "Your email title will appear here"}</div>
              </div>
              <div className="py-8 text-[15px] leading-8 text-neutral-700" dangerouslySetInnerHTML={{ __html: formatReminderMessageHtml(messageEmail || "Write the email body here. The preview updates as you draft.") }} />
              <div className="border-t border-neutral-200 pt-5">
                <div className="text-sm font-semibold text-neutral-950">PlacePro</div>
                <div className="mt-1 text-sm text-neutral-500">Official communication from the MIT-ADT placement portal.</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
