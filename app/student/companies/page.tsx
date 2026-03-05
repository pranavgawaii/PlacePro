"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Search, Filter, Briefcase, IndianRupee } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { computeEligibility, parseCompanyCriteria } from "@/lib/eligibility";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

export default function StudentCompaniesPage() {
    const supabase = createClient();
    const [companies, setCompanies] = useState<CompanyRow[]>([]);
    const [student, setStudent] = useState<StudentRow | null>(null);
    const [applications, setApplications] = useState<ApplicationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [eligibleOnly, setEligibleOnly] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!mounted) return;

            if (user) {
                const { data: studentData } = await supabase
                    .from("students")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();

                if (!mounted) return;

                if (studentData) {
                    setStudent(studentData);
                    const { data: appsData } = await supabase
                        .from("applications")
                        .select("*")
                        .eq("student_id", studentData.id);

                    if (appsData) setApplications(appsData);
                }
            }

            const { data: companiesData } = await supabase
                .from("companies")
                .select("*")
                .eq("active", true)
                .order("created_at", { ascending: false });

            if (!mounted) return;

            if (companiesData) {
                setCompanies(companiesData);
            }
            setLoading(false);
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, [supabase]);

    const isEligible = (company: CompanyRow) => {
        if (!student) return false;
        const criteria = parseCompanyCriteria(company.criteria_json);
        const { eligible } = computeEligibility(student, criteria);
        return eligible;
    };

    const filtered = companies.filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.company_type.toLowerCase().includes(search.toLowerCase());
        const matchesEligibility = eligibleOnly ? isEligible(c) : true;
        return matchesSearch && matchesEligibility;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold text-neutral-900">Placement Drives</h1>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 w-full sm:w-auto">
                        <Switch id="eligible-mode" checked={eligibleOnly} onCheckedChange={setEligibleOnly} />
                        <Label htmlFor="eligible-mode" className="text-sm font-medium cursor-pointer text-neutral-700">Eligible Only</Label>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                        <Input
                            placeholder="Search companies..."
                            className="pl-9 h-10 bg-neutral-50 border-neutral-200 focus-visible:ring-1 focus-visible:ring-black"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.length > 0 ? (
                        filtered.map((company) => {
                            const eligible = isEligible(company);
                            const isApplied = Boolean(applications.find(a => a.company_id === company.id));
                            const isClosed = company.application_deadline && new Date(company.application_deadline) < new Date();

                            return (
                                <div key={company.id} className="card-border rounded-lg bg-white p-5 flex flex-col md:flex-row gap-5 md:items-center justify-between group mb-4">
                                    <div className="flex items-start gap-5">
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white flex items-center justify-center p-1">
                                            {company.name.toLowerCase().includes("tcs") ? (
                                                <img src="/brand/tcs.jpg" alt="TCS" className="h-full w-full object-contain" />
                                            ) : company.name.toLowerCase().includes("google") ? (
                                                <img
                                                    src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                                                    alt="Google"
                                                    className="h-full w-full object-contain"
                                                />
                                            ) : company.logo_url ? (
                                                <img src={company.logo_url} alt={company.name} className="h-full w-full object-cover rounded-md" />
                                            ) : (
                                                <div className="h-full w-full bg-neutral-100 flex items-center justify-center rounded-md">
                                                    <span className="text-lg font-bold text-neutral-400">{company.name[0]}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2.5">
                                                <h3 className="text-base font-semibold text-neutral-900">{company.name}</h3>
                                                {isApplied && (
                                                    <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">
                                                        Applied
                                                    </Badge>
                                                )}
                                                {!isApplied && eligible && (
                                                    <Badge variant="outline" className="h-5 px-2 text-[10px] font-medium text-emerald-600 border-emerald-200 bg-emerald-50">
                                                        Eligible
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500 font-medium">
                                                <span className="flex items-center gap-1.5">
                                                    <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                                                    {company.company_type}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                                    {company.location || "Remote"}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <IndianRupee className="w-3.5 h-3.5 text-neutral-400" />
                                                    {company.package_range || "Not Disclosed"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-6 pl-0 md:pl-[4.5rem]">
                                        <div className="flex flex-col items-start md:items-end gap-1.5">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                                                <span className="bg-neutral-50 px-2.5 py-1 rounded-md text-[11px] border border-neutral-100 font-semibold text-neutral-700">
                                                    {company.target_role || "General Role"}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${isClosed ? "text-red-600" : "text-neutral-400"}`}>
                                                <Calendar className="w-3.5 h-3.5" />
                                                {isClosed
                                                    ? "Closed"
                                                    : company.application_deadline
                                                        ? `Deadline: ${new Date(company.application_deadline).toLocaleDateString()}`
                                                        : "Open Application"}
                                            </div>
                                        </div>

                                        <Link href={`/student/companies/${company.id}`}>
                                            <Button size="sm" variant="outline" className="h-9 text-xs font-medium px-5 border-black hover:bg-neutral-50">
                                                {isApplied ? "View Details" : "Explore Opportunity"}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="card-border rounded-lg bg-white py-12 text-center">
                            <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Filter className="w-5 h-5 text-neutral-300" />
                            </div>
                            <h3 className="text-sm font-semibold text-neutral-900">No opportunities found</h3>
                            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                                {eligibleOnly ? "No eligible drives found matching your criteria." : "Try adjusting your search filters."}
                            </p>
                            {eligibleOnly && (
                                <Button variant="link" onClick={() => setEligibleOnly(false)} className="mt-2 text-xs h-auto p-0 text-blue-600">
                                    View all companies
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
