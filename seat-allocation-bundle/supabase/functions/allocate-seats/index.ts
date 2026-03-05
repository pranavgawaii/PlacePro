import { requireUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/http.ts';
import { generateSeatNumbers, sortStudents } from '../_shared/seat-utils.ts';
import type { AllocateSeatsRequest, ParsedStudentRow } from '../_shared/types.ts';

const toStudentRow = (row: any): ParsedStudentRow & { id: string } => ({
  id: row.id,
  name: row.name,
  roll_number: row.roll_number,
  department: row.department,
});

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST for this endpoint.', null, 405);
  }

  const { user, client, error } = await requireUser(req);
  if (error || !user) {
    return error;
  }

  const payload = (await req.json().catch(() => null)) as AllocateSeatsRequest | null;
  if (!payload) {
    return errorResponse('INVALID_PAYLOAD', 'Request body is required.');
  }

  const labIds = Array.isArray(payload.lab_ids)
    ? Array.from(new Set(payload.lab_ids.map((item) => String(item).trim()).filter(Boolean)))
    : [];

  if (labIds.length === 0) {
    return errorResponse('EMPTY_LAB_SELECTION', 'Select at least one lab.');
  }

  const uploadSessionId = String(payload.upload_session_id ?? '').trim();
  if (!uploadSessionId) {
    return errorResponse('INVALID_UPLOAD_SESSION', 'upload_session_id is required.');
  }

  const mode = payload.mode === 'random' ? 'random' : 'alphabetical';
  const seed = mode === 'random' ? randomSeed() : 0;

  const { data: labs, error: labsError } = await client
    .from('labs')
    .select('id, lab_name, total_seats, rows, columns')
    .eq('owner_id', user.id)
    .in('id', labIds);

  if (labsError) {
    return errorResponse('LAB_FETCH_FAILED', 'Unable to load selected labs.', labsError.message, 500);
  }

  if (!labs || labs.length !== labIds.length) {
    return errorResponse('INVALID_LAB_IDS', 'One or more selected labs are invalid or inaccessible.', null, 404);
  }

  const orderMap = new Map(labIds.map((id, index) => [id, index]));
  const orderedLabs = [...labs].sort((a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  const { data: students, error: studentsError } = await client
    .from('students_temp')
    .select('id, name, roll_number, department')
    .eq('owner_id', user.id)
    .eq('upload_session_id', uploadSessionId);

  if (studentsError) {
    return errorResponse('STUDENT_FETCH_FAILED', 'Unable to load students for upload session.', studentsError.message, 500);
  }

  if (!students || students.length === 0) {
    return errorResponse('NO_STUDENTS', 'No students found in the selected upload session.');
  }

  const sortedStudents = sortStudents(students.map(toStudentRow), mode, seed);
  const totalCapacity = orderedLabs.reduce((sum: number, lab: any) => sum + Number(lab.total_seats || 0), 0);

  const sessionPayload = {
    owner_id: user.id,
    mode,
    upload_session_id: uploadSessionId,
    status: sortedStudents.length > totalCapacity ? 'completed_with_overflow' : 'completed',
    seed: mode === 'random' ? seed : null,
    metadata: {
      lab_ids: labIds,
      total_students: sortedStudents.length,
      total_capacity: totalCapacity,
    },
  };

  const { data: sessionRow, error: sessionError } = await client
    .from('allocation_sessions')
    .insert(sessionPayload)
    .select('id')
    .single();

  if (sessionError || !sessionRow) {
    return errorResponse('SESSION_CREATE_FAILED', 'Unable to create allocation session.', sessionError?.message, 500);
  }

  const allocations: Array<{
    owner_id: string;
    student_id: string;
    lab_id: string;
    seat_number: string;
    session_id: string;
  }> = [];

  const seatSummary = orderedLabs.map((lab: any) => ({
    lab_id: lab.id,
    lab_name: lab.lab_name,
    allocated_count: 0,
    total_seats: Number(lab.total_seats),
  }));

  let pointer = 0;

  for (const lab of orderedLabs as any[]) {
    const seats = generateSeatNumbers({
      totalSeats: Number(lab.total_seats),
      rows: lab.rows,
      columns: lab.columns,
    });

    for (const seatNo of seats) {
      const student = sortedStudents[pointer] as (ParsedStudentRow & { id: string }) | undefined;
      if (!student) {
        break;
      }

      allocations.push({
        owner_id: user.id,
        student_id: student.id,
        lab_id: lab.id,
        seat_number: seatNo,
        session_id: sessionRow.id,
      });

      const summary = seatSummary.find((item) => item.lab_id === lab.id);
      if (summary) {
        summary.allocated_count += 1;
      }

      pointer += 1;
    }

    if (pointer >= sortedStudents.length) {
      break;
    }
  }

  if (allocations.length > 0) {
    const { error: allocationError } = await client.from('allocations').insert(allocations);
    if (allocationError) {
      return errorResponse('ALLOCATION_INSERT_FAILED', 'Unable to store seat allocations.', allocationError.message, 500);
    }
  }

  const overflowStudents = sortedStudents.slice(pointer).map((student) => ({
    student_id: (student as ParsedStudentRow & { id: string }).id,
    name: student.name,
    roll_number: student.roll_number,
  }));

  return jsonResponse({
    session_id: sessionRow.id,
    mode,
    upload_session_id: uploadSessionId,
    seat_summary: seatSummary,
    overflow_students: overflowStudents,
  });
});
