"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LabsManager } from "@/components/admin/seat-allocation/LabsManager";
import { StudentUploadPanel } from "@/components/admin/seat-allocation/StudentUploadPanel";
import { AllocationControls } from "@/components/admin/seat-allocation/AllocationControls";
import { AllocationSummary } from "@/components/admin/seat-allocation/AllocationSummary";
import { StudentMatchPanel } from "@/components/admin/seat-allocation/StudentMatchPanel";
import {
  createLab,
  deleteLab,
  getAllocationSessionDetails,
  getSessionMappingRows,
  listAllocationSessions,
  listLabs,
  listMappableStudents,
  listStudentsByUploadSession,
  parseStudentsFromNormalizedRows,
  publishAllocationSession,
  runSeatAllocation,
  updateAllocationMapping,
  updateLab
} from "@/lib/seat-allocation/seatApi";
import type {
  AllocationSession,
  Lab,
  SeatAllocationResult,
  SessionAllocationDetails,
  SessionMappingRow,
  StudentMappingOption
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

  const [labs, setLabs] = useState<Lab[]>([]);
  const [sessions, setSessions] = useState<AllocationSession[]>([]);
  const [students, setStudents] = useState<StudentMappingOption[]>([]);

  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadedStudentCount, setUploadedStudentCount] = useState(0);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionAllocationDetails | null>(null);
  const [mappingRows, setMappingRows] = useState<SessionMappingRow[]>([]);

  const [labsBusy, setLabsBusy] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [mappingRowSavingId, setMappingRowSavingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const refreshBaseData = useCallback(async () => {
    setRefreshing(true);

    try {
      const [nextLabs, nextSessions, nextStudents] = await Promise.all([
        listLabs(),
        listAllocationSessions(30),
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
      const [details, rows] = await Promise.all([
        getAllocationSessionDetails(sessionId),
        getSessionMappingRows(sessionId)
      ]);

      setSessionDetails(details);
      setMappingRows(rows);
    } catch (sessionError) {
      const message = sessionError instanceof Error ? sessionError.message : "Failed to load session details.";
      toast.error(message);
      setSessionDetails(null);
      setMappingRows([]);
    }
  }, []);

  useEffect(() => {
    void refreshBaseData();
  }, [refreshBaseData]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetails(null);
      setMappingRows([]);
      return;
    }

    void refreshSessionData(selectedSessionId);
  }, [refreshSessionData, selectedSessionId]);

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
      await refreshBaseData();
    } finally {
      setLabsBusy(false);
    }
  };

  const handleAllocationRun = async (payload: {
    lab_ids: string[];
    mode: "alphabetical" | "random";
    upload_session_id: string;
  }): Promise<SeatAllocationResult> => {
    setAllocating(true);

    try {
      const result = await runSeatAllocation(payload);
      toast.success("Seat allocation completed.");
      await refreshBaseData();
      setSelectedSessionId(result.session_id);
      return result;
    } finally {
      setAllocating(false);
    }
  };

  const handleAllocationCompleted = (result: SeatAllocationResult) => {
    setSelectedSessionId(result.session_id);
    setUploadSessionId(result.upload_session_id);
  };

  const handleUploadParsed = async (
    result: { upload_session_id: string; parsed_count: number },
    previewRows: { length: number }
  ) => {
    setUploadSessionId(result.upload_session_id);

    try {
      const uploadedRows = await listStudentsByUploadSession(result.upload_session_id);
      setUploadedStudentCount(uploadedRows.length);
    } catch {
      setUploadedStudentCount(previewRows.length || result.parsed_count);
    }

    toast.success(`Student upload ready: ${result.parsed_count} rows validated.`);
  };

  const handleMapRow = async (allocationId: string, matchedStudentId: string | null) => {
    setMappingRowSavingId(allocationId);

    try {
      await updateAllocationMapping(allocationId, matchedStudentId);

      const matchedStudent = matchedStudentId
        ? students.find((student) => student.id === matchedStudentId) ?? null
        : null;

      setMappingRows((current) =>
        current.map((row) => {
          if (row.allocation_id !== allocationId) {
            return row;
          }

          return {
            ...row,
            matched_student_id: matchedStudentId,
            matched_student_name: matchedStudent?.name ?? null,
            matched_student_prn: matchedStudent?.prn ?? null,
            matched_student_email: matchedStudent?.email ?? null
          };
        })
      );
    } catch (mapError) {
      const message = mapError instanceof Error ? mapError.message : "Failed to save mapping.";
      toast.error(message);
    } finally {
      setMappingRowSavingId(null);
    }
  };

  const handlePublish = async () => {
    if (!selectedSessionId) {
      toast.error("Select a session to publish.");
      return;
    }

    setPublishing(true);

    try {
      const publishedSession = await publishAllocationSession(selectedSessionId);
      toast.success("Seat allocation session published.");
      await refreshBaseData();
      await refreshSessionData(publishedSession.id);
      setSelectedSessionId(publishedSession.id);
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Failed to publish session.";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

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
              Upload student rolls, allocate seats by lab capacity, manually map to student accounts, then publish.
            </p>
          </div>

          <Button variant="outline" onClick={() => void refreshBaseData()} disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Labs</p>
            <p className="font-semibold text-neutral-900">{labs.length}</p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Sessions</p>
            <p className="font-semibold text-neutral-900">{sessions.length}</p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Upload Rows</p>
            <p className="font-semibold text-neutral-900">{uploadedStudentCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabsManager
          labs={labs}
          busy={labsBusy}
          onCreate={handleLabCreate}
          onUpdate={handleLabUpdate}
          onDelete={handleLabDelete}
        />
        <StudentUploadPanel
          uploadSessionId={uploadSessionId}
          onParsed={(result, previewRows) => {
            void handleUploadParsed(result, previewRows);
          }}
          onSubmitRows={parseStudentsFromNormalizedRows}
        />
      </div>

      <AllocationControls
        labs={labs}
        uploadSessionId={uploadSessionId}
        studentCount={uploadedStudentCount}
        loading={allocating}
        onAllocate={handleAllocationRun}
        onAllocated={handleAllocationCompleted}
      />

      <div className="rounded-lg card-border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Allocation Sessions</h2>
          <Badge variant="outline">Latest {sessions.length}</Badge>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-600">No allocation sessions yet. Run one after uploading student data.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Session</th>
                  <th className="px-3 py-2 text-left font-semibold">Created</th>
                  <th className="px-3 py-2 text-left font-semibold">Mode</th>
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
                      <td className="px-3 py-2.5 text-neutral-700">{session.mode}</td>
                      <td className="px-3 py-2.5">
                        {session.is_published ? (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() => setSelectedSessionId(session.id)}
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

      <AllocationSummary details={sessionDetails} />

      <StudentMatchPanel
        session={selectedSession}
        rows={mappingRows}
        students={students}
        mappingThreshold={1}
        savingRowId={mappingRowSavingId}
        publishing={publishing}
        onMap={handleMapRow}
        onPublish={handlePublish}
      />
    </section>
  );
}
