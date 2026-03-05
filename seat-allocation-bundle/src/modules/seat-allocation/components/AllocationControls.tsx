import { useEffect, useMemo, useState } from 'react';
import type { AllocationMode, Lab } from '../types/seat';

interface AllocationControlsProps {
  labs: Lab[];
  uploadSessionId: string | null;
  studentCount?: number;
  onAllocate: (payload: { lab_ids: string[]; mode: AllocationMode; upload_session_id: string }) => Promise<unknown>;
  loading?: boolean;
}

const AllocationControls = ({ labs, uploadSessionId, studentCount = 0, onAllocate, loading }: AllocationControlsProps) => {
  const [mode, setMode] = useState<AllocationMode>('alphabetical');
  const [selectedLabs, setSelectedLabs] = useState<string[]>(() => labs.map((lab) => lab.id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLabs((current) => {
      if (labs.length === 0) {
        return [];
      }

      const labIds = labs.map((lab) => lab.id);
      if (current.length === 0) {
        return labIds;
      }

      const currentSet = new Set(current);
      const next = labIds.filter((id) => currentSet.has(id));
      return next.length > 0 ? next : labIds;
    });
  }, [labs]);

  const totalCapacity = useMemo(
    () =>
      labs
        .filter((lab) => selectedLabs.includes(lab.id))
        .reduce((sum, lab) => sum + lab.total_seats, 0),
    [labs, selectedLabs],
  );
  const insufficientCapacity = studentCount > 0 && totalCapacity < studentCount;

  const submit = async () => {
    if (!uploadSessionId) {
      setError('Upload students first.');
      return;
    }

    if (selectedLabs.length === 0) {
      setError('Select at least one lab.');
      return;
    }
    if (insufficientCapacity) {
      setError(`Selected labs have ${totalCapacity} seats for ${studentCount} students. Add more labs or increase seats.`);
      return;
    }

    setError(null);
    try {
      await onAllocate({
        lab_ids: selectedLabs,
        mode,
        upload_session_id: uploadSessionId,
      });
    } catch (allocationError) {
      setError((allocationError as Error).message);
    }
  };

  return (
    <section className="premium-panel rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Allocation Controls</h3>
        <p className="text-sm text-ink-600">Pick labs and mode. PDF/Excel output follows this exact run order.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as AllocationMode)}
            className="premium-input w-full px-3 py-2 text-sm"
          >
            <option value="alphabetical">Alphabetical (Roll Number)</option>
            <option value="random">Random (Seeded)</option>
          </select>
        </label>

        <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-700">
          <p className="font-medium">Selected Capacity</p>
          <p className="text-lg font-semibold text-ink-900">{totalCapacity} seats</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {labs.map((lab) => {
          const checked = selectedLabs.includes(lab.id);
          return (
            <label
              key={lab.id}
              className={`rounded-xl border px-3 py-2 text-sm transition ${checked ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-ink-200 bg-white text-ink-700'
                }`}
            >
              <input
                type="checkbox"
                className="mr-2"
                checked={checked}
                onChange={(event) => {
                  setSelectedLabs((current) =>
                    event.target.checked ? [...current, lab.id] : current.filter((value) => value !== lab.id),
                  );
                }}
              />
              {lab.lab_name} ({lab.total_seats})
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-700"
          onClick={() => setSelectedLabs(labs.map((lab) => lab.id))}
        >
          Select All
        </button>
        <button
          type="button"
          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-700"
          onClick={() => setSelectedLabs([])}
        >
          Clear
        </button>
      </div>

      <button type="button" className="btn-primary" onClick={submit} disabled={loading || !uploadSessionId}>
        {loading ? 'Allocating...' : 'Run Allocation'}
      </button>

      {insufficientCapacity ? (
        <p className="text-sm text-amber-700">
          Capacity is lower than uploaded students ({totalCapacity}/{studentCount}). Full lab-wise output needs enough seats.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
};

export default AllocationControls;
