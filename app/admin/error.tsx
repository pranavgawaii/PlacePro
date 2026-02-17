"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Unable to load admin portal</h2>
      <p className="mt-2 text-sm text-red-500 font-mono bg-red-50 p-2 rounded">
        {error.message}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">Digest: {error.digest}</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">Please retry or log in again.</p>
      <Button className="mt-4" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
