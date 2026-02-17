import { requireRole } from "@/lib/auth";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BespokeLayout } from "@/components/ui/bespoke-layout";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { UserProfileMenu } from "@/components/student/user-profile-menu";
import { Bell } from "lucide-react";

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
      <header className="z-10 bg-white/95 backdrop-blur-sm nav-line h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="PlacePro Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold tracking-tight">
              PlacePro <span className="text-neutral-400 font-medium ml-1">
                {role === "super_admin" ? "Super Admin" : "Admin"}
              </span>
            </span>
          </Link>
          <div className="h-6 w-px bg-neutral-200 mx-2"></div>
        </div>
        <div className="flex-1 max-w-xl mx-8">
          <div className="flex-1"></div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/messages" className="relative p-2 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500 hover:text-black">
            <Bell className="w-5 h-5" />
          </Link>
          <UserProfileMenu
            name={adminName}
            email={user?.email}
            role={role as any}
            avatarUrl={user?.user_metadata?.avatar_url}
          />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-neutral-50/30 p-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </BespokeLayout>
  );
}
