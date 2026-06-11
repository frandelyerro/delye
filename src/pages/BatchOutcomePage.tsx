import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProspectStore } from '../store/useProspectStore';
import { assessMLReadiness } from '../domain/mlReadiness';
import { getOutcomeLabelText } from '../domain/outcomes';
import type { OutcomeLabel, ProspectOutcome } from '../domain/outcomes';
import type { Prospect } from '../domain/prospect';
import { safeGcos } from '../utils/numberUtils';

const OUTCOME_LABELS: OutcomeLabel[] = [
  'unknown',
  'commercial_discovery',
  'technical_discovery',
  'non_commercial',
  'dry_hole',
];

const CONFIDENCE_LEVELS: ProspectOutcome['resultConfidence'][] = ['high', 'medium', 'low'];

const READINESS_BADGE: Record<string, string> = {
  not_ready: 'bg-red-900 text-red-300',
  partial: 'bg-amber-900 text-amber-300',
  ready_for_baseline: 'bg-sky-900 text-sky-300',
  ready_for_training: 'bg-emerald-900 text-emerald-300',
};

const READINESS_LABEL: Record<string, string> = {
  not_ready: 'Not Ready',
  partial: 'Partial',
  ready_for_baseline: 'Ready for Baseline',
  ready_for_training: 'Ready for Training',
};

type PendingEdit = { label: OutcomeLabel; resultConfidence: ProspectOutcome['resultConfidence'] };

const selectClass = 'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs';

export function BatchOutcomePage() {
  const prospects = useProspectStore((s) => s.prospects);
  const batchUpdateOutcomes = useProspectStore((s) => s.batchUpdateOutcomes);
  const [basinFilter, setBasinFilter] = useState('');
  const [unlabeledOnly, setUnlabeledOnly] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingEdit>>({});
  const [bulkLabel, setBulkLabel] = useState<OutcomeLabel>('dry_hole');
  const [bulkConfidence, setBulkConfidence] = useState<ProspectOutcome['resultConfidence']>('medium');
  const [savedMessage, setSavedMessage] = useState('');

  const basins = useMemo(() => [...new Set(prospects.map((p) => p.basin))].sort(), [prospects]);
  const readiness = useMemo(() => assessMLReadiness(prospects), [prospects]);

  const filtered = useMemo(
    () =>
      prospects.filter((p) => {
        if (basinFilter && p.basin !== basinFilter) return false;
        if (unlabeledOnly && p.outcome && p.outcome.label !== 'unknown') return false;
        return true;
      }),
    [prospects, basinFilter, unlabeledOnly],
  );

  const setEdit = (id: string, patch: Partial<PendingEdit>, current: Prospect) => {
    setSavedMessage('');
    setPending((prev) => {
      const base: PendingEdit = prev[id] ?? {
        label: current.outcome?.label ?? 'unknown',
        resultConfidence: current.outcome?.resultConfidence ?? 'medium',
      };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const applyBulk = () => {
    setSavedMessage('');
    setPending((prev) => {
      const next = { ...prev };
      for (const p of filtered) {
        next[p.id] = { label: bulkLabel, resultConfidence: bulkConfidence };
      }
      return next;
    });
  };

  const pendingCount = Object.keys(pending).length;

  const handleSave = () => {
    const updates = Object.entries(pending).map(([id, edit]) => {
      const existing = prospects.find((p) => p.id === id)?.outcome;
      const outcome: ProspectOutcome = {
        label: edit.label,
        targetVariable: existing?.targetVariable ?? 'geological_success',
        resultConfidence: edit.resultConfidence,
        source: 'manual',
        ...(existing?.wellName ? { wellName: existing.wellName } : {}),
        ...(existing?.drillYear ? { drillYear: existing.drillYear } : {}),
        ...(existing?.operator ? { operator: existing.operator } : {}),
        ...(existing?.notes ? { notes: existing.notes } : {}),
      };
      return { id, outcome };
    });
    batchUpdateOutcomes(updates);
    setSavedMessage(`Saved ${updates.length} outcome${updates.length === 1 ? '' : 's'}.`);
    setPending({});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batch Outcome Labeling</h1>
        <p className="text-slate-400 text-sm mt-1">
          Record drilling outcomes across the portfolio to build the labeled dataset ML training requires.
        </p>
      </div>

      {/* ML readiness summary */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">ML Readiness</h2>
            <p className="text-xs text-slate-500 mt-1">
              {readiness.labeledExamples} of {readiness.totalProspects} prospects have a recorded outcome ·{' '}
              {readiness.knownSuccessFailureCount} known success/failure.
            </p>
          </div>
          <span className={`rounded px-2 py-1 text-xs font-medium ${READINESS_BADGE[readiness.status] ?? ''}`}>
            {READINESS_LABEL[readiness.status] ?? readiness.status} · {readiness.readinessScore}%
          </span>
        </div>
        {readiness.missingRequirements.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-500 list-disc list-inside">
            {readiness.missingRequirements.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      {prospects.length === 0 ? (
        <p className="text-slate-500 text-sm">
          No prospects yet.{' '}
          <Link to="/prospects/new" className="text-sky-400 underline">
            Add one
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Filters + bulk action */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Basin</label>
              <select
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={basinFilter}
                onChange={(e) => setBasinFilter(e.target.value)}
              >
                <option value="">All basins</option>
                {basins.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
              <input
                type="checkbox"
                checked={unlabeledOnly}
                onChange={(e) => setUnlabeledOnly(e.target.checked)}
              />
              Unlabeled only
            </label>

            <div className="ml-auto flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bulk label</label>
                <select
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={bulkLabel}
                  onChange={(e) => setBulkLabel(e.target.value as OutcomeLabel)}
                >
                  {OUTCOME_LABELS.map((l) => (
                    <option key={l} value={l}>
                      {getOutcomeLabelText(l)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Confidence</label>
                <select
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={bulkConfidence}
                  onChange={(e) => setBulkConfidence(e.target.value as ProspectOutcome['resultConfidence'])}
                >
                  {CONFIDENCE_LEVELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={applyBulk}
                disabled={filtered.length === 0}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-sky-500 disabled:opacity-40"
              >
                Apply to {filtered.length} visible
              </button>
            </div>
          </div>

          {/* Table */}
          <section className="rounded-lg border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Prospects ({filtered.length})
              </h2>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No prospects match the current filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-950/70">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Prospect</th>
                      <th className="px-4 py-3">Basin</th>
                      <th className="px-4 py-3">Play Type</th>
                      <th className="px-4 py-3">GCoS %</th>
                      <th className="px-4 py-3">Current Outcome</th>
                      <th className="px-4 py-3">New Label</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const edit = pending[p.id];
                      return (
                        <tr key={p.id} className="border-t border-slate-800 align-top hover:bg-slate-800/35">
                          <td className="px-4 py-3">
                            <Link to={`/prospects/${p.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">
                              {p.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{p.basin}</td>
                          <td className="px-4 py-3 text-slate-300">{p.playType}</td>
                          <td className="px-4 py-3 font-semibold text-slate-100">{Math.round(safeGcos(p) * 100)}%</td>
                          <td className="px-4 py-3 text-slate-400">
                            {p.outcome ? getOutcomeLabelText(p.outcome.label) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className={selectClass}
                              value={edit?.label ?? p.outcome?.label ?? 'unknown'}
                              onChange={(e) => setEdit(p.id, { label: e.target.value as OutcomeLabel }, p)}
                            >
                              {OUTCOME_LABELS.map((l) => (
                                <option key={l} value={l}>
                                  {getOutcomeLabelText(l)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className={selectClass}
                              value={edit?.resultConfidence ?? p.outcome?.resultConfidence ?? 'medium'}
                              onChange={(e) =>
                                setEdit(p.id, { resultConfidence: e.target.value as ProspectOutcome['resultConfidence'] }, p)
                              }
                            >
                              {CONFIDENCE_LEVELS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {edit && (
                              <span
                                className="inline-block h-2 w-2 rounded-full bg-amber-400"
                                title="Unsaved change"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Save bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={pendingCount === 0}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save {pendingCount} change{pendingCount === 1 ? '' : 's'}
            </button>
            {pendingCount > 0 && (
              <button
                onClick={() => {
                  setPending({});
                  setSavedMessage('');
                }}
                className="text-sm text-slate-400 hover:text-slate-200 underline"
              >
                Discard changes
              </button>
            )}
            {savedMessage && <span className="text-sm text-emerald-400">{savedMessage}</span>}
          </div>
        </>
      )}
    </div>
  );
}
