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

  return (
    <BespokeLayout>
      <DashboardHeader
        role="student"
        userName={student?.name || "Student"}
        userEmail={user?.email}
        avatarUrl={student?.avatar_url}
        homeUrl="/student/dashboard"
        messagesUrl="/student/messages"
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
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 p-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
