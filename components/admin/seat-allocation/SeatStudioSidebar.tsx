"use client";

import { format } from "date-fns";
import { ArrowUpRight, CheckCircle2, FileOutput, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SeatSessionDetails } from "@/lib/seat-allocation/types";

interface SeatStudioSidebarProps {
  details: SeatSessionDetails | null;
  publishing?: boolean;
  onPublish: () => Promise<void>;
  onOpenPreview: () => void;
}

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

export function SeatStudioSidebar({ details, publishing, onPublish, onOpenPreview }: SeatStudioSidebarProps) {
  if (!details) {
    return (
      <aside className="rounded-2xl card-border bg-white p-5">
        <h3 className="text-lg font-semibold text-neutral-900">Publish & Export</h3>
        <p className="mt-2 text-sm text-neutral-600">
          Open a seat session to review readiness, generate documents, and publish the final allocation to students.
        </p>
      </aside>
    );
  }

  const { session, stats } = details;
  const blockers = [
    stats.unmatched_candidates > 0 ? `${stats.unmatched_candidates} unmatched candidates` : null,
    stats.duplicate_candidates > 0 ? `${stats.duplicate_candidates} duplicate rows` : null,
    stats.overflow_candidates > 0 ? `${stats.overflow_candidates} overflow candidates` : null,
    stats.unassigned_matched_candidates > 0 ? `${stats.unassigned_matched_candidates} matched students without a seat` : null
  ].filter(Boolean);
  const canPublish = !session.is_published && blockers.length === 0 && stats.matched_candidates > 0;

  return (
    <aside className="rounded-2xl card-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Publish & Export</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Keep drafts editable, then publish one reviewed session when every blocker is cleared.
          </p>
        </div>
        <Badge variant={session.is_published ? "info" : "outline"}>
          {session.is_published ? "Published" : session.status === "ready" ? "Ready" : "Draft"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Session</p>
          <p className="mt-2 text-sm font-semibold text-neutral-900">{session.title}</p>
          <p className="mt-1 text-xs text-neutral-500">Source {session.source_mode} • Created {formatDateTime(session.created_at)}</p>
          <p className="mt-2 text-xs font-medium text-neutral-700">
            {session.scheduled_at ? `Scheduled ${formatDateTime(session.scheduled_at)}` : "Schedule not set yet"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Readiness</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500">Matched</p>
              <p className="font-semibold text-neutral-900">{stats.matched_candidates}</p>
            </div>
            <div>
              <p className="text-neutral-500">Assigned</p>
              <p className="font-semibold text-neutral-900">{stats.assigned_candidates}</p>
            </div>
            <div>
              <p className="text-neutral-500">Candidates</p>
              <p className="font-semibold text-neutral-900">{stats.total_candidates}</p>
            </div>
            <div>
              <p className="text-neutral-500">Published</p>
              <p className="font-semibold text-neutral-900">{formatDateTime(session.published_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          Publish check
        </div>
        {blockers.length > 0 ? (
          <div className="space-y-2">
            {blockers.map((blocker) => (
              <div key={blocker} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {blocker}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {session.is_published ? "This session is already the live allocation for students." : "This draft is ready to publish."}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-2">
        <Button variant="outline" onClick={onOpenPreview}>
          <FileOutput className="h-4 w-4" />
          Open Preview & Export
        </Button>
        <Button onClick={() => void onPublish()} disabled={!canPublish || Boolean(publishing)}>
          {session.is_published ? <ArrowUpRight className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {session.is_published ? "Live Session" : publishing ? "Publishing..." : "Publish Session"}
        </Button>
      </div>
    </aside>
  );
}
