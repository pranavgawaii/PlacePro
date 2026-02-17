"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

function parsePackage(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+(\.\d+)?/g);
  if (!match?.length) {
    return null;
  }

  return Number(match[0]);
}

export function AnalyticsPageClient() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [studentsRes, appsRes, companiesRes] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("applications").select("*"),
        supabase.from("companies").select("*")
      ]);

      if (studentsRes.error || appsRes.error || companiesRes.error) {
        toast.error(studentsRes.error?.message ?? appsRes.error?.message ?? companiesRes.error?.message ?? "Unable to load analytics");
        setLoading(false);
        return;
      }

      setStudents(studentsRes.data);
      setApplications(appsRes.data);
      setCompanies(companiesRes.data);
      setLoading(false);
    };

    void fetchData();
  }, []);

  const metrics = useMemo(() => {
    const totalStudents = students.length;
    const profileComplete = students.filter((student) => student.profile_complete).length;
    const totalApplications = applications.length;
    const activeCompanies = companies.filter((company) => company.active).length;

    return { totalStudents, profileComplete, totalApplications, activeCompanies };
  }, [students, applications, companies]);

  const appSeries = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const values: number[] = [];

    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      labels.push(key.slice(5));
      values.push(applications.filter((app) => app.applied_at.slice(0, 10) === key).length);
    }

    const max = Math.max(1, ...values);
    const points = values.map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x},${y}`;
    });

    return { labels, values, max, points: points.join(" ") };
  }, [applications]);

  const branchData = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((student) => {
      const branch = student.branch ?? "Unknown";
      counts.set(branch, (counts.get(branch) ?? 0) + 1);
    });

    const total = students.length || 1;
    return Array.from(counts.entries())
      .map(([branch, count]) => ({ branch, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [students]);

  const topCompanies = useMemo(() => {
    const countMap = new Map<string, number>();
    applications.forEach((app) => {
      countMap.set(app.company_id, (countMap.get(app.company_id) ?? 0) + 1);
    });

    const companyMap = new Map(companies.map((company) => [company.id, company.name]));
    return Array.from(countMap.entries())
      .map(([companyId, count]) => ({
        name: companyMap.get(companyId) ?? "Unknown",
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [applications, companies]);

  const cgpaHistogram = useMemo(() => {
    const bins = [
      { label: "<6", min: -Infinity, max: 6 },
      { label: "6-7", min: 6, max: 7 },
      { label: "7-8", min: 7, max: 8 },
      { label: "8-9", min: 8, max: 9 },
      { label: "9-10", min: 9, max: 10.1 }
    ];

    return bins.map((bin) => ({
      label: bin.label,
      count: students.filter((student) => {
        const cgpa = student.overall_cgpa ?? 0;
        return cgpa >= bin.min && cgpa < bin.max;
      }).length
    }));
  }, [students]);

  const placementSummary = useMemo(() => {
    const selectedApps = applications.filter((app) => app.status === "selected");
    const placedStudentIds = new Set(selectedApps.map((app) => app.student_id));

    const selectedPackages = selectedApps
      .map((app) => companies.find((company) => company.id === app.company_id)?.package_range ?? null)
      .map((value) => parsePackage(value))
      .filter((value): value is number => value !== null);

    const avgPackage = selectedPackages.length
      ? (selectedPackages.reduce((sum, value) => sum + value, 0) / selectedPackages.length).toFixed(2)
      : "0.00";

    const highestPackage = selectedPackages.length ? Math.max(...selectedPackages).toFixed(2) : "0.00";

    return {
      placed: placedStudentIds.size,
      avgPackage,
      highestPackage
    };
  }, [applications, companies]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Academic Year 2024-25</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-emerald-600">Live Updates</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Placements Card */}
        <div className="bg-white p-6 rounded-lg card-border relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Total Placements</h3>
              <div className="text-3xl font-bold mt-1 tracking-tight">{placementSummary.placed}</div>
              <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <span className="text-lg">↑</span>
                +{Math.round((placementSummary.placed / (metrics.totalStudents || 1)) * 10)}% vs last year
              </div>
            </div>
            <div className="relative w-12 h-12">
              <svg className="transform -rotate-90 w-12 h-12">
                <circle cx="24" cy="24" fill="transparent" r="20" stroke="#f0f0f0" strokeWidth="4"></circle>
                <circle
                  className="transition-all duration-1000 ease-out"
                  cx="24" cy="24"
                  fill="transparent"
                  r="20"
                  stroke="#111"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 - (125.6 * (metrics.totalStudents ? (placementSummary.placed / metrics.totalStudents) : 0))}
                  strokeWidth="4"
                  strokeLinecap="round"
                ></circle>
              </svg>
              <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold">
                {metrics.totalStudents ? Math.round((placementSummary.placed / metrics.totalStudents) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Avg. Package Card */}
        <div className="bg-white p-6 rounded-lg card-border">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Avg. Package (LPA)</h3>
              <div className="text-3xl font-bold mt-1 tracking-tight">₹{placementSummary.avgPackage}L</div>
              <div className="text-xs text-muted-foreground font-medium mt-1">Highest: ₹{placementSummary.highestPackage}L</div>
            </div>
            <div className="p-2 bg-neutral-50 rounded text-muted-foreground">
              <span className="text-xl font-bold">₹</span>
            </div>
          </div>
          <div className="h-10 mt-4 relative">
            {/* Simulated Sparkline for now */}
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <path
                d="M0,40 L20,35 L40,38 L60,20 L80,25 L100,10 L120,15 L140,5 L160,20 L180,10 L200,30 L220,15 L240,5 L260,10"
                fill="none"
                stroke="#111"
                strokeWidth="2"
                className="sparkline-path"
              ></path>
              <circle cx="260" cy="10" fill="#111" r="3"></circle>
            </svg>
          </div>
        </div>

        {/* Active Drives Card */}
        <div className="bg-white p-6 rounded-lg card-border">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Active Drives</h3>
              <div className="text-3xl font-bold mt-1 tracking-tight">{metrics.activeCompanies}</div>
              <div className="text-xs text-muted-foreground font-medium mt-1">{applications.length} Applications today</div>
            </div>
            <div className="flex -space-x-2">
              {companies.slice(0, 3).map((company, i) => (
                <div key={company.id} className="w-8 h-8 rounded-full border-2 border-white bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {company.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold text-white ${['bg-blue-600', 'bg-orange-600', 'bg-green-600'][i % 3]}`}>
                      {company.name[0]}
                    </div>
                  )}
                </div>
              ))}
              {metrics.activeCompanies > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  +{metrics.activeCompanies - 3}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Next: Drive starting soon</span>
            <button className="text-xs font-bold underline hover:no-underline">View Schedule</button>
          </div>
        </div>
      </div>

      {/* Placement Trends Chart */}
      <div className="bg-white rounded-lg card-border p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-lg font-bold">Placement Trends by Department</h2>
            <p className="text-sm text-muted-foreground">Comparative analysis of offers across key engineering streams.</p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
            <button className="px-3 py-1 bg-white shadow-sm rounded text-xs font-medium text-black">Offers</button>
            <button className="px-3 py-1 hover:bg-white/50 rounded text-xs font-medium text-muted-foreground transition-colors">Packages</button>
            <button className="px-3 py-1 hover:bg-white/50 rounded text-xs font-medium text-muted-foreground transition-colors">Participation</button>
          </div>
        </div>

        <div className="relative h-64 w-full">
          <div className="absolute inset-0 flex flex-col justify-between text-xs text-muted-foreground/50">
            <div className="w-full border-b border-neutral-100 pb-1">100%</div>
            <div className="w-full border-b border-neutral-100 pb-1">75%</div>
            <div className="w-full border-b border-neutral-100 pb-1">50%</div>
            <div className="w-full border-b border-neutral-100 pb-1">25%</div>
            <div className="w-full border-b border-neutral-100 pb-1">0%</div>
          </div>
          <div className="absolute inset-0 flex items-end justify-around pt-6 px-4">
            {branchData.length > 0 ? branchData.map((data) => (
              <div key={data.branch} className="w-12 md:w-16 flex flex-col gap-1 cursor-pointer">
                <div className="relative w-full bg-neutral-200 rounded-t duration-500 hover:bg-neutral-800" style={{ height: `${Math.max(5, data.percent)}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded group-hover:opacity-100 transition-opacity">
                    {data.percent}%
                  </div>
                </div>
                <div className="text-xs font-semibold text-center mt-2 truncate">{data.branch}</div>
              </div>
            )) : (
              <div className="flex items-center justify-center w-full h-full text-sm text-muted-foreground">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Live Placement Feed */}
      <div className="bg-white rounded-lg card-border overflow-hidden">
        <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">Live Placement Feed</h2>
          <div className="flex gap-2">
            <button className="p-1.5 hover:bg-neutral-100 rounded text-muted-foreground transition-colors">
              <span className="sr-only">Filter</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            </button>
            <button className="p-1.5 hover:bg-neutral-100 rounded text-muted-foreground transition-colors">
              <span className="sr-only">Download</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Student</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Company</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Role</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Package</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {applications.slice(0, 5).map((app) => {
                const student = students.find(s => s.id === app.student_id);
                const company = companies.find(c => c.id === app.company_id);
                return (
                  <tr key={app.id} className="group hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold">
                          {student?.name?.[0] || "S"}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900">{student?.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{student?.branch || "N/A"} • {student?.batch_year || "2024"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-black text-white font-bold text-[10px]">
                          {company?.name?.[0] || "C"}
                        </div>
                        <span className="font-medium">{company?.name || "Company"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{company?.job_type || "Role"}</td>
                    <td className="px-6 py-4 font-mono text-neutral-900">{company?.package_range || "-"}</td>
                    <td className="px-6 py-4">
                      {app.status === 'selected' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Offer Released
                        </span>
                      ) : app.status === 'shortlisted' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Shortlisted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          {app.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-neutral-400 hover:text-black transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No recent activity</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
