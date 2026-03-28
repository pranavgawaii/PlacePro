"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { CoordinatorAttendanceTab } from "@/components/admin/coordinator/CoordinatorAttendanceTab";
import { CoordinatorFormsTab } from "@/components/admin/coordinator/CoordinatorFormsTab";
import { CoordinatorRosterTab } from "@/components/admin/coordinator/CoordinatorRosterTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCoordinatorForms, listCoordinators } from "@/lib/coordinator/api";
import type { CoordinatorFormWithCount, CoordinatorRecord } from "@/lib/coordinator/types";

type CoordinatorPageProps = {
  initialTab?: "coordinators" | "attendance" | "forms";
};

export function CoordinatorPage({ initialTab = "coordinators" }: CoordinatorPageProps) {
  const [activeTab, setActiveTab] = useState<"coordinators" | "attendance" | "forms">(initialTab);
  const [coordinators, setCoordinators] = useState<CoordinatorRecord[]>([]);
  const [forms, setForms] = useState<CoordinatorFormWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextCoordinators, nextForms] = await Promise.all([listCoordinators(), listCoordinatorForms()]);
      setCoordinators(nextCoordinators);
      setForms(nextForms);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load coordinator data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Placement Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">Coordinator</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Bring coordinator roster management, attendance letters, application forms, and response review into the same PlacePro control room.
            </p>
          </div>
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-0">
          <TabsList className="w-full justify-start rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
            <TabsTrigger value="coordinators" className="rounded-xl px-4 py-2.5 text-sm" activeIndicatorClassName="rounded-xl border border-neutral-200 bg-white shadow-sm" >
              Coordinators
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-xl px-4 py-2.5 text-sm" activeIndicatorClassName="rounded-xl border border-neutral-200 bg-white shadow-sm">
              Attendance Letters
            </TabsTrigger>
            <TabsTrigger value="forms" className="rounded-xl px-4 py-2.5 text-sm" activeIndicatorClassName="rounded-xl border border-neutral-200 bg-white shadow-sm">
              Application Forms
            </TabsTrigger>
          </TabsList>
          <TabsContent value="coordinators" className="pt-6">
            <CoordinatorRosterTab
              coordinators={coordinators}
              loading={loading}
              onChanged={refresh}
              onOpenAttendance={() => setActiveTab("attendance")}
              onOpenForms={() => setActiveTab("forms")}
            />
          </TabsContent>
          <TabsContent value="attendance" className="pt-6">
            <CoordinatorAttendanceTab coordinators={coordinators} />
          </TabsContent>
          <TabsContent value="forms" className="pt-6">
            <CoordinatorFormsTab forms={forms} loading={loading} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
