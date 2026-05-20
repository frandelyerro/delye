import { useState } from 'react';
import { Prospect } from '../domain/prospect';
import { useProspectStore } from '../store/useProspectStore';
import { getRequiredColumns, parseCsvProspects, parseJsonProspects } from '../utils/csvParser';

const previewColumns: Array<keyof Prospect> = ['name', 'basin', 'block', 'playType', 'commercialScore', 'resourceEstimate'];
const previewColumnLabels: Partial<Record<keyof Prospect, string>> = {
  name: 'Name',
  basin: 'Basin',
  block: 'Block',
  playType: 'Play Type',
  commercialScore: 'Commercial Score',
  resourceEstimate: 'Resource Estimate'
};

export function UploadPage() {
  const [preview, setPreview] = useState<Prospect[]>([]);
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const replaceProspects = useProspectStore((s) => s.replaceProspects);
  // Default behavior is replace; appendProspects is available in the store for future UX modes.

  const onFile = async (file: File) => {
    setSelectedFileName(file.name);
    setSuccessMessage('');
    try {
      const text = await file.text();
      const rows = file.name.endsWith('.json') ? parseJsonProspects(text) : parseCsvProspects(text);
      setPreview(rows);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setPreview([]);
    }
  };

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h1 className="text-2xl font-semibold">Upload prospects</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Import a validated CSV or JSON portfolio. The current MVP replaces the active prospect set on import.
      </p>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Required columns</h2>
          <p className="mt-1 text-xs text-slate-500">CSV headers and JSON keys must include these fields before import.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">
          Select CSV or JSON
          <input type="file" accept=".csv,.json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="sr-only"/>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {getRequiredColumns().map((column) => (
          <span key={column} className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">{column}</span>
        ))}
      </div>
    </section>

    {!selectedFileName && <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">Select a valid CSV or JSON file to preview prospects before importing. Imports replace the current prospect list.</div>}
    {selectedFileName && !error && !preview.length && <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">Selected file: {selectedFileName}</div>}
    {error && <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-200">{error}</div>}
    {successMessage && <div className="rounded-lg border border-green-800 bg-green-950 p-4 text-sm text-green-200">{successMessage}</div>}

    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Preview</h2>
        <span className="text-xs text-slate-500">{preview.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>{previewColumns.map((column) => <th key={column} className="px-4 py-3">{previewColumnLabels[column]}</th>)}</tr>
          </thead>
          <tbody>
            {preview.length ? preview.slice(0, 8).map((p) => (
              <tr key={p.id} className="border-t border-slate-800">
                {previewColumns.map((column) => <td key={column} className="px-4 py-3 text-slate-300">{p[column]}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={previewColumns.length} className="px-4 py-6 text-slate-500">No preview data loaded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    <button disabled={!preview.length} onClick={() => { replaceProspects(preview); setSuccessMessage(`Imported ${preview.length} prospects successfully.`); }} className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">Import prospects</button>
  </div>;
}
