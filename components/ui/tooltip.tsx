"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

type TooltipTriggerProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
};

function TooltipTrigger({ asChild, children, ...props }: TooltipTriggerProps) {
  const context = React.useContext(TooltipContext);
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      onMouseEnter={() => context?.setOpen(true)}
      onMouseLeave={() => context?.setOpen(false)}
      onFocus={() => context?.setOpen(true)}
      onBlur={() => context?.setOpen(false)}
      {...props}
    >
      {children}
    </Comp>
  );
}

function TooltipContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(TooltipContext);

  if (!context?.open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
