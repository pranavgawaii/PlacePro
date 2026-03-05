"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { SessionAllocationDetails } from "@/lib/seat-allocation/types";

interface AllocationSummaryProps {
  details: SessionAllocationDetails | null;
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

export function AllocationSummary({ details }: AllocationSummaryProps) {
  if (!details) {
    return (
      <section className="rounded-lg card-border bg-white p-5">
        <h3 className="text-lg font-semibold text-neutral-900">Allocation Summary</h3>
        <p className="mt-1 text-sm text-neutral-600">Run or select a session to view lab-level seat distribution.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg card-border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Allocation Summary</h3>
          <p className="text-sm text-neutral-600">
            Session created {formatDateTime(details.session.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {details.session.is_published ? (
            <Badge className="bg-blue-600 text-white hover:bg-blue-600">
              Published
            </Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          <Badge variant="outline">{details.session.mode}</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {details.seat_summary.map((summary) => (
          <div key={summary.lab_id} className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{summary.lab_name}</p>
            <p className="text-lg font-semibold text-neutral-900">
              {summary.allocated_count} / {summary.total_seats}
            </p>
          </div>
        ))}
      </div>

      {details.overflow_students.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">
            Overflow students: {details.overflow_students.length}
          </p>
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-sm text-amber-800">
            {details.overflow_students.map((student) => (
              <li key={student.student_id}>{student.roll_number} - {student.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          All uploaded students received a seat allocation.
        </p>
      )}

      <div className="text-xs text-neutral-500">
        Published at: {formatDateTime(details.session.published_at)}
      </div>
    </section>
  );
}
