"use client";

import { format } from "date-fns";
import { CalendarDays, Download, Eye, FolderGit2, PlusCircle, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SeatSessionListItem } from "@/lib/seat-allocation/types";

interface SeatSessionGalleryProps {
  sessions: SeatSessionListItem[];
  selectedSessionId: string | null;
  onCreateAllocation: () => void;
  onOpenDraft: (sessionId: string) => void;
  onPreview: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
  onCreateRevision: (sessionId: string) => void;
  onDeleteDraft: (sessionId: string) => void;
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

export function SeatSessionGallery({
  sessions,
  selectedSessionId,
  onCreateAllocation,
  onOpenDraft,
  onPreview,
  onExport,
  onCreateRevision,
  onDeleteDraft
}: SeatSessionGalleryProps) {
  if (sessions.length === 0) {
    return (
      <section className="rounded-xl card-border bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
          <FolderGit2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-neutral-900">No allocation drafts yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600">
          Create a direct or upload draft to prepare seats, review assignments, generate exports, and publish one live session for students.
        </p>
        <Button onClick={onCreateAllocation} className="mt-6">
          <PlusCircle className="h-4 w-4" />
          Create Allocation
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {sessions.map((session) => {
          const stats = session.stats;
          const isSelected = session.id === selectedSessionId;
          const hasAssignments = stats.assigned_candidates > 0;

          return (
            <article
              key={session.id}
              className={[
                "rounded-2xl border bg-white p-5 shadow-sm transition-all",
                isSelected ? "border-blue-300 shadow-blue-100/50" : "border-neutral-200 hover:border-neutral-300"
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={session.is_published ? "info" : "outline"}>
                      {session.is_published ? "Published" : session.status === "ready" ? "Ready Draft" : "Draft"}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {session.source_mode}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{session.title}</h3>
                    <p className="mt-1 text-xs text-neutral-500">Session ID {session.id.slice(0, 8)}</p>
                  </div>
                </div>
                {isSelected ? (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    Open now
                  </Badge>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Candidates</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900">{stats.total_candidates}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Matched</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900">{stats.matched_candidates}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Assigned</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900">{stats.assigned_candidates}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Overflow</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900">{stats.overflow_candidates}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-neutral-400" />
                  <span>Created {formatDateTime(session.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-neutral-400" />
                  <span>
                    {session.scheduled_at ? `Scheduled ${formatDateTime(session.scheduled_at)}` : "Schedule not set"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-400" />
                  <span>
                    {session.is_published ? `Published ${formatDateTime(session.published_at)}` : "Not published yet"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => (session.is_published ? onPreview(session.id) : onOpenDraft(session.id))}>
                  {session.is_published ? <Eye className="h-4 w-4" /> : <FolderGit2 className="h-4 w-4" />}
                  {session.is_published ? "Preview" : "Open Draft"}
                </Button>
                <Button variant="outline" onClick={() => onExport(session.id)} disabled={!hasAssignments}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                {session.is_published ? (
                  <Button variant="outline" onClick={() => onCreateRevision(session.id)}>
                    <PlusCircle className="h-4 w-4" />
                    Create Revision
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onDeleteDraft(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Draft
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
