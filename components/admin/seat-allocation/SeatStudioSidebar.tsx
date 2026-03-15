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
      <aside className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
        <div className="p-6">
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            Publish Desk
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Review, export, and go live</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Open a seat session to check readiness, export polished seating documents, and publish the final allocation to students.
          </p>
        </div>
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
    <aside className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              Publish Desk
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Publish & Export</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Keep drafts editable, then publish one reviewed session when every blocker is cleared.
            </p>
          </div>
          <Badge variant={session.is_published ? "info" : "outline"} className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
            {session.is_published ? "Published" : session.status === "ready" ? "Ready" : "Draft"}
          </Badge>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[24px] border border-neutral-200 bg-neutral-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Session Profile</p>
            <p className="mt-3 text-base font-semibold text-neutral-950">{session.title}</p>
            <div className="mt-3 space-y-2 text-sm text-neutral-600">
              <p>Source: <span className="font-medium text-neutral-900">{session.source_mode}</span></p>
              <p>Created: <span className="font-medium text-neutral-900">{formatDateTime(session.created_at)}</span></p>
              <p>Schedule: <span className="font-medium text-neutral-900">{session.scheduled_at ? formatDateTime(session.scheduled_at) : "Not set yet"}</span></p>
              <p>Published: <span className="font-medium text-neutral-900">{formatDateTime(session.published_at)}</span></p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Matched</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{stats.matched_candidates}</p>
              <p className="mt-1 text-xs text-neutral-500">Candidates ready for seat assignment</p>
            </div>
            <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Assigned</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{stats.assigned_candidates}</p>
              <p className="mt-1 text-xs text-neutral-500">Seats currently allocated in this draft</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Publish readiness
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Keep drafts editable, then publish one reviewed session when every blocker is cleared.
          </p>
          <div className="mt-4 grid gap-2">
            {blockers.length > 0 ? (
              blockers.map((blocker) => (
                <div key={blocker} className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                  {blocker}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                {session.is_published ? "This session is already the live allocation for students." : "This draft is ready to publish."}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Button variant="outline" className="h-12 rounded-2xl border-neutral-300 bg-white text-sm font-medium" onClick={onOpenPreview}>
            <FileOutput className="h-4 w-4" />
            Open Preview & Export
          </Button>
          <Button className="h-12 rounded-2xl text-sm font-medium" onClick={() => void onPublish()} disabled={!canPublish || Boolean(publishing)}>
            {session.is_published ? <ArrowUpRight className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {session.is_published ? "Live Session" : publishing ? "Publishing..." : "Publish Session"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
