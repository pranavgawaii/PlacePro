"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
    Database,
    CompanyCriteria,
    EligibilityResult
} from "@/types/database.types";
import {
    ArrowLeft,
    Clock,
    MapPin,
    CheckCircle2,
    AlertCircle,
    FileText,
    Briefcase,
    IndianRupee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { computeEligibility, parseCompanyCriteria } from "@/lib/eligibility";
import { parseFormFields, parseTimeline } from "@/lib/company-utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

export default function CompanyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const companyId = params.id as string;

    const [company, setCompany] = useState<CompanyRow | null>(null);
    const [student, setStudent] = useState<StudentRow | null>(null);
    const [resumes, setResumes] = useState<ResumeRow[]>([]);
    const [application, setApplication] = useState<ApplicationRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Application Form State
    const [selectedResumeId, setSelectedResumeId] = useState("");
    const [coverLetter, setCoverLetter] = useState("");
    const [additionalInfo, setAdditionalInfo] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!companyId) return;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Company
            const { data: companyData, error: companyError } = await supabase
                .from("companies")
                .select("*")
                .eq("id", companyId)
                .single();

            if (companyError || !companyData) {
                toast.error("Company not found");
                router.push("/student/companies");
                return;
            }

            setCompany(companyData);

            // Fetch Student
            const { data: studentData } = await supabase
                .from("students")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (studentData) {
                setStudent(studentData);

                // Fetch Resumes & Application
                const [resumesRes, appRes] = await Promise.all([
                    supabase.from("resumes").select("*").eq("student_id", studentData.id).order("updated_at", { ascending: false }),
                    supabase.from("applications").select("*").eq("student_id", studentData.id).eq("company_id", companyId).maybeSingle()
                ]);

                if (resumesRes.data) {
                    setResumes(resumesRes.data);
                    const def = resumesRes.data.find(r => r.is_default);
                    if (def) setSelectedResumeId(def.id);
                    else if (resumesRes.data.length > 0) setSelectedResumeId(resumesRes.data[0].id);
                }
                if (appRes.data) setApplication(appRes.data);
            }

            setLoading(false);
        };

        fetchData();
    }, [companyId, supabase, router]);

    const criteria = useMemo(() => {
        if (!company) return null;
        return parseCompanyCriteria(company.criteria_json);
    }, [company]);

    const eligibility = useMemo(() => {
        if (!student || !criteria) return { eligible: false, reasons: [] };
        return computeEligibility(student, criteria);
    }, [student, criteria]);

    const formFields = useMemo(() => company ? parseFormFields(company.application_form_fields) : [], [company]);
    const timeline = useMemo(() => company ? parseTimeline(company.process_timeline) : [], [company]);

    const submitApplication = async () => {
        if (!student || !company || !eligibility.eligible) return;
        if (!selectedResumeId) {
            toast.error("Please select a resume");
            return;
        }

        const missingField = formFields.find((field) => field.required && !additionalInfo[field.id]);
        if (missingField) {
            toast.error(`${missingField.label} is required`);
            return;
        }

        setSubmitting(true);

        const { data, error } = await supabase
            .from("applications")
            .insert({
                student_id: student.id,
                company_id: company.id,
                resume_id: selectedResumeId,
                cover_letter: coverLetter || null,
                additional_info: additionalInfo,
                status: "applied"
            })
            .select("*")
            .single();

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Application submitted successfully!");
            setApplication(data);
        }
        setSubmitting(false);
    };

    if (loading || !company || !student) {
        return (
            <div className="max-w-5xl mx-auto p-6 space-y-8">
                <Skeleton className="h-10 w-32" />
                <div className="space-y-4">
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-96 col-span-2 rounded-xl" />
                        <Skeleton className="h-96 col-span-1 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    const isJobExpired = company.application_deadline ? new Date(company.application_deadline) < new Date() : false;

    return (
        <div className="min-h-screen bg-neutral-50/50 pb-20 font-sans">
            {/* Clean Header */}
            <div className="bg-white border-b border-neutral-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                    <div className="mb-6">
                        <Link href="/student/companies">
                            <Button variant="ghost" size="sm" className="pl-0 text-neutral-500 hover:text-black gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Opportunities
                            </Button>
                        </Link>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
                        <div className="flex gap-6">
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white flex items-center justify-center p-2">
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
                                        <span className="text-2xl font-bold text-neutral-400">{company.name[0]}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
                                        {company.name}
                                        {application && (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-xs font-medium px-2.5">
                                                Applied
                                            </Badge>
                                        )}
                                    </h1>
                                    <p className="text-lg text-neutral-600 font-medium mt-1">
                                        {company.target_role || (company.name.toLowerCase().includes("tcs") ? "National Qualifier Test (NQT) - 2026" : (company.job_type || "Role Not Specified"))}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500 font-medium">
                                    <span className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-neutral-400" />
                                        {company.name.toLowerCase().includes("tcs") ? "Pune, Onsite" : (company.location || "Remote")}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <IndianRupee className="w-4 h-4 text-neutral-400" />
                                        {company.name.toLowerCase().includes("tcs") ? "5.0 - 8.0 LPA" : (company.package_range || "Not Disclosed")}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-neutral-400" />
                                        {company.company_type}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-3">
                            {eligibility.eligible ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 text-xs font-semibold rounded-md hover:bg-emerald-100 border">
                                    Eligible Drive
                                </Badge>
                            ) : (
                                <Badge className="bg-rose-50 text-rose-700 border-rose-100 px-3 py-1 text-xs font-semibold rounded-md hover:bg-rose-100 border">
                                    Not Eligible
                                </Badge>
                            )}

                            {company.application_deadline && (
                                <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                                    <Clock className="w-4 h-4 text-neutral-400" />
                                    {new Date(company.application_deadline) < new Date() ? (
                                        <span className="text-rose-600">Applications Closed</span>
                                    ) : (
                                        <span>Deadline: {new Date(company.application_deadline).toLocaleDateString()}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Information */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Summary & Description */}
                        <div className="card-border bg-white rounded-lg p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-neutral-900">About the Role</h2>
                            </div>

                            <div className="prose prose-neutral prose-sm max-w-none text-neutral-600">
                                <p className="whitespace-pre-line">
                                    {company.description || "No specific job description has been provided for this opportunity. Please check the company website for more details."}
                                </p>

                                {company.name.toLowerCase().includes("tcs") && (
                                    <div className="mt-6 pt-6 border-t border-neutral-100 space-y-4">
                                        <h4 className="font-semibold text-neutral-900">Key Responsibilities</h4>
                                        <ul className="grid grid-cols-1 gap-3 list-none p-0">
                                            {[
                                                "Analyze and develop software solutions in specialized technology areas.",
                                                "Collaborate with global teams to deliver high-quality digital transformations.",
                                                "Participate in agile development cycles and continuous learning tracks."
                                            ].map((item, idx) => (
                                                <li key={idx} className="flex gap-3 text-sm items-start">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-[10px] font-bold mt-0.5">{idx + 1}</span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Eligibility Breakdown */}
                        <div className="card-border bg-white rounded-lg overflow-hidden">
                            <div className="px-4 sm:px-6 py-4 border-b border-neutral-100">
                                <h2 className="text-lg font-semibold text-neutral-900">Eligibility Criteria</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-[720px] w-full text-left text-sm">
                                    <thead className="bg-neutral-50 text-neutral-500">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-3 font-medium text-xs uppercase tracking-wide">Criteria</th>
                                            <th className="px-4 sm:px-6 py-3 font-medium text-xs uppercase tracking-wide">Required</th>
                                            <th className="px-4 sm:px-6 py-3 font-medium text-xs uppercase tracking-wide">Your Profile</th>
                                            <th className="px-4 sm:px-6 py-3 font-medium text-xs uppercase tracking-wide text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {[
                                            { label: "High School (10th)", req: criteria?.tenth_min ? `${criteria.tenth_min}%` : "Not Applied", val: student.tenth_percentage ? `${student.tenth_percentage}%` : "N/A", pass: !criteria?.tenth_min || (student.tenth_percentage || 0) >= (criteria.tenth_min || 0) },
                                            { label: "Senior Secondary (12th)", req: criteria?.twelfth_min ? `${criteria.twelfth_min}%` : "Not Applied", val: student.twelfth_percentage ? `${student.twelfth_percentage}%` : "N/A", pass: !criteria?.twelfth_min || (student.twelfth_percentage || 0) >= (criteria.twelfth_min || 0) },
                                            { label: "Undergraduate CGPA", req: criteria?.cgpa_min ? `${criteria.cgpa_min}` : "Min 6.0", val: student.overall_cgpa || "N/A", pass: !criteria?.cgpa_min || (student.overall_cgpa || 0) >= (criteria.cgpa_min || 0) },
                                            { label: "Major / Branch", req: criteria?.branches?.length ? (criteria.branches.length < 5 ? criteria.branches.join(", ") : "Specific Branches") : "All Branches", val: student.branch || "N/A", pass: !criteria?.branches?.length || (!!student.branch && criteria.branches.includes(student.branch)) },
                                            { label: "Active Backlogs", req: (criteria && criteria.backlogs_allowed !== undefined) ? `Max ${criteria.backlogs_allowed}` : "None Allowed", val: student.current_backlogs?.toString() || "0", pass: (!criteria || (student.current_backlogs || 0) <= (criteria.backlogs_allowed || 0)) },
                                            { label: "Profile Status", req: "Complete", val: student.profile_complete ? "Complete" : "Incomplete", pass: !!student.profile_complete }
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-neutral-50/50">
                                                <td className="px-4 sm:px-6 py-4 font-medium text-neutral-900">{row.label}</td>
                                                <td className="px-4 sm:px-6 py-4 text-neutral-600">{row.req}</td>
                                                <td className="px-4 sm:px-6 py-4 text-neutral-600">{row.val}</td>
                                                <td className="px-4 sm:px-6 py-4 text-right">
                                                    {row.pass ?
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-medium px-2 py-0.5 rounded-md">
                                                            Qualified
                                                        </Badge> :
                                                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[10px] font-medium px-2 py-0.5 rounded-md">
                                                            Not Qualified
                                                        </Badge>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Timeline */}
                        {timeline.length > 0 && (
                            <div className="card-border bg-white rounded-lg p-6 space-y-6">
                                <h2 className="text-lg font-semibold text-neutral-900">Selection Process</h2>
                                <div className="flex flex-col md:flex-row gap-4">
                                    {timeline.map((step, i) => (
                                        <div key={step.id} className="flex-1 p-4 rounded-lg border border-neutral-100 bg-neutral-50/50">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-neutral-200 shadow-sm shrink-0 text-xs font-semibold text-neutral-700">
                                                    {i + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-neutral-900 text-sm truncate" title={step.title}>{step.title}</h3>
                                                    {step.planned_at && (
                                                        <p className="text-[10px] font-medium text-neutral-400">
                                                            {new Date(step.planned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2" title={step.description}>
                                                {step.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Apply Form */}
                    <div className="space-y-6">
                        <div className="card-border bg-white rounded-lg p-6 sticky top-6">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-neutral-900">Apply for this Role</h3>
                                <p className="text-sm text-neutral-500 mt-1">Submit your profile and documents</p>
                            </div>

                            {application ? (
                                <div className="text-center py-6 space-y-4 bg-neutral-50 rounded-lg border border-neutral-100">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-neutral-900">Application Submitted</h3>
                                        <p className="text-xs text-neutral-500 mt-1">Applied on {new Date(application.applied_at).toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-white border-neutral-200 text-neutral-700 font-medium">
                                        Status: {application.status}
                                    </Badge>
                                </div>
                            ) : isJobExpired ? (
                                <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-100">
                                    <Clock className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                                    <h3 className="font-semibold text-neutral-900">Applications Closed</h3>
                                    <p className="text-xs text-neutral-500 mt-1 px-4">The deadline for this position has passed.</p>
                                </div>
                            ) : !eligibility.eligible ? (
                                <div className="bg-rose-50 rounded-lg border border-rose-100 p-5 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-semibold text-rose-900 text-sm">Not Eligible</h3>
                                            <p className="text-xs text-rose-700 mt-1 leading-relaxed">You do not meet the academic criteria for this drive.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        {eligibility.reasons.map((reason, idx) => (
                                            <div key={idx} className="text-xs font-medium text-rose-600 flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-rose-500"></div>
                                                {reason}
                                            </div>
                                        ))}
                                    </div>
                                    {eligibility.reasons.some(r => r.includes("Profile")) && (
                                        <Link href="/student/profile" className="block">
                                            <Button variant="outline" size="sm" className="w-full text-xs border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800">
                                                Update Profile
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                // Active Application Form
                                <div className="space-y-5">
                                    {!student.profile_complete && (
                                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex items-start gap-3">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-semibold text-amber-900">Profile Incomplete</h4>
                                                <p className="text-xs text-amber-700 leading-relaxed">
                                                    You need to <Link href="/student/profile" className="underline font-medium hover:text-amber-900">complete your profile</Link> before final selection.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold text-neutral-700">Select Resume</Label>
                                        {resumes.length > 0 ? (
                                            <select
                                                className="w-full h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
                                                value={selectedResumeId}
                                                onChange={e => setSelectedResumeId(e.target.value)}
                                            >
                                                {resumes.map(r => (
                                                    <option key={r.id} value={r.id}>{r.title} {r.is_default ? "(Default)" : ""}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-md border border-rose-100 font-medium">
                                                No resumes found. <Link href="/student/profile" className="underline">Upload Resume</Link>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-semibold text-neutral-700">Cover Letter (Optional)</Label>
                                        <Textarea
                                            className="min-h-[100px] border-neutral-200 bg-white focus:ring-1 focus:ring-black rounded-md text-sm resize-none"
                                            placeholder="Why are you a good fit?"
                                            value={coverLetter}
                                            onChange={e => setCoverLetter(e.target.value)}
                                        />
                                    </div>

                                    {formFields.length > 0 && (
                                        <div className="space-y-4 pt-4 border-t border-neutral-100">
                                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Additional Details</h4>
                                            {formFields.map(field => (
                                                <div key={field.id} className="space-y-2">
                                                    <Label className="text-xs font-semibold text-neutral-700">
                                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                                    </Label>
                                                    {field.type === 'textarea' ? (
                                                        <Textarea
                                                            className="border-neutral-200 focus:ring-1 focus:ring-black rounded-md text-sm"
                                                            value={additionalInfo[field.id] || ""}
                                                            onChange={e => setAdditionalInfo({ ...additionalInfo, [field.id]: e.target.value })}
                                                        />
                                                    ) : (
                                                        <Input
                                                            type={field.type === 'number' ? 'number' : 'text'}
                                                            className="h-10 border-neutral-200 focus:ring-1 focus:ring-black rounded-md text-sm"
                                                            value={additionalInfo[field.id] || ""}
                                                            onChange={e => setAdditionalInfo({ ...additionalInfo, [field.id]: e.target.value })}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        className="w-full bg-black hover:bg-neutral-800 text-white font-medium h-10 rounded-md mt-2"
                                        onClick={submitApplication}
                                        disabled={submitting || !selectedResumeId}
                                    >
                                        {submitting ? "Submitting..." : "Apply Now"}
                                    </Button>
                                    <p className="text-[10px] text-center text-neutral-400">
                                        By applying, you agree to share your profile with {company.name}.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
