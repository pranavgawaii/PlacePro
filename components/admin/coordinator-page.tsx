"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, FileCheck, Loader2, RefreshCw, Sparkles, UsersRound } from "lucide-react";
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
      title: "Coordinator roster",
      value: coordinators.length,
      description: `${departmentCoverage} department${departmentCoverage === 1 ? "" : "s"} covered`,
      icon: UsersRound
    },
    {
      title: "Attendance workflows",
      value: coordinators.length ? "Ready" : "Pending",
      description: coordinators.length ? "Letter generation is ready for use" : "Add coordinators to start letters",
      icon: FileCheck
    },
    {
      title: "Application forms",
      value: activeForms,
      description: `${totalResponses} response${totalResponses === 1 ? "" : "s"} across all forms`,
      icon: ClipboardCheck
    }
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-neutral-200 bg-white px-5 py-6 shadow-sm sm:px-7">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Placement Operations
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.15rem]">Coordinator Control Room</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
                  Manage coordinator records, generate official attendance letters, publish application forms, and review responses from one premium operations surface.
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-11 rounded-xl px-4 self-start" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Data
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="rounded-[24px] border-neutral-200 bg-neutral-50/70 shadow-none">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{card.title}</div>
                      <div className="text-2xl font-semibold tracking-tight text-neutral-950">{card.value}</div>
                      <p className="text-sm text-neutral-600">{card.description}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-neutral-200 bg-white px-5 py-5 shadow-sm sm:px-7">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-0">
          <TabsList className="grid w-full grid-cols-1 gap-2 rounded-[24px] border border-neutral-200 bg-neutral-50 p-2 md:grid-cols-3">
            <TabsTrigger
              value="coordinators"
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm"
              activeIndicatorClassName="rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <UsersRound className="h-4 w-4" />
              Coordinators
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm"
              activeIndicatorClassName="rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <FileCheck className="h-4 w-4" />
              Attendance Letters
            </TabsTrigger>
            <TabsTrigger
              value="forms"
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm"
              activeIndicatorClassName="rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              <ClipboardCheck className="h-4 w-4" />
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
