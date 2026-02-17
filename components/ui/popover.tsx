"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function Popover({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({ asChild, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(PopoverContext);
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        props.onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        context?.setOpen(!context.open);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

function PopoverContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(PopoverContext);
  if (!context?.open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
        className
      )}
      {...props}
    />
  );
}

export { Popover, PopoverTrigger, PopoverContent };
