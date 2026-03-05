"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
};

const TabsContext = React.createContext<{
  value: string;
  setValue: (next: string) => void;
  layoutId: string;
} | null>(null);

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function Tabs({ value, defaultValue, onValueChange, className, children, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const resolvedValue = value ?? internalValue;
  const layoutId = React.useId();

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [onValueChange, value]
  );

  return (
    <TabsContext.Provider value={{ value: resolvedValue, setValue, layoutId }}>
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-md bg-muted p-1", className)}
      {...props}
    />
  );
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  activeIndicatorClassName?: string;
};

import { motion } from "framer-motion";

function TabsTrigger({ className, value, onClick, children, activeIndicatorClassName, ...props }: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  const active = context?.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      className={cn(
        "relative rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 outline-none",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        context?.setValue(value);
      }}
      {...props}
    >
      {active && (
        <motion.div
          layoutId={`active-tab-${context?.layoutId}`}
          className={cn("absolute inset-0 z-0 rounded-md bg-background shadow-sm", activeIndicatorClassName)}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const context = React.useContext(TabsContext);

  if (!context || context.value !== value) {
    return null;
  }

  return <div className={cn("mt-2", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
