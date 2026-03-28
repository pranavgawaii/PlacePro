"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, FileCheck, Loader2, RefreshCw, Sparkles, UsersRound, Users, UserPlus, ListTodo, Presentation } from "lucide-react";
import { toast } from "sonner";

import { CoordinatorAttendanceTab } from "@/components/admin/coordinator/CoordinatorAttendanceTab";
import { CoordinatorFormsTab } from "@/components/admin/coordinator/CoordinatorFormsTab";
import { CoordinatorRosterTab } from "@/components/admin/coordinator/CoordinatorRosterTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const totalResponses = forms.reduce((sum, form) => sum + form.response_count, 0);
  const activeForms = forms.filter((form) => form.status === "active").length;
  const departmentCoverage = new Set(coordinators.map((coordinator) => coordinator.department)).size;
  
  const overviewCards = [
    {
      title: "Active Coordinators",
      value: coordinators.length,
      description: `${departmentCoverage} department${departmentCoverage === 1 ? "" : "s"} represented`,
      icon: Users
    },
    {
      title: "Attendance Workflows",
      value: coordinators.length ? "Ready" : "Pending",
      description: coordinators.length ? "Document generation enabled" : "Awaiting coordinator enrollment",
      icon: FileCheck
    },
    {
      title: "Application Forms",
      value: activeForms,
      description: `${totalResponses} total response${totalResponses === 1 ? "" : "s"} collected`,
      icon: ListTodo
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-20 pt-2 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200/80 pb-6 px-4 md:px-2">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Coordinator Management</h1>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Manage student coordinators, attendance documents, and placement workflows.
          </p>
        </div>
        
        <Button variant="outline" size="sm" className="h-9 px-4 rounded-md border-neutral-200 shadow-sm" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-neutral-500" /> : <RefreshCw className="mr-2 h-3.5 w-3.5 text-neutral-500" />}
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-12 px-4 md:px-2">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="flex gap-4 items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200/70 bg-white shadow-sm">
                <Icon className="h-4 w-4 text-neutral-600" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">{card.title}</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-semibold text-neutral-950">{card.value}</span>
                  <span className="text-xs text-neutral-500">{card.description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 md:px-2 pt-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
          <TabsList className="w-full flex-wrap rounded-lg bg-neutral-100/80 p-1 sm:w-fit justify-start">
            <TabsTrigger
              value="coordinators"
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm text-neutral-500"
            >
              <UsersRound className="mr-2 inline h-4 w-4" />
              Directory
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm text-neutral-500"
            >
              <Presentation className="mr-2 inline h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger
              value="forms"
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm text-neutral-500"
            >
              <ClipboardCheck className="mr-2 inline h-4 w-4" />
              Forms & Workflows
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="coordinators" className="pt-2 focus-visible:outline-none min-h-[400px]">
            <CoordinatorRosterTab
              coordinators={coordinators}
              loading={loading}
              onChanged={refresh}
              onOpenAttendance={() => setActiveTab("attendance")}
              onOpenForms={() => setActiveTab("forms")}
            />
          </TabsContent>
          <TabsContent value="attendance" className="pt-2 focus-visible:outline-none min-h-[400px]">
            <CoordinatorAttendanceTab coordinators={coordinators} />
          </TabsContent>
          <TabsContent value="forms" className="pt-2 focus-visible:outline-none min-h-[400px]">
            <CoordinatorFormsTab forms={forms} loading={loading} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

