import {
  Branch,
  CompanyType,
  DocType,
  JobType,
  ResumeTemplateType,
  ApplicationStatus
} from "@/types/database.types";

export const BRANCHES: Branch[] = ["CSE", "ECE", "ENTC", "CIVIL", "AERO", "MECH"];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  tenth: "10th Marksheet",
  twelfth: "12th Marksheet",
  sem1: "Semester 1 Grade Card",
  sem2: "Semester 2 Grade Card",
  sem3: "Semester 3 Grade Card",
  sem4: "Semester 4 Grade Card",
  sem5: "Semester 5 Grade Card",
  sem6: "Semester 6 Grade Card",
  sem7: "Semester 7 Grade Card",
  sem8: "Semester 8 Grade Card",
  resume: "Resume",
  other: "Other"
};

export const REQUIRED_DOC_TYPES: DocType[] = [
  "tenth",
  "twelfth",
  "sem1",
  "sem2",
  "sem3",
  "sem4",
  "sem5",
  "sem6",
  "sem7",
  "sem8"
];

export const DOC_TYPES: DocType[] = [...REQUIRED_DOC_TYPES];

export const RESUME_TEMPLATES: Array<{ value: ResumeTemplateType; label: string }> = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
  { value: "minimalist", label: "Minimalist" },
  { value: "creative", label: "Creative" }
];

export const COMPANY_TYPES: CompanyType[] = ["Service", "Product", "Startup", "Government"];
export const JOB_TYPES: JobType[] = ["Full-time", "Internship", "Both"];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  selected: "Selected"
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, "info" | "success" | "destructive" | "secondary"> = {
  applied: "info",
  shortlisted: "secondary",
  interview: "secondary",
  rejected: "destructive",
  selected: "success"
};

export const SKILL_OPTIONS = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "Java",
  "Python",
  "SQL",
  "Supabase",
  "Tailwind",
  "Docker"
];
