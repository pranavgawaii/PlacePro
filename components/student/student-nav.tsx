"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";

const items = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/profile", label: "Profile" },
  { href: "/student/applications", label: "Applications" },
  { href: "/student/messages", label: "Messages" }
];

export function StudentNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/student/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="PlacePro Logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <span className="text-lg font-semibold">PlacePro</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
                pathname === item.href ? "text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LogoutButton className="text-sm" />
      </div>

      <nav className="border-t bg-white px-4 py-2 sm:hidden">
        <div className="flex items-center gap-2 overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                pathname === item.href ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
