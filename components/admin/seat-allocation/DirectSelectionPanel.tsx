"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  AddDirectCandidatesResult,
  SeatSession,
  SeatSessionCandidateView,
  SeatStudentOption
} from "@/lib/seat-allocation/types";

interface DirectSelectionPanelProps {
  session: SeatSession | null;
  students: SeatStudentOption[];
  candidates: SeatSessionCandidateView[];
  loading?: boolean;
  onAddStudents: (params: { sessionId: string; studentIds: string[] }) => Promise<AddDirectCandidatesResult>;
  onAdded: (result: AddDirectCandidatesResult) => void;
}

export function DirectSelectionPanel({
  session,
  students,
  candidates,
  loading,
  onAddStudents,
  onAdded
}: DirectSelectionPanelProps) {
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableDirectSession = session && session.source_mode === "direct" && !session.is_published ? session : null;
  const activeStudentIds = useMemo(
    () => new Set(candidates.map((candidate) => candidate.student_id).filter(Boolean)),
    [candidates]
  );

  const branchOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.branch).filter(Boolean))).sort();
  }, [students]);

  const batchOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.batch_year))).sort((left, right) => right - left);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      if (branchFilter !== "all" && student.branch !== branchFilter) {
        return false;
      }

      if (batchFilter !== "all" && String(student.batch_year) !== batchFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        student.name.toLowerCase().includes(normalizedQuery) ||
        student.email.toLowerCase().includes(normalizedQuery) ||
        (student.prn ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [batchFilter, branchFilter, query, students]);

  const visibleStudents = filteredStudents.slice(0, 120);
  const selectedVisibleCount = visibleStudents.filter((student) => selectedIds.includes(student.id)).length;

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(studentId) ? current : [...current, studentId];
      }

      return current.filter((value) => value !== studentId);
    });
  };

  const handleAdd = async () => {
    if (!editableDirectSession) {
      setError("Create or open a direct draft session before selecting students.");
      return;
    }

    const uniqueIds = Array.from(new Set(selectedIds)).filter((studentId) => !activeStudentIds.has(studentId));
    if (uniqueIds.length === 0) {
      setError("Select at least one new student.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onAddStudents({
        sessionId: editableDirectSession.id,
        studentIds: uniqueIds
      });

      setSelectedIds([]);
      onAdded(result);
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Failed to add students.";
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Select Students</h3>
          <p className="text-sm text-neutral-600">
            Start from real student records, then auto-fill seats across the labs you choose.
          </p>
        </div>
        {editableDirectSession ? (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Direct draft {editableDirectSession.id.slice(0, 8)}
          </Badge>
        ) : (
          <Badge variant="outline">Direct draft required</Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
        <div className="space-y-1.5">
          <label htmlFor="seat-direct-search" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Search students
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              id="seat-direct-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, PRN, or email"
              className="pl-9"
              disabled={loading || submitting}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seat-direct-branch" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Branch
          </label>
          <select
            id="seat-direct-branch"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
            disabled={loading || submitting}
          >
            <option value="all">All branches</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch ?? ""}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seat-direct-batch" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Batch
          </label>
          <select
            id="seat-direct-batch"
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
            disabled={loading || submitting}
          >
            <option value="all">All batches</option>
            {batchOptions.map((batchYear) => (
              <option key={batchYear} value={String(batchYear)}>
                {batchYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span>
            {visibleStudents.length} visible of {filteredStudents.length} filtered students
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Already in draft {activeStudentIds.size}</Badge>
          <Badge variant="outline">Selected {selectedIds.length}</Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="w-12 px-3 py-2 text-left font-semibold">Pick</th>
              <th className="px-3 py-2 text-left font-semibold">Student</th>
              <th className="px-3 py-2 text-left font-semibold">PRN</th>
              <th className="px-3 py-2 text-left font-semibold">Academic</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {visibleStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">
                  No students match the current filters.
                </td>
              </tr>
            ) : (
              visibleStudents.map((student) => {
                const alreadyAdded = activeStudentIds.has(student.id);
                return (
                  <tr key={student.id} className={alreadyAdded ? "bg-neutral-50/80" : ""}>
                    <td className="px-3 py-2.5 align-top">
                      <Checkbox
                        checked={alreadyAdded || selectedIds.includes(student.id)}
                        disabled={alreadyAdded || loading || submitting || !editableDirectSession}
                        onCheckedChange={(checked) => toggleStudent(student.id, checked === true)}
                        aria-label={`Select ${student.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-neutral-900">{student.name}</p>
                      <p className="text-xs text-neutral-500">{student.email}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top font-medium text-neutral-900">{student.prn ?? "PRN pending"}</td>
                    <td className="px-3 py-2.5 align-top text-neutral-600">
                      {student.branch ?? "—"} • Batch {student.batch_year}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {alreadyAdded ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          In draft
                        </Badge>
                      ) : (
                        <Badge variant="outline">Available</Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-500">
          {selectedVisibleCount > 0 ? `${selectedVisibleCount} visible students selected.` : "Choose students to add them into this draft session."}
        </div>
        <Button onClick={() => void handleAdd()} disabled={!editableDirectSession || submitting || selectedIds.length === 0}>
          {submitting ? "Adding..." : `Add ${selectedIds.length || ""} Students`.trim()}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
