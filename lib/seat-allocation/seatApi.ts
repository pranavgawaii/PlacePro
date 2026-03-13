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
  SeatAssignmentEditorRow,
  SeatSession,
  SeatSessionCandidate,
  SeatSessionCandidateView,
  SeatSessionDetails,
  SeatSessionListItem,
  SeatSourceMode,
  SeatStudentOption,
  SeatSummaryItem,
  SeatUploadRow
} from "@/lib/seat-allocation/types";
import type { Database, UserRole } from "@/types/database.types";

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

const ACTIVE_CANDIDATE_STATUSES: CandidateMatchStatus[] = ["matched", "unmatched", "duplicate", "overflow"];
const SESSION_SELECT_COLUMNS =
  "id, owner_id, source_mode, status, is_published, published_at, published_by, created_at";
const LAB_SELECT_COLUMNS = "id, owner_id, lab_name, total_seats, rows, columns, seat_pattern, created_at, updated_at";

const isAdminRole = (role: UserRole | null): boolean => role === "admin" || role === "super_admin";

const normalizePrn = (value: string | null | undefined): string => String(value ?? "").trim().toUpperCase();

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
  const matchedCount = candidateList.filter((row) => row.match_status === "matched" && row.student_id).length;
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

  return (data ?? []).map((row) => ({
    id: row.id,
    source_mode: row.source_mode,
    status: row.status,
    is_published: row.is_published,
    published_at: row.published_at,
    created_at: row.created_at
  }));
};

export const createSeatSession = async (params: { sourceMode: SeatSourceMode }): Promise<SeatSession> => {
  const { supabase, userId } = await requireAdminContext();
  const { data, error } = await supabase
    .from("seat_sessions")
    .insert({
      owner_id: userId,
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
  let unmatchedCount = 0;
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
        error_message: "Duplicate PRN in file or already present in this session."
      });
      duplicateCount += 1;
      seenInImport.add(normalizedPrn);
      return;
    }

    if (matchedStudent) {
      inserts.push({
        session_id: params.sessionId,
        student_id: matchedStudent.id,
        prn: normalizedPrn,
        name_snapshot: matchedStudent.name,
        branch_snapshot: matchedStudent.branch,
        source_mode: "upload",
        source_row_no: row.row_index,
        match_status: "matched",
        error_message: null
      });
      matchedCount += 1;
      seenInImport.add(normalizedPrn);
      existingPrns.add(normalizedPrn);
      return;
    }

    inserts.push({
      session_id: params.sessionId,
      student_id: null,
      prn: normalizedPrn,
      name_snapshot: sourceName,
      branch_snapshot: sourceBranch,
      source_mode: "upload",
      source_row_no: row.row_index,
      match_status: "unmatched",
      error_message: "No student record found for this PRN."
    });
    unmatchedCount += 1;
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
    throw new Error("That student or PRN is already active in this seat session.");
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

  if (candidate.student_id) {
    const { error: assignmentError } = await supabase
      .from("seat_assignments")
      .delete()
      .eq("session_id", candidate.session_id)
      .eq("student_id", candidate.student_id);

    if (assignmentError) {
      throw asError(assignmentError, "Unable to clear seat assignment for removed candidate.");
    }
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

  const matchedCandidates = (candidatesResult.data ?? []).filter((candidate) => Boolean(candidate.student_id));
  if (matchedCandidates.length === 0) {
    throw new Error("Add or resolve students before running auto allocation.");
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
      student_id: candidate.student_id as string,
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
        student_id: assignment.student_id,
        lab_id: assignment.lab_id,
        seat_number: assignment.seat_number
      }))
    );

    if (insertError) {
      throw asError(insertError, "Unable to save auto-generated seat assignments.");
    }
  }

  if (allocation.overflow_student_ids.length > 0) {
    const overflowCandidateIds = matchedCandidates
      .filter((candidate) => candidate.student_id && allocation.overflow_student_ids.includes(candidate.student_id))
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
    overflow_count: allocation.overflow_student_ids.length,
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
        .select("student_id, lab_id, seat_number")
        .eq("session_id", sessionId)
    ]);

  if (candidateError) {
    throw asError(candidateError, "Unable to load matched candidates.");
  }

  if (assignmentError) {
    throw asError(assignmentError, "Unable to load seat assignments.");
  }

  const assignmentMap = new Map((assignments ?? []).map((assignment) => [assignment.student_id, assignment]));

  return (candidates ?? [])
    .filter((candidate) => Boolean(candidate.student_id))
    .map((candidate) => {
      const assignment = assignmentMap.get(candidate.student_id as string);
      return {
        candidate_id: candidate.id,
        student_id: candidate.student_id as string,
        student_name: candidate.name_snapshot ?? "Student",
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
  studentId: string;
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
    .select("id")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .eq("match_status", "matched")
    .maybeSingle();

  if (candidateError) {
    throw asError(candidateError, "Unable to verify student assignment eligibility.");
  }

  if (!candidate) {
    throw new Error("Only matched students can be assigned a seat.");
  }

  const { error } = await supabase
    .from("seat_assignments")
    .upsert(
      {
        session_id: params.sessionId,
        student_id: params.studentId,
        lab_id: params.labId,
        seat_number: seatNumber
      },
      { onConflict: "session_id,student_id" }
    );

  if (error) {
    throw asError(error, "Unable to save seat assignment.");
  }

  await syncSeatSessionStatus(supabase, params.sessionId);
};

export const removeSeatAssignment = async (params: {
  sessionId: string;
  studentId: string;
}): Promise<void> => {
  const { supabase } = await requireAdminContext();
  await ensureEditableSeatSession(supabase, params.sessionId);

  const { error } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId);

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
    matched_candidates: candidates.filter((row) => row.match_status === "matched" && row.student_id).length,
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

export const downloadSeatTemplate = async (): Promise<void> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    { prn: "ADT23SOCB0741", name: "Aarav Sharma", branch: "CSE" },
    { prn: "ADT23SOCB0742", name: "Siya Patil", branch: "ECE" },
    { prn: "ADT23SOCB0743", name: "Vedant Joshi", branch: "ENTC" }
  ]);

  worksheet["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 12 }];
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
    .select("id, published_at")
    .eq("is_published", true)
    .maybeSingle();

  if (sessionError) {
    throw asError(sessionError, "Unable to load published seat session.");
  }

  if (!sessionRow) {
    return null;
  }

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("seat_assignments")
    .select("session_id, lab_id, seat_number, created_at")
    .eq("session_id", sessionRow.id)
    .eq("student_id", studentRow.id)
    .maybeSingle();

  if (assignmentError) {
    throw asError(assignmentError, "Unable to load published seat assignment.");
  }

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
    seat_number: assignmentRow.seat_number,
    lab_name: labRow.lab_name,
    published_at: sessionRow.published_at,
    created_at: assignmentRow.created_at
  };
};
