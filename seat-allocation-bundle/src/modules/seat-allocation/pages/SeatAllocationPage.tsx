import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Database,
  Download,
  FileSpreadsheet,
  LayoutPanelTop,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import AllocationControls from '../components/AllocationControls';
import AllocationSummary from '../components/AllocationSummary';
import DocumentPreviewTabs from '../components/DocumentPreviewTabs';
import DocumentSettingsForm from '../components/DocumentSettingsForm';
import LabsManager from '../components/LabsManager';
import StudentUploadPanel from '../components/StudentUploadPanel';
import {
  DEFAULT_TABLE_STYLE,
  buildColumnConfigs,
  createLab,
  deleteGeneratedDocuments,
  deleteLab,
  generateDocuments,
  getAllocationPreview,
  getDocumentSettings,
  listAllocationSessions,
  listLabs,
  listSessionColumnOptions,
  parseStudentsFromNormalizedRows,
  runSeatAllocation,
  saveDocumentSettings,
  updateLab,
} from '../lib/seatApi';
import type {
  AllocationPreviewGroup,
  DocumentGenerationResult,
  ParseStudentsResult,
  ParsedRow,
  SeatAllocationResult,
  TableColumnConfig,
  TableStyleConfig,
} from '../types/seat';

type StepDefinition = {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
};

const STEPS: StepDefinition[] = [
  { step: 1, title: 'Labs & Header', description: 'Configure labs and document branding.', icon: LayoutPanelTop },
  { step: 2, title: 'Student Upload', description: 'Upload XLSX/CSV/PDF and map required columns.', icon: Database },
  { step: 3, title: 'Run Allocation', description: 'Select labs and execute allocation order.', icon: ListChecks },
  { step: 4, title: 'Review Summary', description: 'Verify lab-wise allocation and overflow.', icon: BadgeCheck },
  { step: 5, title: 'Spreadsheet Preview', description: 'Refine sheet layout before generation.', icon: FileSpreadsheet },
  { step: 6, title: 'Download Outputs', description: 'Generate and download PDF/XLSX documents.', icon: Download },
];

const SeatAllocationPage = () => {
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseStudentsResult | null>(null);
  const [parsedPreviewRows, setParsedPreviewRows] = useState<ParsedRow[]>([]);
  const [allocationResult, setAllocationResult] = useState<SeatAllocationResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [previewGroups, setPreviewGroups] = useState<AllocationPreviewGroup[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<TableColumnConfig[]>([]);
  const [tableStyle, setTableStyle] = useState<TableStyleConfig>(DEFAULT_TABLE_STYLE);
  const [isLayoutFinalized, setIsLayoutFinalized] = useState(false);
  const [documents, setDocuments] = useState<DocumentGenerationResult | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const updateColumnConfigs = (
    updater: TableColumnConfig[] | ((current: TableColumnConfig[]) => TableColumnConfig[]),
  ) => {
    setIsLayoutFinalized(false);
    setColumnConfigs(updater);
  };

  const labsQuery = useQuery({
    queryKey: ['seat-labs'],
    queryFn: listLabs,
  });

  const settingsQuery = useQuery({
    queryKey: ['seat-document-settings'],
    queryFn: getDocumentSettings,
  });

  const historyQuery = useQuery({
    queryKey: ['seat-allocation-history'],
    queryFn: () => listAllocationSessions(10),
  });

  const createLabMutation = useMutation({
    mutationFn: createLab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-labs'] });
    },
  });

  const updateLabMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateLab>[1] }) => updateLab(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-labs'] });
    },
  });

  const deleteLabMutation = useMutation({
    mutationFn: deleteLab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-labs'] });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: saveDocumentSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seat-document-settings'] });
      setBannerMessage('Document settings saved.');
      setBannerError(null);
    },
    onError: (error) => {
      setBannerError((error as Error).message);
      setBannerMessage(null);
    },
  });

  const allocationMutation = useMutation({
    mutationFn: runSeatAllocation,
    onSuccess: async (result) => {
      setAllocationResult(result);
      setActiveSessionId(result.session_id);
      setCurrentStep(4);
      setBannerMessage(`Allocation completed. Session ${result.session_id}`);
      setBannerError(null);
      await queryClient.invalidateQueries({ queryKey: ['seat-allocation-history'] });
    },
    onError: (error) => {
      setBannerError((error as Error).message);
      setBannerMessage(null);
    },
  });

  const documentsMutation = useMutation({
    mutationFn: generateDocuments,
    onSuccess: (result) => {
      setDocuments(result);
      setCurrentStep(6);
      setBannerMessage('Documents generated successfully.');
      setBannerError(null);
    },
    onError: (error) => {
      setBannerError((error as Error).message);
      setBannerMessage(null);
    },
  });

  const deleteDocumentsMutation = useMutation({
    mutationFn: deleteGeneratedDocuments,
    onSuccess: () => {
      setDocuments(null);
      setBannerMessage('Generated files removed for this session.');
      setBannerError(null);
    },
    onError: (error) => {
      setBannerError((error as Error).message);
      setBannerMessage(null);
    },
  });

  const loadPreview = async (sessionId: string) => {
    try {
      const [groups, columns] = await Promise.all([getAllocationPreview(sessionId), listSessionColumnOptions(sessionId)]);
      setPreviewGroups(groups);
      setIsLayoutFinalized(false);
      setColumnConfigs((current) => buildColumnConfigs(columns, current));
      setCurrentStep(5);
    } catch (error) {
      setBannerError((error as Error).message);
      setBannerMessage(null);
    }
  };

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    void loadPreview(activeSessionId);
  }, [activeSessionId]);

  const totalStudents = parseResult?.parsed_count ?? parsedPreviewRows.length;
  const totalCapacity = useMemo(
    () => (labsQuery.data ?? []).reduce((sum, lab) => sum + lab.total_seats, 0),
    [labsQuery.data],
  );
  const totalAllocatedRows = useMemo(
    () => previewGroups.reduce((sum, group) => sum + group.rows.length, 0),
    [previewGroups],
  );

  const enabledExtraColumns = columnConfigs
    .filter((column) => column.enabled && column.key.startsWith('extra:'))
    .map((column) => column.key.slice(6));
  const enabledSeatingColumns = columnConfigs.filter((column) => column.enabled && column.applies_to === 'both').length;
  const enabledAttendanceColumns = columnConfigs.filter((column) => column.enabled).length;
  const hasAllocationForCurrentUpload = !uploadSessionId || Boolean(
    allocationResult &&
    allocationResult.upload_session_id === uploadSessionId &&
    activeSessionId === allocationResult.session_id,
  );

  const diagnostics = [
    { label: 'Parsed Count', value: String(totalStudents) },
    { label: 'Capacity', value: String(totalCapacity) },
    { label: 'Allocated Count', value: String(totalAllocatedRows) },
    { label: 'Upload Session', value: uploadSessionId ?? '—' },
    { label: 'Active Session', value: activeSessionId ?? '—' },
  ];

  const canGenerate =
    Boolean(activeSessionId) &&
    enabledSeatingColumns > 0 &&
    enabledAttendanceColumns > 0 &&
    isLayoutFinalized &&
    totalAllocatedRows > 0 &&
    hasAllocationForCurrentUpload;

  const resetForNewUpload = () => {
    setAllocationResult(null);
    setActiveSessionId(null);
    setPreviewGroups([]);
    setColumnConfigs([]);
    setTableStyle(DEFAULT_TABLE_STYLE);
    setDocuments(null);
    setIsLayoutFinalized(false);
  };

  const handleGenerate = async () => {
    if (!activeSessionId) {
      setBannerError('Run allocation before generating documents.');
      setBannerMessage(null);
      return;
    }
    if (enabledSeatingColumns === 0 || enabledAttendanceColumns === 0) {
      setBannerError('Enable at least one seating column and one attendance column before generating documents.');
      setBannerMessage(null);
      return;
    }
    if (!isLayoutFinalized) {
      setBannerError('Finalize layout in Preview step before generating.');
      setBannerMessage(null);
      return;
    }
    if (!hasAllocationForCurrentUpload) {
      setBannerError('Run allocation again for the latest uploaded student session before generating.');
      setBannerMessage(null);
      return;
    }
    if (totalAllocatedRows <= 0) {
      setBannerError('No allocated rows found for generation.');
      setBannerMessage(null);
      return;
    }

    await documentsMutation.mutateAsync({
      session_id: activeSessionId,
      formats: ['pdf', 'xlsx'],
      excel_mode: 'per_lab',
      selected_columns: enabledExtraColumns,
      column_configs: columnConfigs,
      table_style: tableStyle,
    });
  };

  const renderCurrentStep = () => {
    if (currentStep === 1) {
      return (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <LabsManager
            labs={labsQuery.data ?? []}
            isBusy={createLabMutation.isPending || updateLabMutation.isPending || deleteLabMutation.isPending}
            onCreate={async (payload) => createLabMutation.mutateAsync(payload)}
            onUpdate={async (labId, payload) => updateLabMutation.mutateAsync({ id: labId, payload })}
            onDelete={async (labId) => deleteLabMutation.mutateAsync(labId)}
          />
          <DocumentSettingsForm
            value={settingsQuery.data ?? null}
            saving={saveSettingsMutation.isPending}
            onSave={async (payload) => saveSettingsMutation.mutateAsync(payload)}
          />
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <StudentUploadPanel
          uploadSessionId={uploadSessionId}
          onSubmitRows={async (params) =>
            parseStudentsFromNormalizedRows({
              rows: params.rows,
              source: params.source,
              upload_session_id: undefined,
              file_name: params.fileName,
            })
          }
          onParsed={(result, preview) => {
            resetForNewUpload();
            setUploadSessionId(result.upload_session_id);
            setParseResult(result);
            setParsedPreviewRows(preview);
            setCurrentStep(3);
            setBannerMessage(`Student data uploaded in session ${result.upload_session_id}.`);
            setBannerError(null);
          }}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <AllocationControls
          labs={labsQuery.data ?? []}
          uploadSessionId={uploadSessionId}
          studentCount={totalStudents}
          loading={allocationMutation.isPending}
          onAllocate={async (payload) => allocationMutation.mutateAsync(payload)}
        />
      );
    }

    if (currentStep === 4) {
      return <AllocationSummary result={allocationResult} />;
    }

    if (currentStep === 5) {
      return (
        <DocumentPreviewTabs
          groups={previewGroups}
          columnConfigs={columnConfigs}
          tableStyle={tableStyle}
          onColumnConfigsChange={updateColumnConfigs}
          onTableStyleChange={(next) => {
            setIsLayoutFinalized(false);
            setTableStyle(next);
          }}
          onResetColumns={() => {
            const extras = columnConfigs
              .filter((column) => column.source === 'extra' && column.key.startsWith('extra:'))
              .map((column) => column.key.slice(6));
            updateColumnConfigs(buildColumnConfigs(extras));
          }}
          onResetTableStyle={() => {
            setIsLayoutFinalized(false);
            setTableStyle(DEFAULT_TABLE_STYLE);
          }}
          onFinalizeLayout={() => {
            setIsLayoutFinalized(true);
            setBannerError(null);
            setBannerMessage('Layout finalized. You can now generate documents.');
            setCurrentStep(6);
          }}
          isLayoutFinalized={isLayoutFinalized}
        />
      );
    }

    return (
      <section className="premium-panel rounded-2xl p-5 space-y-4">
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Download Outputs</h3>
        <p className="text-sm text-ink-600">Generate official seating and attendance documents for the active session.</p>
        <p className="text-sm text-ink-700">
          Ready to generate for <span className="font-semibold">{totalAllocatedRows}</span> allocated students.
        </p>
        {!hasAllocationForCurrentUpload && uploadSessionId ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <ShieldAlert size={15} />
            Allocation is not synced with current upload session. Run Step 3 + Step 5 again.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!canGenerate || documentsMutation.isPending}>
            {documentsMutation.isPending ? 'Generating...' : 'Generate PDF + Excel'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              if (!activeSessionId) {
                setBannerError('Choose a session before deleting generated files.');
                setBannerMessage(null);
                return;
              }

              if (!confirm('Delete all generated PDF/Excel files for this session?')) {
                return;
              }

              await deleteDocumentsMutation.mutateAsync(activeSessionId);
            }}
            disabled={!activeSessionId || deleteDocumentsMutation.isPending}
          >
            {deleteDocumentsMutation.isPending ? 'Deleting...' : 'Delete Generated Files'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (activeSessionId) {
                void loadPreview(activeSessionId);
              }
            }}
            disabled={!activeSessionId}
          >
            Refresh Preview
          </button>
        </div>

        {documents ? (
          <div className="grid gap-2 md:grid-cols-3">
            {documents.seat_pdf_url ? (
              <a className="btn-secondary text-center" href={documents.seat_pdf_url} target="_blank" rel="noreferrer">
                Seat Allocation PDF
              </a>
            ) : null}
            {documents.attendance_pdf_url ? (
              <a className="btn-secondary text-center" href={documents.attendance_pdf_url} target="_blank" rel="noreferrer">
                Attendance PDF
              </a>
            ) : null}
            {documents.workbook_url ? (
              <a className="btn-secondary text-center" href={documents.workbook_url} target="_blank" rel="noreferrer">
                Workbook XLSX
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <section className="space-y-6">
      <header className="premium-panel rounded-3xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Operations Suite</p>
            <h2 className="mt-2 text-3xl font-bold text-ink-900 brand-heading">Seat Allocation & Attendance Studio</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-600">
              Premium institutional workflow for parsing student data, seat assignment, spreadsheet-style layout tuning,
              and professional PDF/XLSX generation.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-ink-600">
            <div className="rounded-xl border border-ink-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Parsed</p>
              <p className="text-lg text-ink-900">{totalStudents}</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Capacity</p>
              <p className="text-lg text-ink-900">{totalCapacity}</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Allocated</p>
              <p className="text-lg text-ink-900">{totalAllocatedRows}</p>
            </div>
          </div>
        </div>
      </header>

      {bannerMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{bannerMessage}</p> : null}
      {bannerError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{bannerError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-8 self-start">
          <section className="premium-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Module Navigator</h3>
              <span className="text-xs font-semibold text-ink-500">Step {currentStep}/6</span>
            </div>
            <div className="space-y-2">
              {STEPS.map((item) => {
                const isCurrent = item.step === currentStep;
                const isDone = item.step < currentStep;
                const Icon = item.icon;

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setCurrentStep(item.step)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      isCurrent
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                        {isDone ? '✓' : item.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-1 text-sm font-semibold">
                          <Icon size={14} />
                          {item.title}
                        </div>
                        <p className={`mt-0.5 text-[11px] ${isCurrent ? 'text-ink-200' : isDone ? 'text-emerald-700' : 'text-ink-500'}`}>
                          {item.description}
                        </p>
                      </div>
                      {isCurrent ? <ArrowRight size={14} className="mt-0.5" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="premium-panel rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-ink-900">Integrity Diagnostics</h3>
            <div className="mt-3 space-y-2">
              {diagnostics.map((item) => (
                <div key={item.label} className="rounded-lg border border-ink-100 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-ink-400">{item.label}</p>
                  <p className="truncate text-xs font-semibold text-ink-800">{item.value}</p>
                </div>
              ))}
            </div>
            {!hasAllocationForCurrentUpload && uploadSessionId ? (
              <p className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                <ShieldAlert size={13} />
                Allocation session mismatch with latest upload.
              </p>
            ) : null}
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-700"
              onClick={() => historyQuery.refetch()}
            >
              <RefreshCw size={13} />
              Refresh history
            </button>
          </section>
        </aside>

        <div className="space-y-6">
          {renderCurrentStep()}

          <section className="premium-panel rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink-900">Allocation Session History</h3>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
                onClick={() => historyQuery.refetch()}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Created</th>
                    <th className="px-4 py-2 text-left font-semibold">Mode</th>
                    <th className="px-4 py-2 text-left font-semibold">Upload Session</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {(historyQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-ink-500">
                        No allocation sessions yet.
                      </td>
                    </tr>
                  ) : (
                    (historyQuery.data ?? []).map((session) => (
                      <tr key={session.id}>
                        <td className="px-4 py-2 text-ink-700">{new Date(session.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 capitalize text-ink-700">{session.mode}</td>
                        <td className="px-4 py-2 font-mono text-xs text-ink-700">{session.upload_session_id}</td>
                        <td className="px-4 py-2 text-ink-700">{session.status}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                              onClick={async () => {
                                setUploadSessionId(null);
                                setParseResult(null);
                                setParsedPreviewRows([]);
                                setAllocationResult(null);
                                setDocuments(null);
                                setActiveSessionId(session.id);
                                setCurrentStep(5);
                                await loadPreview(session.id);
                              }}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                              onClick={async () => {
                                if (!confirm('Delete generated files for this session?')) {
                                  return;
                                }
                                await deleteDocumentsMutation.mutateAsync(session.id);
                              }}
                              disabled={deleteDocumentsMutation.isPending}
                            >
                              Delete Files
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-4 text-xs text-ink-600">
            <p className="font-semibold text-ink-800">Debug Metrics</p>
            <p className="mt-1">
              parsed_count: <span className="font-mono">{totalStudents}</span> · capacity: <span className="font-mono">{totalCapacity}</span> ·
              allocated_count: <span className="font-mono">{totalAllocatedRows}</span>
            </p>
            <p className="mt-1 font-mono text-[11px]">
              upload_session_id={uploadSessionId ?? 'null'} | active_session_id={activeSessionId ?? 'null'}
            </p>
          </section>
        </div>
      </div>
    </section>
  );
};

export default SeatAllocationPage;
