"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildCoordinatorTemplateFields, normalizeFieldChoices } from "@/lib/coordinator/utils";
import { type CoordinatorFormField, type CoordinatorFormRecord } from "@/lib/coordinator/types";
import { createCoordinatorForm, getCoordinatorForm, updateCoordinatorForm } from "@/lib/coordinator/api";

type CoordinatorFormBuilderPageProps = {
  formId?: string;
};

const FIELD_OPTIONS: Array<{ value: CoordinatorFormField["field_type"]; label: string }> = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown Select" }
];

const defaultTheme = {
  primaryColor: "#111827",
  backgroundColor: "#F8FAFC"
};

export function CoordinatorFormBuilderPage({ formId }: CoordinatorFormBuilderPageProps) {
  const router = useRouter();
  const isEditMode = Boolean(formId);
  const [loading, setLoading] = useState(Boolean(formId));
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CoordinatorFormRecord["status"]>("draft");
  const [isPublic, setIsPublic] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [themeSettings, setThemeSettings] = useState(defaultTheme);
  const [fields, setFields] = useState<CoordinatorFormField[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) {
      return;
    }
    const currentFormId = formId;

    let ignore = false;
    async function loadForm() {
      try {
        const result = await getCoordinatorForm(currentFormId);
        if (ignore) {
          return;
        }

        setTitle(result.form.title);
        setDescription(result.form.description ?? "");
        setStatus(result.form.status);
        setIsPublic(result.form.is_public);
        setDeadline(result.form.deadline ? new Date(result.form.deadline).toISOString().slice(0, 16) : "");
        setThemeSettings({
          primaryColor: typeof result.form.theme_settings?.primaryColor === "string" ? result.form.theme_settings.primaryColor : defaultTheme.primaryColor,
          backgroundColor: typeof result.form.theme_settings?.backgroundColor === "string" ? result.form.theme_settings.backgroundColor : defaultTheme.backgroundColor
        });
        setFields(result.fields);
        setSlug(result.form.slug);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load form.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadForm();
    return () => {
      ignore = true;
    };
  }, [formId]);

  const publicUrl = useMemo(() => {
    if (!slug || typeof window === "undefined") {
      return null;
    }
    return `${window.location.origin}/coordinator/apply/${slug}`;
  }, [slug]);

  const addField = () => {
    setFields((current) => [
      ...current,
      {
        id: `temp-${Date.now()}`,
        form_id: formId ?? "",
        label: "",
        field_type: "short_text",
        required: true,
        options: null,
        sort_order: current.length,
        created_at: new Date().toISOString()
      }
    ]);
  };

  const updateField = (index: number, next: Partial<CoordinatorFormField>) => {
    setFields((current) => current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...next } : field)));
  };

  const removeField = (index: number) => {
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index).map((field, fieldIndex) => ({ ...field, sort_order: fieldIndex })));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const cloned = [...current];
      const temp = cloned[index];
      cloned[index] = cloned[nextIndex];
      cloned[nextIndex] = temp;
      return cloned.map((field, fieldIndex) => ({ ...field, sort_order: fieldIndex }));
    });
  };

  const applyTemplate = () => {
    if (fields.length > 0 && !window.confirm("Replace the current fields with the coordinator template?")) {
      return;
    }

    setTitle((current) => current || "Coordinator Application");
    setDescription((current) => current || "Apply to become a placement coordinator for the upcoming cycle.");
    setFields(buildCoordinatorTemplateFields());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        description: description.trim() || null,
        status,
        is_public: isPublic,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        theme_settings: themeSettings,
        fields: fields.map((field, index) => ({
          label: field.label,
          field_type: field.field_type,
          required: field.required,
          options: field.field_type === "select" ? field.options ?? { choices: [] } : null,
          sort_order: index
        }))
      };

      if (isEditMode && formId) {
        await updateCoordinatorForm(formId, payload);
        toast.success("Form updated.");
      } else {
        const result = await createCoordinatorForm(payload);
        toast.success("Form created.");
        router.replace(`/admin/coordinator/forms/${result.form.id}`);
        return;
      }

      router.push("/admin/coordinator?tab=forms");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save form.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-sm text-neutral-500 shadow-sm">Loading form builder...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link href="/admin/coordinator?tab=forms" className="inline-flex items-center text-sm text-neutral-500 transition hover:text-neutral-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Coordinator Forms
          </Link>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Form Builder</div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{isEditMode ? "Edit coordinator form" : "Create coordinator form"}</h1>
          <p className="max-w-3xl text-sm leading-6 text-neutral-600">
            Configure the public coordinator application form, arrange its fields, and keep the publish state aligned with the current cycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!isEditMode ? (
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={applyTemplate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Use Coordinator Template
            </Button>
          ) : null}
          <Button className="h-11 rounded-xl px-5" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Form"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-neutral-900">Form settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coordinator-form-title">Title</Label>
              <Input id="coordinator-form-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Coordinator Application" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-form-description">Description</Label>
              <Textarea
                id="coordinator-form-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell students what this form is for."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-form-status">Status</Label>
              <select
                id="coordinator-form-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as CoordinatorFormRecord["status"])}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-form-deadline">Application deadline</Label>
              <Input
                id="coordinator-form-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="block font-medium text-neutral-900">Public access enabled</span>
                <span className="mt-1 block">Students can open the public link when the form is active and within the deadline.</span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Header color</Label>
                <Input type="color" value={themeSettings.primaryColor} onChange={(event) => setThemeSettings((current) => ({ ...current, primaryColor: event.target.value }))} className="h-10 p-1" />
              </div>
              <div className="space-y-2">
                <Label>Background color</Label>
                <Input type="color" value={themeSettings.backgroundColor} onChange={(event) => setThemeSettings((current) => ({ ...current, backgroundColor: event.target.value }))} className="h-10 p-1" />
              </div>
            </div>
            {publicUrl ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                <div className="font-medium text-neutral-900">Public link</div>
                <div className="mt-2 break-all text-xs text-neutral-500">{publicUrl}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={async () => {
                    await navigator.clipboard.writeText(publicUrl);
                    toast.success("Public link copied.");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-neutral-900">Form fields</CardTitle>
              <p className="mt-1 text-sm text-neutral-500">Arrange the application questions in the order you want students to see them.</p>
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <Button variant="outline" className="rounded-xl" onClick={applyTemplate}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Replace with Template
                </Button>
              ) : null}
              <Button className="rounded-xl" onClick={addField}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center text-sm text-neutral-500">
                No fields added yet. Use the coordinator template or add the first field manually.
              </div>
            ) : (
              fields.map((field, index) => (
                <div key={field.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[48px_minmax(0,1fr)_42px]">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => moveField(index, -1)} disabled={index === 0}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Field label</Label>
                        <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Question label" />
                      </div>
                      <div className="space-y-2">
                        <Label>Field type</Label>
                        <select
                          value={field.field_type}
                          onChange={(event) => updateField(index, { field_type: event.target.value as CoordinatorFormField["field_type"], options: event.target.value === "select" ? { choices: [] } : null })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {FIELD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} className="h-4 w-4" />
                        Required field
                      </label>
                      {field.field_type === "select" ? (
                        <div className="space-y-2 md:col-span-2">
                          <Label>Choices (comma separated)</Label>
                          <Input
                            value={field.options?.choices?.join(", ") ?? ""}
                            onChange={(event) => updateField(index, { options: { choices: normalizeFieldChoices(event.target.value) } })}
                            placeholder="Option 1, Option 2, Option 3"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex justify-end lg:justify-center">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => removeField(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
