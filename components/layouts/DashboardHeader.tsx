"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";
import { UserProfileMenu } from "@/components/student/user-profile-menu";

interface DashboardHeaderProps {
    role: "admin" | "super_admin" | "student";
    userName: string;
    userEmail?: string;
    avatarUrl?: string | null;
    secondaryInfo?: React.ReactNode;
    homeUrl: string;
    messagesUrl: string;
}

export function DashboardHeader({
    role,
    userName,
    userEmail,
    avatarUrl,
    secondaryInfo,
    homeUrl,
    messagesUrl,
}: DashboardHeaderProps) {
    return (
        <header className="z-10 bg-white/95 backdrop-blur-sm border-b-2 border-black h-16 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
                <Link href={homeUrl} className="flex items-center gap-2">
                    <Image
                        src="/brand/logo.png"
                        alt="PlacePro Logo"
                        width={32}
                        height={32}
                        className="w-8 h-8 object-contain"
                    />
                    <span className="text-lg font-bold tracking-tight">
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
                <div className="h-6 w-px bg-neutral-200 mx-2"></div>
                {secondaryInfo}
            </div>

            <div className="flex-1 max-w-xl mx-8">
                <div className="flex-1"></div>
            </div>

            <div className="flex items-center gap-4">
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
