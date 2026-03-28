"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CoordinatorFormField, CoordinatorFormRecord } from "@/lib/coordinator/types";

type CoordinatorApplicationPageProps = {
  slug: string;
  form: CoordinatorFormRecord | null;
  fields: CoordinatorFormField[];
  unavailableReason?: string | null;
};

export function CoordinatorApplicationPage({ slug, form, fields, unavailableReason }: CoordinatorApplicationPageProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnswers(
      Object.fromEntries(
        fields.map((field) => [field.id, ""])
      )
    );
  }, [fields, slug]);

  const deadlineLabel = useMemo(() => {
    if (!form?.deadline) {
      return "No deadline announced";
    }
    return new Date(form.deadline).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }, [form?.deadline]);

  const updateAnswer = (fieldId: string, value: string) => {
    setAnswers((current) => ({
      ...current,
      [fieldId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!form) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/coordinator/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to submit application.");
      }

      setSubmitted(true);
      toast.success("Application submitted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: CoordinatorFormField) => {
    const value = answers[field.id] ?? "";

    switch (field.field_type) {
      case "long_text":
        return (
          <Textarea
            id={field.id}
            rows={5}
            value={value}
            onChange={(event) => updateAnswer(field.id, event.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            className="rounded-2xl border-neutral-200 bg-white/90"
          />
        );
      case "select":
        return (
          <select
            id={field.id}
            value={value}
            onChange={(event) => updateAnswer(field.id, event.target.value)}
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition focus:border-neutral-400"
          >
            <option value="">Select an option</option>
            {(field.options?.choices ?? []).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <Input
            id={field.id}
            type={field.field_type === "email" ? "email" : field.field_type === "number" ? "number" : "text"}
            value={value}
            onChange={(event) => updateAnswer(field.id, event.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            className="h-11 rounded-2xl border-neutral-200 bg-white/90"
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-[32px] border border-neutral-200 bg-white px-6 py-7 shadow-sm sm:px-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">MIT-ADT Placement Portal</div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
                {form?.title ?? "Coordinator Application"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                {form?.description ?? unavailableReason ?? "This application is currently unavailable."}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              <div className="flex items-center gap-2 font-medium text-neutral-900">
                <Clock3 className="h-4 w-4 text-neutral-500" />
                Deadline
              </div>
              <div className="mt-1">{deadlineLabel}</div>
            </div>
          </div>
        </header>

        {!form ? (
          <Card className="border-neutral-200 shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="rounded-full border border-neutral-200 bg-neutral-50 p-3">
                <Clock3 className="h-6 w-6 text-neutral-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">Application unavailable</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                  {unavailableReason ?? "This application link is not active right now. Please contact the placement office if you need support."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : submitted ? (
          <Card className="border-neutral-200 shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="rounded-full border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-950">Application received</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                  Thank you for applying. The placement team has received your coordinator application and will review it shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-200 pb-5">
              <CardTitle className="text-lg font-semibold text-neutral-950">Application form</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-6 py-6 sm:px-8">
              {fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="text-sm font-medium text-neutral-900">
                    {field.label}
                    {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                  </Label>
                  {renderField(field)}
                </div>
              ))}

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                Official communication surface for MIT-ADT placement operations. Please make sure the information submitted here is accurate.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-neutral-500">Fields marked with * are required.</p>
                <Button className="h-11 rounded-xl px-5" onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {submitting ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
