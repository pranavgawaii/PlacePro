import { requireRole } from "@/lib/auth";
import type { ReactNode } from "react";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { BespokeLayout } from "@/components/ui/bespoke-layout";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { DashboardHeader } from "@/components/layouts/DashboardHeader";

export default async function StudentLayout({
  children
}: {
  children: ReactNode;
}) {
  const { user } = await requireRole("student");
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("*").eq("user_id", user?.id!).maybeSingle();
  const navItems = [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/companies", label: "Job Board" },
    { href: "/student/applications", label: "My Applications" },
    { href: "/student/messages", label: "Messages" },
    { href: "/student/profile", label: "My Profile" },
    { href: "/student/settings", label: "Settings" }
  ];

  return (
    <BespokeLayout>
      <DashboardHeader
        role="student"
        userName={student?.name || "Student"}
        userEmail={user?.email}
        avatarUrl={student?.avatar_url}
        homeUrl="/student/dashboard"
        messagesUrl="/student/messages"
        mobileNavItems={navItems}
        secondaryInfo={
          <div className="flex items-center gap-2">
            <Image
              src="/brand/mitadt.png"
              alt="MIT-ADT Logo"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <div className="text-sm font-medium text-neutral-500">
              {student?.branch || "Student"} • {student?.batch_year || new Date().getFullYear()}
            </div>
          </div>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <StudentSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 py-4 px-0 sm:py-6 sm:px-6 lg:py-8 lg:px-8">
          <div className="max-w-none sm:max-w-7xl mx-0 sm:mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
