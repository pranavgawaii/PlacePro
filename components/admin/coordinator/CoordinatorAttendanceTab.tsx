"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCheck, SquareCheckBig, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateCoordinatorAttendanceLetter } from "@/lib/coordinator/api";
import type { CoordinatorRecord } from "@/lib/coordinator/types";

type CoordinatorAttendanceTabProps = {
  coordinators: CoordinatorRecord[];
};

const defaultEventDetails = {
  event_title: "",
  event_date: "",
  time_from: "",
  time_to: ""
};

export function CoordinatorAttendanceTab({ coordinators }: CoordinatorAttendanceTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [eventDetails, setEventDetails] = useState(defaultEventDetails);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectedCount = selectedIds.length;
  const isValid = Boolean(eventDetails.event_title && eventDetails.event_date && eventDetails.time_from && eventDetails.time_to && selectedCount > 0);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleCoordinator = (coordinatorId: string) => {
    setSelectedIds((current) => (current.includes(coordinatorId) ? current.filter((value) => value !== coordinatorId) : [...current, coordinatorId]));
  };

  const handlePreview = async (downloadDirectly = false) => {
    if (!isValid) {
      toast.error("Complete the event details and select at least one coordinator.");
      return;
    }

    setGenerating(true);
    try {
      const blob = await generateCoordinatorAttendanceLetter({
        ...eventDetails,
        coordinator_ids: selectedIds
      });

      const url = URL.createObjectURL(blob);
      if (downloadDirectly) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `Coordinator_Attendance_${eventDetails.event_date}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Attendance letter downloaded.");
      } else {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(url);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate attendance letter.");
    } finally {
      setGenerating(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Official Letter Workflow</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">Attendance letters</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Generate the CN-CRTP attendance request letter with event details and the selected coordinator roster.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-neutral-900">Event details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendance-title">Event title</Label>
              <Input
                id="attendance-title"
                value={eventDetails.event_title}
                onChange={(event) => setEventDetails((current) => ({ ...current, event_title: event.target.value }))}
                placeholder="e.g. Deloitte placement drive"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-date">Date</Label>
              <Input
                id="attendance-date"
                type="date"
                value={eventDetails.event_date}
                onChange={(event) => setEventDetails((current) => ({ ...current, event_date: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="attendance-from">Time from</Label>
                <Input
                  id="attendance-from"
                  type="time"
                  value={eventDetails.time_from}
                  onChange={(event) => setEventDetails((current) => ({ ...current, time_from: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-to">Time to</Label>
                <Input
                  id="attendance-to"
                  type="time"
                  value={eventDetails.time_to}
                  onChange={(event) => setEventDetails((current) => ({ ...current, time_to: event.target.value }))}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
              <div className="font-medium text-neutral-900">Ready for PDF</div>
              <div className="mt-1">{selectedCount} coordinator{selectedCount === 1 ? "" : "s"} selected for this letter.</div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => void handlePreview(false)} disabled={generating || !isValid}>
                <Eye className="mr-2 h-4 w-4" />
                Preview PDF
              </Button>
              <Button className="h-11 rounded-xl px-4" onClick={() => void handlePreview(true)} disabled={generating || !isValid}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-neutral-900">Coordinator selection</CardTitle>
              <p className="mt-1 text-sm text-neutral-500">Pick the coordinators whose attendance should be covered by the generated letter.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedIds(coordinators.map((coordinator) => coordinator.id))}>
                Select All
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50/70">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Pick</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Coordinator</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Enrollment No.</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Year</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {coordinators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-sm text-neutral-500">
                        Add coordinators to unlock the attendance-letter workflow.
                      </td>
                    </tr>
                  ) : (
                    coordinators.map((coordinator) => {
                      const checked = selectedSet.has(coordinator.id);
                      return (
                        <tr key={coordinator.id} className="transition hover:bg-neutral-50/70">
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              className="text-neutral-500 transition hover:text-neutral-900"
                              onClick={() => toggleCoordinator(coordinator.id)}
                            >
                              {checked ? <SquareCheckBig className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-neutral-900">{coordinator.name}</div>
                            <div className="mt-1 text-sm text-neutral-500">{coordinator.email || "Email not added"}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-neutral-700">{coordinator.enrollment_no}</td>
                          <td className="px-4 py-4 text-sm text-neutral-700">{coordinator.year}</td>
                          <td className="px-4 py-4 text-sm text-neutral-700">{coordinator.department}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => (!open ? handleClosePreview() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-neutral-200 px-6 py-4">
            <DialogTitle>Attendance letter preview</DialogTitle>
          </DialogHeader>
          <div className="h-[76vh] w-full bg-neutral-100">
            {previewUrl ? <iframe title="Attendance Letter Preview" src={previewUrl} className="h-full w-full" /> : null}
          </div>
          <div className="flex justify-end gap-3 border-t border-neutral-200 px-6 py-4">
            <Button variant="outline" onClick={handleClosePreview}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (!previewUrl) return;
                const link = document.createElement("a");
                link.href = previewUrl;
                link.download = `Coordinator_Attendance_${eventDetails.event_date}.pdf`;
                link.click();
              }}
            >
              <FileCheck className="mr-2 h-4 w-4" />
              Download from Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
