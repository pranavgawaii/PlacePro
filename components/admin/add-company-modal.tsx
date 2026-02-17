"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BRANCHES, COMPANY_TYPES, JOB_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  ApplicationFormField,
  CompanyCriteria,
  CompanyType,
  Database,
  JobType,
  Json,
  ProcessTimelineItem
} from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

type FieldType = ApplicationFormField["type"];

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  editingCompany: CompanyRow | null;
  onSaved: (row: CompanyRow) => void;
}

interface CompanyFormState {
  name: string;
  description: string;
  companyType: CompanyType;
  jobType: JobType;
  location: string;
  targetRole: string;
  packageRange: string;
  tenthMin: string;
  twelfthMin: string;
  cgpaMin: string;
  backlogsAllowed: string;
  otherRequirements: string;
  branches: Set<string>;
  deadline: string;
  applicationFields: ApplicationFormField[];
  processTimeline: ProcessTimelineItem[];
  logoFile: File | null;
}

const EMPTY_STATE: CompanyFormState = {
  name: "",
  description: "",
  companyType: "Service",
  jobType: "Full-time",
  location: "",
  targetRole: "",
  packageRange: "",
  tenthMin: "",
  twelfthMin: "",
  cgpaMin: "6",
  backlogsAllowed: "0",
  otherRequirements: "",
  branches: new Set<string>([]),
  deadline: "",
  applicationFields: [],
  processTimeline: [],
  logoFile: null
};

function parseCriteria(raw: unknown): CompanyCriteria {
  if (!raw || typeof raw !== "object") {
    return {
      cgpa_min: 6,
      branches: [...BRANCHES],
      backlogs_allowed: 0
    };
  }

  const criteria = raw as Partial<CompanyCriteria>;
  const branches = Array.isArray(criteria.branches)
    ? criteria.branches.filter((branch): branch is CompanyCriteria["branches"][number] => typeof branch === "string")
    : [...BRANCHES];

  return {
    cgpa_min: typeof criteria.cgpa_min === "number" ? criteria.cgpa_min : 6,
    tenth_min: typeof criteria.tenth_min === "number" ? criteria.tenth_min : undefined,
    twelfth_min: typeof criteria.twelfth_min === "number" ? criteria.twelfth_min : undefined,
    branches,
    backlogs_allowed: typeof criteria.backlogs_allowed === "number" ? criteria.backlogs_allowed : 0,
    other_requirements: typeof criteria.other_requirements === "string" ? criteria.other_requirements : undefined
  };
}

function parseApplicationFields(raw: unknown): ApplicationFormField[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const source = item as Record<string, unknown>;
    const type = source.type;
    const safeType: FieldType =
      type === "textarea" || type === "number" || type === "date" || type === "dropdown" || type === "file"
        ? type
        : "text";

    return [
      {
        id: typeof source.id === "string" ? source.id : `field-${Math.random().toString(36).slice(2)}`,
        label: typeof source.label === "string" ? source.label : "Custom Field",
        type: safeType,
        required: Boolean(source.required),
        options: Array.isArray(source.options)
          ? source.options.filter((value): value is string => typeof value === "string")
          : undefined
      }
    ];
  });
}

function parseTimeline(raw: unknown): ProcessTimelineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const source = item as Record<string, unknown>;
    if (typeof source.title !== "string") {
      return [];
    }

    return [
      {
        id: typeof source.id === "string" ? source.id : `step-${Math.random().toString(36).slice(2)}`,
        title: source.title,
        description: typeof source.description === "string" ? source.description : undefined,
        planned_at: typeof source.planned_at === "string" ? source.planned_at : undefined
      }
    ];
  });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function AddCompanyModal({
  open,
  onOpenChange,
  currentUserId,
  editingCompany,
  onSaved
}: AddCompanyModalProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<CompanyFormState>(EMPTY_STATE);

  const initialCriteria = useMemo(() => parseCriteria(editingCompany?.criteria_json ?? null), [editingCompany]);

  useEffect(() => {
    if (!editingCompany) {
      setFormState(EMPTY_STATE);
      return;
    }

    setFormState({
      name: editingCompany.name,
      description: editingCompany.description ?? "",
      companyType: editingCompany.company_type,
      jobType: editingCompany.job_type,
      location: editingCompany.location ?? "",
      targetRole: editingCompany.target_role ?? "",
      packageRange: editingCompany.package_range ?? "",
      tenthMin: typeof initialCriteria.tenth_min === "number" ? String(initialCriteria.tenth_min) : "",
      twelfthMin: typeof initialCriteria.twelfth_min === "number" ? String(initialCriteria.twelfth_min) : "",
      cgpaMin: String(initialCriteria.cgpa_min),
      backlogsAllowed: String(initialCriteria.backlogs_allowed),
      otherRequirements: initialCriteria.other_requirements ?? "",
      branches: new Set(initialCriteria.branches),
      deadline: editingCompany.application_deadline
        ? new Date(editingCompany.application_deadline).toISOString().slice(0, 16)
        : "",
      applicationFields: parseApplicationFields(editingCompany.application_form_fields),
      processTimeline: parseTimeline(editingCompany.process_timeline),
      logoFile: null
    });
  }, [editingCompany, initialCriteria]);

  const title = editingCompany ? "Edit Company" : "Add Company";

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, logoFile: event.target.files?.[0] ?? null }));
  };

  const addApplicationField = () => {
    setFormState((prev) => ({
      ...prev,
      applicationFields: [
        ...prev.applicationFields,
        {
          id: `field-${Date.now()}`,
          label: "",
          type: "text",
          required: false
        }
      ]
    }));
  };

  const addTimelineStep = () => {
    setFormState((prev) => ({
      ...prev,
      processTimeline: [
        ...prev.processTimeline,
        {
          id: `step-${Date.now()}`,
          title: "",
          description: ""
        }
      ]
    }));
  };

  const onSave = async () => {
    const name = formState.name.trim();
    const description = formState.description.trim();

    if (!name) {
      toast.error("Company name is required");
      return;
    }

    if (!formState.branches.size) {
      toast.error("Select at least one branch");
      return;
    }

    const cgpaMin = Number(formState.cgpaMin);
    const tenthMin = formState.tenthMin ? Number(formState.tenthMin) : undefined;
    const twelfthMin = formState.twelfthMin ? Number(formState.twelfthMin) : undefined;
    const backlogsAllowed = Number(formState.backlogsAllowed || "0");

    if (Number.isNaN(cgpaMin) || cgpaMin < 0 || cgpaMin > 10) {
      toast.error("CGPA min should be between 0 and 10");
      return;
    }

    if (typeof tenthMin === "number" && (Number.isNaN(tenthMin) || tenthMin < 0 || tenthMin > 100)) {
      toast.error("10th min should be between 0 and 100");
      return;
    }

    if (typeof twelfthMin === "number" && (Number.isNaN(twelfthMin) || twelfthMin < 0 || twelfthMin > 100)) {
      toast.error("12th min should be between 0 and 100");
      return;
    }

    setSaving(true);

    let logoUrl = editingCompany?.logo_url ?? null;
    if (formState.logoFile) {
      const safeName = sanitizeFileName(formState.logoFile.name);
      const path = `${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, formState.logoFile, { upsert: true, contentType: formState.logoFile.type });

      if (uploadError) {
        toast.error(uploadError.message);
        setSaving(false);
        return;
      }

      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      logoUrl = data.publicUrl;
    }

    const criteria: CompanyCriteria = {
      cgpa_min: cgpaMin,
      tenth_min: tenthMin,
      twelfth_min: twelfthMin,
      branches: Array.from(formState.branches) as CompanyCriteria["branches"],
      backlogs_allowed: Number.isNaN(backlogsAllowed) ? 0 : backlogsAllowed,
      other_requirements: formState.otherRequirements.trim() || undefined
    };

    const validFields = formState.applicationFields
      .filter((field) => field.label.trim())
      .map((field) => ({ ...field, label: field.label.trim() }));
    const validTimeline = formState.processTimeline.filter((step) => step.title.trim()).map((step) => ({
      ...step,
      title: step.title.trim(),
      description: step.description?.trim() || undefined
    }));

    const payload = {
      name,
      description,
      logo_url: logoUrl,
      company_type: formState.companyType,
      job_type: formState.jobType,
      location: formState.location.trim() || null,
      target_role: formState.targetRole.trim() || null,
      package_range: formState.packageRange.trim() || null,
      criteria_json: criteria as unknown as Json,
      application_form_fields: validFields as unknown as Json,
      process_timeline: validTimeline as unknown as Json,
      application_deadline: formState.deadline ? new Date(formState.deadline).toISOString() : null,
      active: true,
      created_by: currentUserId
    };

    if (editingCompany) {
      const { data, error } = await supabase.from("companies").update(payload).eq("id", editingCompany.id).select().single();
      if (error || !data) {
        toast.error(error?.message ?? "Unable to update company");
        setSaving(false);
        return;
      }

      onSaved(data);
      toast.success("Company updated");
      setSaving(false);
      onOpenChange(false);
      return;
    }

    const { data, error } = await supabase.from("companies").insert(payload).select().single();

    if (error || !data) {
      toast.error(error?.message ?? "Unable to add company");
      setSaving(false);
      return;
    }

    onSaved(data);
    toast.success("Company added");
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Configure company details, criteria, and application settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={onLogoChange} />
            </div>
            <div className="space-y-2">
              <Label>Company Type</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={formState.companyType}
                onChange={(event) => setFormState((prev) => ({ ...prev, companyType: event.target.value as CompanyType }))}
              >
                {COMPANY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Job Type</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={formState.jobType}
                onChange={(event) => setFormState((prev) => ({ ...prev, jobType: event.target.value as JobType }))}
              >
                {JOB_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={5}
                maxLength={2000}
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={formState.location} onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Target Role</Label>
              <Input placeholder="e.g. Systems Engineer" value={formState.targetRole} onChange={(event) => setFormState((prev) => ({ ...prev, targetRole: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Package Range</Label>
              <Input value={formState.packageRange} onChange={(event) => setFormState((prev) => ({ ...prev, packageRange: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Eligibility Criteria</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>10th % Min</Label>
                <Input type="number" value={formState.tenthMin} onChange={(event) => setFormState((prev) => ({ ...prev, tenthMin: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>12th % Min</Label>
                <Input type="number" value={formState.twelfthMin} onChange={(event) => setFormState((prev) => ({ ...prev, twelfthMin: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CGPA Min</Label>
                <Input type="number" step={0.1} value={formState.cgpaMin} onChange={(event) => setFormState((prev) => ({ ...prev, cgpaMin: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Backlogs</Label>
                <Input type="number" value={formState.backlogsAllowed} onChange={(event) => setFormState((prev) => ({ ...prev, backlogsAllowed: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Branches Allowed</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BRANCHES.map((branch) => (
                  <label key={branch} className="flex items-center gap-2 rounded border p-2 text-sm">
                    <Checkbox
                      checked={formState.branches.has(branch)}
                      onCheckedChange={(checked) => {
                        setFormState((prev) => {
                          const next = new Set(prev.branches);
                          if (checked) {
                            next.add(branch);
                          } else {
                            next.delete(branch);
                          }
                          return { ...prev, branches: next };
                        });
                      }}
                    />
                    {branch}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Other Requirements</Label>
              <Textarea
                rows={3}
                value={formState.otherRequirements}
                onChange={(event) => setFormState((prev) => ({ ...prev, otherRequirements: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Application Settings</h3>
            <div className="space-y-2">
              <Label>Application Deadline</Label>
              <Input type="datetime-local" value={formState.deadline} onChange={(event) => setFormState((prev) => ({ ...prev, deadline: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Custom Form Fields</Label>
                <Button variant="outline" size="sm" onClick={addApplicationField}>Add Field</Button>
              </div>
              {formState.applicationFields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded border p-2 sm:grid-cols-4">
                  <Input
                    placeholder="Field label"
                    value={field.label}
                    onChange={(event) => setFormState((prev) => ({
                      ...prev,
                      applicationFields: prev.applicationFields.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, label: event.target.value } : row
                      )
                    }))}
                  />
                  <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={field.type}
                    onChange={(event) => setFormState((prev) => ({
                      ...prev,
                      applicationFields: prev.applicationFields.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, type: event.target.value as FieldType } : row
                      )
                    }))}
                  >
                    {["text", "textarea", "number", "date", "dropdown", "file"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={(checked) => setFormState((prev) => ({
                        ...prev,
                        applicationFields: prev.applicationFields.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, required: Boolean(checked) } : row
                        )
                      }))}
                    />
                    Required
                  </label>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setFormState((prev) => ({
                      ...prev,
                      applicationFields: prev.applicationFields.filter((_, rowIndex) => rowIndex !== index)
                    }))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Process Timeline</Label>
                <Button variant="outline" size="sm" onClick={addTimelineStep}>Add Step</Button>
              </div>
              {formState.processTimeline.map((step, index) => (
                <div key={step.id} className="grid gap-2 rounded border p-2 sm:grid-cols-3">
                  <Input
                    placeholder="Step title"
                    value={step.title}
                    onChange={(event) => setFormState((prev) => ({
                      ...prev,
                      processTimeline: prev.processTimeline.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, title: event.target.value } : row
                      )
                    }))}
                  />
                  <Input
                    placeholder="Planned date-time"
                    type="datetime-local"
                    value={step.planned_at ? step.planned_at.slice(0, 16) : ""}
                    onChange={(event) => setFormState((prev) => ({
                      ...prev,
                      processTimeline: prev.processTimeline.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, planned_at: event.target.value ? new Date(event.target.value).toISOString() : undefined }
                          : row
                      )
                    }))}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setFormState((prev) => ({
                      ...prev,
                      processTimeline: prev.processTimeline.filter((_, rowIndex) => rowIndex !== index)
                    }))}
                  >
                    Remove
                  </Button>
                  <Textarea
                    className="sm:col-span-3"
                    rows={2}
                    placeholder="Description"
                    value={step.description ?? ""}
                    onChange={(event) => setFormState((prev) => ({
                      ...prev,
                      processTimeline: prev.processTimeline.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, description: event.target.value } : row
                      )
                    }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
