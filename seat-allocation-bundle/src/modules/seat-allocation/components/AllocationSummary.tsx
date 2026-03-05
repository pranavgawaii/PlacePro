import type { SeatAllocationResult } from '../types/seat';

interface AllocationSummaryProps {
  result: SeatAllocationResult | null;
}

const AllocationSummary = ({ result }: AllocationSummaryProps) => {
  if (!result) {
    return (
      <section className="premium-panel rounded-2xl p-5">
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Allocation Summary</h3>
        <p className="mt-2 text-sm text-ink-600">Run an allocation to view summary and overflow details.</p>
      </section>
    );
  }

  return (
    <section className="premium-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Allocation Summary</h3>
        <span className="rounded-lg bg-ink-900 px-3 py-1 text-xs font-semibold text-white">Session {result.session_id}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {result.seat_summary.map((item) => (
          <div key={item.lab_id} className="rounded-xl border border-ink-100 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-500">{item.lab_name}</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">
              {item.allocated_count} / {item.total_seats}
            </p>
          </div>
        ))}
      </div>

      {result.overflow_students.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Overflow Students: {result.overflow_students.length}</p>
          <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
            {result.overflow_students.map((student) => (
              <li key={student.student_id}>{student.roll_number} - {student.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          All students were assigned seats.
        </p>
      )}
    </section>
  );
};

export default AllocationSummary;
