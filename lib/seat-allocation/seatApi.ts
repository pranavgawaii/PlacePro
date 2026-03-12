import { createClient } from "@/lib/supabase/client";
import { allocateSequentially, compareSeatNumbers } from "@/lib/seat-allocation/seatAllocationEngine";
import type {
  AllocationMode,
  AllocationSession,
  Lab,
  ParseSource,
  ParseStudentsResult,
  ParsedRow,
  PublishedSeatAssignment,
  SeatAllocationResult,
  SeatSummaryItem,
  SessionAllocationDetails,
  SessionMappingRow,
  StudentMappingOption
} from "@/lib/seat-allocation/types";
import type { Database, Json, UserRole } from "@/types/database.types";

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

interface ParsedTempRow extends ParsedRow {
  id: string;
}

const isAdminRole = (role: UserRole | null): boolean => role === "admin" || role === "super_admin";

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

    if (code === "42P01" || lowerMessage.includes("does not exist")) {
      return new Error("Seat allocation tables are missing. Run the latest Supabase seat allocation migrations.");
    }

    if (
      code === "42501" ||
      lowerMessage.includes("permission denied") ||
      lowerMessage.includes("row-level security")
    ) {
      return new Error("Seat allocation permissions are not up to date. Apply the latest seat allocation RLS migration.");
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

const parseSeatSummaryFromMetadata = (metadata: Json | null): SeatSummaryItem[] | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const seatSummary = (metadata as Record<string, Json | undefined>).seat_summary;
  if (!Array.isArray(seatSummary)) {
    return null;
  }

  const normalized: SeatSummaryItem[] = [];

  seatSummary.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const row = item as Record<string, Json | undefined>;
    const lab_id = typeof row.lab_id === "string" ? row.lab_id : null;
    const lab_name = typeof row.lab_name === "string" ? row.lab_name : null;
    const allocated_count = typeof row.allocated_count === "number" ? row.allocated_count : null;
    const total_seats = typeof row.total_seats === "number" ? row.total_seats : null;

    if (!lab_id || !lab_name || allocated_count === null || total_seats === null) {
      return;
    }

    normalized.push({ lab_id, lab_name, allocated_count, total_seats });
  });

  return normalized.length > 0 ? normalized : null;
};

const parseOverflowFromMetadata = (
  metadata: Json | null
): Array<{ student_id: string; name: string; roll_number: string }> | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const overflow = (metadata as Record<string, Json | undefined>).overflow_students;
  if (!Array.isArray(overflow)) {
    return null;
  }

  const normalized: Array<{ student_id: string; name: string; roll_number: string }> = [];

  overflow.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const row = item as Record<string, Json | undefined>;
    const student_id = typeof row.student_id === "string" ? row.student_id : null;
    const name = typeof row.name === "string" ? row.name : null;
    const roll_number = typeof row.roll_number === "string" ? row.roll_number : null;

    if (!student_id || !name || !roll_number) {
      return;
    }

    normalized.push({ student_id, name, roll_number });
  });

  return normalized;
};

const toSession = (row: Database["public"]["Tables"]["allocation_sessions"]["Row"]): AllocationSession => row;
const toLab = (row: Database["public"]["Tables"]["labs"]["Row"]): Lab => row;
const LAB_SELECT_COLUMNS = "id, owner_id, lab_name, total_seats, rows, columns, seat_pattern, created_at, updated_at";
const STUDENTS_TEMP_SELECT_COLUMNS =
  "id, owner_id, name, roll_number, department, upload_session_id, parse_source, raw_row, created_at";
const ALLOCATION_SESSION_SELECT_COLUMNS =
  "id, owner_id, upload_session_id, mode, status, seed, metadata, is_published, published_at, published_by, created_at";

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

export const parseStudentsFromNormalizedRows = async (params: {
  rows: ParsedRow[];
  source: ParseSource;
  upload_session_id?: string;
}): Promise<ParseStudentsResult> => {
  const { supabase, userId } = await requireAdminContext();
  const uploadSessionId = params.upload_session_id ?? crypto.randomUUID();

  const { data: existingRows, error: existingError } = await supabase
    .from("students_temp")
    .select("roll_number")
    .eq("owner_id", userId)
    .eq("upload_session_id", uploadSessionId);

  if (existingError) {
    throw asError(existingError, "Failed to validate duplicate rolls.");
  }

  const existingRolls = new Set((existingRows ?? []).map((row) => row.roll_number.toLowerCase()));
  const payloadRolls = new Set<string>();
  const duplicates = new Set<string>();
  const invalidRows: ParseStudentsResult["invalid_rows"] = [];

  const validRows = params.rows
    .map((row, index) => ({
      row_index: row.row_index ?? index + 1,
      name: row.name.trim(),
      roll_number: row.roll_number.trim(),
      department: row.department?.trim() || null,
      raw_row: row.raw_row ?? { ...row }
    }))
    .filter((row) => {
      if (!row.name || !row.roll_number) {
        invalidRows.push({
          row_index: row.row_index,
          reason: "Missing required name or roll number.",
          raw_row: row.raw_row
        });
        return false;
      }

      const key = row.roll_number.toLowerCase();
      if (payloadRolls.has(key)) {
        duplicates.add(row.roll_number);
        invalidRows.push({
          row_index: row.row_index,
          reason: `Duplicate roll number in upload: ${row.roll_number}`,
          raw_row: row.raw_row
        });
        return false;
      }

      if (existingRolls.has(key)) {
        duplicates.add(row.roll_number);
        invalidRows.push({
          row_index: row.row_index,
          reason: `Roll number already exists in this upload session: ${row.roll_number}`,
          raw_row: row.raw_row
        });
        return false;
      }

      payloadRolls.add(key);
      existingRolls.add(key);
      return true;
    });

  if (validRows.length > 0) {
    const inserts: Database["public"]["Tables"]["students_temp"]["Insert"][] = validRows.map((row) => ({
      owner_id: userId,
      name: row.name,
      roll_number: row.roll_number,
      department: row.department,
      upload_session_id: uploadSessionId,
      parse_source: params.source,
      raw_row: row.raw_row as Json
    }));

    const { error } = await supabase.from("students_temp").insert(inserts);
    if (error) {
      throw asError(error, "Failed to save parsed students.");
    }
  }

  return {
    upload_session_id: uploadSessionId,
    parsed_count: validRows.length,
    duplicate_rolls: Array.from(duplicates),
    invalid_rows: invalidRows
  };
};

export const listStudentsByUploadSession = async (uploadSessionId: string): Promise<ParsedTempRow[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("students_temp")
    .select(STUDENTS_TEMP_SELECT_COLUMNS)
    .eq("upload_session_id", uploadSessionId)
    .order("roll_number", { ascending: true });

  if (error) {
    throw asError(error, "Unable to load parsed students.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    roll_number: row.roll_number,
    department: row.department ?? undefined,
    raw_row: (row.raw_row as Record<string, unknown> | null) ?? undefined
  }));
};

export const runSeatAllocation = async (payload: {
  lab_ids: string[];
  mode?: AllocationMode;
  upload_session_id: string;
}): Promise<SeatAllocationResult> => {
  const { supabase, userId } = await requireAdminContext();

  const mode: AllocationMode = payload.mode === "random" ? "random" : "alphabetical";
  const selectedLabIds = Array.from(new Set(payload.lab_ids.filter(Boolean)));

  if (selectedLabIds.length === 0) {
    throw new Error("Select at least one lab before allocation.");
  }

  const [{ data: labsData, error: labsError }, { data: studentsData, error: studentsError }] = await Promise.all([
    supabase
      .from("labs")
      .select(LAB_SELECT_COLUMNS)
      .eq("owner_id", userId)
      .in("id", selectedLabIds),
    supabase
      .from("students_temp")
      .select(STUDENTS_TEMP_SELECT_COLUMNS)
      .eq("owner_id", userId)
      .eq("upload_session_id", payload.upload_session_id)
  ]);

  if (labsError) {
    throw asError(labsError, "Unable to load selected labs.");
  }

  if (studentsError) {
    throw asError(studentsError, "Unable to load uploaded students.");
  }

  const labs = (labsData ?? []).map(toLab);
  if (labs.length !== selectedLabIds.length) {
    throw new Error("One or more selected labs are invalid.");
  }

  const uploadedStudents = (studentsData ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    roll_number: row.roll_number,
    department: row.department ?? undefined,
    raw_row: (row.raw_row as Record<string, unknown> | null) ?? undefined
  }));

  if (uploadedStudents.length === 0) {
    throw new Error("Upload students before running allocation.");
  }

  const labOrder = new Map(selectedLabIds.map((labId, index) => [labId, index]));
  const orderedLabs = [...labs].sort((a, b) => (labOrder.get(a.id) ?? 0) - (labOrder.get(b.id) ?? 0));

  const seed = mode === "random" ? Math.floor(Math.random() * 1_000_000_000) : 0;
  const allocation = allocateSequentially({
    labs: orderedLabs,
    students: uploadedStudents,
    mode,
    seed
  });

  const totalCapacity = orderedLabs.reduce((sum, lab) => sum + lab.total_seats, 0);

  const metadata: Json = {
    generated_by: "client",
    lab_ids: selectedLabIds,
    total_students: uploadedStudents.length,
    total_capacity: totalCapacity,
    seat_summary: allocation.seat_summary,
    overflow_students: allocation.overflow_students.map((student) => ({
      student_id: student.id ?? "",
      name: student.name,
      roll_number: student.roll_number
    }))
  };

  const sessionInsert: Database["public"]["Tables"]["allocation_sessions"]["Insert"] = {
    owner_id: userId,
    upload_session_id: payload.upload_session_id,
    mode,
    status: allocation.overflow_students.length > 0 ? "completed_with_overflow" : "completed",
    seed: mode === "random" ? seed : null,
    metadata
  };

  const { data: sessionRow, error: sessionError } = await supabase
    .from("allocation_sessions")
    .insert(sessionInsert)
    .select(ALLOCATION_SESSION_SELECT_COLUMNS)
    .single();

  if (sessionError || !sessionRow) {
    throw asError(sessionError, "Failed to create allocation session.");
  }

  if (allocation.allocations.length > 0) {
    const inserts: Database["public"]["Tables"]["allocations"]["Insert"][] = allocation.allocations.map((row) => ({
      owner_id: userId,
      student_id: row.student.id ?? "",
      matched_student_id: null,
      lab_id: row.lab_id,
      lab_name_snapshot: row.lab_name,
      seat_number: row.seat_number,
      session_id: sessionRow.id
    }));

    if (inserts.some((row) => !row.student_id)) {
      throw new Error("Allocation failed: missing student mapping context.");
    }

    const { error: insertError } = await supabase.from("allocations").insert(inserts);
    if (insertError) {
      throw asError(insertError, "Failed to save allocation rows.");
    }
  }

  return {
    session_id: sessionRow.id,
    mode,
    upload_session_id: payload.upload_session_id,
    seat_summary: allocation.seat_summary,
    overflow_students: allocation.overflow_students.map((student) => ({
      student_id: student.id ?? "",
      name: student.name,
      roll_number: student.roll_number
    }))
  };
};

export const listAllocationSessions = async (limit = 20): Promise<AllocationSession[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("allocation_sessions")
    .select(ALLOCATION_SESSION_SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw asError(error, "Unable to load allocation sessions.");
  }

  return (data ?? []).map(toSession);
};

export const getAllocationSessionDetails = async (sessionId: string): Promise<SessionAllocationDetails> => {
  const { supabase } = await requireAdminContext();

  const [{ data: sessionRow, error: sessionError }, { data: allocations, error: allocationsError }] =
    await Promise.all([
      supabase.from("allocation_sessions").select(ALLOCATION_SESSION_SELECT_COLUMNS).eq("id", sessionId).single(),
      supabase.from("allocations").select("lab_id, lab_name_snapshot").eq("session_id", sessionId)
    ]);

  if (sessionError || !sessionRow) {
    throw asError(sessionError, "Unable to load session details.");
  }

  if (allocationsError) {
    throw asError(allocationsError, "Unable to load allocation summary.");
  }

  const metadataSummary = parseSeatSummaryFromMetadata(sessionRow.metadata);
  const metadataOverflow = parseOverflowFromMetadata(sessionRow.metadata) ?? [];

  let seatSummary: SeatSummaryItem[] = metadataSummary ?? [];

  if (seatSummary.length === 0) {
    const grouped = new Map<string, SeatSummaryItem>();

    (allocations ?? []).forEach((row) => {
      const key = row.lab_id;
      const existing = grouped.get(key);
      if (existing) {
        existing.allocated_count += 1;
        return;
      }

      grouped.set(key, {
        lab_id: row.lab_id,
        lab_name: row.lab_name_snapshot,
        allocated_count: 1,
        total_seats: 1
      });
    });

    seatSummary = Array.from(grouped.values());
  }

  return {
    session: toSession(sessionRow),
    seat_summary: seatSummary,
    overflow_students: metadataOverflow
  };
};

export const getSessionMappingRows = async (sessionId: string): Promise<SessionMappingRow[]> => {
  const { supabase } = await requireAdminContext();

  const { data: allocationRows, error: allocationError } = await supabase
    .from("allocations")
    .select("id, seat_number, lab_name_snapshot, student_id, matched_student_id")
    .eq("session_id", sessionId);

  if (allocationError) {
    throw asError(allocationError, "Unable to load allocation rows.");
  }

  const tempStudentIds = Array.from(new Set((allocationRows ?? []).map((row) => row.student_id)));
  const matchedStudentIds = Array.from(
    new Set((allocationRows ?? []).map((row) => row.matched_student_id).filter((value): value is string => Boolean(value)))
  );

  const [tempStudentsRes, matchedStudentsRes] = await Promise.all([
    tempStudentIds.length > 0
      ? supabase.from("students_temp").select("id, name, roll_number, department").in("id", tempStudentIds)
      : Promise.resolve({ data: [], error: null }),
    matchedStudentIds.length > 0
      ? supabase.from("students").select("id, name, prn, email").in("id", matchedStudentIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (tempStudentsRes.error) {
    throw asError(tempStudentsRes.error, "Unable to load temporary student rows.");
  }

  if (matchedStudentsRes.error) {
    throw asError(matchedStudentsRes.error, "Unable to load matched students.");
  }

  const tempMap = new Map((tempStudentsRes.data ?? []).map((row) => [row.id, row]));
  const matchedMap = new Map((matchedStudentsRes.data ?? []).map((row) => [row.id, row]));

  const rows: SessionMappingRow[] = (allocationRows ?? []).map((row) => {
    const temp = tempMap.get(row.student_id);
    const matched = row.matched_student_id ? matchedMap.get(row.matched_student_id) : null;

    return {
      allocation_id: row.id,
      seat_number: row.seat_number,
      lab_name: row.lab_name_snapshot,
      temp_student_id: row.student_id,
      temp_name: temp?.name ?? "Unknown",
      temp_roll_number: temp?.roll_number ?? "-",
      temp_department: temp?.department ?? null,
      matched_student_id: row.matched_student_id,
      matched_student_name: matched?.name ?? null,
      matched_student_prn: matched?.prn ?? null,
      matched_student_email: matched?.email ?? null
    };
  });

  return rows.sort((left, right) => {
    const labCompare = left.lab_name.localeCompare(right.lab_name, undefined, { sensitivity: "base" });
    if (labCompare !== 0) {
      return labCompare;
    }

    return compareSeatNumbers(left.seat_number, right.seat_number);
  });
};

export const listMappableStudents = async (): Promise<StudentMappingOption[]> => {
  const { supabase } = await requireAdminContext();
  const { data, error } = await supabase
    .from("students")
    .select("id, name, prn, email, branch")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw asError(error, "Unable to load students for mapping.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prn: row.prn,
    email: row.email,
    branch: row.branch
  }));
};

export const updateAllocationMapping = async (
  allocationId: string,
  matchedStudentId: string | null
): Promise<void> => {
  const { supabase } = await requireAdminContext();

  const { error } = await supabase
    .from("allocations")
    .update({ matched_student_id: matchedStudentId })
    .eq("id", allocationId);

  if (error) {
    throw asError(error, "Unable to save mapping for allocation row.");
  }
};

export const publishAllocationSession = async (sessionId: string): Promise<AllocationSession> => {
  const { supabase } = await requireAdminContext();

  const { data, error } = await supabase.rpc("publish_seat_allocation_session", {
    p_session_id: sessionId
  });

  if (error) {
    throw asError(error, "Failed to publish seat allocation session.");
  }

  if (!data) {
    throw new Error("Publish did not return session data.");
  }

  const sessionRow = Array.isArray(data) ? data[0] : data;
  return toSession(sessionRow as AllocationSession);
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

  const { data: allocationRow, error: allocationError } = await supabase
    .from("allocations")
    .select("session_id, seat_number, lab_name_snapshot, created_at")
    .eq("matched_student_id", studentRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (allocationError) {
    throw asError(allocationError, "Unable to load seat allocation.");
  }

  if (!allocationRow) {
    return null;
  }

  let publishedAt: string | null = null;

  const { data: sessionRow } = await supabase
    .from("allocation_sessions")
    .select("published_at")
    .eq("id", allocationRow.session_id)
    .maybeSingle();

  if (sessionRow?.published_at) {
    publishedAt = sessionRow.published_at;
  }

  return {
    session_id: allocationRow.session_id,
    seat_number: allocationRow.seat_number,
    lab_name: allocationRow.lab_name_snapshot,
    published_at: publishedAt,
    created_at: allocationRow.created_at
  };
};
