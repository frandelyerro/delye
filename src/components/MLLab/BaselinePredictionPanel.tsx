import { compareExpertAndML } from '../../domain/mlModel';
import type { Prospect } from '../../domain/prospect';

const agreementBadge: Record<string, string> = {
  high: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/40 bg-red-500/15 text-red-300',
};

interface Props {
  prospects: Prospect[];
}

export function BaselinePredictionPanel({ prospects }: Props) {
  return (
    <section className="rounded-lg border border-amber-900/50 bg-slate-900">
      <div className="border-b border-amber-900/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-amber-200">Baseline Prediction Preview</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Deterministic weighted formula — not a trained ML model. Expert GCoS is the source of truth.
        </p>
      </div>
      {prospects.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-950/70">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Expert GCoS</th>
                <th className="px-4 py-3">Baseline Predicted</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => {
                const cmp = compareExpertAndML(p);
                return (
                  <tr key={p.id} className="border-t border-slate-800 align-middle hover:bg-slate-800/35">
                    <td className="px-4 py-3 font-medium text-slate-200">{p.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{Math.round(cmp.expertGCoS * 100)}%</td>
                    <td className="px-4 py-3 text-amber-200">{Math.round(cmp.predictedGCoS * 100)}%</td>
                    <td className="px-4 py-3">
                      <span className={cmp.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {cmp.delta >= 0 ? '+' : ''}{Math.round(cmp.delta * 100)}pp
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${agreementBadge[cmp.agreement]}`}>
                        {cmp.agreement}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-sm text-slate-500">No prospects available.</p>
      )}
      <div className="border-t border-amber-900/30 px-4 py-2">
        <p className="text-xs text-amber-700">⚠ No trained ML model is connected yet. Baseline predictions are deterministic and for development only. Do not use for real investment decisions.</p>
      </div>
    </section>
  );
}
