import type { Prospect } from '../../domain/prospect';
import type { MLReadinessResult } from '../../domain/mlReadiness';

const statusBadge: Record<string, string> = {
  not_ready: 'border-red-500/40 bg-red-500/15 text-red-300',
  partial: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  ready_for_baseline: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  ready_for_training: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
};

const statusLabel: Record<string, string> = {
  not_ready: 'Not Ready',
  partial: 'Partial',
  ready_for_baseline: 'Ready for Baseline',
  ready_for_training: 'Ready for Training',
};

interface Props {
  readiness: MLReadinessResult;
  prospects: Prospect[];
}

export function MLReadinessPanel({ readiness }: Props) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">ML Readiness</h2>
      <p className="mt-1 text-xs text-slate-400">Assessment of portfolio data quality for ML training readiness.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Readiness Score</div>
          <div className="mt-2 text-3xl font-semibold text-slate-50">{readiness.readinessScore}/100</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge[readiness.status]}`}>
            {statusLabel[readiness.status]}
          </span>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Prospects</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">{readiness.totalProspects}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Evidence-Derived</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">{readiness.evidenceDerivedCount}</div>
          <div className="text-xs text-slate-500 mt-1">of {readiness.totalProspects} total</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Labeled Examples</div>
          <div className={`mt-2 text-2xl font-semibold ${readiness.labeledExamples > 0 ? 'text-emerald-300' : 'text-slate-50'}`}>{readiness.labeledExamples}</div>
          <div className="text-xs text-slate-500 mt-1">real historical outcomes</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Known Success/Failure</div>
          <div className={`mt-2 text-2xl font-semibold ${readiness.knownSuccessFailureCount > 0 ? 'text-emerald-300' : 'text-slate-50'}`}>{readiness.knownSuccessFailureCount}</div>
          <div className="text-xs text-slate-500 mt-1">discoveries + dry holes</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-700 bg-slate-950 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Missing Requirements</div>
          {readiness.missingRequirements.length ? (
            <ul className="space-y-1">
              {readiness.missingRequirements.map((r, i) => (
                <li key={i} className="text-xs text-red-300">✗ {r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-400">All requirements met.</p>
          )}
        </div>
        <div className="rounded border border-slate-700 bg-slate-950 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</div>
          <ul className="space-y-1">
            {readiness.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-slate-300">→ {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
