"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AutoAllocateSeatsResult,
  Lab,
  SeatSession,
  SeatSessionDetails
} from "@/lib/seat-allocation/types";

interface AllocationControlsProps {
  session: SeatSession | null;
  labs: Lab[];
  details: SeatSessionDetails | null;
  loading?: boolean;
  onAllocate: (params: { sessionId: string; labIds: string[] }) => Promise<AutoAllocateSeatsResult>;
  onAllocated: (result: AutoAllocateSeatsResult) => void;
}

export function AllocationControls({
  session,
  labs,
  details,
  loading,
  onAllocate,
  onAllocated
}: AllocationControlsProps) {
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const editableSession = session && !session.is_published ? session : null;
  const matchedCount = details?.stats.matched_candidates ?? 0;
  const selectedCapacity = useMemo(
    () =>
      labs
        .filter((lab) => selectedLabs.includes(lab.id))
        .reduce((sum, lab) => sum + lab.total_seats, 0),
    [labs, selectedLabs]
  );
  const hasOverflowRisk = matchedCount > 0 && selectedCapacity < matchedCount;

  useEffect(() => {
    setSelectedLabs((current) => {
      const nextIds = labs.map((lab) => lab.id);
      if (nextIds.length === 0) {
        return [];
      }

      const available = new Set(nextIds);
      const kept = current.filter((labId) => available.has(labId));
      return kept.length > 0 ? kept : nextIds;
    });
  }, [labs]);

  const toggleLab = (labId: string, checked: boolean) => {
    setSelectedLabs((current) => {
      if (checked) {
        return current.includes(labId) ? current : [...current, labId];
      }
      return current.filter((value) => value !== labId);
    });
  };

  const handleAllocate = async () => {
    if (!editableSession) {
      setError("Open an editable draft session before running allocation.");
      return;
    }

    if (selectedLabs.length === 0) {
      setError("Select at least one lab.");
      return;
    }

    if (matchedCount === 0) {
      setError("Add or resolve students before allocating seats.");
      return;
    }

    setError(null);

    try {
      const result = await onAllocate({
        sessionId: editableSession.id,
        labIds: selectedLabs
      });
      onAllocated(result);
    } catch (allocateError) {
      const nextError = allocateError instanceof Error ? allocateError.message : "Auto allocation failed.";
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
            Allocation Engine
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Auto Allocate Seats</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Seats fill in selected lab order, then by ascending seat number. You can still edit any assignment before publish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">Matched {matchedCount}</Badge>
          <Badge variant="outline" className="rounded-full">Capacity {selectedCapacity}</Badge>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {labs.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
            Add at least one lab to continue.
          </div>
        ) : (
          labs.map((lab) => {
            const checked = selectedLabs.includes(lab.id);
            return (
              <label
                key={lab.id}
                className={[
                  "rounded-2xl border px-4 py-3.5 text-sm transition",
                  checked
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={checked}
                  onChange={(event) => toggleLab(lab.id, event.target.checked)}
                  disabled={!editableSession || loading}
                />
                <span className="font-medium">{lab.lab_name}</span>
                <span className="ml-2 text-xs text-current/80">{lab.total_seats} seats</span>
              </label>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50/80 px-4 py-4">
        <div className="space-y-1 text-sm text-neutral-600">
          <p>
            Draft status: <span className="font-semibold text-neutral-900">{session?.status ?? "No session selected"}</span>
          </p>
          <p>
            Selected labs: <span className="font-semibold text-neutral-900">{selectedLabs.length}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-11 rounded-2xl px-5" variant="outline" onClick={() => setSelectedLabs(labs.map((lab) => lab.id))} disabled={labs.length === 0 || loading}>
            Select all labs
          </Button>
          <Button className="h-11 rounded-2xl px-5" onClick={() => void handleAllocate()} disabled={!editableSession || loading || labs.length === 0}>
            {loading ? "Allocating..." : "Run Auto Allocation"}
          </Button>
        </div>
      </div>

      {hasOverflowRisk ? (
        <p className="text-sm text-amber-700">
          Capacity is lower than matched students. Overflow students will stay blocked until you add seats or remove candidates.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
