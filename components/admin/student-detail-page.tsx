"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ExternalLink,
  FileCheck,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BRANCHES } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

type StudentDetailPayload = {
  student: StudentRow;
  documents: DocumentRow[];
  applications: ApplicationRow[];
  companies: CompanyRow[];
};

type StudentFormState = {
  name: string;
  email: string;
  enrollment_no: string;
  mobile: string;
  branch: string;
  batch_year: string;
  is_active: boolean;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  tenth_board: string;
  tenth_school: string;
  tenth_year: string;
  tenth_percentage: string;
  twelfth_board: string;
  twelfth_college: string;
  twelfth_year: string;
  twelfth_percentage: string;
  current_backlogs: string;
  cgpa_sem1: string;
  cgpa_sem2: string;
  cgpa_sem3: string;
  cgpa_sem4: string;
  cgpa_sem5: string;
  cgpa_sem6: string;
  cgpa_sem7: string;
  cgpa_sem8: string;
  overall_cgpa: string;
};

type SemesterField =
  | "cgpa_sem1"
  | "cgpa_sem2"
  | "cgpa_sem3"
  | "cgpa_sem4"
  | "cgpa_sem5"
  | "cgpa_sem6"
  | "cgpa_sem7"
  | "cgpa_sem8";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return dateFormatter.format(parsed);
}

function displayNumber(value?: number | null, suffix: string = "") {
  if (typeof value !== "number") return "Not added";
  return `${value.toFixed(2).replace(/\.00$/, "")}${suffix}`;
}

function toInputValue(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildFormState(student: StudentRow): StudentFormState {
  return {
    name: student.name,
    email: student.email,
    enrollment_no: student.prn ?? "",
    mobile: student.phone ?? "",
    branch: student.branch ?? "CSE",
    batch_year: String(student.batch_year),
    is_active: student.is_active,
    linkedin_url: student.linkedin_url ?? "",
    github_url: student.github_url ?? "",
    portfolio_url: student.portfolio_url ?? "",
    tenth_board: student.tenth_board ?? "",
    tenth_school: student.tenth_school ?? "",
    tenth_year: toInputValue(student.tenth_year),
    tenth_percentage: toInputValue(student.tenth_percentage),
    twelfth_board: student.twelfth_board ?? "",
    twelfth_college: student.twelfth_college ?? "",
    twelfth_year: toInputValue(student.twelfth_year),
    twelfth_percentage: toInputValue(student.twelfth_percentage),
    current_backlogs: String(student.current_backlogs ?? 0),
    cgpa_sem1: toInputValue(student.cgpa_sem1),
    cgpa_sem2: toInputValue(student.cgpa_sem2),
    cgpa_sem3: toInputValue(student.cgpa_sem3),
    cgpa_sem4: toInputValue(student.cgpa_sem4),
    cgpa_sem5: toInputValue(student.cgpa_sem5),
    cgpa_sem6: toInputValue(student.cgpa_sem6),
    cgpa_sem7: toInputValue(student.cgpa_sem7),
    cgpa_sem8: toInputValue(student.cgpa_sem8),
    overall_cgpa: toInputValue(student.overall_cgpa)
  };
}

export function StudentDetailPage({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StudentDetailPayload | null>(null);
  const [draft, setDraft] = useState<StudentFormState | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadStudent() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/students/${studentId}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as (StudentDetailPayload & { error?: string }) | null;

        if (!response.ok || !data || !("student" in data)) {
          throw new Error(data?.error ?? "Unable to load student details.");
        }

        if (ignore) return;

        setPayload(data);
        setDraft(buildFormState(data.student));
      } catch (error) {
        if (!ignore) {
          const message = error instanceof Error ? error.message : "Unable to load student details.";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadStudent();

    return () => {
      ignore = true;
    };
  }, [studentId]);

  const companyMap = useMemo(() => {
    return new Map((payload?.companies ?? []).map((company) => [company.id, company]));
  }, [payload?.companies]);

  const documents = payload?.documents ?? [];
  const applications = payload?.applications ?? [];
  const student = payload?.student ?? null;

  const stats = useMemo(() => {
    const verifiedDocs = documents.filter((document) => document.verified).length;
    const activeApplications = applications.filter((application) =>
      ["applied", "shortlisted", "interview"].includes(application.status)
    ).length;
    const selectedApplications = applications.filter((application) => application.status === "selected").length;

    return {
      verifiedDocs,
      pendingDocs: documents.length - verifiedDocs,
      activeApplications,
      selectedApplications
    };
  }, [applications, documents]);

  const handleFieldChange = (field: keyof StudentFormState, value: string | boolean) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const resetDraft = () => {
    if (student) {
      setDraft(buildFormState(student));
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });

      const data = (await response.json().catch(() => null)) as ({ student?: StudentRow; error?: string } | null);

      if (!response.ok || !data?.student) {
        throw new Error(data?.error ?? "Unable to save student changes.");
      }

      const nextPayload = payload
        ? {
            ...payload,
            student: data.student
          }
        : null;

      setPayload(nextPayload);
      setDraft(buildFormState(data.student));
      toast.success("Student details updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save student changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft || !student) {
    if (!loading && error) {
      return (
        <section className="space-y-6">
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700">
            {error}
          </div>
          <Button asChild variant="outline" className="rounded-xl border-neutral-200">
            <Link href="/admin/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Link>
          </Button>
        </section>
      );
    }

    return (
      <section className="space-y-6">
        <Skeleton className="h-14 w-72 rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-[780px] w-full rounded-3xl" />
      </section>
    );
  }

  return (
    <section className="space-y-6 pb-10">
      <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 border border-neutral-200 shadow-sm">
              <AvatarImage src={student.avatar_url ?? undefined} alt={student.name} />
              <AvatarFallback className="bg-neutral-900 text-xl font-semibold text-white">
                {draft.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-neutral-500 transition hover:text-neutral-900">
                  <ArrowLeft className="h-4 w-4" />
                  Students
                </Link>
                <span className="text-neutral-300">/</span>
                <span className="text-neutral-900">Student Workspace</span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{draft.name || "Student profile"}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
                  <span>{draft.branch || "Branch pending"}</span>
                  <span className="text-neutral-300">•</span>
                  <span>Batch {draft.batch_year || "-"}</span>
                  <span className="text-neutral-300">•</span>
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-400">
                    {draft.enrollment_no || "Enrollment pending"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={draft.is_active ? "secondary" : "destructive"} className="rounded-full px-3 py-1">
                  {draft.is_active ? "Active account" : "Inactive account"}
                </Badge>
                <Badge variant={student.profile_complete ? "success" : "secondary"} className="rounded-full px-3 py-1">
                  {student.profile_complete ? "Profile complete" : "Profile in progress"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-400" />
                  {draft.email}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-neutral-400" />
                  {draft.mobile || "Auto-generated if left blank"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
            <Button className="h-11 rounded-xl px-5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving changes..." : "Save Changes"}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl border-neutral-200 px-5" onClick={resetDraft}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Identity & Contact</CardTitle>
              <CardDescription>Edit the official student record used across the portal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="student-name">Full Name</Label>
                <Input id="student-name" value={draft.name} onChange={(event) => handleFieldChange("name", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-email">Email</Label>
                <Input id="student-email" type="email" value={draft.email} onChange={(event) => handleFieldChange("email", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-mobile">Mobile No</Label>
                <Input
                  id="student-mobile"
                  maxLength={10}
                  placeholder="Leave blank to auto-generate"
                  value={draft.mobile}
                  onChange={(event) => handleFieldChange("mobile", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-enrollment">Enrollment No</Label>
                <Input id="student-enrollment" value={draft.enrollment_no} onChange={(event) => handleFieldChange("enrollment_no", event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-batch">Batch</Label>
                <Input id="student-batch" type="number" value={draft.batch_year} onChange={(event) => handleFieldChange("batch_year", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-branch">Branch</Label>
                <select
                  id="student-branch"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-blue-500"
                  value={draft.branch}
                  onChange={(event) => handleFieldChange("branch", event.target.value)}
                >
                  {BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 md:col-span-2">
                <Checkbox checked={draft.is_active} onCheckedChange={(checked) => handleFieldChange("is_active", checked === true)} />
                <div>
                  <div className="text-sm font-medium text-neutral-900">Keep account active</div>
                  <div className="text-xs text-neutral-500">Inactive students remain in records but lose admin-enabled access flows.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Portfolio Links</CardTitle>
              <CardDescription>Keep public profile URLs current for recruiters and admin reviews.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="student-linkedin">LinkedIn</Label>
                <Input id="student-linkedin" value={draft.linkedin_url} onChange={(event) => handleFieldChange("linkedin_url", event.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-github">GitHub</Label>
                <Input id="student-github" value={draft.github_url} onChange={(event) => handleFieldChange("github_url", event.target.value)} placeholder="https://github.com/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-portfolio">Portfolio</Label>
                <Input id="student-portfolio" value={draft.portfolio_url} onChange={(event) => handleFieldChange("portfolio_url", event.target.value)} placeholder="https://portfolio.example.com" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Academic Record</CardTitle>
              <CardDescription>Update school history, percentages, backlogs, and overall profile strength.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm font-semibold text-neutral-900">Class 10</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Board</Label>
                      <Input value={draft.tenth_board} onChange={(event) => handleFieldChange("tenth_board", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input type="number" value={draft.tenth_year} onChange={(event) => handleFieldChange("tenth_year", event.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>School</Label>
                      <Input value={draft.tenth_school} onChange={(event) => handleFieldChange("tenth_school", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Percentage</Label>
                      <Input type="number" step="0.01" value={draft.tenth_percentage} onChange={(event) => handleFieldChange("tenth_percentage", event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm font-semibold text-neutral-900">Class 12 / Diploma</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Board</Label>
                      <Input value={draft.twelfth_board} onChange={(event) => handleFieldChange("twelfth_board", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input type="number" value={draft.twelfth_year} onChange={(event) => handleFieldChange("twelfth_year", event.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>College</Label>
                      <Input value={draft.twelfth_college} onChange={(event) => handleFieldChange("twelfth_college", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Percentage</Label>
                      <Input type="number" step="0.01" value={draft.twelfth_percentage} onChange={(event) => handleFieldChange("twelfth_percentage", event.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Current Backlogs</Label>
                  <Input type="number" value={draft.current_backlogs} onChange={(event) => handleFieldChange("current_backlogs", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Overall CGPA</Label>
                  <Input type="number" step="0.01" value={draft.overall_cgpa} onChange={(event) => handleFieldChange("overall_cgpa", event.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Semester CGPA</CardTitle>
              <CardDescription>Edit semester-level scores used in eligibility reviews and profile completeness.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-4">
              {([
                ["cgpa_sem1", "Semester 1"],
                ["cgpa_sem2", "Semester 2"],
                ["cgpa_sem3", "Semester 3"],
                ["cgpa_sem4", "Semester 4"],
                ["cgpa_sem5", "Semester 5"],
                ["cgpa_sem6", "Semester 6"],
                ["cgpa_sem7", "Semester 7"],
                ["cgpa_sem8", "Semester 8"]
              ] as Array<[SemesterField, string]>).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  <Input type="number" step="0.01" value={draft[field]} onChange={(event) => handleFieldChange(field, event.target.value)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Profile Health</CardTitle>
              <CardDescription>Operational summary for documents, applications, and profile readiness.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {[
                { label: "Profile completion", value: student.profile_complete ? "Complete" : "In progress", icon: ShieldCheck },
                { label: "Documents", value: `${documents.length} total • ${stats.verifiedDocs} verified`, icon: FileCheck },
                { label: "Applications", value: `${applications.length} total • ${stats.activeApplications} active`, icon: Briefcase },
                { label: "Created", value: formatDateTime(student.created_at), icon: CalendarDays },
                { label: "Overall CGPA", value: displayNumber(student.overall_cgpa), icon: GraduationCap }
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
                  <div className="rounded-xl bg-neutral-100 p-2 text-neutral-600">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">{item.label}</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{item.value}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Documents</CardTitle>
              <CardDescription>Latest uploads and verification status for this student.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {documents.length > 0 ? (
                documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">{document.doc_type.replace(/_/g, " ").toUpperCase()}</div>
                        <div className="mt-1 text-xs text-neutral-500">{document.file_name || "Uploaded file"}</div>
                        <div className="mt-1 text-xs text-neutral-400">{formatDateTime(document.uploaded_at)}</div>
                      </div>
                      <Badge variant={document.verified ? "success" : "secondary"} className="rounded-full px-3 py-1">
                        {document.verified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-neutral-500">
                        {document.file_size ? `${Math.round(document.file_size / 1024)} KB` : "Size unavailable"}
                      </span>
                      <a href={document.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-neutral-900 hover:text-neutral-600">
                        Open file
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
                  No documents uploaded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-100 pb-5">
              <CardTitle className="text-xl text-neutral-950">Application Timeline</CardTitle>
              <CardDescription>Current company movement and admin-side application context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {applications.length > 0 ? (
                applications.map((application) => {
                  const company = companyMap.get(application.company_id);
                  return (
                    <div key={application.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">{company?.name || "Company removed"}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {company?.target_role || "Role pending"}
                            {company?.location ? ` • ${company.location}` : ""}
                          </div>
                        </div>
                        <Badge
                          variant={
                            application.status === "selected"
                              ? "success"
                              : application.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="rounded-full px-3 py-1 capitalize"
                        >
                          {application.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="mt-3 text-xs text-neutral-500">Updated {formatDateTime(application.updated_at)}</div>
                      {application.admin_notes ? (
                        <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                          {application.admin_notes}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
                  No applications recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
