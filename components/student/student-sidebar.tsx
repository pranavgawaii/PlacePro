"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Briefcase, ClipboardCheck, MessageSquare, User, Settings } from "lucide-react";

export function StudentSidebar() {
    const pathname = usePathname();

    const links = [
        { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/companies", label: "Job Board", icon: Briefcase },
        { href: "/student/applications", label: "My Applications", icon: ClipboardCheck },
        { href: "/student/messages", label: "Messages", icon: MessageSquare },
        { href: "/student/profile", label: "My Profile", icon: User },
        { href: "/student/settings", label: "Settings", icon: Settings },
    ];

    return (
        <aside className="w-64 border-r-2 border-black flex flex-col bg-white hidden md:flex shrink-0 overflow-y-auto">
            <nav className="flex-1 p-4 space-y-1">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-black text-white shadow-sm"
                                    : "text-neutral-600 hover:bg-neutral-50 hover:text-black"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-neutral-200">
                <div className="flex items-center justify-between px-2 text-xs text-neutral-500">
                    <span>Student Portal</span>
                </div>
            </div>
        </aside>
    );
}
