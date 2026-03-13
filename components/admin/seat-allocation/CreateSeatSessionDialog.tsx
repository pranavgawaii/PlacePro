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
      <DialogContent className="border-neutral-200 bg-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-neutral-900">Create Allocation</DialogTitle>
          <DialogDescription className="text-neutral-600">
            Start a new seat-allocation draft, name it, and choose how candidates will enter the session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-neutral-900">Candidate source</Label>
            <Tabs value={sourceMode} onValueChange={(value) => onSourceModeChange(value as SeatSourceMode)}>
              <TabsList className="grid w-full grid-cols-2 bg-neutral-100 p-1">
                <TabsTrigger value="direct" className="h-11 text-sm" activeIndicatorClassName="bg-white shadow-sm">
                  Select Students
                </TabsTrigger>
                <TabsTrigger value="upload" className="h-11 text-sm" activeIndicatorClassName="bg-white shadow-sm">
                  Upload File
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-neutral-500">
              {sourceMode === "direct"
                ? "Choose real students from the existing student list, then allocate and edit seats."
                : "Upload a sheet or PDF, match rows by Enrollment No, then resolve unmatched candidates before publish."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seat-session-title" className="text-sm font-semibold text-neutral-900">
              Draft title
            </Label>
            <Input
              id="seat-session-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={sourceMode === "direct" ? "New Direct Draft" : "New Upload Draft"}
              className="h-11"
            />
            <p className="text-xs text-neutral-500">
              Use a company name, event name, or any label that helps your team identify this allocation session later.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seat-session-schedule" className="text-sm font-semibold text-neutral-900">
              Allocation date & time
            </Label>
            <Input
              id="seat-session-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => onScheduledAtChange(event.target.value)}
              className="h-11"
            />
            <p className="text-xs text-neutral-500">
              This schedule is shown in the admin seat-allocation module and on the student dashboard card.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={() => void onCreate()} disabled={creating || !title.trim()}>
            {creating ? "Creating..." : "Create Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
