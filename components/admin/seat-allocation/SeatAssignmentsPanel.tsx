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
  onSaveAssignment: (params: { sessionId: string; studentId: string; labId: string; seatNumber: string }) => Promise<void>;
  onRemoveAssignment: (params: { sessionId: string; studentId: string }) => Promise<void>;
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
    return drafts[row.student_id] ?? {
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
        studentId: row.student_id,
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
        studentId: row.student_id
      });
      setDrafts((current) => ({
        ...current,
        [row.student_id]: { labId: "", seatNumber: "" }
      }));
    } catch (removeError) {
      const nextError = removeError instanceof Error ? removeError.message : "Failed to clear seat assignment.";
      setError(nextError);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Edit Assignments</h3>
          <p className="text-sm text-neutral-600">
            Auto allocation fills the grid first. You can still fine-tune lab and seat placement before publish.
          </p>
        </div>
        {editableSession ? (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Editable draft
          </Badge>
        ) : (
          <Badge variant="outline">Read only</Badge>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by student, PRN, branch, or seat"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Student</th>
              <th className="px-3 py-2 text-left font-semibold">Academic</th>
              <th className="px-3 py-2 text-left font-semibold">Lab</th>
              <th className="px-3 py-2 text-left font-semibold">Seat</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No matched students are ready for assignment yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const draft = getDraft(row);
                const busy = savingStudentId === row.student_id;
                return (
                  <tr key={row.student_id}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-neutral-900">{row.student_name}</p>
                      <p className="text-xs text-neutral-500">{row.prn}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top text-neutral-600">{row.branch ?? "—"}</td>
                    <td className="px-3 py-2.5 align-top">
                      <select
                        value={draft.labId}
                        onChange={(event) => setDraft(row.student_id, { ...draft, labId: event.target.value })}
                        className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
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
                    <td className="px-3 py-2.5 align-top">
                      <Input
                        value={draft.seatNumber}
                        onChange={(event) => setDraft(row.student_id, { ...draft, seatNumber: event.target.value.toUpperCase() })}
                        placeholder="A-01"
                        disabled={!editableSession || busy}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleSave(row)}
                          disabled={!editableSession || busy}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          {row.lab_id || row.seat_number ? "Update" : "Assign"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleClear(row)}
                          disabled={!editableSession || busy || (!row.lab_id && !row.seat_number)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft(row.student_id, { labId: row.lab_id ?? "", seatNumber: row.seat_number ?? "" })}
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
    </section>
  );
}
