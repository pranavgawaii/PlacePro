"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AllocationMode, Lab, SeatAllocationResult } from "@/lib/seat-allocation/types";

interface AllocationControlsProps {
  labs: Lab[];
  uploadSessionId: string | null;
  studentCount: number;
  loading?: boolean;
  onAllocate: (payload: {
    lab_ids: string[];
    mode: AllocationMode;
    upload_session_id: string;
  }) => Promise<SeatAllocationResult>;
  onAllocated: (result: SeatAllocationResult) => void;
}

export function AllocationControls({
  labs,
  uploadSessionId,
  studentCount,
  loading,
  onAllocate,
  onAllocated
}: AllocationControlsProps) {
  const [mode, setMode] = useState<AllocationMode>("alphabetical");
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLabs((current) => {
      const labIds = labs.map((lab) => lab.id);
      if (labIds.length === 0) {
        return [];
      }

      const available = new Set(labIds);
      const kept = current.filter((labId) => available.has(labId));
      return kept.length > 0 ? kept : labIds;
    });
  }, [labs]);

  const selectedCapacity = useMemo(
    () =>
      labs
        .filter((lab) => selectedLabs.includes(lab.id))
        .reduce((sum, lab) => sum + lab.total_seats, 0),
    [labs, selectedLabs]
  );

  const hasInsufficientCapacity = studentCount > 0 && selectedCapacity < studentCount;

  const handleAllocate = async () => {
    if (!uploadSessionId) {
      setError("Upload student data before allocation.");
      return;
    }

    if (selectedLabs.length === 0) {
      setError("Select at least one lab.");
      return;
    }

    if (hasInsufficientCapacity) {
      setError(`Selected labs have ${selectedCapacity} seats for ${studentCount} students.`);
      return;
    }

    setError(null);

    try {
      const result = await onAllocate({
        lab_ids: selectedLabs,
        mode,
        upload_session_id: uploadSessionId
      });
      onAllocated(result);
    } catch (allocateError) {
      const nextError = allocateError instanceof Error ? allocateError.message : "Allocation failed.";
      setError(nextError);
    }
  };

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Run Allocation</h3>
          <p className="text-sm text-neutral-600">Select labs and mode, then generate a new seat allocation session.</p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Capacity {selectedCapacity}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Allocation mode</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                mode === "alphabetical"
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              ].join(" ")}
              onClick={() => setMode("alphabetical")}
            >
              Alphabetical
            </button>
            <button
              type="button"
              className={[
                "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                mode === "random"
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              ].join(" ")}
              onClick={() => setMode("random")}
            >
              Random
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Quick stats</p>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 space-y-0.5">
            <p>Students in upload: <span className="font-semibold text-neutral-900">{studentCount}</span></p>
            <p>Selected labs: <span className="font-semibold text-neutral-900">{selectedLabs.length}</span></p>
            <p>Session: <span className="font-semibold text-neutral-900">{uploadSessionId ?? "Not uploaded"}</span></p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Labs</p>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className="rounded border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-50"
              onClick={() => setSelectedLabs(labs.map((lab) => lab.id))}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-50"
              onClick={() => setSelectedLabs([])}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {labs.map((lab) => {
            const checked = selectedLabs.includes(lab.id);

            return (
              <label
                key={lab.id}
                className={[
                  "rounded-md border px-3 py-2 text-sm transition",
                  checked
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-neutral-200 bg-white text-neutral-700"
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={checked}
                  onChange={(event) => {
                    setSelectedLabs((current) =>
                      event.target.checked
                        ? [...current, lab.id]
                        : current.filter((labId) => labId !== lab.id)
                    );
                  }}
                />
                {lab.lab_name} ({lab.total_seats})
              </label>
            );
          })}
        </div>
      </div>

      <Button onClick={() => void handleAllocate()} disabled={loading || !uploadSessionId || labs.length === 0}>
        {loading ? "Allocating..." : "Run Allocation"}
      </Button>

      {hasInsufficientCapacity ? (
        <p className="text-sm text-amber-700">Selected capacity is lower than uploaded students.</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
