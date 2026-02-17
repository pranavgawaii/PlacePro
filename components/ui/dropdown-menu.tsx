"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

type DropdownMenuTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

function DropdownMenuTrigger({ asChild, children, onClick, ...props }: DropdownMenuTriggerProps) {
  const context = React.useContext(DropdownContext);
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        context?.setOpen(!context.open);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
};

function DropdownMenuContent({ className, align = "center", ...props }: DropdownMenuContentProps) {
  const context = React.useContext(DropdownContext);

  if (!context?.open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-1 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        className
      )}
      {...props}
    />
  );
}

type DropdownMenuItemProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  onSelectItem?: () => void;
  asChild?: boolean;
};

function DropdownMenuItem({ className, inset, onClick, onSelectItem, asChild, ...props }: DropdownMenuItemProps) {
  const context = React.useContext(DropdownContext);
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2",
        inset && "pl-8",
        className
      )}
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event);
        onSelectItem?.();
        context?.setOpen(false);
      }}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, inset, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return <div className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  return (
    <DropdownMenuItem
      className={cn("flex items-center gap-2", className)}
      onSelectItem={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span>{checked ? "✓" : ""}</span>
      {children}
    </DropdownMenuItem>
  );
}

function DropdownMenuRadioGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: string }) {
  return <DropdownMenuItem className={className} {...props}>{children}</DropdownMenuItem>;
}

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
}

function DropdownMenuGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuSub({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuSubContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props} />;
}

function DropdownMenuSubTrigger({ className, inset, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return <div className={cn("rounded-sm px-2 py-1.5 text-sm", inset && "pl-8", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup
};
