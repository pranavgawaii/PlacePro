"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { PasswordGenerator } from "@/components/admin/students/PasswordGenerator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/utils";
import { serializeCsvRows } from "@/lib/utils/csv-parser";
import {
  ManualAddInput,
  manualAddSchema,
  MultiAddInput,
  multiAddSchema,
  STUDENT_BRANCHES
} from "@/lib/validations/student";

type AddStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

type AddStudentResponse = {
  success: boolean;
  student?: {
    id: string;
    name: string;
    email: string;
    enrollment_no: string;
  };
  generatedPassword?: string;
  error?: string;
};

type MultiAddResponse = {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    student: {
      name: string;
      email: string;
      enrollment_no: string;
    };
    error: string;
  }>;
  credentials: Array<{
    row: number;
    name: string;
    email: string;
    enrollment_no: string;
    password: string;
  }>;
  errorLogCsv: string;
  credentialsCsv: string;
  error?: string;
};

const BATCH_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const SINGLE_DEFAULTS: ManualAddInput = {
  name: "",
  email: "",
  enrollment_no: "",
  mobile: "",
  branch: "CSE",
  batch_year: 2027,
  passwordStrategy: "pattern",
  forcePasswordChange: true
};

const MULTI_DEFAULTS: MultiAddInput = {
  students: [
    {
      name: "",
      email: "",
      enrollment_no: "",
      mobile: "",
      branch: "CSE",
      batch_year: 2027
    }
  ],
  passwordStrategy: "pattern",
  forcePasswordChange: true
};

export function AddStudentModal({ open, onOpenChange, onImported }: AddStudentModalProps) {
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [singleAddedPassword, setSingleAddedPassword] = useState<string | null>(null);
  const [multiResult, setMultiResult] = useState<MultiAddResponse | null>(null);

  const singleForm = useForm<ManualAddInput>({
    resolver: zodResolver(manualAddSchema),
    defaultValues: SINGLE_DEFAULTS
  });

  const multiForm = useForm<MultiAddInput>({
    resolver: zodResolver(multiAddSchema),
    defaultValues: MULTI_DEFAULTS
  });

  const multiFieldArray = useFieldArray({
    control: multiForm.control,
    name: "students"
  });

  const singleWatch = singleForm.watch();

  const resetState = () => {
    setIsMultiMode(false);
    setIsSubmitting(false);
    setSingleAddedPassword(null);
    setMultiResult(null);
    singleForm.reset(SINGLE_DEFAULTS);
    multiForm.reset(MULTI_DEFAULTS);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Unable to copy password");
    }
  };

  const handleSingleSubmit = singleForm.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setSingleAddedPassword(null);
    try {
      const response = await fetch("/api/admin/students/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });

      const data = (await response.json()) as AddStudentResponse;

      if (!response.ok || !data.success) {
        toast.error(data.error ?? "Failed to add student");
        return;
      }

      setSingleAddedPassword(data.generatedPassword ?? null);
      toast.success("Student added successfully");
      onImported();

      singleForm.reset({
        ...SINGLE_DEFAULTS,
        passwordStrategy: values.passwordStrategy,
        forcePasswordChange: values.forcePasswordChange
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleMultiSubmit = multiForm.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setMultiResult(null);
    try {
      const payload = {
        students: values.students,
        rowNumbers: values.students.map((_, index) => index + 1),
        passwordStrategy: values.passwordStrategy,
        forcePasswordChange: values.forcePasswordChange
      };

      const response = await fetch("/api/admin/students/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as MultiAddResponse;

      if (!response.ok) {
        toast.error(data.error ?? "Failed to add students");
        return;
      }

      setMultiResult(data);
      if (data.success > 0) {
        onImported();
      }
      toast.success(`${data.success} students added successfully`);

      if (data.failed === 0) {
        multiForm.reset({
          ...MULTI_DEFAULTS,
          passwordStrategy: values.passwordStrategy,
          forcePasswordChange: values.forcePasswordChange
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const addMultiRow = () => {
    if (multiFieldArray.fields.length >= 5) {
      return;
    }
    multiFieldArray.append({
      name: "",
      email: "",
      enrollment_no: "",
      mobile: "",
      branch: "CSE",
      batch_year: 2027
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={isMultiMode ? "max-w-5xl" : "max-w-xl"}>
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>
            Create student accounts manually, or switch to multi-add mode for up to 5 students.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
          <div>
            <div className="text-sm font-medium">Add Multiple</div>
            <div className="text-xs text-neutral-500">Enable table mode for adding up to 5 students at once.</div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isMultiMode}
              onCheckedChange={(checked) => {
                setIsMultiMode(checked === true);
                setSingleAddedPassword(null);
                setMultiResult(null);
              }}
            />
            Multi-add mode
          </label>
        </div>

        {!isMultiMode ? (
          <form className="space-y-4" onSubmit={handleSingleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="student-name">Full Name</Label>
                <Input id="student-name" {...singleForm.register("name")} aria-describedby="single-name-error" />
                <p id="single-name-error" className="text-xs text-red-600">
                  {singleForm.formState.errors.name?.message}
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="student-email">Email</Label>
                <Input id="student-email" type="email" {...singleForm.register("email")} aria-describedby="single-email-error" />
                <p id="single-email-error" className="text-xs text-red-600">
                  {singleForm.formState.errors.email?.message}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-enrollment">Enrollment Number</Label>
                <Input
                  id="student-enrollment"
                  maxLength={20}
                  placeholder="ADT23SOCB0741"
                  {...singleForm.register("enrollment_no")}
                  aria-describedby="single-enrollment-error"
                />
                <p id="single-enrollment-error" className="text-xs text-red-600">
                  {singleForm.formState.errors.enrollment_no?.message}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-mobile">Mobile</Label>
                <Input id="student-mobile" maxLength={10} {...singleForm.register("mobile")} aria-describedby="single-mobile-error" />
                <p id="single-mobile-error" className="text-xs text-red-600">
                  {singleForm.formState.errors.mobile?.message}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Branch</Label>
                <Controller
                  control={singleForm.control}
                  name="branch"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDENT_BRANCHES.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-red-600">{singleForm.formState.errors.branch?.message}</p>
              </div>

              <div className="space-y-2">
                <Label>Batch Year</Label>
                <Controller
                  control={singleForm.control}
                  name="batch_year"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch year" />
                      </SelectTrigger>
                      <SelectContent>
                        {BATCH_YEARS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-red-600">{singleForm.formState.errors.batch_year?.message}</p>
              </div>
            </div>

            <PasswordGenerator
              passwordStrategy={singleWatch.passwordStrategy}
              forcePasswordChange={singleWatch.forcePasswordChange}
              onPasswordStrategyChange={(value) => singleForm.setValue("passwordStrategy", value)}
              onForcePasswordChangeChange={(value) => singleForm.setValue("forcePasswordChange", value)}
              branch={singleWatch.branch}
              enrollmentNo={singleWatch.enrollment_no}
              mobile={singleWatch.mobile}
            />

            {singleAddedPassword ? (
              <Alert variant="success">
                <AlertTitle>Student created successfully</AlertTitle>
                <AlertDescription>
                  Generated password: <span className="font-mono">{singleAddedPassword}</span>
                </AlertDescription>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => copyPassword(singleAddedPassword)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy Password
                </Button>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Student
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleMultiSubmit}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="rounded-full">
                {multiFieldArray.fields.length}/5 rows
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMultiRow}
                disabled={multiFieldArray.fields.length >= 5}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Row
              </Button>
            </div>

            <PasswordGenerator
              passwordStrategy={multiForm.watch("passwordStrategy")}
              forcePasswordChange={multiForm.watch("forcePasswordChange")}
              onPasswordStrategyChange={(value) => multiForm.setValue("passwordStrategy", value)}
              onForcePasswordChangeChange={(value) => multiForm.setValue("forcePasswordChange", value)}
              showPreview={false}
            />

            <div className="max-h-[340px] space-y-3 overflow-auto rounded-md border border-neutral-200 p-3">
              {multiFieldArray.fields.map((field, index) => (
                <div key={field.id} className="rounded-md border border-neutral-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Student {index + 1}</div>
                    {multiFieldArray.fields.length > 1 ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => multiFieldArray.remove(index)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove row</span>
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name</Label>
                      <Input {...multiForm.register(`students.${index}.name`)} />
                      <p className="text-xs text-red-600">{multiForm.formState.errors.students?.[index]?.name?.message}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" {...multiForm.register(`students.${index}.email`)} />
                      <p className="text-xs text-red-600">{multiForm.formState.errors.students?.[index]?.email?.message}</p>
                    </div>
                    <div>
                      <Label>Enrollment Number</Label>
                      <Input
                        maxLength={20}
                        placeholder="ADT23SOCB0741"
                        {...multiForm.register(`students.${index}.enrollment_no`)}
                      />
                      <p className="text-xs text-red-600">
                        {multiForm.formState.errors.students?.[index]?.enrollment_no?.message}
                      </p>
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input maxLength={10} {...multiForm.register(`students.${index}.mobile`)} />
                      <p className="text-xs text-red-600">{multiForm.formState.errors.students?.[index]?.mobile?.message}</p>
                    </div>
                    <div>
                      <Label>Branch</Label>
                      <Controller
                        control={multiForm.control}
                        name={`students.${index}.branch`}
                        render={({ field: branchField }) => (
                          <Select value={branchField.value} onValueChange={branchField.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {STUDENT_BRANCHES.map((branch) => (
                                <SelectItem key={branch} value={branch}>
                                  {branch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-xs text-red-600">{multiForm.formState.errors.students?.[index]?.branch?.message}</p>
                    </div>
                    <div>
                      <Label>Batch Year</Label>
                      <Controller
                        control={multiForm.control}
                        name={`students.${index}.batch_year`}
                        render={({ field: batchField }) => (
                          <Select value={String(batchField.value)} onValueChange={(value) => batchField.onChange(Number(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select batch year" />
                            </SelectTrigger>
                            <SelectContent>
                              {BATCH_YEARS.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-xs text-red-600">{multiForm.formState.errors.students?.[index]?.batch_year?.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {multiResult ? (
              <Alert variant={multiResult.failed > 0 ? "warning" : "success"}>
                <Users className="h-4 w-4" />
                <AlertTitle>Multi-add completed</AlertTitle>
                <AlertDescription>
                  {multiResult.success} succeeded | {multiResult.failed} failed
                </AlertDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCsv("student_credentials.csv", multiResult.credentialsCsv)}
                    disabled={multiResult.success === 0}
                  >
                    Download Credentials CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        "student_import_errors.csv",
                        multiResult.errorLogCsv ||
                          serializeCsvRows(
                            multiResult.errors.map((entry) => ({
                              row: entry.row,
                              name: entry.student.name,
                              email: entry.student.email,
                              enrollment_no: entry.student.enrollment_no,
                              error: entry.error
                            })),
                            ["row", "name", "email", "enrollment_no", "error"]
                          )
                      )
                    }
                    disabled={multiResult.failed === 0}
                  >
                    Download Error Log
                  </Button>
                </div>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add All Students
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
