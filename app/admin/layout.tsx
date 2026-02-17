import { requireRole } from "@/lib/auth";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BespokeLayout } from "@/components/ui/bespoke-layout";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { UserProfileMenu } from "@/components/student/user-profile-menu";
import { Bell } from "lucide-react";
import { DashboardHeader } from "@/components/layouts/DashboardHeader";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  const { user, role } = await requireRole("admin");
  // const supabase = await createClient(); // Not needed if we don't query more

  if (!user) return null; // Should not happen due to redirect

  // In a real app we might have an 'admins' table, but for now we'll use user metadata or email
  const adminName = user.user_metadata?.name || "Administrator";

  return (
    <BespokeLayout>
      <DashboardHeader
        role={role as any}
        userName={adminName}
        userEmail={user.email}
        avatarUrl={user.user_metadata?.avatar_url}
        homeUrl="/admin"
        messagesUrl="/admin/messages"
      />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 p-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
