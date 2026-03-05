import { useEffect, useState } from 'react';
import type { DocumentSettings } from '../types/seat';

interface DocumentSettingsFormProps {
  value: DocumentSettings | null;
  onSave: (payload: {
    exam_title?: string;
    subject?: string;
    footer_text?: string | null;
  }) => Promise<unknown>;
  saving?: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const normalizeDateInput = (value?: string | null): string => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return todayISO();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return todayISO();
  }

  return parsed.toISOString().slice(0, 10);
};

const DocumentSettingsForm = ({ value, onSave, saving }: DocumentSettingsFormProps) => {
  const [examTitle, setExamTitle] = useState(value?.exam_title ?? 'Magic Solution Drive');
  const [documentDate, setDocumentDate] = useState(normalizeDateInput(value?.subject));
  const [footerText, setFooterText] = useState(value?.footer_text ?? 'MIT ADT University');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      return;
    }

    setExamTitle(value.exam_title);
    setDocumentDate(normalizeDateInput(value.subject));
    setFooterText(value.footer_text ?? '');
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      await onSave({
        exam_title: examTitle.trim(),
        subject: documentDate.trim(),
        footer_text: footerText.trim(),
      });
    } catch (saveError) {
      setError((saveError as Error).message);
    }
  };

  return (
    <section className="premium-panel rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-ink-900 brand-heading">Document Branding</h3>
        <p className="text-sm text-ink-600">Set the centered title shown under the header line in generated PDFs.</p>
      </div>

      <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
        Header text and logo are fixed to MIT ADT format.
      </div>

      <div className="grid gap-3">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Drive / Exam Title</span>
          <input
            value={examTitle}
            onChange={(event) => setExamTitle(event.target.value)}
            placeholder="Magic Solution Drive"
            className="premium-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Document Date</span>
          <input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
            className="premium-input w-full px-3 py-2 text-sm"
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Footer Text</span>
          <input
            value={footerText}
            onChange={(event) => setFooterText(event.target.value)}
            className="premium-input w-full px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button type="button" className="btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Branding'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
};

export default DocumentSettingsForm;
