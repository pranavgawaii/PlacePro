import {
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { AlignCenter, AlignLeft, AlignRight, Columns3, GripHorizontal, Type } from 'lucide-react';
import type { AllocationPreviewGroup, TableColumnAlign, TableColumnConfig, TableStyleConfig } from '../types/seat';

interface DocumentPreviewTabsProps {
  groups: AllocationPreviewGroup[];
  columnConfigs?: TableColumnConfig[];
  tableStyle?: TableStyleConfig;
  onColumnConfigsChange?: (next: TableColumnConfig[]) => void;
  onTableStyleChange?: (next: TableStyleConfig) => void;
  onResetColumns?: () => void;
  onResetTableStyle?: () => void;
  onFinalizeLayout?: () => void;
  isLayoutFinalized?: boolean;
}

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: 'seat_no', label: 'Seat No', align: 'left', width: 66, padding_x: 4, padding_y: 4, enabled: true, source: 'system', applies_to: 'both' },
  { key: 'roll_no', label: 'Roll No', align: 'center', width: 76, padding_x: 4, padding_y: 4, enabled: true, source: 'system', applies_to: 'both' },
  { key: 'student_name', label: 'Student Name', align: 'left', width: 176, padding_x: 4, padding_y: 4, enabled: true, source: 'system', applies_to: 'both' },
  { key: 'class_room_no', label: 'Class Room No', align: 'center', width: 114, padding_x: 4, padding_y: 4, enabled: true, source: 'system', applies_to: 'both' },
  { key: 'signature', label: 'Signature', align: 'center', width: 98, padding_x: 4, padding_y: 4, enabled: true, source: 'system', applies_to: 'attendance' },
];
const DEFAULT_TABLE_STYLE: TableStyleConfig = {
  font_size: 10,
  header_font_size: 10.5,
  row_height: 19,
  header_row_height: 20,
  cell_padding_x: 4,
  cell_padding_y: 4,
  line_width: 0.5,
  section_gap: 18,
};

const ALIGN_CLASS: Record<TableColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};
const ALIGN_LABEL: Record<TableColumnAlign, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const columnLetter = (index: number) => {
  let current = index;
  let output = '';
  while (current >= 0) {
    output = String.fromCharCode(65 + (current % 26)) + output;
    current = Math.floor(current / 26) - 1;
  }
  return output;
};

const resolveCellValue = (
  row: AllocationPreviewGroup['rows'][number],
  labName: string,
  columnKey: string,
): string => {
  if (columnKey === 'seat_no') return row.seat_number;
  if (columnKey === 'roll_no') return row.roll_number;
  if (columnKey === 'student_name') return row.student_name;
  if (columnKey === 'class_room_no') return labName;
  if (columnKey === 'signature') return '__________________';
  if (columnKey.startsWith('extra:')) {
    return row.extra_values?.[columnKey.slice(6)] ?? '-';
  }
  return '-';
};

const DocumentPreviewTabs = ({
  groups,
  columnConfigs = [],
  tableStyle = DEFAULT_TABLE_STYLE,
  onColumnConfigsChange,
  onTableStyleChange,
  onResetColumns,
  onResetTableStyle,
  onFinalizeLayout,
  isLayoutFinalized = false,
}: DocumentPreviewTabsProps) => {
  const [tab, setTab] = useState<'seating' | 'attendance'>('seating');
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [hoverColumnKey, setHoverColumnKey] = useState<string | null>(null);

  const effectiveColumns = columnConfigs.length > 0 ? columnConfigs : DEFAULT_COLUMNS;
  const effectiveStyle = { ...DEFAULT_TABLE_STYLE, ...tableStyle };
  const activeColumns = effectiveColumns.filter((column) => {
    if (!column.enabled) {
      return false;
    }
    if (tab === 'seating') {
      return column.applies_to === 'both';
    }
    return true;
  });
  const selectedColumn = useMemo(
    () => effectiveColumns.find((column) => column.key === selectedColumnKey) ?? null,
    [effectiveColumns, selectedColumnKey],
  );

  useEffect(() => {
    if (activeColumns.length === 0) {
      setSelectedColumnKey(null);
      return;
    }
    if (!selectedColumnKey || !activeColumns.some((column) => column.key === selectedColumnKey)) {
      setSelectedColumnKey(activeColumns[0].key);
    }
  }, [activeColumns, selectedColumnKey]);

  const updateColumns = (next: TableColumnConfig[]) => {
    onColumnConfigsChange?.(next);
  };

  const updateColumnByKey = (key: string, patch: Partial<TableColumnConfig>) => {
    updateColumns(effectiveColumns.map((column) => (column.key === key ? { ...column, ...patch } : column)));
  };

  const updateSelectedColumn = (patch: Partial<TableColumnConfig>) => {
    if (!selectedColumn) {
      return;
    }
    updateColumnByKey(selectedColumn.key, patch);
  };

  const reorderColumns = (fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) {
      return;
    }
    const from = effectiveColumns.findIndex((column) => column.key === fromKey);
    const to = effectiveColumns.findIndex((column) => column.key === toKey);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    const next = [...effectiveColumns];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateColumns(next);
  };

  const updateStyle = <K extends keyof TableStyleConfig>(key: K, value: number) => {
    onTableStyleChange?.({ ...effectiveStyle, [key]: value });
  };

  const beginResize = (event: ReactMouseEvent, key: string, startWidth: number) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const width = clamp(Math.round(startWidth + delta), 56, 320);
      updateColumnByKey(key, { width });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onHeaderDragStart = (event: ReactDragEvent, key: string) => {
    setDraggingColumnKey(key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  };

  const onHeaderDrop = (event: ReactDragEvent, targetKey: string) => {
    event.preventDefault();
    const sourceKey = event.dataTransfer.getData('text/plain');
    setDraggingColumnKey(null);
    setHoverColumnKey(null);
    reorderColumns(sourceKey, targetKey);
  };

  return (
    <section className="premium-panel rounded-3xl border border-ink-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-ink-900 brand-heading">Spreadsheet Preview</h3>
          <p className="text-sm text-ink-600">Edit layout directly in-grid. Generated PDF/Excel uses this exact table structure.</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-1 text-sm font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setTab('seating')}
            className={`rounded-lg px-3 py-1.5 ${tab === 'seating' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
          >
            Seating Preview
          </button>
          <button
            type="button"
            onClick={() => setTab('attendance')}
            className={`rounded-lg px-3 py-1.5 ${tab === 'attendance' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
          >
            Attendance Preview
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <span className="inline-flex items-center gap-1"><Type size={12} /> Font</span>
            <input
              type="range"
              min={8}
              max={14}
              step={0.5}
              value={effectiveStyle.font_size}
              onChange={(event) => updateStyle('font_size', clamp(Number(event.target.value), 8, 14))}
              className="w-28 accent-ink-800"
            />
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <span className="inline-flex items-center gap-1"><GripHorizontal size={12} /> Row Height</span>
            <input
              type="range"
              min={14}
              max={40}
              step={1}
              value={effectiveStyle.row_height}
              onChange={(event) => updateStyle('row_height', clamp(Number(event.target.value), 14, 40))}
              className="w-32 accent-ink-800"
            />
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <span className="inline-flex items-center gap-1"><Columns3 size={12} /> Grid Weight</span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={effectiveStyle.line_width}
              onChange={(event) =>
                updateStyle(
                  'line_width',
                  clamp(Number(Number(event.target.value).toFixed(2)), 0.25, 2),
                )
              }
              className="w-28 accent-ink-800"
            />
          </label>
          <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Section Gap
            <input
              type="range"
              min={6}
              max={42}
              step={1}
              value={effectiveStyle.section_gap}
              onChange={(event) => updateStyle('section_gap', clamp(Number(event.target.value), 6, 42))}
              className="w-32 accent-ink-800"
            />
          </label>
          <button type="button" className="ml-auto rounded-md border border-ink-200 px-2 py-1 text-xs" onClick={onResetTableStyle}>Reset Grid</button>
          <button type="button" className="rounded-md border border-ink-200 px-2 py-1 text-xs" onClick={onResetColumns}>Reset Columns</button>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isLayoutFinalized ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isLayoutFinalized ? 'Finalized' : 'Draft'}
          </span>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={onFinalizeLayout}>
            Finalize
          </button>
        </div>

        {selectedColumn ? (
          <div className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50 p-2 sm:grid-cols-12">
            <label className="sm:col-span-4">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Selected Column</span>
              <input
                value={selectedColumn.label}
                onChange={(event) => updateSelectedColumn({ label: event.target.value })}
                className="premium-input w-full px-2 py-1 text-xs"
              />
            </label>
            <div className="sm:col-span-3">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Align</span>
              <div className="flex overflow-hidden rounded-md border border-ink-200">
                <button
                  type="button"
                  className={`flex-1 px-2 py-1 text-xs ${selectedColumn.align === 'left' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600'}`}
                  onClick={() => updateSelectedColumn({ align: 'left' })}
                  title={ALIGN_LABEL.left}
                >
                  <AlignLeft size={12} className="mx-auto" />
                </button>
                <button
                  type="button"
                  className={`flex-1 px-2 py-1 text-xs ${selectedColumn.align === 'center' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600'}`}
                  onClick={() => updateSelectedColumn({ align: 'center' })}
                  title={ALIGN_LABEL.center}
                >
                  <AlignCenter size={12} className="mx-auto" />
                </button>
                <button
                  type="button"
                  className={`flex-1 px-2 py-1 text-xs ${selectedColumn.align === 'right' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600'}`}
                  onClick={() => updateSelectedColumn({ align: 'right' })}
                  title={ALIGN_LABEL.right}
                >
                  <AlignRight size={12} className="mx-auto" />
                </button>
              </div>
            </div>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Padding X</span>
              <input
                type="range"
                min={2}
                max={14}
                step={1}
                value={selectedColumn.padding_x}
                onChange={(event) => updateSelectedColumn({ padding_x: clamp(Number(event.target.value), 2, 14) })}
                className="w-full accent-ink-800"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Padding Y</span>
              <input
                type="range"
                min={2}
                max={14}
                step={1}
                value={selectedColumn.padding_y}
                onChange={(event) => updateSelectedColumn({ padding_y: clamp(Number(event.target.value), 2, 14) })}
                className="w-full accent-ink-800"
              />
            </label>
            <div className="sm:col-span-1 flex items-end">
              <label className="inline-flex items-center gap-1 text-xs text-ink-700">
                <input
                  type="checkbox"
                  checked={selectedColumn.enabled}
                  onChange={(event) => updateSelectedColumn({ enabled: event.target.checked })}
                />
                Show
              </label>
            </div>
            <p className="sm:col-span-12 text-[11px] text-ink-500">
              Mouse controls: drag column edge to resize, drag header to reorder, double-click header to rename.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs text-ink-500">
        <span className="font-semibold text-ink-700">Formula Bar</span> · Layout-only preview (data values are read-only)
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-sm text-ink-600">
          Run allocation to preview documents.
        </p>
      ) : activeColumns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-sm text-ink-600">
          Enable at least one column in table settings to render preview.
        </p>
      ) : (
        <div className="grid gap-4" style={{ rowGap: `${Math.max(10, effectiveStyle.section_gap)}px` }}>
          {groups.map((group) => (
            <div key={group.lab.id} className="overflow-hidden rounded-2xl border border-[#d9e0ea] bg-[#f8fafc]">
              <div className="flex items-center justify-between border-b border-[#d9e0ea] bg-[#eef2f7] px-4 py-2">
                <h4 className="text-sm font-semibold text-ink-900">{group.lab.name}</h4>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-ink-600">{group.rows.length} rows</span>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[760px] table-fixed" style={{ fontSize: `${effectiveStyle.font_size}px` }}>
                  <colgroup>
                    <col style={{ width: '44px' }} />
                    {activeColumns.map((column) => (
                      <col key={`col-${column.key}`} style={{ width: `${column.width}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-[#f3f6fb] text-ink-600">
                      <th
                        className="border-b border-r border-[#d9e0ea] text-center text-[11px] font-semibold"
                        style={{ lineHeight: `${effectiveStyle.header_row_height}px` }}
                      >
                        #
                      </th>
                      {activeColumns.map((column, index) => (
                        <th
                          key={`head-${column.key}`}
                          onClick={() => setSelectedColumnKey(column.key)}
                          onDoubleClick={() => setEditingHeaderKey(column.key)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setHoverColumnKey(column.key);
                          }}
                          onDragLeave={() => setHoverColumnKey((current) => (current === column.key ? null : current))}
                          onDrop={(event) => onHeaderDrop(event, column.key)}
                          draggable
                          onDragStart={(event) => onHeaderDragStart(event, column.key)}
                          onDragEnd={() => {
                            setDraggingColumnKey(null);
                            setHoverColumnKey(null);
                          }}
                          className={`relative border-b border-r border-[#d9e0ea] ${ALIGN_CLASS[column.align]} ${selectedColumnKey === column.key ? 'bg-[#dbeafe]' : ''} ${hoverColumnKey === column.key && draggingColumnKey ? 'ring-1 ring-brand-300' : ''}`}
                          style={{
                            padding: `${column.padding_y ?? effectiveStyle.cell_padding_y}px ${column.padding_x ?? effectiveStyle.cell_padding_x}px`,
                            fontSize: `${effectiveStyle.header_font_size}px`,
                            lineHeight: `${effectiveStyle.header_row_height}px`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="mb-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-400">{columnLetter(index)}</div>
                          {editingHeaderKey === column.key ? (
                            <input
                              autoFocus
                              value={column.label}
                              onChange={(event) =>
                                updateColumns(
                                  effectiveColumns.map((item) =>
                                    item.key === column.key ? { ...item, label: event.target.value } : item,
                                  ),
                                )
                              }
                              onBlur={() => setEditingHeaderKey(null)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  setEditingHeaderKey(null);
                                }
                              }}
                              className="w-full rounded border border-ink-300 px-1 py-0.5 text-xs"
                            />
                          ) : (
                            <span className="inline-flex select-none items-center gap-1">
                              {column.label}
                              <GripHorizontal size={12} className="text-ink-300" />
                            </span>
                          )}
                          <span
                            onMouseDown={(event) => beginResize(event, column.key, column.width)}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                            title="Drag to resize column"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {group.rows.map((row, rowIndex) => (
                      <tr key={`${group.lab.id}-${row.seat_number}`}>
                        <td
                          className="border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-center text-[11px] text-ink-500"
                          style={{ lineHeight: `${effectiveStyle.row_height}px` }}
                        >
                          {rowIndex + 1}
                        </td>
                        {activeColumns.map((column) => (
                          <td
                            key={`${group.lab.id}-${row.seat_number}-${column.key}`}
                            className={`border-b border-r border-[#e2e8f0] text-ink-700 ${column.key === 'seat_no' ? 'font-medium text-ink-900' : ''} ${ALIGN_CLASS[column.align]}`}
                            style={{
                              padding: `${column.padding_y ?? effectiveStyle.cell_padding_y}px ${column.padding_x ?? effectiveStyle.cell_padding_x}px`,
                              lineHeight: `${effectiveStyle.row_height}px`,
                              borderBottomWidth: `${effectiveStyle.line_width}px`,
                            }}
                          >
                            {resolveCellValue(row, group.lab.name, column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default DocumentPreviewTabs;
