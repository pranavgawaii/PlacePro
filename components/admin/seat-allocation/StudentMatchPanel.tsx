"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AllocationSession,
  SessionMappingRow,
  StudentMappingOption
} from "@/lib/seat-allocation/types";

interface StudentMatchPanelProps {
  session: AllocationSession | null;
  rows: SessionMappingRow[];
  students: StudentMappingOption[];
  mappingThreshold?: number;
  savingRowId?: string | null;
  publishing?: boolean;
  onMap: (allocationId: string, matchedStudentId: string | null) => Promise<void>;
  onPublish: () => Promise<void>;
}

export function StudentMatchPanel({
  session,
  rows,
  students,
  mappingThreshold = 1,
  savingRowId,
  publishing,
  onMap,
  onPublish
}: StudentMatchPanelProps) {
  const [rowQuery, setRowQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  const normalizedRowQuery = rowQuery.trim().toLowerCase();
  const normalizedStudentQuery = studentQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedRowQuery) {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.lab_name.toLowerCase().includes(normalizedRowQuery) ||
        row.seat_number.toLowerCase().includes(normalizedRowQuery) ||
        row.temp_name.toLowerCase().includes(normalizedRowQuery) ||
        row.temp_roll_number.toLowerCase().includes(normalizedRowQuery) ||
        (row.matched_student_name ?? "").toLowerCase().includes(normalizedRowQuery) ||
        (row.matched_student_prn ?? "").toLowerCase().includes(normalizedRowQuery)
      );
    });
  }, [rows, normalizedRowQuery]);

  const filteredStudents = useMemo(() => {
    if (!normalizedStudentQuery) {
      return students.slice(0, 300);
    }

    return students
      .filter((student) => {
        return (
          student.name.toLowerCase().includes(normalizedStudentQuery) ||
          student.email.toLowerCase().includes(normalizedStudentQuery) ||
          (student.prn ?? "").toLowerCase().includes(normalizedStudentQuery)
        );
      })
      .slice(0, 300);
  }, [students, normalizedStudentQuery]);

  const studentById = useMemo(() => {
    return new Map(students.map((student) => [student.id, student]));
  }, [students]);

  const filteredStudentIds = useMemo(() => {
    return new Set(filteredStudents.map((student) => student.id));
  }, [filteredStudents]);

  const mappedCount = rows.filter((row) => Boolean(row.matched_student_id)).length;
  const totalCount = rows.length;
  const mappingRatio = totalCount === 0 ? 0 : mappedCount / totalCount;
  const hasCompleteMapping = totalCount > 0 && rows.every((row) => Boolean(row.matched_student_id));
  const canPublish = hasCompleteMapping && mappingRatio >= mappingThreshold;

  const getStudentOptions = (matchedStudentId: string | null): StudentMappingOption[] => {
    if (!matchedStudentId || filteredStudentIds.has(matchedStudentId)) {
      return filteredStudents;
    }

    const mappedStudent = studentById.get(matchedStudentId);
    if (!mappedStudent) {
      return filteredStudents;
    }

    return [mappedStudent, ...filteredStudents];
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Manual Student Mapping</h3>
          <p className="text-sm text-neutral-600">
            Map each allocated temporary record to a real student profile before publish.
          </p>
        </div>

        <div className="text-right text-sm">
          <p className="font-semibold text-neutral-900">
            {mappedCount} / {totalCount} mapped
          </p>
          <p className="text-xs text-neutral-500">Required: {Math.round(mappingThreshold * 100)}%</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="seat-map-row-filter" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Filter allocation rows
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              id="seat-map-row-filter"
              value={rowQuery}
              onChange={(event) => setRowQuery(event.target.value)}
              placeholder="Search by seat, roll, lab"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seat-map-student-filter" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Filter student options
          </label>
          <Input
            id="seat-map-student-filter"
            value={studentQuery}
            onChange={(event) => setStudentQuery(event.target.value)}
            placeholder="Search by name, email, PRN"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Seat</th>
              <th className="px-3 py-2 text-left font-semibold">Temp Student</th>
              <th className="px-3 py-2 text-left font-semibold">Map to student</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No matching rows found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.allocation_id}>
                  <td className="px-3 py-2.5 align-top">
                    <p className="font-semibold text-neutral-900">{row.seat_number}</p>
                    <p className="text-xs text-neutral-500">{row.lab_name}</p>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p className="font-medium text-neutral-900">{row.temp_name}</p>
                    <p className="text-xs text-neutral-500">{row.temp_roll_number}</p>
                    {row.temp_department ? (
                      <p className="text-xs text-neutral-500">{row.temp_department}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <select
                      value={row.matched_student_id ?? ""}
                      className="w-full rounded-md border border-neutral-200 px-2.5 py-2 text-sm outline-none focus:border-blue-300"
                      disabled={savingRowId === row.allocation_id || publishing || session?.is_published}
                      onChange={(event) => {
                        const nextValue = event.target.value || null;
                        void onMap(row.allocation_id, nextValue);
                      }}
                    >
                      <option value="">Unmapped</option>
                      {getStudentOptions(row.matched_student_id).map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} - {student.prn ?? "PRN pending"}
                        </option>
                      ))}
                    </select>
                    {row.matched_student_email ? (
                      <p className="mt-1 text-xs text-neutral-500">{row.matched_student_email}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {row.matched_student_id ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Mapped
                      </span>
                    ) : (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {canPublish ? "Ready to publish" : "Complete mapping to publish"}
          </p>
          <p className="text-xs text-neutral-500">
            One published session is visible to students at a time.
          </p>
        </div>

        <Button
          onClick={() => void onPublish()}
          disabled={!canPublish || Boolean(publishing) || !session || session.is_published}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          <CheckCheck className="h-4 w-4" />
          {session?.is_published ? "Published" : publishing ? "Publishing..." : "Publish Session"}
        </Button>
      </div>
    </section>
  );
}
