import React from "react";
import { cn } from "@/lib/utils";

interface BespokeLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export function BespokeLayout({ children, className }: BespokeLayoutProps) {
    return (
        <div className={cn("bespoke-frame flex flex-col font-sans text-neutral-900 antialiased", className)}>
            {children}
        </div>
    );
}
