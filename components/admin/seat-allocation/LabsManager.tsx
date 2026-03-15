"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lab } from "@/lib/seat-allocation/types";

interface LabDraft {
  id?: string;
  lab_name: string;
  total_seats: string;
  rows: string;
  columns: string;
}

interface LabsManagerProps {
  labs: Lab[];
  busy?: boolean;
  onCreate: (payload: {
    lab_name: string;
    total_seats: number;
    rows?: number | null;
    columns?: number | null;
  }) => Promise<void>;
  onUpdate: (
    labId: string,
    payload: {
      lab_name: string;
      total_seats: number;
      rows?: number | null;
      columns?: number | null;
    }
  ) => Promise<void>;
  onDelete: (labId: string) => Promise<void>;
}

const EMPTY_DRAFT: LabDraft = {
  lab_name: "",
  total_seats: "",
  rows: "",
  columns: ""
};

const draftFromLab = (lab: Lab): LabDraft => ({
  id: lab.id,
  lab_name: lab.lab_name,
  total_seats: String(lab.total_seats),
  rows: lab.rows ? String(lab.rows) : "",
  columns: lab.columns ? String(lab.columns) : ""
});

export function LabsManager({ labs, busy, onCreate, onUpdate, onDelete }: LabsManagerProps) {
  const [draft, setDraft] = useState<LabDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const editingLab = useMemo(() => labs.find((lab) => lab.id === draft.id) ?? null, [draft.id, labs]);

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const parsePositiveInteger = (value: string, label: string): number => {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`${label} must be a positive integer.`);
    }
    return number;
  };

  const parseOptionalInteger = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const number = Number(trimmed);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error("Rows and columns must be positive integers.");
    }

    return number;
  };

  const submit = async () => {
    try {
      setError(null);

      const labName = draft.lab_name.trim();
      if (!labName) {
        throw new Error("Lab name is required.");
      }

      const totalSeats = parsePositiveInteger(draft.total_seats, "Total seats");
      const rows = parseOptionalInteger(draft.rows);
      const columns = parseOptionalInteger(draft.columns);

      if (draft.id) {
        await onUpdate(draft.id, {
          lab_name: labName,
          total_seats: totalSeats,
          rows,
          columns
        });
      } else {
        await onCreate({
          lab_name: labName,
          total_seats: totalSeats,
          rows,
          columns
        });
      }

      reset();
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Failed to save lab.";
      setError(nextError);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            Lab Network
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Labs & Capacity</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Configure exam labs and seat capacity for allocation runs.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          {labs.length} labs
        </span>
      </div>

        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50/80 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="seat-lab-name" className="text-sm font-semibold text-neutral-900">Lab name</Label>
              <Input
                id="seat-lab-name"
                value={draft.lab_name}
                onChange={(event) => setDraft((current) => ({ ...current, lab_name: event.target.value }))}
                placeholder="Lab A - Block 2"
                disabled={busy}
                className="h-12 rounded-2xl border-neutral-200 bg-white px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seat-lab-total" className="text-sm font-semibold text-neutral-900">Total seats</Label>
              <Input
                id="seat-lab-total"
                type="number"
                min={1}
                value={draft.total_seats}
                onChange={(event) => setDraft((current) => ({ ...current, total_seats: event.target.value }))}
                placeholder="60"
                disabled={busy}
                className="h-12 rounded-2xl border-neutral-200 bg-white px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seat-lab-rows" className="text-sm font-semibold text-neutral-900">Rows (optional)</Label>
              <Input
                id="seat-lab-rows"
                type="number"
                min={1}
                value={draft.rows}
                onChange={(event) => setDraft((current) => ({ ...current, rows: event.target.value }))}
                placeholder="8"
                disabled={busy}
                className="h-12 rounded-2xl border-neutral-200 bg-white px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seat-lab-columns" className="text-sm font-semibold text-neutral-900">Columns (optional)</Label>
              <Input
                id="seat-lab-columns"
                type="number"
                min={1}
                value={draft.columns}
                onChange={(event) => setDraft((current) => ({ ...current, columns: event.target.value }))}
                placeholder="8"
                disabled={busy}
                className="h-12 rounded-2xl border-neutral-200 bg-white px-4"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button className="h-11 rounded-2xl px-5" onClick={() => void submit()} disabled={busy}>
              {draft.id ? "Update Lab" : "Add Lab"}
            </Button>
            {draft.id ? (
              <Button variant="outline" className="h-11 rounded-2xl px-5" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            ) : null}
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="overflow-hidden rounded-[24px] border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
            <tr>
                <th className="px-4 py-3 text-left font-semibold">Lab</th>
                <th className="px-4 py-3 text-left font-semibold">Seats</th>
                <th className="px-4 py-3 text-left font-semibold">Layout</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {labs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-500">
                    No labs added yet.
                  </td>
                </tr>
              ) : (
                labs.map((lab) => (
                  <tr key={lab.id} className="transition-colors hover:bg-neutral-50/80">
                    <td className="px-4 py-3.5 font-medium text-neutral-900">{lab.lab_name}</td>
                    <td className="px-4 py-3.5 text-neutral-700">{lab.total_seats}</td>
                    <td className="px-4 py-3.5 text-neutral-600">
                      {lab.rows && lab.columns ? `${lab.rows} × ${lab.columns}` : "Auto"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          onClick={() => {
                            setDraft(draftFromLab(lab));
                            setError(null);
                          }}
                          disabled={busy}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => {
                            const confirmDelete = window.confirm(`Delete ${lab.lab_name}?`);
                            if (!confirmDelete) {
                              return;
                            }

                            void onDelete(lab.id).then(() => {
                              if (editingLab?.id === lab.id) {
                                reset();
                              }
                            }).catch((deleteError) => {
                              const nextError = deleteError instanceof Error ? deleteError.message : "Failed to delete lab.";
                              setError(nextError);
                            });
                          }}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
