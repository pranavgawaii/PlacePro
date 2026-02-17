"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil, Trash2, Search, Filter, Plus, Building2, Users, Download, MoreHorizontal, ExternalLink, Activity } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, formatCgpa } from "@/lib/utils";
import { CompanyCriteria, Database } from "@/types/database.types";
import { AddCompanyModal } from "@/components/admin/add-company-modal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BRANCHES } from "@/lib/constants";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

function parseCriteria(raw: unknown): CompanyCriteria | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const criteria = raw as Partial<CompanyCriteria>;
  if (typeof criteria.cgpa_min !== "number") {
    return null;
  }

  const branches = Array.isArray(criteria.branches)
    ? criteria.branches.filter((branch): branch is CompanyCriteria["branches"][number] => typeof branch === "string")
    : [];

  return {
    cgpa_min: criteria.cgpa_min,
    tenth_min: typeof criteria.tenth_min === "number" ? criteria.tenth_min : undefined,
    twelfth_min: typeof criteria.twelfth_min === "number" ? criteria.twelfth_min : undefined,
    branches,
    backlogs_allowed: typeof criteria.backlogs_allowed === "number" ? criteria.backlogs_allowed : 0,
    other_requirements: typeof criteria.other_requirements === "string" ? criteria.other_requirements : undefined
  };
}

function studentEligible(student: StudentRow, criteria: CompanyCriteria) {
  const meetsCgpa = (student.overall_cgpa ?? 0) >= criteria.cgpa_min;
  const meetsTenth = typeof criteria.tenth_min === "number" ? (student.tenth_percentage ?? 0) >= criteria.tenth_min : true;
  const meetsTwelfth =
    typeof criteria.twelfth_min === "number" ? (student.twelfth_percentage ?? 0) >= criteria.twelfth_min : true;
  const meetsBranch = criteria.branches.length
    ? student.branch
      ? criteria.branches.includes(student.branch)
      : false
    : true;

  return meetsCgpa && meetsTenth && meetsTwelfth && meetsBranch;
}

export function CompaniesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [eligibleCompany, setEligibleCompany] = useState<CompanyRow | null>(null);

  const fetchData = async () => {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error(userError?.message ?? "Unable to load admin user");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const [{ data: companiesRows, error: companiesError }, { data: studentRows, error: studentsError }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("students").select("*")
    ]);

    if (companiesError) {
      toast.error(companiesError.message);
      setLoading(false);
      return;
    }

    if (studentsError) {
      toast.error(studentsError.message);
      setLoading(false);
      return;
    }

    setCompanies(companiesRows);
    setStudents(studentRows);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const eligibleMap = useMemo(() => {
    const map = new Map<string, StudentRow[]>();
    companies.forEach((company) => {
      const criteria = parseCriteria(company.criteria_json);
      if (!criteria) {
        map.set(company.id, []);
        return;
      }

      map.set(
        company.id,
        students.filter((student) => studentEligible(student, criteria))
      );
    });
    return map;
  }, [companies, students]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch = company.name.toLowerCase().includes(search.toLowerCase()) ||
        (company.description && company.description.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? company.active : !company.active;
      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  const onSavedCompany = (savedRow: CompanyRow) => {
    setCompanies((prev) => {
      const exists = prev.some((row) => row.id === savedRow.id);
      if (!exists) {
        return [savedRow, ...prev];
      }
      return prev.map((row) => (row.id === savedRow.id ? savedRow : row));
    });

    const criteria = parseCriteria(savedRow.criteria_json);
    const eligibleCount = criteria ? students.filter((student) => studentEligible(student, criteria)).length : 0;
    toast.success(`${eligibleCount} students eligible`);
  };

  const toggleActive = async (company: CompanyRow) => {
    const { data, error } = await supabase
      .from("companies")
      .update({ active: !company.active })
      .eq("id", company.id)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setCompanies((prev) => prev.map((row) => (row.id === data.id ? data : row)));
    toast.success(`Company ${data.active ? "activated" : "deactivated"}`);
  };

  const deleteCompany = async (companyId: string) => {
    const confirmed = window.confirm("Delete this company?");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("companies").delete().eq("id", companyId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCompanies((prev) => prev.filter((company) => company.id !== companyId));
    toast.success("Company deleted");
  };

  const exportEligibleCsv = (company: CompanyRow) => {
    const studentsForCompany = eligibleMap.get(company.id) ?? [];
    const header = ["Name", "Enrolment Number", "CGPA", "Branch", "Email"];
    const rows = studentsForCompany.map((student) => [
      student.name,
      student.prn ?? "",
      student.overall_cgpa?.toString() ?? "",
      student.branch ?? "",
      student.email
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadCsv(`${company.name.toLowerCase().replace(/\s+/g, "-")}-eligible.csv`, csv);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex h-12 w-full items-center justify-between">
          <Skeleton className="h-10 w-96 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage recruiting partners, criteria, and drives.</p>
        </div>
        <Button
          onClick={() => {
            setEditingCompany(null);
            setShowModal(true);
          }}
          className="rounded-full px-6"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Company
        </Button>
      </div>

      <div className="sticky top-0 z-10 -mx-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full bg-neutral-50 border-neutral-200 focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2 border-l pl-3 ml-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-full px-4 border-dashed">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  Status: {statusFilter === "all" ? "All" : statusFilter === "active" ? "Active" : "Paused"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Companies
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                  Active only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paused")}>
                  Paused only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="ml-auto text-xs text-muted-foreground font-medium">
            {filteredCompanies.length} result{filteredCompanies.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/50 hover:bg-neutral-50/50">
              <TableHead className="w-[30%]">Company</TableHead>
              <TableHead className="w-[35%]">Criteria & Eligibility</TableHead>
              <TableHead className="w-[15%] text-center">Stats</TableHead>
              <TableHead className="w-[10%] text-center">Status</TableHead>
              <TableHead className="w-[10%] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.length ? (
              filteredCompanies.map((company) => {
                const criteria = parseCriteria(company.criteria_json);
                const eligibleStudents = eligibleMap.get(company.id) ?? [];

                return (
                  <TableRow key={company.id} className="group hover:bg-neutral-50/30 transition-colors">
                    <TableCell>
                      <div className="flex items-start gap-4 py-1">
                        <div className="h-12 w-12 rounded-lg border bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                          {company.name.toLowerCase().includes("tcs") ? (
                            <img src="/tcs.jpg" alt="TCS" className="h-full w-full object-contain p-1" />
                          ) : company.name.toLowerCase().includes("google") ? (
                            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="h-full w-full object-contain p-2.5" />
                          ) : company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="h-full w-full object-contain" />
                          ) : (
                            <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold text-lg">
                              {company.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-base leading-none text-neutral-900">{company.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 bg-neutral-100 px-1.5 py-0.5 rounded-md text-neutral-600">
                              {company.company_type}
                            </span>
                            <span>•</span>
                            <span>{company.location || "Remote"}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2 py-1">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="rounded-md font-normal text-xs bg-indigo-50 text-indigo-700 border-indigo-100">
                            CGPA {criteria?.cgpa_min}+
                          </Badge>
                          {criteria?.branches?.length ? (
                            criteria.branches.length < BRANCHES.length ? (
                              <Badge variant="outline" className="rounded-md font-normal text-xs text-muted-foreground">
                                {criteria.branches.length} Branches
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-md font-normal text-xs text-muted-foreground">All Branches</Badge>
                            )
                          ) : null}
                          <span className="text-xs text-muted-foreground self-center ml-1">
                            {company.package_range || "Package not specified"}
                          </span>
                        </div>
                        {company.job_type && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs pl-0.5">
                            {company.job_type} Role
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEligibleCompany(company)}
                          className="h-8 rounded-full px-3 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                        >
                          <Users className="mr-1.5 h-3 w-3" />
                          {eligibleStudents.length} Eligible
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${company.active
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                          }`}
                      >
                        {company.active ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingCompany(company);
                            setShowModal(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/companies/${company.id}/applications`}>
                              <ExternalLink className="mr-2 h-4 w-4" /> View Applications
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void toggleActive(company)}>
                            <Activity className="mr-2 h-4 w-4" />
                            {company.active ? "Pause Hiring" : "Activate Hiring"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEligibleCompany(company)}>
                            <Users className="mr-2 h-4 w-4" /> View Eligible List
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => void deleteCompany(company.id)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Building2 className="h-12 w-12 text-neutral-200 mb-4" />
                    <p className="font-medium text-neutral-900">No companies found</p>
                    <p className="text-sm max-w-xs mx-auto mt-1">
                      {search || statusFilter !== "all"
                        ? "Try adjusting your search or filters."
                        : "Get started by adding your first recruiting partner."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddCompanyModal
        open={showModal}
        onOpenChange={setShowModal}
        currentUserId={currentUserId}
        editingCompany={editingCompany}
        onSaved={onSavedCompany}
      />

      <Dialog open={Boolean(eligibleCompany)} onOpenChange={(open) => (!open ? setEligibleCompany(null) : undefined)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{eligibleCompany?.name} Eligible Students</DialogTitle>
            <DialogDescription>
              Based on {eligibleCompany?.name}'s criteria as of {format(new Date(), "dd MMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-neutral-50/50 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-white">
              <div className="text-sm font-medium text-muted-foreground">
                Total Eligible: <span className="text-foreground">{eligibleCompany ? (eligibleMap.get(eligibleCompany.id)?.length ?? 0) : 0}</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>PRN</TableHead>
                    <TableHead className="text-right">CGPA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(eligibleCompany ? eligibleMap.get(eligibleCompany.id) ?? [] : []).map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.branch ?? "-"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{student.prn ?? "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCgpa(student.overall_cgpa)}</TableCell>
                    </TableRow>
                  ))}
                  {eligibleCompany && (eligibleMap.get(eligibleCompany.id)?.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-neutral-500">
                        No eligible students found for current criteria.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEligibleCompany(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (eligibleCompany) {
                  exportEligibleCsv(eligibleCompany);
                }
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
