"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  const onLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Logged out successfully");
    // HARD REFRESH: Force a full page reload to clear memory state and sync cookies
    window.location.href = "/login";
  };

  return (
    <Button variant="outline" onClick={onLogout} className={className}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
}
