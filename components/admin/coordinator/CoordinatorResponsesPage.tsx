"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatFieldAnswer } from "@/lib/coordinator/utils";
import { listCoordinatorFormResponses, updateCoordinatorResponse } from "@/lib/coordinator/api";
import { COORDINATOR_RESPONSE_STATUSES, type CoordinatorFormField, type CoordinatorFormRecord, type CoordinatorFormResponseRecord } from "@/lib/coordinator/types";

type CoordinatorResponsesPageProps = {
  formId: string;
};

const STATUS_STYLES: Record<CoordinatorFormResponseRecord["status"], string> = {
  new: "border-neutral-200 bg-neutral-100 text-neutral-700",
  shortlisted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-700"
};

export function CoordinatorResponsesPage({ formId }: CoordinatorResponsesPageProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CoordinatorFormRecord | null>(null);
  const [fields, setFields] = useState<CoordinatorFormField[]>([]);
  const [responses, setResponses] = useState<CoordinatorFormResponseRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<CoordinatorFormResponseRecord["status"] | "all">("all");
  const [selectedResponse, setSelectedResponse] = useState<CoordinatorFormResponseRecord | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const result = await listCoordinatorFormResponses(formId);
        if (ignore) {
          return;
        }
        setForm(result.form);
        setFields(result.fields);
        setResponses(result.responses);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load responses.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      ignore = true;
    };
  }, [formId]);

  const filteredResponses = useMemo(() => {
    return statusFilter === "all" ? responses : responses.filter((response) => response.status === statusFilter);
  }, [responses, statusFilter]);

  const updateSelectedResponse = async (nextStatus: CoordinatorFormResponseRecord["status"], nextNotes: string | null) => {
    if (!selectedResponse) {
      return;
    }

    setSaving(true);
    try {
      const result = await updateCoordinatorResponse(selectedResponse.id, {
        status: nextStatus,
        notes: nextNotes
      });
      setResponses((current) => current.map((response) => (response.id === result.response.id ? result.response : response)));
      setSelectedResponse(result.response);
      toast.success("Response updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update response.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!form) {
      return;
    }

    const headers = ["Submitted At", ...fields.map((field) => field.label), "Status", "Notes"];
    const rows = responses.map((response) => [
      new Date(response.submitted_at).toLocaleString("en-IN"),
      ...fields.map((field) => formatFieldAnswer(response.answers[field.id])),
      response.status,
      response.notes ?? ""
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form.title.replace(/\s+/g, "_")}_responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Link href="/admin/coordinator?tab=forms" className="inline-flex items-center text-sm text-neutral-500 transition hover:text-neutral-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Coordinator Forms
          </Link>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Response Review</div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{form?.title ?? "Coordinator Responses"}</h1>
          <p className="max-w-3xl text-sm leading-6 text-neutral-600">
            Review public coordinator applications, update decision status, and export the full response dataset for review committees.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative min-w-[180px]">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CoordinatorFormResponseRecord["status"] | "all")}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-700 shadow-sm outline-none"
            >
              <option value="all">All Status</option>
              {COORDINATOR_RESPONSE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-neutral-900">Submitted responses</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50/70">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Submitted</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Applicant</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Email</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Status</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading responses...
                    </td>
                  </tr>
                ) : filteredResponses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                      No responses found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredResponses.map((response) => (
                    <tr key={response.id} className="transition hover:bg-neutral-50/70">
                      <td className="px-6 py-4 text-sm text-neutral-600">{new Date(response.submitted_at).toLocaleString("en-IN")}</td>
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">{response.applicant_name || "Unknown applicant"}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{response.applicant_email || "Not captured"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[response.status]}`}>
                          {response.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedResponse(response)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedResponse)} onOpenChange={(open) => (!open ? setSelectedResponse(null) : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedResponse?.applicant_name || "Response details"}</DialogTitle>
            <DialogDescription>
              Review the submitted answers, update the decision status, and add private notes for the committee.
            </DialogDescription>
          </DialogHeader>
          {selectedResponse ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {COORDINATOR_RESPONSE_STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={selectedResponse.status === status ? "default" : "outline"}
                        size="sm"
                        className="rounded-lg capitalize"
                        onClick={() => void updateSelectedResponse(status, selectedResponse.notes)}
                        disabled={saving}
                      >
                        {status.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Private notes</Label>
                  <Textarea
                    value={selectedResponse.notes ?? ""}
                    onChange={(event) => setSelectedResponse({ ...selectedResponse, notes: event.target.value })}
                    onBlur={() => void updateSelectedResponse(selectedResponse.status, selectedResponse.notes ?? null)}
                    rows={4}
                    placeholder="Add internal review notes"
                  />
                </div>
              </div>
              <Card className="border-neutral-200 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-neutral-900">Submitted answers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{field.label}</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{formatFieldAnswer(selectedResponse.answers[field.id])}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
