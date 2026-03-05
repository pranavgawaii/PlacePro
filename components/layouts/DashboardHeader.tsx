"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell, Menu } from "lucide-react";
import { UserProfileMenu } from "@/components/student/user-profile-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface DashboardHeaderProps {
    role: "admin" | "super_admin" | "student";
    userName: string;
    userEmail?: string;
    avatarUrl?: string | null;
    secondaryInfo?: React.ReactNode;
    homeUrl: string;
    messagesUrl: string;
    mobileNavItems?: Array<{ href: string; label: string }>;
}

export function DashboardHeader({
    role,
    userName,
    userEmail,
    avatarUrl,
    secondaryInfo,
    homeUrl,
    messagesUrl,
    mobileNavItems,
}: DashboardHeaderProps) {
    return (
        <header className="z-10 bg-white/95 backdrop-blur-sm border-b-2 border-black h-16 flex items-center justify-between px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
                {mobileNavItems?.length ? (
                    <Sheet>
                        <SheetTrigger
                            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-4 w-4" />
                        </SheetTrigger>
                        <SheetContent side="left" className="bg-white">
                            <SheetTitle className="text-base font-semibold text-neutral-900">Navigation</SheetTitle>
                            <div className="mt-6 space-y-2">
                                {mobileNavItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-black"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                ) : null}
                <Link href={homeUrl} className="flex items-center gap-2">
                    <Image
                        src="/brand/logo.png"
                        alt="PlacePro Logo"
                        width={32}
                        height={32}
                        className="w-8 h-8 object-contain"
                    />
                    <span className="text-base sm:text-lg font-bold tracking-tight">
                        PlacePro{" "}
                        <span
                            className={
                                role === "student"
                                    ? "text-blue-600 font-medium ml-1"
                                    : "text-neutral-400 font-medium ml-1"
                            }
                        >
                            {role === "super_admin"
                                ? "Super Admin"
                                : role === "admin"
                                    ? "Admin"
                                    : "Student"}
                        </span>
                    </span>
                </Link>
                <div className="hidden md:block h-6 w-px bg-neutral-200 mx-2"></div>
                {secondaryInfo ? <div className="hidden md:flex">{secondaryInfo}</div> : null}
            </div>

            <div className="hidden md:flex flex-1 max-w-xl mx-8">
                <div className="flex-1"></div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                <Link
                    href={messagesUrl}
                    className="relative p-2 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500 hover:text-black"
                >
                    <Bell className="w-5 h-5" />
                </Link>
                <UserProfileMenu
                    name={userName}
                    email={userEmail}
                    role={role === "student" ? "student" : "admin"}
                    avatarUrl={avatarUrl}
                />
            </div>
        </header>
    );
}
