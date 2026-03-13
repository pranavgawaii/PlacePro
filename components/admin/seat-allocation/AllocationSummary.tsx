"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SeatSessionDetails } from "@/lib/seat-allocation/types";

interface AllocationSummaryProps {
  details: SeatSessionDetails | null;
  publishing?: boolean;
  onPublish: () => Promise<void>;
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return format(date, "dd MMM yyyy, hh:mm a");
};

export function AllocationSummary({ details, publishing, onPublish }: AllocationSummaryProps) {
  if (!details) {
    return (
      <section className="rounded-lg card-border bg-white p-5">
        <h3 className="text-lg font-semibold text-neutral-900">Session Summary</h3>
        <p className="mt-1 text-sm text-neutral-600">Create or open a seat session to see readiness, occupancy, and publish status.</p>
      </section>
    );
  }

  const { session, stats, lab_summary: labSummary } = details;
  const blockers = [
    stats.unmatched_candidates > 0 ? `${stats.unmatched_candidates} unmatched candidates` : null,
    stats.duplicate_candidates > 0 ? `${stats.duplicate_candidates} duplicate rows` : null,
    stats.overflow_candidates > 0 ? `${stats.overflow_candidates} overflow students` : null,
    stats.unassigned_matched_candidates > 0 ? `${stats.unassigned_matched_candidates} matched students without seats` : null
  ].filter(Boolean);
  const canPublish = !session.is_published && blockers.length === 0 && stats.matched_candidates > 0;

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Session Summary</h3>
          <p className="text-sm text-neutral-600">Source {session.source_mode} • Created {formatDateTime(session.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={session.is_published ? "info" : "outline"}>
            {session.is_published ? "Published" : session.status}
          </Badge>
          <Badge variant="outline">{session.id.slice(0, 8)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Candidates</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{stats.total_candidates}</p>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Matched</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{stats.matched_candidates}</p>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Assigned</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{stats.assigned_candidates}</p>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Published At</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{formatDateTime(session.published_at)}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Lab Occupancy</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {labSummary.length === 0 ? (
              <p className="px-4 py-4 text-sm text-neutral-500">No seat assignments yet.</p>
            ) : (
              labSummary.map((summary) => (
                <div key={summary.lab_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{summary.lab_name}</p>
                    <p className="text-xs text-neutral-500">{summary.total_seats} total seats</p>
                  </div>
                  <Badge variant="outline">{summary.allocated_count} allocated</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Publish Check</p>
            <p className="text-xs text-neutral-500">Only fully resolved sessions can be published to students.</p>
          </div>

          {blockers.length > 0 ? (
            <ul className="space-y-2 text-sm text-amber-800">
              {blockers.map((blocker) => (
                <li key={blocker} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              This session is ready to publish.
            </p>
          )}

          <Button onClick={() => void onPublish()} disabled={!canPublish || Boolean(publishing)} className="w-full">
            {session.is_published ? "Published" : publishing ? "Publishing..." : "Publish Session"}
          </Button>
        </div>
      </div>
    </section>
  );
}
