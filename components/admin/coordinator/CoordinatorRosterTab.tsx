"use client";

import { useMemo, useState } from "react";
import { Edit2, FileCheck, FileText, Mail, Plus, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { CoordinatorDepartment, CoordinatorRecord, CoordinatorYear } from "@/lib/coordinator/types";
import { COORDINATOR_DEPARTMENTS, COORDINATOR_YEARS } from "@/lib/coordinator/types";
import { createCoordinator, deleteCoordinator, updateCoordinator } from "@/lib/coordinator/api";

const emptyForm = {
  name: "",
  enrollment_no: "",
  email: "",
  department: COORDINATOR_DEPARTMENTS[0] as CoordinatorDepartment,
  year: COORDINATOR_YEARS[0] as CoordinatorYear
};

type CoordinatorRosterTabProps = {
  coordinators: CoordinatorRecord[];
  loading: boolean;
  onChanged: () => Promise<void>;
  onOpenAttendance: () => void;
  onOpenForms: () => void;
};

export function CoordinatorRosterTab({ coordinators, loading, onChanged, onOpenAttendance, onOpenForms }: CoordinatorRosterTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<CoordinatorDepartment | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoordinator, setEditingCoordinator] = useState<CoordinatorRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const filteredCoordinators = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return coordinators.filter((coordinator) => {
      const matchesSearch =
        !query ||
        coordinator.name.toLowerCase().includes(query) ||
        coordinator.enrollment_no.toLowerCase().includes(query) ||
        (coordinator.email ?? "").toLowerCase().includes(query);
      const matchesDepartment = departmentFilter === "ALL" ? true : coordinator.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [coordinators, departmentFilter, searchTerm]);

  const openCreateDialog = () => {
    setEditingCoordinator(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (coordinator: CoordinatorRecord) => {
    setEditingCoordinator(coordinator);
    setFormData({
      name: coordinator.name,
      enrollment_no: coordinator.enrollment_no,
      email: coordinator.email ?? "",
      department: coordinator.department as CoordinatorDepartment,
      year: coordinator.year as CoordinatorYear
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCoordinator(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingCoordinator) {
        await updateCoordinator(editingCoordinator.id, {
          ...formData,
          email: formData.email.trim() || null
        });
        toast.success("Coordinator updated.");
      } else {
        await createCoordinator({
          ...formData,
          email: formData.email.trim() || null
        });
        toast.success("Coordinator added.");
      }
      closeDialog();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save coordinator.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (coordinator: CoordinatorRecord) => {
    if (!window.confirm(`Delete ${coordinator.name}?`)) {
      return;
    }

    try {
      await deleteCoordinator(coordinator.id);
      toast.success("Coordinator deleted.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete coordinator.");
    }
  };

  const coordinatorsWithEmail = coordinators.filter((coordinator) => Boolean(coordinator.email)).length;
  const coveredDepartments = new Set(coordinators.map((coordinator) => coordinator.department)).size;
  const summaryCards = [
    {
      label: "Total Coordinators",
      value: coordinators.length,
      note: "Active roster records",
      icon: UsersRound
    },
    {
      label: "Contact Coverage",
      value: `${coordinatorsWithEmail}/${coordinators.length || 0}`,
      note: "Roster members with email",
      icon: Mail
    },
    {
      label: "Departments",
      value: coveredDepartments,
      note: "Academic units represented",
      icon: FileCheck
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Coordinator Desk</div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">Coordinator roster</h2>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600">
            Manage the official placement coordinators, prepare attendance letters, and move into the application workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={onOpenAttendance}>
            <FileCheck className="mr-2 h-4 w-4" />
            Attendance Letters
          </Button>
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={onOpenForms}>
            <FileText className="mr-2 h-4 w-4" />
            Application Forms
          </Button>
          <Button className="h-11 rounded-xl px-5" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Coordinator
          </Button>
        </div>
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

      <Card className="rounded-[28px] border-neutral-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-neutral-900">Search and filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, enrollment number, or email"
              className="h-11 rounded-xl border-neutral-200 pl-10"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value as CoordinatorDepartment | "ALL")}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-neutral-400"
          >
            <option value="ALL">All Departments</option>
            {COORDINATOR_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[28px] border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Coordinator</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Enrollment No.</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Year</th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Department</th>
                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                    Loading coordinators...
                  </td>
                </tr>
              ) : filteredCoordinators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-sm text-neutral-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
                        <UserPlus className="h-5 w-5 text-neutral-300" />
                      </div>
                      <div>
                        <div className="font-medium text-neutral-700">No coordinators found</div>
                        <div className="mt-1 text-xs text-neutral-400">Create the first coordinator record to begin.</div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCoordinators.map((coordinator) => (
                  <tr key={coordinator.id} className="transition hover:bg-neutral-50/70">
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-sm font-semibold text-neutral-700">
                          {coordinator.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">{coordinator.name}</div>
                          <div className="mt-1 text-sm text-neutral-500">{coordinator.email || "Email not added"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-800">
                      <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-neutral-700">
                        {coordinator.enrollment_no}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{coordinator.year}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{coordinator.department}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openEditDialog(coordinator)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg text-red-600 hover:text-red-700" onClick={() => handleDelete(coordinator)}>
                          <Trash2 className="mr-2 h-4 w-4" />
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
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCoordinator ? "Edit coordinator" : "Add coordinator"}</DialogTitle>
            <DialogDescription>
              Keep the roster ready for attendance letters and coordinator application workflows.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coordinator-name">Full name</Label>
              <Input
                id="coordinator-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Enter coordinator name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-enrollment">Enrollment number</Label>
              <Input
                id="coordinator-enrollment"
                value={formData.enrollment_no}
                onChange={(event) => setFormData((current) => ({ ...current, enrollment_no: event.target.value.toUpperCase() }))}
                placeholder="Enrollment number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-email">Email</Label>
              <Input
                id="coordinator-email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                placeholder="Optional coordinator email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-department">Department</Label>
              <select
                id="coordinator-department"
                value={formData.department}
                onChange={(event) => setFormData((current) => ({ ...current, department: event.target.value as CoordinatorDepartment }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COORDINATOR_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-year">Year</Label>
              <select
                id="coordinator-year"
                value={formData.year}
                onChange={(event) => setFormData((current) => ({ ...current, year: event.target.value as CoordinatorYear }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COORDINATOR_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editingCoordinator ? "Save Changes" : "Add Coordinator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
