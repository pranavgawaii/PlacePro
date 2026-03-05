"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { ApplicationStatus, Database } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ApplicationEventRow = Database["public"]["Tables"]["application_events"]["Row"];

type ApplicationWithCompany = ApplicationRow & {
  company: CompanyRow | null;
};

const STATUS_TABS: Array<{ value: "all" | ApplicationStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "applied", label: "Applied" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "rejected", label: "Rejected" },
  { value: "selected", label: "Selected" }
];

function statusVariant(status: ApplicationStatus): "info" | "success" | "destructive" | "secondary" {
  if (status === "rejected") {
    return "destructive";
  }
  if (status === "selected") {
    return "success";
  }
  if (status === "shortlisted" || status === "interview") {
    return "secondary";
  }
  return "info";
}

async function openResumeFromBucket(filePathOrUrl: string, supabase: ReturnType<typeof createClient>) {
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

export function StudentApplicationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApplicationWithCompany[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [detailRow, setDetailRow] = useState<ApplicationWithCompany | null>(null);
  const [events, setEvents] = useState<ApplicationEventRow[]>([]);
  const [resume, setResume] = useState<ResumeRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchData = async () => {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error(userError?.message ?? "Unable to load user session");
        setLoading(false);
        return;
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (studentError || !student) {
        toast.error(studentError?.message ?? "Unable to load student");
        setLoading(false);
        return;
      }

      const { data: applicationRows, error: applicationError } = await supabase
        .from("applications")
        .select("*")
        .eq("student_id", (student as StudentRow).id)
        .order("applied_at", { ascending: false });

      if (applicationError) {
        toast.error(applicationError.message);
        setLoading(false);
        return;
      }

      const companyIds = applicationRows.map((application) => application.company_id);

      let companyRows: CompanyRow[] = [];
      if (companyIds.length) {
        const { data, error: companiesError } = await supabase.from("companies").select("*").in("id", companyIds);
        if (companiesError) {
          toast.error(companiesError.message);
          setLoading(false);
          return;
        }
        companyRows = data;
      }

      const companyMap = new Map(companyRows.map((company) => [company.id, company]));
      setRows(
        applicationRows.map((application) => ({
          ...application,
          company: companyMap.get(application.company_id) ?? null
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      applied: rows.filter((row) => row.status === "applied").length,
      shortlisted: rows.filter((row) => row.status === "shortlisted").length,
      interview: rows.filter((row) => row.status === "interview").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      selected: rows.filter((row) => row.status === "selected").length
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") {
      return rows;
    }
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const openDetail = async (row: ApplicationWithCompany) => {
    setDetailRow(row);
    setDetailLoading(true);

    const [eventsRes, resumeRes] = await Promise.all([
      supabase.from("application_events").select("*").eq("application_id", row.id).order("created_at", { ascending: true }),
      row.resume_id ? supabase.from("resumes").select("*").eq("id", row.resume_id).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);

    if (eventsRes.error) {
      toast.error(eventsRes.error.message);
      setDetailLoading(false);
      return;
    }

    if (resumeRes.error) {
      toast.error(resumeRes.error.message);
      setDetailLoading(false);
      return;
    }

    setEvents(eventsRes.data);
    setResume(resumeRes.data);
    setDetailLoading(false);
  };

  const withdrawApplication = async (row: ApplicationWithCompany) => {
    if (row.status !== "applied") {
      return;
    }

    setWithdrawing(true);

    const { error } = await supabase.from("applications").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setWithdrawing(false);
      return;
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
    setDetailRow(null);
    toast.success("Application withdrawn");
    setWithdrawing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <p className="text-sm text-muted-foreground">Track every placement application and current status.</p>
      </div>

      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | ApplicationStatus)}>
        <TabsList className="flex w-full flex-wrap justify-start">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label} ({counts[tab.value]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Job Type</TableHead>
              <TableHead>Applied Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.company?.name ?? "Company unavailable"}</TableCell>
                  <TableCell>{row.company?.job_type ?? "-"}</TableCell>
                  <TableCell>{format(new Date(row.applied_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{APPLICATION_STATUS_LABELS[row.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.company?.application_deadline ? format(new Date(row.company.application_deadline), "dd MMM yyyy") : "-"}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(row)}>
                      View Application
                    </Button>
                    {row.status === "applied" ? (
                      <Button size="sm" variant="destructive" onClick={() => void withdrawApplication(row)}>
                        Withdraw
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No applications yet. <Link href="/student/dashboard" className="underline">Browse companies to apply.</Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => (!open ? setDetailRow(null) : undefined)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailRow?.company?.name ?? "Application"}</DialogTitle>
            <DialogDescription>
              Status: {detailRow ? APPLICATION_STATUS_LABELS[detailRow.status] : "-"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detailRow ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {resume?.file_url ? (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Submitted Resume</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void openResumeFromBucket(resume.file_url!, supabase)}
                  >
                    View Resume PDF
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">No resume PDF generated yet.</div>
              )}

              {detailRow.cover_letter ? (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Cover Letter</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{detailRow.cover_letter}</p>
                </div>
              ) : null}

              {detailRow.admin_notes ? (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Admin Notes</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{detailRow.admin_notes}</p>
                </div>
              ) : null}

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">Status Timeline</p>
                <div className="space-y-2 text-sm">
                  {events.length ? (
                    events.map((event) => (
                      <div key={event.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                        <span>{APPLICATION_STATUS_LABELS[event.to_status]}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), "dd MMM yyyy, hh:mm a")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Timeline will appear after status changes.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {detailRow?.status === "applied" ? (
              <Button variant="destructive" onClick={() => void withdrawApplication(detailRow)} disabled={withdrawing}>
                {withdrawing ? "Withdrawing..." : "Withdraw Application"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
