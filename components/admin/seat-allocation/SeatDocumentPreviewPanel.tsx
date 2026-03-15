"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Presentation, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateSeatDocuments, getSeatDocumentPreview } from "@/lib/seat-allocation/seatApi";
import type {
  SeatDocumentGenerationResult,
  SeatDocumentKind,
  SeatDocumentPreview,
  SeatExportMode,
  SeatSession
} from "@/lib/seat-allocation/types";

interface SeatDocumentPreviewPanelProps {
  session: SeatSession | null;
  assignedCount: number;
}

export function SeatDocumentPreviewPanel({ session, assignedCount }: SeatDocumentPreviewPanelProps) {
  const [previewKind, setPreviewKind] = useState<SeatDocumentKind>("seating");
  const [exportMode, setExportMode] = useState<SeatExportMode>("per_lab");
  const [preview, setPreview] = useState<SeatDocumentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generatePdf, setGeneratePdf] = useState(true);
  const [generateXlsx, setGenerateXlsx] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SeatDocumentGenerationResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!session || assignedCount === 0) {
        setPreview(null);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const nextPreview = await getSeatDocumentPreview(session.id, exportMode);
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : "Unable to load document preview.");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [assignedCount, exportMode, session]);

  useEffect(() => {
    setResult(null);
  }, [exportMode, session?.id]);

  const selectedGroups = useMemo(() => {
    if (!preview) {
      return [];
    }

    return previewKind === "seating" ? preview.seating_groups : preview.attendance_groups;
  }, [preview, previewKind]);

  const handleGenerate = async () => {
    if (!session) {
      toast.error("Open a seat session first.");
      return;
    }

    const formats = [generatePdf ? "pdf" : null, generateXlsx ? "xlsx" : null].filter(
      (value): value is "pdf" | "xlsx" => Boolean(value)
    );

    if (formats.length === 0) {
      toast.error("Choose at least one export format.");
      return;
    }

    setGenerating(true);
    try {
      const nextResult = await generateSeatDocuments({
        sessionId: session.id,
        formats,
        exportMode
      });
      setResult(nextResult);
      toast.success("Seat documents generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate seat documents.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            Document Studio
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">Preview & Export</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Preview seating and attendance layouts, then export the final list lab-wise or as one full consolidated sheet.
          </p>
        </div>
        {session ? (
          <Badge variant="outline" className="rounded-full capitalize">
            {session.source_mode} • {session.is_published ? "Published" : session.status}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Tabs value={previewKind} onValueChange={(value) => setPreviewKind(value as SeatDocumentKind)}>
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-neutral-100 p-1.5">
              <TabsTrigger value="seating" className="h-11 rounded-xl" activeIndicatorClassName="rounded-xl bg-white shadow-sm">
                Seating Preview
              </TabsTrigger>
              <TabsTrigger value="attendance" className="h-11 rounded-xl" activeIndicatorClassName="rounded-xl bg-white shadow-sm">
                Attendance Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seating" className="mt-0 space-y-4" />
            <TabsContent value="attendance" className="mt-0 space-y-4" />
          </Tabs>

          {previewLoading ? (
            <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-8 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing document preview...
              </div>
            </div>
          ) : previewError ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{previewError}</div>
          ) : !session ? (
            <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-8 text-sm text-neutral-600">
              Select a seat session to inspect the preview and export options.
            </div>
          ) : assignedCount === 0 || selectedGroups.length === 0 ? (
            <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-8 text-sm text-neutral-600">
              Run or edit assignments first. Previews appear once this session has assigned seats.
            </div>
          ) : (
            <div className="space-y-4">
              {selectedGroups.map((group) => {
                const previewRows = group.rows.slice(0, 8);
                const hiddenCount = Math.max(0, group.rows.length - previewRows.length);

                return (
                  <div key={`${previewKind}-${group.key}`} className="overflow-hidden rounded-[24px] border border-neutral-200">
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{group.title}</p>
                        <p className="text-xs text-neutral-500">
                          {group.rows.length} students • {exportMode === "per_lab" ? "Lab-wise grouping" : "Full consolidated order"}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full">{previewKind === "seating" ? "Seating" : "Attendance"}</Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-white text-neutral-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Seat</th>
                            <th className="px-4 py-3 text-left font-semibold">Enrollment No</th>
                            <th className="px-4 py-3 text-left font-semibold">Name</th>
                            <th className="px-4 py-3 text-left font-semibold">Branch</th>
                            {previewKind === "attendance" ? (
                              <th className="px-4 py-3 text-left font-semibold">Signature</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {previewRows.map((row) => (
                            <tr key={`${group.key}-${row.student_id}`}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{row.seat_number}</td>
                              <td className="px-4 py-3 text-neutral-700">{row.enrollment_no || "—"}</td>
                              <td className="px-4 py-3 text-neutral-900">{row.student_name}</td>
                              <td className="px-4 py-3 text-neutral-700">{row.branch ?? "—"}</td>
                              {previewKind === "attendance" ? (
                                <td className="px-4 py-3">
                                  <div className="h-8 rounded-md border border-dashed border-neutral-300 bg-neutral-50" />
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {hiddenCount > 0 ? (
                      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                        + {hiddenCount} more students will appear in the generated export.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[24px] border border-neutral-200 bg-neutral-50/80 p-5">
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">Export controls</h4>
            <p className="mt-1 text-xs text-neutral-500">
              Choose the grouping and output format, then generate signed download links for the current session.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Export mode</p>
            <Tabs value={exportMode} onValueChange={(value) => setExportMode(value as SeatExportMode)}>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white p-1.5">
                <TabsTrigger value="per_lab" className="h-11 rounded-xl" activeIndicatorClassName="rounded-xl bg-neutral-100 shadow-none">
                  <Presentation className="h-4 w-4" />
                  Lab-wise
                </TabsTrigger>
                <TabsTrigger value="full_list" className="h-11 rounded-xl" activeIndicatorClassName="rounded-xl bg-neutral-100 shadow-none">
                  <Rows3 className="h-4 w-4" />
                  Full list
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Formats</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <button
                type="button"
                className={[
                  "flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition-colors",
                  generatePdf ? "border-blue-300 bg-blue-50 text-blue-800" : "border-neutral-200 bg-white text-neutral-700"
                ].join(" ")}
                onClick={() => setGeneratePdf((current) => !current)}
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileDown className="h-4 w-4" /> PDF bundle
                </span>
                <span>{generatePdf ? "On" : "Off"}</span>
              </button>
              <button
                type="button"
                className={[
                  "flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition-colors",
                  generateXlsx ? "border-blue-300 bg-blue-50 text-blue-800" : "border-neutral-200 bg-white text-neutral-700"
                ].join(" ")}
                onClick={() => setGenerateXlsx((current) => !current)}
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="h-4 w-4" /> Excel workbook
                </span>
                <span>{generateXlsx ? "On" : "Off"}</span>
              </button>
            </div>
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={!session || assignedCount === 0 || generating || (!generatePdf && !generateXlsx)}
            className="h-11 w-full rounded-2xl"
          >
            {generating ? "Generating..." : "Generate Documents"}
          </Button>

          {result ? (
            <div className="space-y-2 rounded-[20px] border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-neutral-900">Downloads ready</p>
              <div className="flex flex-wrap gap-2">
                {result.seat_pdf_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={result.seat_pdf_url} target="_blank" rel="noreferrer">Seating PDF</a>
                  </Button>
                ) : null}
                {result.attendance_pdf_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={result.attendance_pdf_url} target="_blank" rel="noreferrer">Attendance PDF</a>
                  </Button>
                ) : null}
                {result.workbook_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={result.workbook_url} target="_blank" rel="noreferrer">Excel Workbook</a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </section>
  );
}
