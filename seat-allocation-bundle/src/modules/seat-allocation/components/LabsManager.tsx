import { useMemo, useState } from 'react';
import type { Lab } from '../types/seat';

interface LabDraft {
  id?: string;
  lab_name: string;
  total_seats: string;
}

const emptyDraft: LabDraft = {
  lab_name: '',
  total_seats: '',
};

const toDraft = (lab: Lab): LabDraft => ({
  id: lab.id,
  lab_name: lab.lab_name,
  total_seats: String(lab.total_seats),
});

interface LabsManagerProps {
  labs: Lab[];
  isBusy?: boolean;
  onCreate: (payload: { lab_name: string; total_seats: number; rows?: number | null; columns?: number | null }) => Promise<unknown>;
  onUpdate: (labId: string, payload: { lab_name: string; total_seats: number; rows?: number | null; columns?: number | null }) => Promise<unknown>;
  onDelete: (labId: string) => Promise<unknown>;
}

const LabsManager = ({ labs, isBusy, onCreate, onUpdate, onDelete }: LabsManagerProps) => {
  const [draft, setDraft] = useState<LabDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingLab = useMemo(() => labs.find((lab) => lab.id === editingId) ?? null, [editingId, labs]);

  const validate = (input: LabDraft): string | null => {
    if (!input.lab_name.trim()) {
      return 'Lab name is required.';
    }

    const totalSeats = Number(input.total_seats);
    if (!Number.isInteger(totalSeats) || totalSeats <= 0) {
      return 'Total seats must be a positive integer.';
    }

    return null;
  };

  const toPayload = (input: LabDraft) => {
    return {
      lab_name: input.lab_name.trim(),
      total_seats: Number(input.total_seats),
      rows: null,
      columns: null,
    };
  };

  const reset = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setError(null);
  };

  const submit = async () => {
    const validationError = validate(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (editingId) {
        await onUpdate(editingId, toPayload(draft));
      } else {
        await onCreate(toPayload(draft));
      }
      reset();
    } catch (mutationError) {
      setError((mutationError as Error).message);
    }
  };

  return (
    <section className="premium-panel rounded-2xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-ink-900 brand-heading">Labs Management</h3>
          <p className="text-sm text-ink-600">Configure lab names and seat capacity before allocation.</p>
        </div>
        <span className="rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {labs.length} labs
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Lab Name</span>
          <input
            value={draft.lab_name}
            onChange={(event) => setDraft((current) => ({ ...current, lab_name: event.target.value }))}
            className="premium-input w-full px-3 py-2 text-sm"
            placeholder="Lab A - Block 2"
            disabled={isBusy}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Total Seats</span>
          <input
            type="number"
            min={1}
            value={draft.total_seats}
            onChange={(event) => setDraft((current) => ({ ...current, total_seats: event.target.value }))}
            className="premium-input w-full px-3 py-2 text-sm"
            placeholder="60"
            disabled={isBusy}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} className="btn-primary" disabled={isBusy}>
          {editingId ? 'Update Lab' : 'Add Lab'}
        </button>
        {editingId ? (
          <button type="button" onClick={reset} className="btn-secondary" disabled={isBusy}>
            Cancel
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-ink-100">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Lab</th>
              <th className="px-4 py-3 text-left font-semibold">Total Seats</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {labs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-500">
                  No labs added yet.
                </td>
              </tr>
            ) : (
              labs.map((lab) => (
                <tr key={lab.id}>
                  <td className="px-4 py-3 font-medium text-ink-900">{lab.lab_name}</td>
                  <td className="px-4 py-3 text-ink-600">{lab.total_seats}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
                        onClick={() => {
                          setDraft(toDraft(lab));
                          setEditingId(lab.id);
                          setError(null);
                        }}
                        disabled={isBusy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                        onClick={async () => {
                          if (!confirm(`Delete ${lab.lab_name}?`)) {
                            return;
                          }
                          try {
                            await onDelete(lab.id);
                            if (editingLab?.id === lab.id) {
                              reset();
                            }
                          } catch (mutationError) {
                            setError((mutationError as Error).message);
                          }
                        }}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LabsManager;
