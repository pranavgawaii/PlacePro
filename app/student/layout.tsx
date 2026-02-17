
import { requireRole } from "@/lib/auth";
import type { ReactNode } from "react";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { BespokeLayout } from "@/components/ui/bespoke-layout";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { UserProfileMenu } from "@/components/student/user-profile-menu";
import { Bell } from "lucide-react";

export default async function StudentLayout({
  children
}: {
  children: ReactNode;
}) {
  const { user } = await requireRole("student");
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("*").eq("user_id", user?.id!).maybeSingle();

  return (
    <BespokeLayout>
      <header className="z-10 bg-white/95 backdrop-blur-sm nav-line h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="PlacePro Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold tracking-tight">
              PlacePro <span className="text-blue-600 font-medium ml-1">Student</span>
            </span>
          </Link>
          <div className="h-6 w-px bg-neutral-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <Image
              src="/mitadt.png"
              alt="MIT-ADT Logo"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <div className="text-sm font-medium text-neutral-500">
              {student?.branch || "Student"} • {student?.batch_year || new Date().getFullYear()}
            </div>
          </div>
        </div>
        <div className="flex-1 max-w-xl mx-8">
          {/* Search removed as it wasn't functional in original */}
          <div className="flex-1"></div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/student/messages" className="relative p-2 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500 hover:text-black">
            <Bell className="w-5 h-5" />
          </Link>
          <UserProfileMenu
            name={student?.name || "Student"}
            email={user?.email}
            role="student"
            avatarUrl={student?.avatar_url}
          />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <StudentSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 p-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
