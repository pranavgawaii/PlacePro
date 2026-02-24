import { CompanyCriteria, Database, EligibilityResult } from "@/types/database.types";

export function parseCompanyCriteria(raw: unknown): CompanyCriteria {
  const fallback: CompanyCriteria = {
    cgpa_min: 0,
    branches: ["CSE", "ECE", "ENTC", "CIVIL", "AERO", "MECH"],
    backlogs_allowed: 0
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const source = raw as Record<string, unknown>;
  return {
    cgpa_min: typeof source.cgpa_min === "number" ? source.cgpa_min : 0,
    tenth_min: typeof source.tenth_min === "number" ? source.tenth_min : undefined,
    twelfth_min: typeof source.twelfth_min === "number" ? source.twelfth_min : undefined,
    branches: Array.isArray(source.branches)
      ? source.branches.filter((branch): branch is CompanyCriteria["branches"][number] => typeof branch === "string")
      : fallback.branches,
    backlogs_allowed: typeof source.backlogs_allowed === "number" ? source.backlogs_allowed : 0,
    other_requirements:
      typeof source.other_requirements === "string" ? source.other_requirements : undefined
  };
}

type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export function computeEligibility(student: StudentRow, criteria: CompanyCriteria): EligibilityResult {
  const reasons: string[] = [];

  // Keep parity with DB check_eligibility: incomplete profile blocks eligibility.
  if (!student.profile_complete) {
    reasons.push("Profile is incomplete");
  }

  // Hard eligibility criteria
  if ((student.overall_cgpa ?? 0) < criteria.cgpa_min) {
    reasons.push(`CGPA requirement: ${criteria.cgpa_min} (You: ${student.overall_cgpa ?? 0})`);
  }

  if (typeof criteria.tenth_min === "number" && (student.tenth_percentage ?? 0) < criteria.tenth_min) {
    reasons.push(`10th percentage requirement: ${criteria.tenth_min} (You: ${student.tenth_percentage ?? 0})`);
  }

  if (typeof criteria.twelfth_min === "number" && (student.twelfth_percentage ?? 0) < criteria.twelfth_min) {
    reasons.push(`12th percentage requirement: ${criteria.twelfth_min} (You: ${student.twelfth_percentage ?? 0})`);
  }

  if (criteria.branches.length && (!student.branch || !criteria.branches.includes(student.branch))) {
    reasons.push(`Branch requirement mismatch (${criteria.branches.join(", ")})`);
  }

  if ((student.current_backlogs ?? 0) > criteria.backlogs_allowed) {
    reasons.push(`Backlogs allowed: ${criteria.backlogs_allowed} (You: ${student.current_backlogs})`);
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}
