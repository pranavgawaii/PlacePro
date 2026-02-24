import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "PlacePro | Campus Placement Management",
  description: "Manage student profiles, company eligibility, and campus placement workflows in one dashboard.",
  icons: {
    icon: [
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.png?v=2", type: "image/png" }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-white" suppressHydrationWarning>
        <SupabaseProvider>{children}</SupabaseProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
