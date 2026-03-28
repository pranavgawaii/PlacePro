"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ClipboardCheck, Copy, Edit, Eye, ExternalLink, FileText, Send, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCoordinatorFormStatus } from "@/lib/coordinator/api";
import type { CoordinatorFormWithCount } from "@/lib/coordinator/types";

type CoordinatorFormsTabProps = {
  forms: CoordinatorFormWithCount[];
  loading: boolean;
  onRefresh: () => Promise<void>;
};

const statusStyles: Record<CoordinatorFormWithCount["status"], string> = {
  draft: "border-neutral-200 bg-neutral-100 text-neutral-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-red-200 bg-red-50 text-red-700"
};

export function CoordinatorFormsTab({ forms, loading, onRefresh }: CoordinatorFormsTabProps) {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const copyPublicLink = async (slug: string) => {
    const url = `${window.location.origin}/coordinator/apply/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success("Public form link copied.");
    window.setTimeout(() => setCopiedSlug(null), 1800);
  };

  const handleToggleStatus = async (form: CoordinatorFormWithCount) => {
    setTogglingId(form.id);
    try {
      const nextStatus = form.status === "active" ? "closed" : "active";
      await updateCoordinatorFormStatus(form.id, nextStatus);
      toast.success(`Form ${nextStatus === "active" ? "activated" : "closed"}.`);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update form status.");
    } finally {
      setTogglingId(null);
    }
  };

  const activeForms = forms.filter((form) => form.status === "active").length;
  const totalResponses = forms.reduce((sum, form) => sum + form.response_count, 0);
  const closedForms = forms.filter((form) => form.status === "closed").length;
  const summaryCards = [
    {
      label: "Total Forms",
      value: forms.length,
      note: "Coordinator application flows",
      icon: FileText
    },
    {
      label: "Active Forms",
      value: activeForms,
      note: `${closedForms} currently closed`,
      icon: Send
    },
    {
      label: "Responses Logged",
      value: totalResponses,
      note: "Across all coordinator applications",
      icon: ClipboardCheck
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">PlacePro Forms</div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">Coordinator application forms</h2>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600">
            Create coordinator applications, publish public links, and review submissions from one control surface.
          </p>
        </div>
        <Button asChild className="h-11 rounded-xl px-5">
          <Link href="/admin/coordinator/forms/new">
            <FileText className="mr-2 h-4 w-4" />
            Create New Form
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="rounded-[24px] border-neutral-200 bg-neutral-50/70 shadow-none">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{card.label}</div>
                  <div className="text-2xl font-semibold tracking-tight text-neutral-950">{card.value}</div>
                  <p className="text-sm text-neutral-600">{card.note}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden rounded-[28px] border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-neutral-900">Application forms</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50/70">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Form</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Status</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Responses</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Deadline</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                      Loading forms...
                    </td>
                  </tr>
                ) : forms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                      No forms created yet.
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="transition hover:bg-neutral-50/70">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-neutral-900">{form.title}</div>
                        <div className="mt-1 text-sm text-neutral-500">{form.description || "No description added"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[form.status]}`}>
                          {form.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-neutral-800">{form.response_count}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {form.deadline ? new Date(form.deadline).toLocaleString("en-IN") : "No deadline"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void copyPublicLink(form.slug)}>
                            {copiedSlug === form.slug ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
                            Copy Link
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg" asChild>
                            <Link href={`/coordinator/apply/${form.slug}`} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg" asChild>
                            <Link href={`/admin/coordinator/forms/${form.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg" asChild>
                            <Link href={`/admin/coordinator/forms/${form.id}/responses`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Responses
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void handleToggleStatus(form)} disabled={togglingId === form.id}>
                            {form.status === "active" ? <ToggleRight className="mr-2 h-4 w-4 text-emerald-600" /> : <ToggleLeft className="mr-2 h-4 w-4" />}
                            {form.status === "active" ? "Close" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
