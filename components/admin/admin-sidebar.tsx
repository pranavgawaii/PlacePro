"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Building, Megaphone, LifeBuoy, Settings, Armchair, UserPlus } from "lucide-react";

export function AdminSidebar() {
    const pathname = usePathname();

    const links = [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/students", label: "Students", icon: Users },
        { href: "/admin/companies", label: "Companies", icon: Building },
        { href: "/admin/seat-allocation", label: "Seat Allocation", icon: Armchair },
        { href: "/admin/coordinator", label: "Coordinator", icon: UserPlus },
        { href: "/admin/messages", label: "Broadcasts", icon: Megaphone },
        { href: "/admin/settings", label: "Settings", icon: Settings },
    ];

    return (
        <aside className="w-64 border-r-2 border-black flex flex-col bg-white hidden md:flex shrink-0 overflow-y-auto">
            <nav className="flex-1 p-4 space-y-1">
                {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
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
                <div className="bg-neutral-50 rounded p-4 border border-neutral-200">
                    <div className="flex items-center gap-2 mb-2">
                        <LifeBuoy className="w-4 h-4 text-neutral-500" />
                        <span className="text-xs font-semibold text-neutral-700">Need Help?</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 leading-relaxed mb-3">
                        Contact support for urgent drive issues.
                    </p>
                    <button className="w-full text-xs bg-white border border-neutral-300 rounded py-1.5 font-medium hover:bg-neutral-50 transition-colors">
                        Contact Support
                    </button>
                </div>
                <div className="mt-4 flex items-center justify-between px-2 text-xs text-neutral-500">
                    <span>v2.4.0</span>
                </div>
            </div>
        </aside>
    );
}
