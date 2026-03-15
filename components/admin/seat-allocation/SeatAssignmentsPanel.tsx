"use client";

import { useMemo, useState } from "react";
import { PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lab, SeatAssignmentEditorRow, SeatSession } from "@/lib/seat-allocation/types";

interface SeatAssignmentsPanelProps {
  session: SeatSession | null;
  labs: Lab[];
  rows: SeatAssignmentEditorRow[];
  savingStudentId?: string | null;
  onSaveAssignment: (params: { sessionId: string; candidateId: string; labId: string; seatNumber: string }) => Promise<void>;
  onRemoveAssignment: (params: { sessionId: string; candidateId: string }) => Promise<void>;
}

interface DraftState {
  labId: string;
  seatNumber: string;
}

export function SeatAssignmentsPanel({
  session,
  labs,
  rows,
  savingStudentId,
  onSaveAssignment,
  onRemoveAssignment
}: SeatAssignmentsPanelProps) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [error, setError] = useState<string | null>(null);

  const editableSession = session && !session.is_published ? session : null;
  const normalizedQuery = query.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.student_name.toLowerCase().includes(normalizedQuery) ||
        row.prn.toLowerCase().includes(normalizedQuery) ||
        (row.branch ?? "").toLowerCase().includes(normalizedQuery) ||
        (row.seat_number ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, rows]);

  const getDraft = (row: SeatAssignmentEditorRow): DraftState => {
    return drafts[row.candidate_id] ?? {
      labId: row.lab_id ?? "",
      seatNumber: row.seat_number ?? ""
    };
  };

  const setDraft = (studentId: string, nextDraft: DraftState) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: nextDraft
    }));
  };

  const handleSave = async (row: SeatAssignmentEditorRow) => {
    if (!editableSession) {
      setError("Open an editable session to manage seat assignments.");
      return;
    }

    const draft = getDraft(row);
    if (!draft.labId || !draft.seatNumber.trim()) {
      setError("Choose a lab and seat number before saving.");
      return;
    }

    setError(null);

    try {
      await onSaveAssignment({
        sessionId: editableSession.id,
        candidateId: row.candidate_id,
        labId: draft.labId,
        seatNumber: draft.seatNumber
      });
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : "Failed to save seat assignment.";
      setError(nextError);
    }
  };

  const handleClear = async (row: SeatAssignmentEditorRow) => {
    if (!editableSession) {
      setError("Open an editable session to manage seat assignments.");
      return;
    }

    setError(null);

    try {
      await onRemoveAssignment({
        sessionId: editableSession.id,
        candidateId: row.candidate_id
      });
      setDrafts((current) => ({
        ...current,
        [row.candidate_id]: { labId: "", seatNumber: "" }
      }));
    } catch (removeError) {
      const nextError = removeError instanceof Error ? removeError.message : "Failed to clear seat assignment.";
      setError(nextError);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            Assignment Studio
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Edit Seat Assignments</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Auto allocation fills the layout first. You can still fine-tune labs and seat numbers before publish.
          </p>
        </div>
        {editableSession ? (
          <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
            Editable draft
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full px-3 py-1.5">Published preview</Badge>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by student, Enrollment No, branch, or seat"
          className="h-12 rounded-2xl border-neutral-200 bg-white pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Student</th>
              <th className="px-4 py-3 text-left font-semibold">Academic</th>
              <th className="px-4 py-3 text-left font-semibold">Lab</th>
              <th className="px-4 py-3 text-left font-semibold">Seat</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No matched students are ready for assignment yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const draft = getDraft(row);
                const busy = savingStudentId === row.candidate_id;
                return (
                  <tr key={row.candidate_id} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-neutral-900">{row.student_name}</p>
                      <p className="text-xs text-neutral-500">{row.prn}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-neutral-600">{row.branch ?? "—"}</td>
                    <td className="px-4 py-3 align-top">
                        <select
                          value={draft.labId}
                          onChange={(event) => setDraft(row.candidate_id, { ...draft, labId: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm outline-none transition focus:border-blue-300"
                        disabled={!editableSession || busy}
                      >
                        <option value="">Select lab</option>
                        {labs.map((lab) => (
                          <option key={lab.id} value={lab.id}>
                            {lab.lab_name} ({lab.total_seats})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Input
                        value={draft.seatNumber}
                        onChange={(event) => setDraft(row.candidate_id, { ...draft, seatNumber: event.target.value.toUpperCase() })}
                        placeholder="A-01"
                        disabled={!editableSession || busy}
                        className="h-11 rounded-2xl border-neutral-200 bg-white"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => void handleSave(row)}
                          disabled={!editableSession || busy}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          {row.lab_id || row.seat_number ? "Update" : "Assign"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleClear(row)}
                          disabled={!editableSession || busy || (!row.lab_id && !row.seat_number)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 rounded-xl"
                          onClick={() => setDraft(row.candidate_id, { labId: row.lab_id ?? "", seatNumber: row.seat_number ?? "" })}
                          disabled={busy}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
