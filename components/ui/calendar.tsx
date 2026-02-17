"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CalendarProps = {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
};

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const value = selected ? selected.toISOString().slice(0, 10) : "";

  return (
    <input
      type="date"
      className={cn(
        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      value={value}
      onChange={(event) => {
        onSelect?.(event.target.value ? new Date(event.target.value) : undefined);
      }}
    />
  );
}
