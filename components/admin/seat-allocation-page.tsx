"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AllocationControls } from "@/components/admin/seat-allocation/AllocationControls";
import { AllocationSummary } from "@/components/admin/seat-allocation/AllocationSummary";
import { DirectSelectionPanel } from "@/components/admin/seat-allocation/DirectSelectionPanel";
import { LabsManager } from "@/components/admin/seat-allocation/LabsManager";
import { SeatAssignmentsPanel } from "@/components/admin/seat-allocation/SeatAssignmentsPanel";
import { StudentMatchPanel } from "@/components/admin/seat-allocation/StudentMatchPanel";
import { StudentUploadPanel } from "@/components/admin/seat-allocation/StudentUploadPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addDirectCandidates,
  autoAllocateSeats,
  createLab,
  createSeatSession,
  deleteLab,
  downloadSeatTemplate,
  getSeatSessionDetails,
  importSeatCandidates,
  listLabs,
  listMappableStudents,
  listSeatAssignments,
  listSeatCandidates,
  listSeatSessions,
  publishSeatSession,
  removeSeatAssignment,
  removeSeatCandidate,
  resolveSeatCandidate,
  updateLab,
  updateSeatAssignment
} from "@/lib/seat-allocation/seatApi";
import type {
  Lab,
  ParseSource,
  SeatAssignmentEditorRow,
  SeatSession,
  SeatSessionCandidateView,
  SeatSessionDetails,
  SeatSessionListItem,
  SeatSourceMode,
  SeatStudentOption,
  SeatUploadRow
} from "@/lib/seat-allocation/types";

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return format(parsed, "dd MMM yyyy, hh:mm a");
};

export function SeatAllocationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const [labs, setLabs] = useState<Lab[]>([]);
  const [sessions, setSessions] = useState<SeatSessionListItem[]>([]);
  const [students, setStudents] = useState<SeatStudentOption[]>([]);

  const [sourceMode, setSourceMode] = useState<SeatSourceMode>("direct");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SeatSessionDetails | null>(null);
  const [candidates, setCandidates] = useState<SeatSessionCandidateView[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<SeatAssignmentEditorRow[]>([]);

  const [labsBusy, setLabsBusy] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [candidateBusyId, setCandidateBusyId] = useState<string | null>(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const selectedSession = useMemo<SeatSession | null>(
    () => sessionDetails?.session ?? null,
    [sessionDetails]
  );

  const refreshBaseData = useCallback(async () => {
    setRefreshing(true);

    try {
      const [nextLabs, nextSessions, nextStudents] = await Promise.all([
        listLabs(),
        listSeatSessions(30),
        listMappableStudents()
      ]);

      setLabs(nextLabs);
      setSessions(nextSessions);
      setStudents(nextStudents);
      setSelectedSessionId((current) => {
        if (current && nextSessions.some((session) => session.id === current)) {
          return current;
        }
        return nextSessions[0]?.id ?? null;
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Failed to load seat allocation data.";
      toast.error(message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const refreshSessionData = useCallback(async (sessionId: string) => {
    try {
      const [nextDetails, nextCandidates, nextAssignments] = await Promise.all([
        getSeatSessionDetails(sessionId),
        listSeatCandidates(sessionId),
        listSeatAssignments(sessionId)
      ]);

      setSessionDetails(nextDetails);
      setCandidates(nextCandidates);
      setAssignmentRows(nextAssignments);
      setSourceMode(nextDetails.session.source_mode);
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : "Failed to load session details.";
      toast.error(message);
      setSessionDetails(null);
      setCandidates([]);
      setAssignmentRows([]);
    }
  }, []);

  useEffect(() => {
    void refreshBaseData();
  }, [refreshBaseData]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetails(null);
      setCandidates([]);
      setAssignmentRows([]);
      return;
    }

    void refreshSessionData(selectedSessionId);
  }, [refreshSessionData, selectedSessionId]);

  const syncAfterMutation = useCallback(async (sessionId?: string | null) => {
    await refreshBaseData();
    const nextId = sessionId ?? selectedSessionId;
    if (nextId) {
      await refreshSessionData(nextId);
      setSelectedSessionId(nextId);
    }
  }, [refreshBaseData, refreshSessionData, selectedSessionId]);

  const handleLabCreate = async (payload: {
    lab_name: string;
    total_seats: number;
    rows?: number | null;
    columns?: number | null;
  }) => {
    setLabsBusy(true);
    try {
      await createLab(payload);
      toast.success("Lab created.");
      await refreshBaseData();
    } finally {
      setLabsBusy(false);
    }
  };

  const handleLabUpdate = async (
    labId: string,
    payload: {
      lab_name: string;
      total_seats: number;
      rows?: number | null;
      columns?: number | null;
    }
  ) => {
    setLabsBusy(true);
    try {
      await updateLab(labId, payload);
      toast.success("Lab updated.");
      await refreshBaseData();
    } finally {
      setLabsBusy(false);
    }
  };

  const handleLabDelete = async (labId: string) => {
    setLabsBusy(true);
    try {
      await deleteLab(labId);
      toast.success("Lab deleted.");
      await syncAfterMutation();
    } finally {
      setLabsBusy(false);
    }
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const nextSession = await createSeatSession({ sourceMode });
      toast.success(`${sourceMode === "direct" ? "Direct" : "Upload"} draft created.`);
      setSelectedSessionId(nextSession.id);
      await syncAfterMutation(nextSession.id);
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : "Failed to create seat session.";
      toast.error(message);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDirectAdd = async (params: { sessionId: string; studentIds: string[] }) => {
    const result = await addDirectCandidates(params);
    await syncAfterMutation(params.sessionId);
    return result;
  };

  const handleDirectAdded = (result: { added_count: number; skipped_count: number }) => {
    toast.success(`Added ${result.added_count} students to the draft.`);
    if (result.skipped_count > 0) {
      toast.info(`${result.skipped_count} students were skipped because they were already included or inactive.`);
    }
  };

  const handleImportRows = async (params: {
    sessionId: string;
    rows: SeatUploadRow[];
    source: ParseSource;
  }) => {
    const result = await importSeatCandidates(params);
    await syncAfterMutation(params.sessionId);
    return result;
  };

  const handleImported = (result: {
    inserted_count: number;
    matched_count: number;
    unmatched_count: number;
    duplicate_count: number;
  }) => {
    toast.success(`Imported ${result.inserted_count} rows into the draft.`);
    if (result.unmatched_count > 0 || result.duplicate_count > 0) {
      toast.info(
        `${result.matched_count} matched, ${result.unmatched_count} unmatched, ${result.duplicate_count} duplicate.`
      );
    }
  };

  const handleAllocate = async (params: { sessionId: string; labIds: string[] }) => {
    setAllocating(true);
    try {
      const result = await autoAllocateSeats(params);
      await syncAfterMutation(params.sessionId);
      return result;
    } finally {
      setAllocating(false);
    }
  };

  const handleAllocated = (result: { assigned_count: number; overflow_count: number }) => {
    toast.success(`Allocated ${result.assigned_count} seats.`);
    if (result.overflow_count > 0) {
      toast.warning(`${result.overflow_count} students are in overflow and need resolution before publish.`);
    }
  };

  const handleResolveCandidate = async (params: { candidateId: string; studentId: string }) => {
    setCandidateBusyId(params.candidateId);
    try {
      await resolveSeatCandidate(params);
      toast.success("Candidate resolved.");
      await syncAfterMutation(selectedSessionId);
    } finally {
      setCandidateBusyId(null);
    }
  };

  const handleRemoveCandidate = async (candidateId: string) => {
    setCandidateBusyId(candidateId);
    try {
      await removeSeatCandidate(candidateId);
      toast.success("Candidate removed from draft.");
      await syncAfterMutation(selectedSessionId);
    } finally {
      setCandidateBusyId(null);
    }
  };

  const handleSaveAssignment = async (params: {
    sessionId: string;
    studentId: string;
    labId: string;
    seatNumber: string;
  }) => {
    setAssignmentBusyId(params.studentId);
    try {
      await updateSeatAssignment(params);
      toast.success("Seat assignment saved.");
      await syncAfterMutation(params.sessionId);
    } finally {
      setAssignmentBusyId(null);
    }
  };

  const handleRemoveAssignment = async (params: { sessionId: string; studentId: string }) => {
    setAssignmentBusyId(params.studentId);
    try {
      await removeSeatAssignment(params);
      toast.success("Seat assignment cleared.");
      await syncAfterMutation(params.sessionId);
    } finally {
      setAssignmentBusyId(null);
    }
  };

  const handlePublish = async () => {
    if (!selectedSessionId) {
      toast.error("Select a seat session to publish.");
      return;
    }

    setPublishing(true);
    try {
      const publishedSession = await publishSeatSession(selectedSessionId);
      toast.success("Seat session published successfully.");
      await syncAfterMutation(publishedSession.id);
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Failed to publish seat session.";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const sourceScopedSession = selectedSession?.source_mode === sourceMode ? selectedSession : null;
  const totalPublished = sessions.filter((session) => session.is_published).length;

  if (loading) {
    return (
      <div className="rounded-lg card-border bg-white p-8">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading seat allocation module...
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg card-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Seat Allocation</h1>
            <p className="text-sm text-neutral-600">
              Build a draft from real students or PRN uploads, auto-fill seats, make edits, then publish one live session.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void refreshBaseData()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button onClick={() => void handleCreateSession()} disabled={creatingSession}>
              {creatingSession ? "Creating..." : `New ${sourceMode === "direct" ? "Direct" : "Upload"} Draft`}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Labs</p>
            <p className="font-semibold text-neutral-900">{labs.length}</p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Sessions</p>
            <p className="font-semibold text-neutral-900">{sessions.length}</p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Students</p>
            <p className="font-semibold text-neutral-900">{students.length}</p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Published</p>
            <p className="font-semibold text-neutral-900">{totalPublished}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <LabsManager
          labs={labs}
          busy={labsBusy}
          onCreate={handleLabCreate}
          onUpdate={handleLabUpdate}
          onDelete={handleLabDelete}
        />

        <section className="rounded-lg card-border bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Draft Source</h3>
              <p className="text-sm text-neutral-600">Choose how this draft will receive students.</p>
            </div>
            {selectedSession ? (
              <Badge variant="outline">Selected {selectedSession.id.slice(0, 8)}</Badge>
            ) : (
              <Badge variant="outline">No session selected</Badge>
            )}
          </div>

          <Tabs value={sourceMode} onValueChange={(value) => setSourceMode(value as SeatSourceMode)}>
            <TabsList className="grid w-full grid-cols-2 bg-neutral-100 p-1">
              <TabsTrigger value="direct" className="h-10" activeIndicatorClassName="bg-white shadow-sm">
                Select Students
              </TabsTrigger>
              <TabsTrigger value="upload" className="h-10" activeIndicatorClassName="bg-white shadow-sm">
                Upload File
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            {sourceScopedSession ? (
              <p>
                Working in <span className="font-semibold text-neutral-900">{sourceScopedSession.source_mode}</span> draft <span className="font-semibold text-neutral-900">{sourceScopedSession.id.slice(0, 8)}</span>.
              </p>
            ) : (
              <p>Create a new {sourceMode} draft, or open an existing one from the session list below.</p>
            )}
          </div>
        </section>
      </div>

      <div className="rounded-lg card-border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Seat Sessions</h2>
          <Badge variant="outline">Latest {sessions.length}</Badge>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-600">No seat sessions yet. Create a direct or upload draft to begin.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Session</th>
                  <th className="px-3 py-2 text-left font-semibold">Created</th>
                  <th className="px-3 py-2 text-left font-semibold">Source</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {sessions.map((session) => {
                  const selected = session.id === selectedSessionId;
                  return (
                    <tr key={session.id} className={selected ? "bg-blue-50/70" : ""}>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{session.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-neutral-700">{formatDateTime(session.created_at)}</td>
                      <td className="px-3 py-2.5 text-neutral-700 capitalize">{session.source_mode}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={session.is_published ? "info" : "outline"}>
                          {session.is_published ? "Published" : session.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            setSourceMode(session.source_mode);
                          }}
                        >
                          {selected ? "Selected" : "Open"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sourceMode === "direct" ? (
        <DirectSelectionPanel
          session={sourceScopedSession}
          students={students}
          candidates={candidates}
          onAddStudents={handleDirectAdd}
          onAdded={handleDirectAdded}
        />
      ) : (
        <StudentUploadPanel
          session={sourceScopedSession}
          onImportRows={handleImportRows}
          onImported={handleImported}
          onDownloadTemplate={downloadSeatTemplate}
        />
      )}

      <AllocationControls
        session={selectedSession}
        labs={labs}
        details={sessionDetails}
        loading={allocating}
        onAllocate={handleAllocate}
        onAllocated={handleAllocated}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <StudentMatchPanel
          session={selectedSession}
          candidates={candidates}
          students={students}
          busyCandidateId={candidateBusyId}
          onResolve={handleResolveCandidate}
          onRemove={handleRemoveCandidate}
        />
        <AllocationSummary details={sessionDetails} publishing={publishing} onPublish={handlePublish} />
      </div>

      <SeatAssignmentsPanel
        session={selectedSession}
        labs={labs}
        rows={assignmentRows}
        savingStudentId={assignmentBusyId}
        onSaveAssignment={handleSaveAssignment}
        onRemoveAssignment={handleRemoveAssignment}
      />
    </section>
  );
}
