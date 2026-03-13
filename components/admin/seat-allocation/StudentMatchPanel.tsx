"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CandidateMatchStatus,
  SeatSession,
  SeatSessionCandidateView,
  SeatStudentOption
} from "@/lib/seat-allocation/types";

interface StudentMatchPanelProps {
  session: SeatSession | null;
  candidates: SeatSessionCandidateView[];
  students: SeatStudentOption[];
  busyCandidateId?: string | null;
  onResolve: (params: { candidateId: string; studentId: string }) => Promise<void>;
  onRemove: (candidateId: string) => Promise<void>;
}

const statusLabel: Record<CandidateMatchStatus, string> = {
  matched: "Matched",
  unmatched: "Unmatched",
  duplicate: "Duplicate",
  overflow: "Overflow",
  removed: "Removed"
};

export function StudentMatchPanel({
  session,
  candidates,
  students,
  busyCandidateId,
  onResolve,
  onRemove
}: StudentMatchPanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateMatchStatus>("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const editableSession = session && !session.is_published ? session : null;
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedStudentQuery = studentQuery.trim().toLowerCase();

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (statusFilter !== "all" && candidate.match_status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        candidate.prn.toLowerCase().includes(normalizedQuery) ||
        (candidate.name_snapshot ?? "").toLowerCase().includes(normalizedQuery) ||
        (candidate.student_name ?? "").toLowerCase().includes(normalizedQuery) ||
        (candidate.error_message ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [candidates, normalizedQuery, statusFilter]);

  const filteredStudents = useMemo(() => {
    if (!normalizedStudentQuery) {
      return students.slice(0, 250);
    }

    return students
      .filter((student) => {
        return (
          student.name.toLowerCase().includes(normalizedStudentQuery) ||
          student.email.toLowerCase().includes(normalizedStudentQuery) ||
          (student.prn ?? "").toLowerCase().includes(normalizedStudentQuery)
        );
      })
      .slice(0, 250);
  }, [normalizedStudentQuery, students]);

  const handleResolve = async (candidateId: string) => {
    if (!editableSession) {
      setError("Open an editable seat session to resolve unmatched rows.");
      return;
    }

    const studentId = selectedStudentIds[candidateId];
    if (!studentId) {
      setError("Choose a student before resolving this row.");
      return;
    }

    setError(null);

    try {
      await onResolve({ candidateId, studentId });
    } catch (resolveError) {
      const nextError = resolveError instanceof Error ? resolveError.message : "Unable to resolve candidate.";
      setError(nextError);
    }
  };

  const handleRemove = async (candidateId: string) => {
    if (!editableSession) {
      setError("Open an editable seat session to manage candidates.");
      return;
    }

    setError(null);

    try {
      await onRemove(candidateId);
    } catch (removeError) {
      const nextError = removeError instanceof Error ? removeError.message : "Unable to remove candidate.";
      setError(nextError);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Candidate Review</h3>
          <p className="text-sm text-neutral-600">
            Resolve unmatched Enrollment Numbers, remove duplicate rows, and clear overflow before publish.
          </p>
        </div>
        <Badge variant="outline">Active rows {candidates.length}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Enrollment No, name, or issue"
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | CandidateMatchStatus)}
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
        >
          <option value="all">All statuses</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="duplicate">Duplicate</option>
          <option value="overflow">Overflow</option>
        </select>
        <Input
          value={studentQuery}
          onChange={(event) => setStudentQuery(event.target.value)}
          placeholder="Filter student options for unmatched rows"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Candidate</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Resolve</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No candidate rows match the current filters.
                </td>
              </tr>
            ) : (
              filteredCandidates.map((candidate) => {
                const busy = busyCandidateId === candidate.id;
                const canResolve = candidate.match_status === "unmatched";
                const canRemove = true;

                return (
                  <tr key={candidate.id}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-neutral-900">{candidate.name_snapshot ?? candidate.student_name ?? "Student row"}</p>
                      <p className="text-xs text-neutral-500">{candidate.prn}</p>
                      <p className="text-xs text-neutral-500">{candidate.branch_snapshot ?? candidate.student_branch ?? "—"}</p>
                      {candidate.error_message ? <p className="mt-1 text-xs text-red-600">{candidate.error_message}</p> : null}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Badge
                        variant={candidate.match_status === "matched" ? "success" : candidate.match_status === "unmatched" ? "outline" : "secondary"}
                        className={candidate.match_status === "overflow" ? "border-amber-200 bg-amber-50 text-amber-700" : undefined}
                      >
                        {statusLabel[candidate.match_status]}
                      </Badge>
                      {candidate.student_name ? <p className="mt-2 text-xs text-neutral-500">Linked: {candidate.student_name}</p> : null}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {canResolve ? (
                        <div className="space-y-2">
                          <select
                            value={selectedStudentIds[candidate.id] ?? ""}
                            onChange={(event) => {
                              setSelectedStudentIds((current) => ({
                                ...current,
                                [candidate.id]: event.target.value
                              }));
                            }}
                            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                            disabled={!editableSession || busy}
                          >
                            <option value="">Choose student</option>
                            {filteredStudents.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} - {student.prn ?? "Enrollment pending"}
                              </option>
                            ))}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => void handleResolve(candidate.id)} disabled={!editableSession || busy}>
                            <UserCheck className="h-3.5 w-3.5" />
                            Resolve
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          {candidate.match_status === "matched"
                            ? "No action required."
                            : candidate.match_status === "duplicate"
                              ? "Remove duplicate rows before publish."
                              : "Adjust capacity or remove the overflow row."}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => void handleRemove(candidate.id)}
                        disabled={!editableSession || busy || !canRemove}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
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
