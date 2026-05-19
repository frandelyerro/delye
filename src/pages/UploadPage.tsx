import { useState } from 'react';
import { Prospect } from '../domain/prospect';
import { useProspectStore } from '../store/useProspectStore';
import { getRequiredColumns, parseCsvProspects, parseJsonProspects } from '../utils/csvParser';

export function UploadPage() {
  const [preview, setPreview] = useState<Prospect[]>([]);
  const [error, setError] = useState('');
  const replaceProspects = useProspectStore((s) => s.replaceProspects);
  // Default behavior is replace; appendProspects is available in the store for future UX modes.

  const onFile = async (file: File) => {
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

  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Upload prospects</h2>
    <p className="text-sm text-slate-400">Required columns: {getRequiredColumns().join(', ')}</p>
    <input type="file" accept=".csv,.json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block"/>
    {error && <div className="text-red-400 text-sm">{error}</div>}
    <div className="bg-slate-900 border border-slate-800 rounded p-3 text-sm max-h-72 overflow-auto">Preview rows: {preview.length}
      {preview.slice(0, 5).map((p) => <div key={p.id} className="border-t border-slate-800 mt-2 pt-2">{p.name} - {p.basin} - {p.block}</div>)}
    </div>
    <button disabled={!preview.length} onClick={() => replaceProspects(preview)} className="bg-cyan-700 disabled:opacity-50 rounded px-4 py-2">Import prospects</button>
  </div>;
}
