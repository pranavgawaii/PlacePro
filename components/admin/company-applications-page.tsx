"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ApplicationStatus, Database } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];

type ApplicationWithStudent = ApplicationRow & {
  student: StudentRow | null;
  resume: ResumeRow | null;
};

const STATUS_OPTIONS: Array<"all" | ApplicationStatus> = ["all", "applied", "shortlisted", "interview", "rejected", "selected"];

async function openResume(filePathOrUrl: string, supabase: ReturnType<typeof createClient>) {
  if (/^https?:\/\//i.test(filePathOrUrl)) {
    window.open(filePathOrUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(filePathOrUrl, 60 * 10);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to open resume");
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

interface CompanyApplicationsPageProps {
  companyId: string;
}

export function CompanyApplicationsPage({ companyId }: CompanyApplicationsPageProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [rows, setRows] = useState<ApplicationWithStudent[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [detail, setDetail] = useState<ApplicationWithStudent | null>(null);
  const [detailStatus, setDetailStatus] = useState<ApplicationStatus>("applied");
  const [detailNotes, setDetailNotes] = useState("");

  const fetchData = async () => {
    const [companyRes, appRes, studentRes, resumeRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase.from("applications").select("*").eq("company_id", companyId).order("applied_at", { ascending: false }),
      supabase.from("students").select("*"),
      supabase.from("resumes").select("*")
    ]);

    if (companyRes.error || appRes.error || studentRes.error || resumeRes.error) {
      toast.error(companyRes.error?.message ?? appRes.error?.message ?? studentRes.error?.message ?? resumeRes.error?.message ?? "Unable to load applications");
      setLoading(false);
      return;
    }

    const studentMap = new Map(studentRes.data.map((student) => [student.id, student]));
    const resumeMap = new Map(resumeRes.data.map((resume) => [resume.id, resume]));

    setCompany(companyRes.data);
    setRows(
      appRes.data.map((row) => ({
        ...row,
        student: studentMap.get(row.student_id) ?? null,
        resume: row.resume_id ? resumeMap.get(row.resume_id) ?? null : null
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, [companyId]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      shortlisted: rows.filter((row) => row.status === "shortlisted").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      selected: rows.filter((row) => row.status === "selected").length
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return rows.filter((row) => {
      const statusPass = statusFilter === "all" ? true : row.status === statusFilter;
      const branchPass = branchFilter === "all" ? true : row.student?.branch === branchFilter;
      const searchPass = query
        ? `${row.student?.name ?? ""} ${row.student?.prn ?? ""}`.toLowerCase().includes(query)
        : true;

      return statusPass && branchPass && searchPass;
    });
  }, [rows, statusFilter, branchFilter, search]);

  const updateStatus = async (applicationId: string, status: ApplicationStatus, notes: string | null) => {
    const { error } = await supabase
      .from("applications")
      .update({ status, admin_notes: notes })
      .eq("id", applicationId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === applicationId ? { ...row, status, admin_notes: notes, updated_at: new Date().toISOString() } : row))
    );

    toast.success("Application updated");
  };

  const applyBulkStatus = async (status: ApplicationStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select applications first");
      return;
    }

    const { error } = await supabase.from("applications").update({ status }).in("id", ids);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((prev) => prev.map((row) => (selectedIds.has(row.id) ? { ...row, status } : row)));
    toast.success(`Updated ${ids.length} application(s)`);
  };

  const exportSelectedResumes = async () => {
    if (!selectedIds.size) {
      toast.error("Select applications first");
      return;
    }

    const response = await fetch(`/api/admin/companies/${companyId}/applications/export-zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationIds: Array.from(selectedIds) })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Failed to export resumes");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${company?.name ?? "company"}-resumes.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-16 w-16 rounded-2xl border bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
          {company.name.toLowerCase().includes("tcs") ? (
            <img src="/brand/tcs.jpg" alt="TCS" className="h-full w-full object-contain p-1.5" />
          ) : company.name.toLowerCase().includes("google") ? (
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="h-full w-full object-contain p-3" />
          ) : company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="h-full w-full object-contain" />
          ) : (
            <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold text-xl">
              {company.name[0]}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{company.name} Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and review the selection pipeline for this drive.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Applications</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Shortlisted</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.shortlisted}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rejected</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.rejected}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Selected</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.selected}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | ApplicationStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
            >
              <option value="all">All branches</option>
              {["CSE", "ECE", "ENTC", "CIVIL", "AERO", "MECH"].map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>

            <Input placeholder="Search by name / Enrolment Number" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void applyBulkStatus("shortlisted")}>Shortlist Selected</Button>
            <Button variant="outline" onClick={() => void applyBulkStatus("rejected")}>Reject Selected</Button>
            <Button variant="outline" onClick={() => void exportSelectedResumes()}>Export Selected CVs</Button>
            <p className="self-center text-sm text-muted-foreground">Selected: {selectedIds.size}</p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Enrolment Number</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>CGPA</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(event) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) {
                              next.add(row.id);
                            } else {
                              next.delete(row.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.student?.name ?? "-"}</TableCell>
                    <TableCell>{row.student?.prn ?? "-"}</TableCell>
                    <TableCell>{row.student?.branch ?? "-"}</TableCell>
                    <TableCell>{row.student?.overall_cgpa ?? "-"}</TableCell>
                    <TableCell>
                      {row.resume?.file_url ? (
                        <Button size="sm" variant="outline" onClick={() => void openResume(row.resume!.file_url!, supabase)}>
                          View
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{new Date(row.applied_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "selected" ? "success" : row.status === "rejected" ? "destructive" : "secondary"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDetail(row);
                          setDetailStatus(row.status);
                          setDetailNotes(row.admin_notes ?? "");
                        }}
                      >
                        View
                      </Button>
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        value={row.status}
                        onChange={(event) => void updateStatus(row.id, event.target.value as ApplicationStatus, row.admin_notes ?? null)}
                      >
                        {STATUS_OPTIONS.filter((status): status is ApplicationStatus => status !== "all").map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No applications match selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => (!open ? setDetail(null) : undefined)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.student?.name ?? "Application"}</DialogTitle>
            <DialogDescription>
              {detail?.student?.prn ?? ""} • {detail?.student?.branch ?? ""} • {detail?.student?.overall_cgpa ?? ""}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4">
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Resume</p>
                {detail.resume?.file_url ? (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => void openResume(detail.resume!.file_url!, supabase)}>
                    Open Resume
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">No resume file generated.</p>
                )}
              </div>

              {detail.cover_letter ? (
                <div className="rounded border p-3">
                  <p className="text-sm font-medium">Cover Letter</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{detail.cover_letter}</p>
                </div>
              ) : null}

              {Object.keys(detail.additional_info ?? {}).length ? (
                <div className="rounded border p-3">
                  <p className="text-sm font-medium">Custom Field Responses</p>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {Object.entries(detail.additional_info as Record<string, string>).map(([key, value]) => (
                      <p key={key}>
                        <span className="font-medium">{key}: </span>
                        {value}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={detailStatus}
                  onChange={(event) => setDetailStatus(event.target.value as ApplicationStatus)}
                >
                  {STATUS_OPTIONS.filter((status): status is ApplicationStatus => status !== "all").map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea value={detailNotes} onChange={(event) => setDetailNotes(event.target.value)} rows={5} />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => {
                if (!detail) {
                  return;
                }
                void updateStatus(detail.id, detailStatus, detailNotes || null);
                setDetail((prev) => (prev ? { ...prev, status: detailStatus, admin_notes: detailNotes } : prev));
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
