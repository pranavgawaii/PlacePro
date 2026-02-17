"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock3, Send, CheckCircle2, Timer, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { computeEligibility, parseCompanyCriteria } from "@/lib/eligibility";
import {
  CompanyCriteria,
  Database,
  EligibilityResult,
  JobType,
  CompanyType
} from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyDetailDialog } from "@/components/student/company-detail-dialog";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

type CompanyWithEligibility = {
  company: CompanyRow;
  criteria: CompanyCriteria;
  eligibility: EligibilityResult;
  applied: boolean;
};

function packageSortValue(packageRange: string | null) {
  if (!packageRange) {
    return 0;
  }

  const value = packageRange.match(/\d+(\.\d+)?/);
  return value ? Number(value[0]) : 0;
}

export function StudentDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);

  const [viewMode, setViewMode] = useState<"all" | "eligible">("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<"All" | JobType>("All");
  const [companyTypeFilter, setCompanyTypeFilter] = useState<"All" | CompanyType>("All");
  const [sortBy, setSortBy] = useState<"latest" | "deadline" | "package">("latest");

  const [selectedCompany, setSelectedCompany] = useState<CompanyWithEligibility | null>(null);
  const [initialDialogView, setInitialDialogView] = useState<"details" | "apply">("details");

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError || !user) {
        toast.error(authError?.message ?? "Unable to load user session");
        if (mounted) setLoading(false);
        return;
      }

      const { data: studentRow, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!mounted) return;

      if (studentError || !studentRow) {
        toast.error(studentError?.message ?? "Unable to load student");
        if (mounted) setLoading(false);
        return;
      }

      const [companyRes, applicationRes, resumeRes] = await Promise.all([
        supabase.from("companies").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("applications").select("*").eq("student_id", studentRow.id),
        supabase.from("resumes").select("*").eq("student_id", studentRow.id).order("updated_at", { ascending: false })
      ]);

      if (!mounted) return;

      if (companyRes.error || applicationRes.error || resumeRes.error) {
        toast.error(
          companyRes.error?.message ?? applicationRes.error?.message ?? resumeRes.error?.message ?? "Unable to load dashboard"
        );
        if (mounted) setLoading(false);
        return;
      }

      setStudent(studentRow);
      setCompanies(companyRes.data);
      setApplications(applicationRes.data);
      setResumes(resumeRes.data);
      setLoading(false);
    };

    void fetchData();

    const channel = supabase
      .channel("student-companies-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "companies"
        },
        () => {
          if (!mounted) return;
          toast.success("New company added!");
          void supabase
            .from("companies")
            .select("*")
            .eq("active", true)
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              if (data && mounted) {
                setCompanies(data);
              }
            });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const companyRows = useMemo<CompanyWithEligibility[]>(() => {
    if (!student) {
      return [];
    }

    const appliedSet = new Set(applications.map((application) => application.company_id));

    return companies.map((company) => {
      const criteria = parseCompanyCriteria(company.criteria_json);
      const eligibility = computeEligibility(student, criteria);
      return {
        company,
        criteria,
        eligibility,
        applied: appliedSet.has(company.id)
      };
    });
  }, [student, companies, applications]);

  const filteredRows = useMemo(() => {
    let list = [...companyRows];

    if (viewMode === "eligible") {
      list = list.filter((item) => item.eligibility.eligible);
    }

    if (jobTypeFilter !== "All") {
      list = list.filter((item) => item.company.job_type === jobTypeFilter || item.company.job_type === "Both");
    }

    if (companyTypeFilter !== "All") {
      list = list.filter((item) => item.company.company_type === companyTypeFilter);
    }

    if (sortBy === "deadline") {
      list.sort((a, b) => {
        if (!a.company.application_deadline) {
          return 1;
        }
        if (!b.company.application_deadline) {
          return -1;
        }
        return new Date(a.company.application_deadline).getTime() - new Date(b.company.application_deadline).getTime();
      });
    } else if (sortBy === "package") {
      list.sort((a, b) => packageSortValue(b.company.package_range) - packageSortValue(a.company.package_range));
    } else {
      list.sort((a, b) => new Date(b.company.created_at).getTime() - new Date(a.company.created_at).getTime());
    }

    return list;
  }, [companyRows, viewMode, jobTypeFilter, companyTypeFilter, sortBy]);

  const handleApplicationSubmit = (newApp: ApplicationRow) => {
    setApplications((prev) => [...prev, newApp]);
  };

  const openCompany = (row: CompanyWithEligibility, view: "details" | "apply") => {
    setSelectedCompany(row);
    setInitialDialogView(view);
  };

  if (loading || !student) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <section className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Welcome Hero */}
          <div className="lg:col-span-2 border-2 border-black bg-white shadow-sharp relative">
            <div className="p-8 h-full flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold font-mono uppercase tracking-[0.2em] text-neutral-500 mb-6">
                  OPERATIONAL_STATUS // ACTIVE_SESSION
                </div>
                <h1 className="text-6xl font-black tracking-tighter text-black uppercase leading-[0.85] mb-6">
                  WELCOME BACK,<br />{student.name?.split(" ")[0]}
                </h1>
                <p className="text-black text-sm font-medium max-w-md leading-relaxed">
                  Systems audit complete. You have {applications.filter(a => a.status === 'shortlisted' || a.status === 'interview').length} active recruitment processes currently running in your pipeline.
                </p>
              </div>
              <div className="flex items-center gap-4 mt-10">
                <button className="bg-black text-white px-8 py-3 border-2 border-black text-[11px] font-bold uppercase tracking-widest shadow-sharp-sm">
                  VIEW_SCHEDULE
                </button>
                <button className="bg-white text-black px-8 py-3 border-2 border-black text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50">
                  UPDATE_PROFILE
                </button>
              </div>
            </div>
          </div>

          {/* Placement Readiness */}
          <div className="bg-white border-2 border-black p-8 flex flex-col items-center justify-center relative shadow-sharp">
            <h3 className="text-black text-[10px] font-bold uppercase tracking-wider font-mono absolute top-6 left-6 bg-neutral-100 px-2 py-1">
              READINESS // AUDIT
            </h3>
            <div className="relative w-36 h-36 mt-4">
              <svg className="transform -rotate-90 w-36 h-36">
                <rect x="2" y="2" width="140" height="140" fill="transparent" stroke="#f0f0f0" strokeWidth="8" />
                <rect
                  className="text-black"
                  x="2" y="2" width="140" height="140"
                  fill="transparent"
                  stroke="currentColor"
                  strokeDasharray="560"
                  strokeDashoffset={560 - (560 * ((student.profile_complete && student.documents_uploaded >= 10) ? 0.9 : 0.5))}
                  strokeWidth="8"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black tracking-tighter text-black uppercase">{(student.profile_complete && student.documents_uploaded >= 10) ? '90' : '50'}%</span>
                <span className="text-[10px] text-black font-bold uppercase tracking-widest mt-1">STATUS</span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight mt-8 text-center leading-relaxed px-4">
              {(student.profile_complete && student.documents_uploaded >= 10) ? 'Ready for high-frequency recruitment.' : 'Complete profile to optimize readiness.'}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 border-2 border-black shadow-sharp">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Applications</h3>
                <div className="text-5xl font-black mt-2 tracking-tighter text-black uppercase">{applications.length}</div>
              </div>
              <div className="p-3 border-2 border-black bg-neutral-50">
                <Send className="w-5 h-5 text-black" />
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2 mt-4">
              <span className="w-2 h-2 bg-black"></span>
              {applications.filter(a => ['applied', 'shortlisted', 'interview'].includes(a.status)).length}_ACTIVE_PROCESSES
            </div>
          </div>

          <div className="bg-white p-6 border-2 border-black shadow-sharp">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Shortlisted</h3>
                <div className="text-5xl font-black mt-2 tracking-tighter text-black uppercase">{applications.filter(a => a.status === 'shortlisted').length}</div>
              </div>
              <div className="p-3 border-2 border-black bg-neutral-50">
                <CheckCircle2 className="w-5 h-5 text-black" />
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-4">
              RESPONSE_TIME // AVG_02_DAYS
            </div>
          </div>

          <div className="bg-white p-6 border-2 border-black shadow-sharp">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Interviews</h3>
                <div className="text-5xl font-black mt-2 tracking-tighter text-black uppercase">{applications.filter(a => a.status === 'interview').length}</div>
              </div>
              <div className="p-3 border-2 border-black bg-neutral-50">
                <Timer className="w-5 h-5 text-black" />
              </div>
            </div>
            {applications.filter(a => a.status === 'interview').length > 0 ? (
              <div className="mt-4 p-3 border border-black bg-neutral-50 font-mono text-[10px] font-bold flex items-center justify-between">
                <span>NEXT_EVENT</span>
                <span className="text-black">TOMORROW</span>
              </div>
            ) : (
              <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">NO_EVENTS_SCHEDULED</div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Company List / Recommended */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between border-b-2 border-black pb-6">
              <h2 className="text-3xl font-black tracking-tighter text-black uppercase">Recommended // Opportunities</h2>
              <div className="flex gap-2">
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "all" | "eligible")}>
                  <TabsList className="h-10 bg-white border-2 border-black p-0 rounded-none">
                    <TabsTrigger value="all" className="text-[10px] font-bold uppercase tracking-widest px-6 rounded-none data-[state=active]:bg-black data-[state=active]:text-white">ALL_DRIVES</TabsTrigger>
                    <TabsTrigger value="eligible" className="text-[10px] font-bold uppercase tracking-widest px-6 rounded-none data-[state=active]:bg-black data-[state=active]:text-white">ELIGIBLE</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const isEligible = row.eligibility.eligible;
                return (
                  <div key={row.company.id} className="relative bg-white border-2 border-black p-6 shadow-sharp">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-6">
                        <div className="w-16 h-16 border-2 border-black bg-neutral-50 flex items-center justify-center shrink-0 overflow-hidden">
                          {row.company.name.toLowerCase().includes("tcs") ? (
                            <div className="w-full h-full p-2 flex items-center justify-center bg-white">
                              <img src="/tcs.jpg" alt="TCS" className="w-full h-full object-contain" />
                            </div>
                          ) : row.company.name.toLowerCase().includes("google") ? (
                            <div className="w-full h-full p-2 flex items-center justify-center bg-white">
                              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-full h-full object-contain" />
                            </div>
                          ) : row.company.logo_url ? (
                            <img src={row.company.logo_url as string} alt={row.company.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                              <span className="text-3xl font-black text-black">{row.company.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-black text-2xl text-black tracking-tighter uppercase leading-none">{row.company.name}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                            <span>{row.company.company_type}</span>
                            <span className="w-1.5 h-1.5 bg-black"></span>
                            <span>{row.company.location || 'Remote'}</span>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <span className="px-2 py-0.5 border border-black text-black text-[9px] font-bold uppercase tracking-tight">{row.company.job_type}</span>
                            <span className="px-2 py-0.5 bg-black text-white text-[9px] font-bold uppercase tracking-tight">{row.company.package_range || 'Na'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isEligible ? (
                          <div className="px-3 py-1 bg-white border-2 border-black text-[10px] font-black uppercase tracking-widest shadow-sharp-sm">
                            ELIGIBLE
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-neutral-100 border-2 border-dashed border-neutral-300 text-neutral-400 text-[10px] font-black uppercase tracking-widest">
                            INELIGIBLE
                          </div>
                        )}
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter mt-1 font-mono">POSTED_{formatDistanceToNowStrict(new Date(row.company.created_at)).toUpperCase()}_AGO</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-5 border-t-2 border-black flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black bg-neutral-100 px-2 py-1 font-mono">
                          DRIVE // {row.company.target_role?.toUpperCase() || row.company.job_type?.toUpperCase() || "GENERAL"}
                        </span>
                      </div>

                      {row.applied ? (
                        <div className="bg-brand-primary text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-black shadow-sharp-sm">APPLIED</div>
                      ) : (
                        <Link href={`/student/companies/${row.company.id}`}>
                          <Button
                            className={isEligible
                              ? "bg-black text-white hover:bg-neutral-800 border-2 border-black h-10 px-8 text-xs font-black uppercase tracking-widest shadow-sharp-sm"
                              : "bg-neutral-100 text-neutral-400 pointer-events-none border-2 border-neutral-200 h-10 px-8 text-xs font-black uppercase tracking-widest"}
                          >
                            {isEligible ? 'APPLY_NOW' : 'LOCKED'}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center border border-dashed rounded-lg text-muted-foreground">
                No companies found matching your criteria.
              </div>
            )}
          </div>

          {/* Interview Roadmap */}
          <div className="w-full lg:w-80 space-y-6 shrink-0">
            <div className="bg-white border-2 border-black shadow-sharp h-full">
              <div className="bg-neutral-50 border-b-2 border-black px-6 py-4">
                <h3 className="font-black text-lg tracking-tighter text-black uppercase">Roadmap // Status</h3>
              </div>
              <div className="p-8">
                <div className="relative pl-6 border-l-2 border-black space-y-12">
                  {applications.filter(a => a.status === 'selected').length > 0 && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 border-2 border-black bg-emerald-500 shadow-sharp-sm"></div>
                      <div className="mb-2">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 border border-emerald-100">DEPLOYMENT_DONE</span>
                      </div>
                      <h4 className="text-sm font-black uppercase text-black">Offer Received</h4>
                      <p className="text-[10px] text-neutral-400 mt-1 font-bold font-mono">TIMESTAMP // {new Date().toLocaleDateString()}</p>
                    </div>
                  )}

                  {applications.filter(a => a.status === 'interview').length > 0 ? (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 border-2 border-black bg-black shadow-sharp-sm"></div>
                      <div className="mb-2">
                        <span className="text-[10px] font-bold text-black uppercase tracking-widest bg-neutral-100 px-2 py-0.5 border border-black/10">UPCOMING_EVENT</span>
                      </div>
                      <h4 className="text-sm font-black uppercase text-black leading-tight">
                        {companies.find(c => c.id === applications.find(a => a.status === 'interview')?.company_id)?.name} Interview
                      </h4>
                      <div className="mt-6 p-4 border-2 border-black bg-neutral-50">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-black uppercase tracking-widest mb-2">
                          <Clock3 className="h-3.5 w-3.5" />
                          EVENT_TOMORROW
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                          <Clock3 className="h-3.5 w-3.5 opacity-0" />
                          14:00 - 15:00_HRS
                        </div>
                      </div>
                      <div className="mt-6 flex gap-2">
                        <Link href={`/student/companies/${applications.find(a => a.status === 'interview')?.company_id}`} className="w-1/2">
                          <button className="w-full text-[10px] py-2 bg-white border-2 border-black font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors">DETAILS</button>
                        </Link>
                        <button className="w-1/2 text-[10px] py-2 bg-black text-white border-2 border-black font-bold uppercase tracking-widest shadow-sharp-sm">JOIN_HUB</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative opacity-40">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 border-2 border-black bg-neutral-200"></div>
                      <div className="mb-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">IDLE_STATE</span>
                      </div>
                      <h4 className="text-sm font-black uppercase text-neutral-500">No active interviews</h4>
                    </div>
                  )}

                  <div className="relative opacity-40">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 border-2 border-black bg-neutral-50"></div>
                    <div className="mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">FUTURE_OPS</span>
                    </div>
                    <h4 className="text-sm font-black uppercase text-neutral-500">HR Discussion</h4>
                    <p className="text-[10px] text-neutral-400 mt-1 font-bold">PRE_CLEARANCE_REQUIRED</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
