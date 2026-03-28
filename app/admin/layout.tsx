import { requireRole } from "@/lib/auth";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BespokeLayout } from "@/components/ui/bespoke-layout";
import { DashboardHeader } from "@/components/layouts/DashboardHeader";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  const { user, role } = await requireRole("admin");

  if (!user) return null; // Should not happen due to redirect

  // In a real app we might have an 'admins' table, but for now we'll use user metadata or email
  const adminName = user.user_metadata?.name || "Administrator";
  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/companies", label: "Companies" },
    { href: "/admin/seat-allocation", label: "Seat Allocation" },
    { href: "/admin/coordinator", label: "Coordinator" },
    { href: "/admin/messages", label: "Broadcasts" },
    { href: "/admin/settings", label: "Settings" }
  ];

  return (
    <BespokeLayout>
      <DashboardHeader
        role={role}
        userName={adminName}
        userEmail={user.email}
        avatarUrl={user.user_metadata?.avatar_url}
        homeUrl="/admin"
        messagesUrl="/admin/messages"
        mobileNavItems={navItems}
      />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 py-4 px-0 sm:py-6 sm:px-6 lg:py-8 lg:px-8">
          <div className="max-w-none sm:max-w-7xl mx-0 sm:mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
