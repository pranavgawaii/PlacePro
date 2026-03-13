"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AllocationControls } from "@/components/admin/seat-allocation/AllocationControls";
import { CreateSeatSessionDialog } from "@/components/admin/seat-allocation/CreateSeatSessionDialog";
import { DirectSelectionPanel } from "@/components/admin/seat-allocation/DirectSelectionPanel";
import { LabsManager } from "@/components/admin/seat-allocation/LabsManager";
import { SeatAssignmentsPanel } from "@/components/admin/seat-allocation/SeatAssignmentsPanel";
import { SeatDocumentPreviewPanel } from "@/components/admin/seat-allocation/SeatDocumentPreviewPanel";
import { SeatSessionGallery } from "@/components/admin/seat-allocation/SeatSessionGallery";
import { SeatStudioSidebar } from "@/components/admin/seat-allocation/SeatStudioSidebar";
import { StudentMatchPanel } from "@/components/admin/seat-allocation/StudentMatchPanel";
import { StudentUploadPanel } from "@/components/admin/seat-allocation/StudentUploadPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addDirectCandidates,
  autoAllocateSeats,
  createLab,
  createSeatSession,
  createSeatSessionRevision,
  deleteLab,
  deleteSeatSession,
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
  updateSeatAssignment,
  updateSeatSessionTitle
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

const defaultSeatSessionTitle = (sourceMode: SeatSourceMode) =>
  sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft";

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, "dd MMM yyyy, hh:mm a");
};

export function SeatAllocationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [viewMode, setViewMode] = useState<"gallery" | "editor">("gallery");
  const [editorIntent, setEditorIntent] = useState<"studio" | "preview">("studio");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSourceMode, setCreateSourceMode] = useState<SeatSourceMode>("direct");
  const [createTitle, setCreateTitle] = useState(defaultSeatSessionTitle("direct"));

  const [labs, setLabs] = useState<Lab[]>([]);
  const [sessions, setSessions] = useState<SeatSessionListItem[]>([]);
  const [students, setStudents] = useState<SeatStudentOption[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SeatSessionDetails | null>(null);
  const [candidates, setCandidates] = useState<SeatSessionCandidateView[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<SeatAssignmentEditorRow[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const [labsBusy, setLabsBusy] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [candidateBusyId, setCandidateBusyId] = useState<string | null>(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const selectedSession = useMemo<SeatSession | null>(() => sessionDetails?.session ?? null, [sessionDetails]);
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
        return current ?? nextSessions[0]?.id ?? null;
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
      setTitleDraft(nextDetails.session.title);
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
      setTitleDraft("");
      return;
    }

    void refreshSessionData(selectedSessionId);
  }, [refreshSessionData, selectedSessionId]);

  useEffect(() => {
    if (viewMode !== "editor" || editorIntent !== "preview") {
      return;
    }

    const node = previewRef.current;
    if (!node) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [editorIntent, sessionDetails, viewMode]);

  const syncAfterMutation = useCallback(
    async (sessionId?: string | null) => {
      await refreshBaseData();
      const nextId = sessionId ?? selectedSessionId;
      if (nextId) {
        await refreshSessionData(nextId);
        setSelectedSessionId(nextId);
      }
    },
    [refreshBaseData, refreshSessionData, selectedSessionId]
  );

  const handleOpenSession = (sessionId: string, nextIntent: "studio" | "preview" = "studio") => {
    setSelectedSessionId(sessionId);
    setViewMode("editor");
    setEditorIntent(nextIntent);
  };

  const handleBackToGallery = () => {
    setViewMode("gallery");
    setEditorIntent("studio");
  };

  const handleCreateDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (open) {
      return;
    }

    setCreateSourceMode("direct");
    setCreateTitle(defaultSeatSessionTitle("direct"));
  };

  const handleCreateSourceModeChange = (mode: SeatSourceMode) => {
    setCreateSourceMode(mode);
    setCreateTitle(defaultSeatSessionTitle(mode));
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const nextSession = await createSeatSession({
        sourceMode: createSourceMode,
        title: createTitle
      });
      toast.success(`${nextSession.title} created.`);
      setCreateDialogOpen(false);
      setSelectedSessionId(nextSession.id);
      setViewMode("editor");
      setEditorIntent("studio");
      await syncAfterMutation(nextSession.id);
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : "Failed to create seat session.";
      toast.error(message);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!selectedSession || selectedSession.is_published) {
      return;
    }

    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      toast.error("Draft title is required.");
      return;
    }

    if (nextTitle === selectedSession.title) {
      return;
    }

    setSavingTitle(true);
    try {
      const updatedSession = await updateSeatSessionTitle({
        sessionId: selectedSession.id,
        title: nextTitle
      });
      setTitleDraft(updatedSession.title);
      toast.success("Draft title updated.");
      await syncAfterMutation(updatedSession.id);
    } catch (titleError) {
      const message = titleError instanceof Error ? titleError.message : "Unable to update draft title.";
      toast.error(message);
    } finally {
      setSavingTitle(false);
    }
  };

  const handleCreateRevision = async (sessionId: string) => {
    const baseTitle = sessions.find((session) => session.id === sessionId)?.title ?? "Seat Session";

    try {
      const nextRevision = await createSeatSessionRevision({
        sessionId,
        title: `${baseTitle} Revision`
      });
      toast.success("Revision draft created.");
      setSelectedSessionId(nextRevision.id);
      setViewMode("editor");
      setEditorIntent("studio");
      await syncAfterMutation(nextRevision.id);
    } catch (revisionError) {
      const message = revisionError instanceof Error ? revisionError.message : "Unable to create revision draft.";
      toast.error(message);
    }
  };

  const handleDeleteDraft = async (sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId);
    const confirmed = window.confirm(`Delete ${target?.title ?? "this draft"}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteSeatSession(sessionId);
      toast.success("Draft deleted.");
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setSessionDetails(null);
        setCandidates([]);
        setAssignmentRows([]);
        setViewMode("gallery");
      }
      await refreshBaseData();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete draft.";
      toast.error(message);
    }
  };

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
      await syncAfterMutation(selectedSessionId);
    } finally {
      setLabsBusy(false);
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
    candidateId: string;
    labId: string;
    seatNumber: string;
  }) => {
    setAssignmentBusyId(params.candidateId);
    try {
      await updateSeatAssignment(params);
      toast.success("Seat assignment saved.");
      await syncAfterMutation(params.sessionId);
    } finally {
      setAssignmentBusyId(null);
    }
  };

  const handleRemoveAssignment = async (params: { sessionId: string; candidateId: string }) => {
    setAssignmentBusyId(params.candidateId);
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

  const totalPublished = sessions.filter((session) => session.is_published).length;
  const readyDrafts = sessions.filter((session) => !session.is_published && session.status === "ready").length;
  const totalCandidates = sessions.reduce((sum, session) => sum + session.stats.total_candidates, 0);
  const activeEditorSession = selectedSession ?? null;

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
      <CreateSeatSessionDialog
        open={createDialogOpen}
        sourceMode={createSourceMode}
        title={createTitle}
        creating={creatingSession}
        onOpenChange={handleCreateDialogChange}
        onSourceModeChange={handleCreateSourceModeChange}
        onTitleChange={setCreateTitle}
        onCreate={handleCreateSession}
      />

      <div className="rounded-2xl card-border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Seat Allocation</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Build named drafts, fill seats across labs, export lab-wise or full lists, and publish one live session for students.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void refreshBaseData()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            {viewMode === "editor" ? (
              <Button variant="outline" onClick={handleBackToGallery}>
                <ArrowLeft className="h-4 w-4" />
                Back to Gallery
              </Button>
            ) : null}
            <Button onClick={() => setCreateDialogOpen(true)}>Create Allocation</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Sessions</p>
            <p className="mt-2 text-xl font-semibold text-neutral-900">{sessions.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Published</p>
            <p className="mt-2 text-xl font-semibold text-neutral-900">{totalPublished}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Ready Drafts</p>
            <p className="mt-2 text-xl font-semibold text-neutral-900">{readyDrafts}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Candidates</p>
            <p className="mt-2 text-xl font-semibold text-neutral-900">{totalCandidates}</p>
          </div>
        </div>
      </div>

      {viewMode === "gallery" ? (
        <SeatSessionGallery
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onCreateAllocation={() => setCreateDialogOpen(true)}
          onOpenDraft={(sessionId) => handleOpenSession(sessionId, "studio")}
          onPreview={(sessionId) => handleOpenSession(sessionId, "preview")}
          onExport={(sessionId) => handleOpenSession(sessionId, "preview")}
          onCreateRevision={(sessionId) => {
            void handleCreateRevision(sessionId);
          }}
          onDeleteDraft={(sessionId) => {
            void handleDeleteDraft(sessionId);
          }}
        />
      ) : activeEditorSession ? (
        <div className="space-y-6">
          <section className="rounded-2xl card-border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={activeEditorSession.is_published ? "info" : "outline"}>
                    {activeEditorSession.is_published ? "Published" : activeEditorSession.status === "ready" ? "Ready Draft" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {activeEditorSession.source_mode}
                  </Badge>
                  <Badge variant="outline">Created {formatDateTime(activeEditorSession.created_at)}</Badge>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    disabled={activeEditorSession.is_published || savingTitle}
                    className="h-11 max-w-2xl text-base font-semibold"
                    placeholder="Allocation title"
                  />
                  {activeEditorSession.is_published ? (
                    <Button variant="outline" onClick={() => void handleCreateRevision(activeEditorSession.id)}>
                      Create Revision
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void handleSaveTitle()} disabled={savingTitle || titleDraft.trim() === activeEditorSession.title}>
                      {savingTitle ? "Saving..." : "Save Title"}
                    </Button>
                  )}
                </div>
                <p className="mt-3 text-sm text-neutral-600">
                  {activeEditorSession.is_published
                    ? "Published sessions stay frozen for students. Create a revision draft to make changes while keeping this live version intact."
                    : activeEditorSession.source_mode === "direct"
                      ? "This direct draft pulls candidates from the real student database and stays fully editable until you publish."
                      : "This upload draft matches candidates by Enrollment No and stays editable until every unmatched, duplicate, and overflow row is resolved."}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <LabsManager
                labs={labs}
                busy={labsBusy}
                onCreate={handleLabCreate}
                onUpdate={handleLabUpdate}
                onDelete={handleLabDelete}
              />

              {activeEditorSession.source_mode === "direct" ? (
                <DirectSelectionPanel
                  session={activeEditorSession}
                  students={students}
                  candidates={candidates}
                  onAddStudents={handleDirectAdd}
                  onAdded={handleDirectAdded}
                />
              ) : (
                <StudentUploadPanel
                  session={activeEditorSession}
                  onImportRows={handleImportRows}
                  onImported={handleImported}
                  onDownloadTemplate={downloadSeatTemplate}
                />
              )}

              <StudentMatchPanel
                session={activeEditorSession}
                candidates={candidates}
                students={students}
                busyCandidateId={candidateBusyId}
                onResolve={handleResolveCandidate}
                onRemove={handleRemoveCandidate}
              />

              <AllocationControls
                session={activeEditorSession}
                labs={labs}
                details={sessionDetails}
                loading={allocating}
                onAllocate={handleAllocate}
                onAllocated={handleAllocated}
              />

              <SeatAssignmentsPanel
                session={activeEditorSession}
                labs={labs}
                rows={assignmentRows}
                savingStudentId={assignmentBusyId}
                onSaveAssignment={handleSaveAssignment}
                onRemoveAssignment={handleRemoveAssignment}
              />

              <div ref={previewRef}>
                <SeatDocumentPreviewPanel
                  session={activeEditorSession}
                  assignedCount={sessionDetails?.stats.assigned_candidates ?? 0}
                />
              </div>
            </div>

            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <SeatStudioSidebar
                details={sessionDetails}
                publishing={publishing}
                onPublish={handlePublish}
                onOpenPreview={() => setEditorIntent("preview")}
              />

              {sessionDetails ? (
                <section className="rounded-2xl card-border bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Lab occupancy</h3>
                      <p className="mt-1 text-sm text-neutral-600">Live distribution for the current session.</p>
                    </div>
                    <Badge variant="outline">{sessionDetails.lab_summary.length} labs</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {sessionDetails.lab_summary.length === 0 ? (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                        No assignments yet. Run auto allocation or edit seats manually to populate lab occupancy.
                      </div>
                    ) : (
                      sessionDetails.lab_summary.map((summary) => (
                        <div key={summary.lab_id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-neutral-900">{summary.lab_name}</p>
                              <p className="text-xs text-neutral-500">{summary.total_seats} total seats</p>
                            </div>
                            <Badge variant="outline">{summary.allocated_count} filled</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl card-border bg-white p-8 text-sm text-neutral-600">
          Select a seat session from the gallery or create a new allocation to continue.
        </div>
      )}
    </section>
  );
}
