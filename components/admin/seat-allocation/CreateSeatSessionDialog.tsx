"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SeatSourceMode } from "@/lib/seat-allocation/types";

interface CreateSeatSessionDialogProps {
  open: boolean;
  sourceMode: SeatSourceMode;
  title: string;
  scheduledAt: string;
  creating?: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceModeChange: (mode: SeatSourceMode) => void;
  onTitleChange: (title: string) => void;
  onScheduledAtChange: (value: string) => void;
  onCreate: () => Promise<void>;
}

export function CreateSeatSessionDialog({
  open,
  sourceMode,
  title,
  scheduledAt,
  creating,
  onOpenChange,
  onSourceModeChange,
  onTitleChange,
  onScheduledAtChange,
  onCreate
}: CreateSeatSessionDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    if (!title.trim()) {
      onTitleChange(sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft");
    }
  }, [open, onTitleChange, sourceMode, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-neutral-200 bg-white p-0 shadow-2xl sm:max-w-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
        <div className="space-y-6 p-6 sm:p-7">
          <DialogHeader className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              New Allocation
            </span>
            <DialogTitle className="text-2xl tracking-tight text-neutral-950">Create Allocation</DialogTitle>
            <DialogDescription className="max-w-xl text-sm leading-6 text-neutral-600">
              Start a new seat-allocation draft, name it, and choose how candidates will enter the session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="rounded-[24px] border border-neutral-200 bg-neutral-50/80 p-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-900">Candidate source</Label>
                <Tabs value={sourceMode} onValueChange={(value) => onSourceModeChange(value as SeatSourceMode)}>
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-neutral-200">
                    <TabsTrigger
                      value="direct"
                      className="h-12 rounded-xl text-sm font-medium text-neutral-600"
                      activeIndicatorClassName="rounded-xl bg-blue-600 shadow-none"
                    >
                      Select Students
                    </TabsTrigger>
                    <TabsTrigger
                      value="upload"
                      className="h-12 rounded-xl text-sm font-medium text-neutral-600"
                      activeIndicatorClassName="rounded-xl bg-blue-600 shadow-none"
                    >
                      Upload File
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="pt-1 text-xs leading-5 text-neutral-500">
                  {sourceMode === "direct"
                    ? "Choose real students from the existing student list, then allocate and edit seats."
                    : "Upload a sheet or PDF, match rows by Enrollment No, then resolve unmatched candidates before publish."}
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seat-session-title" className="text-sm font-semibold text-neutral-900">
                  Draft title
                </Label>
                <Input
                  id="seat-session-title"
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder={sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft"}
                  className="h-12 rounded-2xl border-neutral-200 bg-white px-4 text-sm"
                />
                <p className="text-xs leading-5 text-neutral-500">
                  Use a company name, event name, or any label that helps your team identify this allocation session later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seat-session-schedule" className="text-sm font-semibold text-neutral-900">
                  Allocation date & time
                </Label>
                <Input
                  id="seat-session-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => onScheduledAtChange(event.target.value)}
                  className="h-12 rounded-2xl border-neutral-200 bg-white px-4 text-sm"
                />
                <p className="text-xs leading-5 text-neutral-500">
                  This schedule is shown in the admin seat-allocation module and on the student dashboard card.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-neutral-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Draft Preview</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                  {sourceMode === "direct" ? "Direct Selection" : "Upload Intake"}
                </span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                  {title.trim() || (sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft")}
                </span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                  {scheduledAt ? "Scheduled" : "Schedule Pending"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-neutral-200 pt-5 sm:justify-end">
            <Button variant="outline" className="h-11 rounded-2xl px-5" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancel
            </Button>
            <Button className="h-11 rounded-2xl px-5" onClick={() => void onCreate()} disabled={creating || !title.trim()}>
              {creating ? "Creating..." : "Create Allocation"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
