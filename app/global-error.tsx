"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold">Unexpected application error</h2>
          <Button asChild>
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </body>
    </html>
  );
}
