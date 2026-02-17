"use client";

import { createContext, useContext, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReactNode } from "react";

type SupabaseClient = ReturnType<typeof createClient>;

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createClient(), []);

  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}

export function useSupabaseClient() {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabaseClient must be used within SupabaseProvider");
  }

  return context;
}
