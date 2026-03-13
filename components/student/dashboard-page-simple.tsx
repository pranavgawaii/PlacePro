"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Bell, Send, CheckCircle2, Timer, MapPin, IndianRupee, Briefcase, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNowStrict } from "date-fns";
import { computeEligibility, parseCompanyCriteria } from "@/lib/eligibility";
import { cn } from "@/lib/utils";
import { getPublishedSeatForCurrentStudent } from "@/lib/seat-allocation/seatApi";
import type { PublishedSeatAssignment } from "@/lib/seat-allocation/types";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

export function StudentDashboardPageSimple() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentRow | null>(null);
    const [applications, setApplications] = useState<ApplicationRow[]>([]);
    const [companies, setCompanies] = useState<CompanyRow[]>([]);
    const [publishedSeat, setPublishedSeat] = useState<PublishedSeatAssignment | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: studentData } = await supabase
                    .from("students")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();

                if (studentData) {
                    setStudent(studentData);

                    const { data: appsData } = await supabase
                        .from("applications")
                        .select("*")
                        .eq("student_id", studentData.id);

                    if (appsData) setApplications(appsData);
                    try {
                        const seatAssignment = await getPublishedSeatForCurrentStudent();
                        setPublishedSeat(seatAssignment);
                    } catch (seatError) {
                        console.error("Error fetching seat allocation:", seatError);
                        setPublishedSeat(null);
                    }
                } else {
                    setPublishedSeat(null);
                }

                const { data: companiesData } = await supabase
                    .from("companies")
                    .select("*")
                    .eq("active", true)
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (companiesData) setCompanies(companiesData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [supabase]);

    const shortlistedCount = applications.filter(app => app.status === "shortlisted").length;
    const activeProcesses = applications.filter(app => ["applied", "shortlisted", "interview"].includes(app.status)).length;

    const isEligible = (company: CompanyRow) => {
        if (!student) return false;
        const criteria = parseCompanyCriteria(company.criteria_json);
        const { eligible } = computeEligibility(student, criteria);
        return eligible;
    };

    return (
        <>
            {/* Hero Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Welcome Card */}
                <div
                    className={cn(
                        "rounded-xl card-border overflow-hidden bg-blueprint text-white-force relative",
                        publishedSeat ? "lg:col-span-2" : "lg:col-span-3"
                    )}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
                    <div className="relative p-6 sm:p-8 h-full flex flex-col justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                                {loading ? "Welcome back" : `Welcome back, ${student?.name?.split(" ")[0] || "Student"}`}
                            </h1>
                            <p className="text-blue-100 text-sm max-w-md">
                                You have 2 upcoming interviews this week. Keep up the momentum, your profile is looking strong!
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mt-6">
                            <button className="bg-white text-blue-700 px-4 py-2 rounded text-sm font-semibold hover:bg-blue-50 transition-colors shadow-sm">
                                View Schedule
                            </button>
                            <Link href="/student/profile" className="bg-transparent border border-white/30 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-white/10 transition-colors">
                                Update Profile
                            </Link>
                        </div>
                    </div>
                </div>

                {publishedSeat ? (
                    <div className="rounded-xl card-border bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                                    Seat Allocation
                                </p>
                                <div className="mt-2 flex items-end gap-3">
                                    <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                                        {publishedSeat.lab_name}
                                    </h3>
                                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                                        Seat {publishedSeat.seat_number}
                                    </span>
                                </div>
                            </div>
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
                                <MapPin className="h-4.5 w-4.5" />
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold text-neutral-900">
                                    {publishedSeat.session_title || `Session ${publishedSeat.session_id.slice(0, 8)}`}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                                <span>
                                    {publishedSeat.scheduled_at
                                        ? new Date(publishedSeat.scheduled_at).toLocaleString("en-IN", {
                                            dateStyle: "medium",
                                            timeStyle: "short"
                                        })
                                        : new Date(publishedSeat.created_at).toLocaleString("en-IN", {
                                            dateStyle: "medium",
                                            timeStyle: "short"
                                        })}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Applications Sent */}
                <div className="bg-white p-6 rounded-lg card-border">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Applications Sent</h3>
                            <div className="text-3xl font-bold mt-1 tracking-tight">
                                {loading ? "..." : applications.length}
                            </div>
                        </div>
                        <div className="p-2 bg-neutral-100 rounded text-neutral-600">
                            <Send className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-xs text-neutral-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        {loading ? "..." : activeProcesses} Active processes
                    </div>
                </div>

                {/* Shortlisted */}
                <div className="bg-white p-6 rounded-lg card-border">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Shortlisted</h3>
                            <div className="text-3xl font-bold mt-1 tracking-tight">
                                {loading ? "..." : shortlistedCount}
                            </div>
                        </div>
                        <div className="p-2 bg-blue-50 rounded text-blue-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-xs text-neutral-500 font-medium">Avg. response time: 2 days</div>
                </div>

                {/* Upcoming Interviews (Static Placeholder) */}
                <div className="bg-white p-6 rounded-lg card-border relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Upcoming Interviews</h3>
                            <div className="text-3xl font-bold mt-1 tracking-tight">2</div>
                        </div>
                        <div className="p-2 bg-orange-50 rounded text-orange-600 animate-pulse">
                            <Timer className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 p-2 bg-neutral-50 rounded border border-neutral-100 flex items-center justify-between">
                        <span className="text-xs font-semibold">Uber R2</span>
                        <span className="text-xs font-mono text-orange-600">23h 14m</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Recommended Jobs */}
                <div className="flex-1 space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-bold">Recommended for You</h2>
                        <div className="flex gap-2">
                            <Link href="/student/companies">
                                <button className="text-xs font-medium text-neutral-500 hover:text-black transition-colors px-3 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">
                                    View All
                                </button>
                            </Link>
                        </div>
                    </div>

                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="bg-white p-6 rounded-lg card-border">
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ))
                    ) : companies.length > 0 ? (
                        companies.map(company => {
                            const eligible = isEligible(company);
                            const isApplied = applications.some(app => app.company_id === company.id);
                            const isClosed = company.application_deadline && new Date(company.application_deadline) < new Date();

                            return (
                                <div key={company.id} className="card-border rounded-lg bg-white p-5 flex flex-col md:flex-row gap-5 md:items-center justify-between mb-4">
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
                                            ) : company.name.toLowerCase().includes("uber") ? (
                                                <div className="w-full h-full bg-black flex items-center justify-center">
                                                    <span className="text-white font-bold text-lg">U</span>
                                                </div>
                                            ) : company.name.toLowerCase().includes("tesla") ? (
                                                <div className="w-full h-full bg-red-600 flex items-center justify-center">
                                                    <span className="text-white font-bold text-lg">T</span>
                                                </div>
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
                        <div className="bg-white p-8 rounded-lg card-border text-center text-neutral-500 text-sm">
                            No active placement drives at the moment.
                        </div>
                    )}
                </div>

                {/* Interview Roadmap Sidebar (Static) */}
                <div className="w-full lg:w-80 space-y-6">
                    <div className="bg-white p-6 rounded-lg card-border h-full">
                        <h3 className="font-bold text-lg mb-6">Interview Roadmap</h3>
                        <div className="relative pl-4 border-l-2 border-neutral-100 space-y-8">
                            {/* Completed 1 */}
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white ring-1 ring-neutral-200"></div>
                                <div className="mb-1">
                                    <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Completed</span>
                                </div>
                                <h4 className="text-sm font-bold">Uber Online Assessment</h4>
                                <p className="text-xs text-neutral-500 mt-1">Score: 92/100 • Oct 12, 2024</p>
                            </div>

                            {/* Completed 2 */}
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white ring-1 ring-neutral-200"></div>
                                <div className="mb-1">
                                    <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Completed</span>
                                </div>
                                <h4 className="text-sm font-bold">Uber Technical R1</h4>
                                <p className="text-xs text-neutral-500 mt-1">Feedback: Strong DSA skills • Oct 15, 2024</p>
                            </div>

                            {/* Up Next */}
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white ring-4 ring-blue-50"></div>
                                <div className="mb-1">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                        Up Next
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-black">Uber System Design R2</h4>
                                <div className="mt-2 bg-blue-50 p-3 rounded border border-blue-100">
                                    <div className="flex items-center gap-2 text-xs font-medium text-blue-800 mb-1">
                                        <span className="material-symbols-outlined text-sm">event</span>
                                        Tomorrow
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-blue-800">
                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                        2:00 PM - 3:00 PM
                                    </div>
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <button className="w-full text-xs py-1.5 border border-neutral-300 rounded font-medium hover:bg-neutral-50">
                                        Prep Material
                                    </button>
                                    <button className="w-full text-xs py-1.5 bg-black text-white rounded font-medium hover:bg-neutral-800">
                                        Join Link
                                    </button>
                                </div>
                            </div>

                            {/* Future */}
                            <div className="relative opacity-50">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-neutral-300 border-2 border-white"></div>
                                <div className="mb-1">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Future</span>
                                </div>
                                <h4 className="text-sm font-bold">HR Discussion</h4>
                                <p className="text-xs text-neutral-500 mt-1">Pending Clearance</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
