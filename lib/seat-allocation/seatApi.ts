import { createClient } from "@/lib/supabase/client";
import {
  autoAllocateSeats as buildAutoAllocation,
  compareSeatNumbers
} from "@/lib/seat-allocation/seatAllocationEngine";
import type {
  AddDirectCandidatesResult,
  AutoAllocateSeatsResult,
  CandidateMatchStatus,
  ImportSeatCandidatesResult,
  Lab,
  ParseSource,
  PublishedSeatAssignment,
  SeatDocumentGenerationResult,
  SeatDocumentPreview,
  SeatExportMode,
  SeatAssignmentEditorRow,
  SeatSession,
  SeatSessionCandidate,
  SeatSessionCandidateView,
  SeatSessionDetails,
  SeatSessionListItem,
  SeatSourceMode,
  SeatStudentOption,
  SeatSummaryItem,
  SeatPreviewGroup,
  SeatUploadRow
} from "@/lib/seat-allocation/types";
import type { Database, UserRole } from "@/types/database.types";

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

const ACTIVE_CANDIDATE_STATUSES: CandidateMatchStatus[] = ["matched", "unmatched", "duplicate", "overflow"];
const SESSION_SELECT_COLUMNS =
  "id, owner_id, title, source_mode, status, is_published, published_at, published_by, created_at";
const LAB_SELECT_COLUMNS = "id, owner_id, lab_name, total_seats, rows, columns, seat_pattern, created_at, updated_at";

const isAdminRole = (role: UserRole | null): boolean => role === "admin" || role === "super_admin";

const normalizePrn = (value: string | null | undefined): string => String(value ?? "").trim().toUpperCase();
const defaultSeatSessionTitle = (sourceMode: SeatSourceMode): string =>
  sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft";

const asError = (error: unknown, fallback = "Unexpected error"): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }

  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message = typeof value.message === "string" ? value.message.trim() : "";
    const code = typeof value.code === "string" ? value.code.trim() : "";
    const details = typeof value.details === "string" ? value.details.trim() : "";
    const hint = typeof value.hint === "string" ? value.hint.trim() : "";
    const lowerMessage = message.toLowerCase();

    if (
      code === "42P01" ||
      code === "PGRST205" ||
      lowerMessage.includes("does not exist") ||
      lowerMessage.includes("schema cache") ||
      lowerMessage.includes("could not find the table")
    ) {
      return new Error("Seat allocation V2 tables are missing in Supabase. Run the latest seat allocation V2 SQL migration and refresh the schema cache.");
    }

    if (
      code === "42501" ||
      lowerMessage.includes("permission denied") ||
      lowerMessage.includes("row-level security")
    ) {
      return new Error("Seat allocation V2 permissions are not up to date. Apply the latest seat allocation V2 RLS SQL.");
    }

    if (code === "23505" || lowerMessage.includes("duplicate key")) {
      return new Error("That seat or student is already assigned in this session.");
    }

    if (message) {
      const extraParts = [details, hint].filter(Boolean);
      return new Error(extraParts.length > 0 ? `${message} ${extraParts.join(" ")}` : message);
    }
  }

  return new Error(fallback);
};

const readAuthContext = async (): Promise<AuthContext> => {
  const supabase = createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Please log in again.");
  }

  return { supabase, userId: user.id };
};

const requireAdminContext = async (): Promise<AuthContext> => {
  const context = await readAuthContext();

  const { data: roleRow, error } = await context.supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    throw asError(error, "Unable to verify admin role.");
  }

  if (!roleRow || !roleRow.is_active || !isAdminRole(roleRow.role)) {
    throw new Error("Only admins can access seat allocation.");
  }

  return context;
};

const toLab = (row: Database["public"]["Tables"]["labs"]["Row"]): Lab => row;
const toSeatSession = (row: Database["public"]["Tables"]["seat_sessions"]["Row"]): SeatSession => row;

const statusRank: Record<CandidateMatchStatus, number> = {
  unmatched: 0,
  duplicate: 1,
  overflow: 2,
  matched: 3,
  removed: 4
};

const loadActiveSessionCandidates = async (
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<SeatSessionCandidate[]> => {
  const { data, error } = await supabase
    .from("seat_session_candidates")
    .select("*")
    .eq("session_id", sessionId)
    .neq("match_status", "removed")
    .order("created_at", { ascending: true });

  if (error) {
    throw asError(error, "Unable to load seat session candidates.");
  }

  return data ?? [];
};

const getSeatSession = async (
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<SeatSession> => {
  const { data, error } = await supabase
    .from("seat_sessions")
    .select(SESSION_SELECT_COLUMNS)
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw asError(error, "Seat session not found.");
  }

  return toSeatSession(data);
};

const ensureEditableSeatSession = async (
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  expectedSourceMode?: SeatSourceMode
): Promise<SeatSession> => {
  const session = await getSeatSession(supabase, sessionId);

  if (session.is_published) {
    throw new Error("Published seat sessions are read-only. Create a new draft session to make changes.");
  }

  if (expectedSourceMode && session.source_mode !== expectedSourceMode) {
    throw new Error(`This session accepts ${session.source_mode} candidates. Create a ${expectedSourceMode} draft session instead.`);
  }

  return session;
};

const syncSeatSessionStatus = async (
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<void> => {
  const session = await getSeatSession(supabase, sessionId);
  if (session.is_published) {
    return;
  }

  const [candidateRows, assignmentRowsResult] = await Promise.all([
    supabase
      .from("seat_session_candidates")
      .select("match_status, student_id")
      .eq("session_id", sessionId),
    supabase
      .from("seat_assignments")
      .select("id")
      .eq("session_id", sessionId)
  ]);

  if (candidateRows.error) {
    throw asError(candidateRows.error, "Unable to sync session status.");
  }

  if (assignmentRowsResult.error) {
    throw asError(assignmentRowsResult.error, "Unable to sync session status.");
  }

  const candidateList = candidateRows.data ?? [];
  const matchedCount = candidateList.filter((row) => row.match_status === "matched").length;
  const unresolvedCount = candidateList.filter((row) =>
    row.match_status === "unmatched" || row.match_status === "duplicate" || row.match_status === "overflow"
  ).length;
  const assignedCount = (assignmentRowsResult.data ?? []).length;

  const nextStatus =
    matchedCount > 0 && unresolvedCount === 0 && assignedCount === matchedCount ? "ready" : "draft";

  const { error } = await supabase
    .from("seat_sessions")
    .update({ status: nextStatus })
    .eq("id", sessionId);

  if (error) {
    throw asError(error, "Unable to update seat session status.");
  }
};

const buildSeatPreviewGroups = (
  rows: Array<{
    student_id: string;
    seat_number: string;
    enrollment_no: string;
    student_name: string;
    branch: string | null;
    lab_name: string;
  }>,
  exportMode: SeatExportMode
): SeatPreviewGroup[] => {
  if (exportMode === "full_list") {
    return [
      {
        key: "all",
        title: "Full List",
        rows
      }
    ];
  }

  const map = new Map<string, SeatPreviewGroup>();
  rows.forEach((row) => {
    if (!map.has(row.lab_name)) {
      map.set(row.lab_name, {
        key: row.lab_name,
        title: row.lab_name,
        rows: []
      });
    }

    map.get(row.lab_name)?.rows.push(row);
  });

  return Array.from(map.values()).sort((left, right) =>
    left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
  );
};

const candidateRevisionKey = (candidate: {
  student_id?: string | null;
  prn: string;
  name_snapshot?: string | null;
  source_row_no?: number | null;
}) =>
  [candidate.student_id ?? "", normalizePrn(candidate.prn), candidate.name_snapshot ?? "", String(candidate.source_row_no ?? "")]
    .join("::");

export const listLabs = async (): Promise<Lab[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("labs")
    .select(LAB_SELECT_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    throw asError(error, "Unable to load labs.");
  }

  return (data ?? []).map(toLab);
};

export const createLab = async (payload: {
  lab_name: string;
  total_seats: number;
  rows?: number | null;
  columns?: number | null;
  seat_pattern?: string;
}): Promise<Lab> => {
  const { supabase, userId } = await requireAdminContext();

  const cleanName = payload.lab_name.trim();
  if (!cleanName) {
    throw new Error("Lab name is required.");
  }

  const seats = Number(payload.total_seats);
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error("Total seats must be a positive integer.");
  }

  const insertPayload: Database["public"]["Tables"]["labs"]["Insert"] = {
    owner_id: userId,
    lab_name: cleanName,
    total_seats: seats,
    rows: payload.rows ?? null,
    columns: payload.columns ?? null,
    seat_pattern: payload.seat_pattern ?? "numeric"
  };

  const { data, error } = await supabase
    .from("labs")
    .insert(insertPayload)
    .select(LAB_SELECT_COLUMNS)
    .single();

  if (error) {
    throw asError(error, "Failed to create lab.");
  }

  return toLab(data);
};

export const updateLab = async (
  labId: string,
  payload: {
    lab_name: string;
    total_seats: number;
    rows?: number | null;
    columns?: number | null;
    seat_pattern?: string;
  }
): Promise<Lab> => {
  const { supabase } = await requireAdminContext();

  const cleanName = payload.lab_name.trim();
  if (!cleanName) {
    throw new Error("Lab name is required.");
  }

  const seats = Number(payload.total_seats);
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error("Total seats must be a positive integer.");
  }

  const updatePayload: Database["public"]["Tables"]["labs"]["Update"] = {
    lab_name: cleanName,
    total_seats: seats,
    rows: payload.rows ?? null,
    columns: payload.columns ?? null,
    seat_pattern: payload.seat_pattern ?? "numeric",
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("labs")
    .update(updatePayload)
    .eq("id", labId)
    .select(LAB_SELECT_COLUMNS)
    .single();

  if (error) {
    throw asError(error, "Failed to update lab.");
  }

  return toLab(data);
};

export const deleteLab = async (labId: string): Promise<void> => {
  const { supabase } = await requireAdminContext();
  const { error } = await supabase.from("labs").delete().eq("id", labId);

  if (error) {
    throw asError(error, "Failed to delete lab.");
  }
};

export const listMappableStudents = async (): Promise<SeatStudentOption[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("students")
    .select("id, name, email, prn, branch, batch_year")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw asError(error, "Unable to load students.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    prn: row.prn,
    branch: row.branch,
    batch_year: row.batch_year
  }));
};

export const listSeatSessions = async (limit = 20): Promise<SeatSessionListItem[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("seat_sessions")
    .select(SESSION_SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw asError(error, "Unable to load seat sessions.");
  }

  const sessionRows = data ?? [];
  const sessionIds = sessionRows.map((row) => row.id);

  const [candidateStatsResult, assignmentStatsResult] = await Promise.all([
    sessionIds.length > 0
      ? supabase
          .from("seat_session_candidates")
          .select("session_id, match_status, student_id")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length > 0
      ? supabase
          .from("seat_assignments")
          .select("session_id")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (candidateStatsResult.error) {
    throw asError(candidateStatsResult.error, "Unable to load seat session candidate counts.");
  }

  if (assignmentStatsResult.error) {
    throw asError(assignmentStatsResult.error, "Unable to load seat session assignment counts.");
  }

  const statsMap = new Map<
    string,
    {
      total_candidates: number;
      matched_candidates: number;
      overflow_candidates: number;
      assigned_candidates: number;
    }
  >();

  sessionIds.forEach((sessionId) => {
    statsMap.set(sessionId, {
      total_candidates: 0,
      matched_candidates: 0,
      overflow_candidates: 0,
      assigned_candidates: 0
    });
  });

  (candidateStatsResult.data ?? []).forEach((row) => {
    const current = statsMap.get(row.session_id);
    if (!current) {
      return;
    }

    current.total_candidates += 1;
    if (row.match_status === "matched") {
      current.matched_candidates += 1;
    }
    if (row.match_status === "overflow") {
      current.overflow_candidates += 1;
    }
  });

  (assignmentStatsResult.data ?? []).forEach((row) => {
    const current = statsMap.get(row.session_id);
    if (!current) {
      return;
    }

    current.assigned_candidates += 1;
  });

  return sessionRows.map((row) => ({
    id: row.id,
    title: row.title,
    source_mode: row.source_mode,
    status: row.status,
    is_published: row.is_published,
    published_at: row.published_at,
    created_at: row.created_at,
    stats: statsMap.get(row.id) ?? {
      total_candidates: 0,
      matched_candidates: 0,
      overflow_candidates: 0,
      assigned_candidates: 0
    }
  }));
};

export const createSeatSession = async (params: {
  sourceMode: SeatSourceMode;
  title?: string;
}): Promise<SeatSession> => {
  const { supabase, userId } = await requireAdminContext();
  const title = params.title?.trim() || defaultSeatSessionTitle(params.sourceMode);
  const { data, error } = await supabase
    .from("seat_sessions")
    .insert({
      owner_id: userId,
      title,
      source_mode: params.sourceMode,
      status: "draft"
    })
    .select(SESSION_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw asError(error, "Failed to create seat session.");
  }

  return toSeatSession(data);
};

export const addDirectCandidates = async (params: {
  sessionId: string;
  studentIds: string[];
}): Promise<AddDirectCandidatesResult> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId, "direct");

  const uniqueStudentIds = Array.from(new Set(params.studentIds.filter(Boolean)));
  if (uniqueStudentIds.length === 0) {
    throw new Error("Select at least one student.");
  }

  const [{ data: students, error: studentsError }, activeCandidates] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, prn, branch, is_active")
      .in("id", uniqueStudentIds),
    loadActiveSessionCandidates(supabase, params.sessionId)
  ]);

  if (studentsError) {
    throw asError(studentsError, "Unable to load selected students.");
  }

  const existingStudentIds = new Set(activeCandidates.map((candidate) => candidate.student_id).filter(Boolean));
  const existingPrns = new Set(activeCandidates.map((candidate) => normalizePrn(candidate.prn)).filter(Boolean));

  const inserts: Database["public"]["Tables"]["seat_session_candidates"]["Insert"][] = [];
  let skippedCount = 0;

  (students ?? []).forEach((student) => {
    if (!student.is_active) {
      skippedCount += 1;
      return;
    }

    const normalizedPrn = normalizePrn(student.prn);
    if (existingStudentIds.has(student.id) || (normalizedPrn && existingPrns.has(normalizedPrn))) {
      skippedCount += 1;
      return;
    }

    inserts.push({
      session_id: params.sessionId,
      student_id: student.id,
      prn: normalizedPrn,
      name_snapshot: student.name,
      branch_snapshot: student.branch,
      source_mode: "direct",
      match_status: "matched"
    });
  });

  if (inserts.length > 0) {
    const { error } = await supabase.from("seat_session_candidates").insert(inserts);
    if (error) {
      throw asError(error, "Unable to add selected students to the seat session.");
    }
  }

  await syncSeatSessionStatus(supabase, params.sessionId);

  return {
    added_count: inserts.length,
    skipped_count: skippedCount + Math.max(0, uniqueStudentIds.length - (students ?? []).length)
  };
};

export const importSeatCandidates = async (params: {
  sessionId: string;
  rows: SeatUploadRow[];
  source: ParseSource;
}): Promise<ImportSeatCandidatesResult> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId, "upload");

  if (params.rows.length === 0) {
    throw new Error("No parsed rows available to import.");
  }

  const activeCandidates = await loadActiveSessionCandidates(supabase, params.sessionId);
  const existingPrns = new Set(activeCandidates.map((candidate) => normalizePrn(candidate.prn)).filter(Boolean));
  const inputPrns = Array.from(new Set(params.rows.map((row) => normalizePrn(row.prn)).filter(Boolean)));

  const { data: matchedStudents, error: studentsError } = await supabase
    .from("students")
    .select("id, name, prn, branch, is_active")
    .in("prn", inputPrns);

  if (studentsError) {
    throw asError(studentsError, "Unable to match uploaded students.");
  }

  const studentsByPrn = new Map(
    (matchedStudents ?? [])
      .filter((student) => student.is_active)
      .map((student) => [normalizePrn(student.prn), student])
  );

  const seenInImport = new Set<string>();
  const inserts: Database["public"]["Tables"]["seat_session_candidates"]["Insert"][] = [];
  let matchedCount = 0;
  const unmatchedCount = 0;
  let duplicateCount = 0;

  params.rows.forEach((row) => {
    const normalizedPrn = normalizePrn(row.prn);
    const sourceName = row.name?.trim() || null;
    const sourceBranch = row.branch?.trim() || null;

    if (!normalizedPrn) {
      return;
    }

    const isDuplicate = seenInImport.has(normalizedPrn) || existingPrns.has(normalizedPrn);
    const matchedStudent = studentsByPrn.get(normalizedPrn);

    if (isDuplicate) {
      inserts.push({
        session_id: params.sessionId,
        student_id: null,
        prn: normalizedPrn,
        name_snapshot: sourceName,
        branch_snapshot: sourceBranch,
        source_mode: "upload",
        source_row_no: row.row_index,
        match_status: "duplicate",
        error_message: "Duplicate Enrollment No in file or already present in this session."
      });
      duplicateCount += 1;
      seenInImport.add(normalizedPrn);
      return;
    }

    inserts.push({
      session_id: params.sessionId,
      student_id: matchedStudent?.id ?? null,
      prn: normalizedPrn,
      name_snapshot: matchedStudent?.name ?? sourceName ?? normalizedPrn,
      branch_snapshot: matchedStudent?.branch ?? sourceBranch,
      source_mode: "upload",
      source_row_no: row.row_index,
      match_status: "matched",
      error_message: null
    });
    matchedCount += 1;
    seenInImport.add(normalizedPrn);
    existingPrns.add(normalizedPrn);
  });

  if (inserts.length > 0) {
    const { error } = await supabase.from("seat_session_candidates").insert(inserts);
    if (error) {
      throw asError(error, "Unable to import uploaded seat candidates.");
    }
  }

  await syncSeatSessionStatus(supabase, params.sessionId);

  return {
    inserted_count: inserts.length,
    matched_count: matchedCount,
    unmatched_count: unmatchedCount,
    duplicate_count: duplicateCount
  };
};

export const listSeatCandidates = async (sessionId: string): Promise<SeatSessionCandidateView[]> => {
  const { supabase } = await requireAdminContext();
  const activeCandidates = await loadActiveSessionCandidates(supabase, sessionId);

  const studentIds = Array.from(new Set(activeCandidates.map((candidate) => candidate.student_id).filter(Boolean)));
  const { data: students, error } = studentIds.length
    ? await supabase
        .from("students")
        .select("id, name, email, branch")
        .in("id", studentIds as string[])
    : { data: [], error: null };

  if (error) {
    throw asError(error, "Unable to load candidate student details.");
  }

  const studentMap = new Map((students ?? []).map((student) => [student.id, student]));

  return activeCandidates
    .map((candidate) => {
      const student = candidate.student_id ? studentMap.get(candidate.student_id) ?? null : null;
      return {
        id: candidate.id,
        session_id: candidate.session_id,
        student_id: candidate.student_id,
        prn: candidate.prn,
        name_snapshot: candidate.name_snapshot,
        branch_snapshot: candidate.branch_snapshot,
        source_mode: candidate.source_mode,
        source_row_no: candidate.source_row_no,
        match_status: candidate.match_status,
        error_message: candidate.error_message,
        student_name: student?.name ?? null,
        student_email: student?.email ?? null,
        student_branch: student?.branch ?? null
      };
    })
    .sort((left, right) => {
      const rankCompare = statusRank[left.match_status] - statusRank[right.match_status];
      if (rankCompare !== 0) {
        return rankCompare;
      }

      return left.prn.localeCompare(right.prn, undefined, { numeric: true, sensitivity: "base" });
    });
};

export const resolveSeatCandidate = async (params: {
  candidateId: string;
  studentId: string;
}): Promise<void> => {
  const { supabase } = await requireAdminContext();
  const { data: candidate, error: candidateError } = await supabase
    .from("seat_session_candidates")
    .select("*")
    .eq("id", params.candidateId)
    .single();

  if (candidateError || !candidate) {
    throw asError(candidateError, "Seat candidate not found.");
  }

  await ensureEditableSeatSession(supabase, candidate.session_id);

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, prn, branch, is_active")
    .eq("id", params.studentId)
    .single();

  if (studentError || !student || !student.is_active) {
    throw asError(studentError, "Selected student is not available.");
  }

  const activeCandidates = await loadActiveSessionCandidates(supabase, candidate.session_id);
  const normalizedPrn = normalizePrn(student.prn) || candidate.prn;
  const hasConflict = activeCandidates.some((row) => {
    if (row.id === params.candidateId) {
      return false;
    }

    return row.student_id === student.id || normalizePrn(row.prn) === normalizedPrn;
  });

  if (hasConflict) {
    throw new Error("That student or Enrollment No is already active in this seat session.");
  }

  const { error } = await supabase
    .from("seat_session_candidates")
    .update({
      student_id: student.id,
      prn: normalizedPrn,
      name_snapshot: student.name,
      branch_snapshot: student.branch,
      match_status: "matched",
      error_message: null
    })
    .eq("id", params.candidateId);

  if (error) {
    throw asError(error, "Unable to resolve candidate to a real student.");
  }

  const { error: assignmentError } = await supabase
    .from("seat_assignments")
    .update({ student_id: student.id })
    .eq("session_id", candidate.session_id)
    .eq("candidate_id", candidate.id);

  if (assignmentError) {
    throw asError(assignmentError, "Unable to sync seat assignment with the resolved student.");
  }

  await syncSeatSessionStatus(supabase, candidate.session_id);
};

export const removeSeatCandidate = async (candidateId: string): Promise<void> => {
  const { supabase } = await requireAdminContext();
  const { data: candidate, error: candidateError } = await supabase
    .from("seat_session_candidates")
    .select("*")
    .eq("id", candidateId)
    .single();

  if (candidateError || !candidate) {
    throw asError(candidateError, "Seat candidate not found.");
  }

  await ensureEditableSeatSession(supabase, candidate.session_id);

  const { error } = await supabase
    .from("seat_session_candidates")
    .update({
      match_status: "removed",
      error_message: null
    })
    .eq("id", candidateId);

  if (error) {
    throw asError(error, "Unable to remove seat candidate.");
  }

  const { error: assignmentError } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("session_id", candidate.session_id)
    .eq("candidate_id", candidate.id);

  if (assignmentError) {
    throw asError(assignmentError, "Unable to clear seat assignment for removed candidate.");
  }

  await syncSeatSessionStatus(supabase, candidate.session_id);
};

export const autoAllocateSeats = async (params: {
  sessionId: string;
  labIds: string[];
}): Promise<AutoAllocateSeatsResult> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId);

  const labIds = Array.from(new Set(params.labIds.filter(Boolean)));
  if (labIds.length === 0) {
    throw new Error("Select at least one lab before auto allocation.");
  }

  const [labsResult, candidatesResult] = await Promise.all([
    supabase
      .from("labs")
      .select(LAB_SELECT_COLUMNS)
      .in("id", labIds),
    supabase
      .from("seat_session_candidates")
      .select("*")
      .eq("session_id", params.sessionId)
      .in("match_status", ["matched", "overflow"])
  ]);

  if (labsResult.error) {
    throw asError(labsResult.error, "Unable to load labs for auto allocation.");
  }

  if (candidatesResult.error) {
    throw asError(candidatesResult.error, "Unable to load matched candidates for auto allocation.");
  }

  const orderedLabs = (labsResult.data ?? [])
    .map(toLab)
    .sort((left, right) => labIds.indexOf(left.id) - labIds.indexOf(right.id));

  if (orderedLabs.length !== labIds.length) {
    throw new Error("One or more selected labs are invalid.");
  }

  const matchedCandidates = (candidatesResult.data ?? []).filter((candidate) => candidate.match_status === "matched");
  if (matchedCandidates.length === 0) {
    throw new Error("Add or import candidates before running auto allocation.");
  }

  const resetOverflowIds = matchedCandidates.map((candidate) => candidate.id);
  if (resetOverflowIds.length > 0) {
    const { error } = await supabase
      .from("seat_session_candidates")
      .update({ match_status: "matched", error_message: null })
      .in("id", resetOverflowIds);

    if (error) {
      throw asError(error, "Unable to reset candidate state before auto allocation.");
    }
  }

  const allocation = buildAutoAllocation({
    labs: orderedLabs,
    students: matchedCandidates.map((candidate) => ({
      candidate_id: candidate.id,
      student_id: candidate.student_id,
      prn: normalizePrn(candidate.prn),
      name: candidate.name_snapshot ?? candidate.prn
    }))
  });

  const { error: deleteError } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("session_id", params.sessionId);

  if (deleteError) {
    throw asError(deleteError, "Unable to clear existing seat assignments.");
  }

  if (allocation.assignments.length > 0) {
    const { error: insertError } = await supabase.from("seat_assignments").insert(
      allocation.assignments.map((assignment) => ({
        session_id: params.sessionId,
        candidate_id: assignment.candidate_id,
        student_id: assignment.student_id,
        lab_id: assignment.lab_id,
        seat_number: assignment.seat_number
      }))
    );

    if (insertError) {
      throw asError(insertError, "Unable to save auto-generated seat assignments.");
    }
  }

  if (allocation.overflow_candidate_ids.length > 0) {
    const overflowCandidateIds = matchedCandidates
      .filter((candidate) => allocation.overflow_candidate_ids.includes(candidate.id))
      .map((candidate) => candidate.id);

    if (overflowCandidateIds.length > 0) {
      const { error: overflowError } = await supabase
        .from("seat_session_candidates")
        .update({
          match_status: "overflow",
          error_message: "Not enough seats in the selected labs."
        })
        .in("id", overflowCandidateIds);

      if (overflowError) {
        throw asError(overflowError, "Unable to update overflow candidates.");
      }
    }
  }

  await syncSeatSessionStatus(supabase, params.sessionId);

  return {
    session_id: params.sessionId,
    assigned_count: allocation.assignments.length,
    overflow_count: allocation.overflow_candidate_ids.length,
    seat_summary: allocation.seat_summary
  };
};

export const listSeatAssignments = async (sessionId: string): Promise<SeatAssignmentEditorRow[]> => {
  const { supabase } = await requireAdminContext();

  const [{ data: candidates, error: candidateError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      supabase
        .from("seat_session_candidates")
        .select("id, student_id, prn, name_snapshot, branch_snapshot")
        .eq("session_id", sessionId)
        .eq("match_status", "matched"),
      supabase
        .from("seat_assignments")
        .select("candidate_id, student_id, lab_id, seat_number")
        .eq("session_id", sessionId)
    ]);

  if (candidateError) {
    throw asError(candidateError, "Unable to load matched candidates.");
  }

  if (assignmentError) {
    throw asError(assignmentError, "Unable to load seat assignments.");
  }

  const assignmentMap = new Map((assignments ?? []).map((assignment) => [assignment.candidate_id, assignment]));

  return (candidates ?? [])
    .map((candidate) => {
      const assignment = assignmentMap.get(candidate.id);
      return {
        candidate_id: candidate.id,
        student_id: candidate.student_id,
        student_name: candidate.name_snapshot ?? "Candidate",
        prn: candidate.prn,
        branch: candidate.branch_snapshot,
        lab_id: assignment?.lab_id ?? null,
        seat_number: assignment?.seat_number ?? null
      };
    })
    .sort((left, right) => {
      if (left.lab_id && right.lab_id) {
        if (left.lab_id !== right.lab_id) {
          return left.lab_id.localeCompare(right.lab_id);
        }
        if (left.seat_number && right.seat_number) {
          return compareSeatNumbers(left.seat_number, right.seat_number);
        }
      }

      const leftKey = normalizePrn(left.prn) || left.student_name;
      const rightKey = normalizePrn(right.prn) || right.student_name;
      return leftKey.localeCompare(rightKey, undefined, { numeric: true, sensitivity: "base" });
    });
};

export const updateSeatAssignment = async (params: {
  sessionId: string;
  candidateId: string;
  labId: string;
  seatNumber: string;
}): Promise<void> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId);

  const seatNumber = String(params.seatNumber ?? "").trim().toUpperCase();
  if (!params.labId || !seatNumber) {
    throw new Error("Select a lab and enter a seat number.");
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("seat_session_candidates")
    .select("id, student_id")
    .eq("id", params.candidateId)
    .eq("session_id", params.sessionId)
    .eq("match_status", "matched")
    .maybeSingle();

  if (candidateError) {
    throw asError(candidateError, "Unable to verify student assignment eligibility.");
  }

  if (!candidate) {
    throw new Error("Only matched candidates can be assigned a seat.");
  }

  const { error } = await supabase
    .from("seat_assignments")
    .upsert(
      {
        session_id: params.sessionId,
        candidate_id: params.candidateId,
        student_id: candidate.student_id ?? null,
        lab_id: params.labId,
        seat_number: seatNumber
      },
      { onConflict: "session_id,candidate_id" }
    );

  if (error) {
    throw asError(error, "Unable to save seat assignment.");
  }

  await syncSeatSessionStatus(supabase, params.sessionId);
};

export const removeSeatAssignment = async (params: {
  sessionId: string;
  candidateId: string;
}): Promise<void> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId);

  const { error } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("session_id", params.sessionId)
    .eq("candidate_id", params.candidateId);

  if (error) {
    throw asError(error, "Unable to remove seat assignment.");
  }

  await syncSeatSessionStatus(supabase, params.sessionId);
};

export const getSeatSessionDetails = async (sessionId: string): Promise<SeatSessionDetails> => {
  const { supabase } = await requireAdminContext();

  const [session, candidatesResult, assignmentsResult] = await Promise.all([
    getSeatSession(supabase, sessionId),
    supabase
      .from("seat_session_candidates")
      .select("match_status, student_id")
      .eq("session_id", sessionId),
    supabase
      .from("seat_assignments")
      .select("lab_id")
      .eq("session_id", sessionId)
  ]);

  if (candidatesResult.error) {
    throw asError(candidatesResult.error, "Unable to load seat session candidate stats.");
  }

  if (assignmentsResult.error) {
    throw asError(assignmentsResult.error, "Unable to load seat assignment stats.");
  }

  const candidates = candidatesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];

  const stats = {
    total_candidates: candidates.length,
    matched_candidates: candidates.filter((row) => row.match_status === "matched").length,
    unmatched_candidates: candidates.filter((row) => row.match_status === "unmatched").length,
    duplicate_candidates: candidates.filter((row) => row.match_status === "duplicate").length,
    overflow_candidates: candidates.filter((row) => row.match_status === "overflow").length,
    removed_candidates: candidates.filter((row) => row.match_status === "removed").length,
    assigned_candidates: assignments.length,
    unassigned_matched_candidates: 0
  };

  stats.unassigned_matched_candidates = Math.max(0, stats.matched_candidates - stats.assigned_candidates);

  const labIds = Array.from(new Set(assignments.map((assignment) => assignment.lab_id)));
  const { data: labs, error: labsError } = labIds.length
    ? await supabase
        .from("labs")
        .select("id, lab_name, total_seats")
        .in("id", labIds)
    : { data: [], error: null };

  if (labsError) {
    throw asError(labsError, "Unable to load lab summary.");
  }

  const labSummaryMap = new Map<string, SeatSummaryItem>();
  (labs ?? []).forEach((lab) => {
    labSummaryMap.set(lab.id, {
      lab_id: lab.id,
      lab_name: lab.lab_name,
      allocated_count: 0,
      total_seats: lab.total_seats
    });
  });

  assignments.forEach((assignment) => {
    const summaryRow = labSummaryMap.get(assignment.lab_id);
    if (summaryRow) {
      summaryRow.allocated_count += 1;
    }
  });

  return {
    session,
    stats,
    lab_summary: Array.from(labSummaryMap.values()).sort((left, right) =>
      left.lab_name.localeCompare(right.lab_name, undefined, { sensitivity: "base" })
    )
  };
};

export const updateSeatSessionTitle = async (params: {
  sessionId: string;
  title: string;
}): Promise<SeatSession> => {
  const { supabase } = await requireAdminContext();
  const title = params.title.trim();

  if (!title) {
    throw new Error("Session title is required.");
  }

  const { data, error } = await supabase
    .from("seat_sessions")
    .update({ title })
    .eq("id", params.sessionId)
    .select(SESSION_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw asError(error, "Unable to update seat session title.");
  }

  return toSeatSession(data);
};

export const deleteSeatSession = async (sessionId: string): Promise<void> => {
  const { supabase } = await requireAdminContext();
  const session = await getSeatSession(supabase, sessionId);

  if (session.is_published) {
    throw new Error("Published sessions cannot be deleted. Create a revision instead.");
  }

  const { error } = await supabase
    .from("seat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    throw asError(error, "Unable to delete seat session.");
  }
};

export const createSeatSessionRevision = async (params: {
  sessionId: string;
  title?: string;
}): Promise<SeatSession> => {
  const { supabase, userId } = await requireAdminContext();
  const sourceSession = await getSeatSession(supabase, params.sessionId);

  const nextTitle = params.title?.trim() || `${sourceSession.title} Revision`;

  const [{ data: candidates, error: candidatesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("seat_session_candidates")
        .select("*")
        .eq("session_id", params.sessionId)
        .neq("match_status", "removed"),
      supabase
        .from("seat_assignments")
        .select("*")
        .eq("session_id", params.sessionId)
    ]);

  if (candidatesError) {
    throw asError(candidatesError, "Unable to load source seat candidates for revision.");
  }

  if (assignmentsError) {
    throw asError(assignmentsError, "Unable to load source seat assignments for revision.");
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("seat_sessions")
    .insert({
      owner_id: userId,
      title: nextTitle,
      source_mode: sourceSession.source_mode,
      status: "draft"
    })
    .select(SESSION_SELECT_COLUMNS)
    .single();

  if (sessionError || !sessionRow) {
    throw asError(sessionError, "Unable to create seat session revision.");
  }

  const revisionSession = toSeatSession(sessionRow);
  const candidateIdMap = new Map<string, string>();

  if ((candidates ?? []).length > 0) {
    const { data: insertedCandidates, error } = await supabase.from("seat_session_candidates").insert(
      (candidates ?? []).map((candidate) => ({
        session_id: revisionSession.id,
        student_id: candidate.student_id,
        prn: candidate.prn,
        name_snapshot: candidate.name_snapshot,
        branch_snapshot: candidate.branch_snapshot,
        source_mode: candidate.source_mode,
        source_row_no: candidate.source_row_no,
        match_status: candidate.match_status,
        error_message: candidate.error_message
      }))
    ).select("id, student_id, prn, name_snapshot, source_row_no");

    if (error) {
      throw asError(error, "Unable to copy seat candidates into the revision draft.");
    }

    (insertedCandidates ?? []).forEach((candidate) => {
      candidateIdMap.set(
        candidateRevisionKey(candidate),
        candidate.id
      );
    });
  }

  if ((assignments ?? []).length > 0) {
    const { error } = await supabase.from("seat_assignments").insert(
      (assignments ?? [])
        .map((assignment) => {
          const sourceCandidate =
            (candidates ?? []).find((candidate) => candidate.id === assignment.candidate_id) ??
            (candidates ?? []).find(
              (candidate) =>
                candidate.student_id &&
                assignment.student_id &&
                candidate.student_id === assignment.student_id
            ) ??
            null;

          if (!sourceCandidate) {
            return null;
          }

          const revisionCandidateId = candidateIdMap.get(candidateRevisionKey(sourceCandidate));
          if (!revisionCandidateId) {
            return null;
          }

          return {
            session_id: revisionSession.id,
            candidate_id: revisionCandidateId,
            student_id: sourceCandidate.student_id ?? assignment.student_id ?? null,
            lab_id: assignment.lab_id,
            seat_number: assignment.seat_number
          };
        })
        .filter(Boolean) as Database["public"]["Tables"]["seat_assignments"]["Insert"][]
    );

    if (error) {
      throw asError(error, "Unable to copy seat assignments into the revision draft.");
    }
  }

  await syncSeatSessionStatus(supabase, revisionSession.id);
  return await getSeatSession(supabase, revisionSession.id);
};

export const getSeatDocumentPreview = async (
  sessionId: string,
  exportMode: SeatExportMode
): Promise<SeatDocumentPreview> => {
  const { supabase } = await requireAdminContext();

  const { data, error } = await supabase
    .from("seat_assignments")
    .select(`
      candidate_id,
      student_id,
      seat_number,
      labs!seat_assignments_lab_id_fkey(lab_name),
      students!seat_assignments_student_id_fkey(name, prn, branch),
      seat_session_candidates!seat_assignments_candidate_id_fkey(prn, name_snapshot, branch_snapshot)
    `)
    .eq("session_id", sessionId);

  if (error) {
    throw asError(error, "Unable to load seat document preview.");
  }

  const previewRows = (data ?? []) as Array<{
    candidate_id: string | null;
    student_id: string | null;
    seat_number: string;
    labs: { lab_name: string } | null;
    students: { name: string; prn: string | null; branch: string | null } | null;
    seat_session_candidates: { prn: string; name_snapshot: string | null; branch_snapshot: string | null } | null;
  }>;

  const rows = previewRows
    .map((row) => ({
      student_id: row.student_id ?? row.candidate_id ?? row.seat_number,
      seat_number: row.seat_number,
      enrollment_no: normalizePrn(row.students?.prn ?? row.seat_session_candidates?.prn),
      student_name: row.students?.name ?? row.seat_session_candidates?.name_snapshot ?? "Candidate",
      branch: row.students?.branch ?? row.seat_session_candidates?.branch_snapshot ?? null,
      lab_name: row.labs?.lab_name ?? "Unknown Lab"
    }))
    .sort((left, right) => {
      const labCompare = left.lab_name.localeCompare(right.lab_name, undefined, { sensitivity: "base" });
      if (labCompare !== 0) {
        return labCompare;
      }
      return compareSeatNumbers(left.seat_number, right.seat_number);
    });

  const seatingGroups = buildSeatPreviewGroups(rows, exportMode);
  const attendanceGroups = buildSeatPreviewGroups(rows, exportMode);

  return {
    export_mode: exportMode,
    seating_groups: seatingGroups,
    attendance_groups: attendanceGroups
  };
};

export const publishSeatSession = async (sessionId: string): Promise<SeatSession> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase.rpc("publish_seat_session", {
    p_session_id: sessionId
  });

  if (error) {
    throw asError(error, "Unable to publish the seat session.");
  }

  if (!data) {
    throw new Error("Seat publish did not return session data.");
  }

  const sessionRow = Array.isArray(data) ? data[0] : data;
  return toSeatSession(sessionRow as SeatSession);
};

export const generateSeatDocuments = async (params: {
  sessionId: string;
  formats: Array<"pdf" | "xlsx">;
  exportMode: SeatExportMode;
}): Promise<SeatDocumentGenerationResult> => {
  const response = await fetch("/api/admin/seat-allocation/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      formats: params.formats,
      exportMode: params.exportMode
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | (SeatDocumentGenerationResult & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to generate seat documents.");
  }

  return {
    seat_pdf_url: payload?.seat_pdf_url,
    attendance_pdf_url: payload?.attendance_pdf_url,
    workbook_url: payload?.workbook_url,
    generated_at: payload?.generated_at ?? new Date().toISOString()
  };
};

export const downloadSeatTemplate = async (): Promise<void> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    { Name: "Aarav Sharma", "Enrollment No": "ADT23SOCB0741", Branch: "CSE" },
    { Name: "Siya Patil", "Enrollment No": "ADT23SOCB0742", Branch: "ECE" },
    { Name: "Vedant Joshi", "Enrollment No": "ADT23SOCB0743", Branch: "ENTC" }
  ]);

  worksheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Seat Allocation");
  XLSX.writeFile(workbook, "placepro_seat_allocation_template.xlsx");
};

export const getPublishedSeatForCurrentStudent = async (): Promise<PublishedSeatAssignment | null> => {
  const { supabase, userId } = await readAuthContext();

  const { data: studentRow, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (studentError) {
    throw asError(studentError, "Unable to load student profile.");
  }

  if (!studentRow) {
    return null;
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("seat_sessions")
    .select("id, title, published_at")
    .eq("is_published", true)
    .maybeSingle();

  if (sessionError) {
    throw asError(sessionError, "Unable to load published seat session.");
  }

  if (!sessionRow) {
    return null;
  }

  const { data: candidateRows, error: candidateError } = await supabase
    .from("seat_session_candidates")
    .select("id")
    .eq("session_id", sessionRow.id)
    .eq("student_id", studentRow.id)
    .neq("match_status", "removed");

  if (candidateError) {
    throw asError(candidateError, "Unable to load published seat candidate details.");
  }

  const candidateIds = Array.from(new Set((candidateRows ?? []).map((row) => row.id)));

  let assignmentQuery = supabase
    .from("seat_assignments")
    .select("session_id, lab_id, seat_number, created_at, candidate_id, student_id")
    .eq("session_id", sessionRow.id);

  if (candidateIds.length > 0) {
    assignmentQuery = assignmentQuery.or(`student_id.eq.${studentRow.id},candidate_id.in.(${candidateIds.join(",")})`);
  } else {
    assignmentQuery = assignmentQuery.eq("student_id", studentRow.id);
  }

  const { data: assignmentRows, error: assignmentError } = await assignmentQuery
    .order("created_at", { ascending: true })
    .limit(1);

  if (assignmentError) {
    throw asError(assignmentError, "Unable to load published seat assignment.");
  }

  const assignmentRow = assignmentRows?.[0] ?? null;
  if (!assignmentRow) {
    return null;
  }

  const { data: labRow, error: labError } = await supabase
    .from("labs")
    .select("lab_name")
    .eq("id", assignmentRow.lab_id)
    .maybeSingle();

  if (labError) {
    throw asError(labError, "Unable to load seat lab details.");
  }

  if (!labRow) {
    return null;
  }

  return {
    session_id: sessionRow.id,
    session_title: sessionRow.title,
    seat_number: assignmentRow.seat_number,
    lab_name: labRow.lab_name,
    published_at: sessionRow.published_at,
    created_at: assignmentRow.created_at
  };
};
