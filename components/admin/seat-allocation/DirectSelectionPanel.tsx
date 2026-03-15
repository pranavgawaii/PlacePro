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
    <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            Candidate Source
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Select Students</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Start from real student records, then auto-fill seats across the labs you choose.
          </p>
        </div>
        {editableDirectSession ? (
          <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
            Direct draft ready
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full px-3 py-1.5">Direct draft required</Badge>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
        <div className="space-y-2">
          <label htmlFor="seat-direct-search" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Search students
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              id="seat-direct-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, Enrollment No, or email"
              className="h-12 rounded-2xl border-neutral-200 bg-white pl-9"
              disabled={loading || submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="seat-direct-branch" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Branch
          </label>
          <select
            id="seat-direct-branch"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm outline-none transition focus:border-blue-300"
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

        <div className="space-y-2">
          <label htmlFor="seat-direct-batch" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Batch
          </label>
          <select
            id="seat-direct-batch"
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm outline-none transition focus:border-blue-300"
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-600">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span>
            {visibleStudents.length} visible of {filteredStudents.length} filtered students
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">Already in draft {activeStudentIds.size}</Badge>
          <Badge variant="outline" className="rounded-full">Selected {selectedIds.length}</Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="w-12 px-4 py-3 text-left font-semibold">Pick</th>
              <th className="px-4 py-3 text-left font-semibold">Student</th>
              <th className="px-4 py-3 text-left font-semibold">Enrollment No</th>
              <th className="px-4 py-3 text-left font-semibold">Academic</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {visibleStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No students match the current filters.
                </td>
              </tr>
            ) : (
              visibleStudents.map((student) => {
                const alreadyAdded = activeStudentIds.has(student.id);
                return (
                  <tr key={student.id} className={alreadyAdded ? "bg-neutral-50/80" : "hover:bg-neutral-50/70"}>
                    <td className="px-4 py-3 align-top">
                      <Checkbox
                        checked={alreadyAdded || selectedIds.includes(student.id)}
                        disabled={alreadyAdded || loading || submitting || !editableDirectSession}
                        onCheckedChange={(checked) => toggleStudent(student.id, checked === true)}
                        aria-label={`Select ${student.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-neutral-900">{student.name}</p>
                      <p className="text-xs text-neutral-500">{student.email}</p>
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-neutral-900">{student.prn ?? "Enrollment pending"}</td>
                    <td className="px-4 py-3 align-top text-neutral-600">
                      {student.branch ?? "—"} • Batch {student.batch_year}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {alreadyAdded ? (
                        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                          In draft
                        </Badge>
                      ) : selectedIds.includes(student.id) ? (
                        <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                          Selected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full">Available</Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-500">
          {selectedVisibleCount > 0 ? `${selectedVisibleCount} visible students selected.` : "Choose students to add them into this draft session."}
        </div>
        <Button className="h-11 rounded-2xl px-5" onClick={() => void handleAdd()} disabled={!editableDirectSession || submitting || selectedIds.length === 0}>
          {submitting ? "Adding..." : `Add ${selectedIds.length || ""} Students`.trim()}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
