"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Building2, Clock3, MapPin, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { computeEligibility, parseCompanyCriteria } from "@/lib/eligibility";
import { createClient } from "@/lib/supabase/client";
import {
    Database,
    CompanyCriteria,
    EligibilityResult
} from "@/types/database.types";
import { parseFormFields, parseTimeline, requirementStatus } from "@/lib/company-utils"; // New utility
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];

interface CompanyDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: CompanyRow;
    student: StudentRow;
    resumes: ResumeRow[];
    existingApplication?: ApplicationRow | null;
    onApplicationSubmit?: (app: ApplicationRow) => void;
    initialView?: "details" | "apply";
}

export function CompanyDetailDialog({
    open,
    onOpenChange,
    company,
    student,
    resumes,
    existingApplication,
    onApplicationSubmit,
    initialView = "details"
}: CompanyDetailDialogProps) {
    const supabase = createClient();
    const [view, setView] = useState<"details" | "apply">(initialView);
    const [selectedResumeId, setSelectedResumeId] = useState("");
    const [coverLetter, setCoverLetter] = useState("");
    const [additionalInfo, setAdditionalInfo] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Reset view when dialog opens/closes
    useEffect(() => {
        if (open) {
            setView(initialView);
        } else {
            const timer = setTimeout(() => setView("details"), 300); // Reset after transition
            return () => clearTimeout(timer);
        }
    }, [open, initialView]);

    // Set default resume
    useEffect(() => {
        if (resumes.length && !selectedResumeId) {
            const def = resumes.find((r) => r.is_default) ?? resumes[0];
            setSelectedResumeId(def.id);
        }
    }, [resumes, selectedResumeId]);

    const criteria = useMemo<CompanyCriteria>(() => {
        return parseCompanyCriteria(company.criteria_json);
    }, [company]);

    const eligibility = useMemo<EligibilityResult>(() => {
        return computeEligibility(student, criteria);
    }, [company, criteria, student]);

    const formFields = useMemo(() => parseFormFields(company.application_form_fields), [company]);
    const processTimeline = useMemo(() => parseTimeline(company.process_timeline), [company]);

    const requirementRows = useMemo(() => {
        return [
            requirementStatus(
                "10th %",
                criteria.tenth_min ? `${criteria.tenth_min}%+` : "Not specified",
                student.tenth_percentage ? `${student.tenth_percentage}%` : "N/A",
                criteria.tenth_min ? (student.tenth_percentage ?? 0) >= criteria.tenth_min : true
            ),
            requirementStatus(
                "12th %",
                criteria.twelfth_min ? `${criteria.twelfth_min}%+` : "Not specified",
                student.twelfth_percentage ? `${student.twelfth_percentage}%` : "N/A",
                criteria.twelfth_min ? (student.twelfth_percentage ?? 0) >= criteria.twelfth_min : true
            ),
            requirementStatus(
                "CGPA",
                `${criteria.cgpa_min}+`,
                student.overall_cgpa !== null ? String(student.overall_cgpa) : "N/A",
                (student.overall_cgpa ?? 0) >= criteria.cgpa_min
            ),
            requirementStatus(
                "Branch",
                criteria.branches.length ? criteria.branches.join(", ") : "All",
                student.branch ?? "N/A",
                !criteria.branches.length || (student.branch ? criteria.branches.includes(student.branch) : false)
            ),
            requirementStatus(
                "Backlogs",
                String(criteria.backlogs_allowed ?? 0),
                String(student.current_backlogs),
                student.current_backlogs <= (criteria.backlogs_allowed ?? 0)
            )
        ];
    }, [criteria, student]);

    const submitApplication = async () => {
        if (!student || !company || !eligibility.eligible) {
            return;
        }

        if (!selectedResumeId) {
            toast.error("Select a resume");
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

        if (error || !data) {
            toast.error(error?.message ?? "Unable to submit application");
            setSubmitting(false);
            return;
        }

        if (onApplicationSubmit) {
            onApplicationSubmit(data);
        }

        toast.success("Application submitted! 🎉");
        onOpenChange(false);
        setSubmitting(false);
    };

    const deadlineText = company.application_deadline
        ? `Closes in ${formatDistanceToNowStrict(new Date(company.application_deadline), { addSuffix: false })}`
        : "No deadline";

    // VIEW: APPLICATION FORM (Default and Only View)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Apply to {company.name}</DialogTitle>
                    <DialogDescription>Submit your resume and required details.</DialogDescription>
                </DialogHeader>

                {resumes.length ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="resume">Select Resume</Label>
                            <select
                                id="resume"
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                value={selectedResumeId}
                                onChange={(event) => setSelectedResumeId(event.target.value)}
                            >
                                {resumes.map((resume) => (
                                    <option key={resume.id} value={resume.id}>
                                        {resume.title} {resume.is_default ? "(Default)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cover-letter">Cover Letter (optional)</Label>
                            <Textarea
                                id="cover-letter"
                                maxLength={500}
                                value={coverLetter}
                                onChange={(event) => setCoverLetter(event.target.value)}
                                placeholder="Why are you a good fit?"
                            />
                        </div>

                        {formFields.map((field) => (
                            <div key={field.id} className="space-y-2">
                                <Label htmlFor={`field-${field.id}`}>
                                    {field.label}
                                    {field.required ? " *" : ""}
                                </Label>
                                {field.type === "textarea" ? (
                                    <Textarea
                                        id={`field-${field.id}`}
                                        value={additionalInfo[field.id] ?? ""}
                                        onChange={(event) =>
                                            setAdditionalInfo((prev) => ({
                                                ...prev,
                                                [field.id]: event.target.value
                                            }))
                                        }
                                    />
                                ) : (
                                    <Input
                                        id={`field-${field.id}`}
                                        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                                        value={additionalInfo[field.id] ?? ""}
                                        onChange={(event) =>
                                            setAdditionalInfo((prev) => ({
                                                ...prev,
                                                [field.id]: event.target.value
                                            }))
                                        }
                                    />
                                )}
                            </div>
                        ))}

                        {processTimeline.length ? (
                            <div className="rounded-md border bg-muted/30 p-3 mt-4">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Application Process</p>
                                <div className="space-y-1 text-sm">
                                    {processTimeline.map((step) => (
                                        <p key={step.id}>• {step.title}</p>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                        Create a resume first. <Link href="/student/profile" className="underline">Go to Resume Builder</Link>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => void submitApplication()} disabled={!resumes.length || submitting}>
                        {submitting ? "Submitting..." : "Submit Application"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
