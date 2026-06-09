import type { Prospect } from '../../domain/prospect';
import type { MLFeatureVector } from '../../domain/mlTypes';

interface Props {
  features: MLFeatureVector[];
  prospects: Prospect[];
}

export function FeatureExtractionPanel({ features, prospects }: Props) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Feature Extraction Preview</h2>
        <span className="text-xs text-slate-500">{features.length} feature vectors</span>
      </div>
      {prospects.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-950/70">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Basin</th>
                <th className="px-4 py-3">GCoS Expert</th>
                <th className="px-4 py-3">Data Conf.</th>
                <th className="px-4 py-3">Evid. Completeness</th>
                <th className="px-4 py-3">Main Risk (flagged)</th>
                <th className="px-4 py-3">Risked Res. (MMboe)</th>
                <th className="px-4 py-3">Simple EMV ($M)</th>
                <th className="px-4 py-3">Tier #</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p, i) => {
                const fv = features[i];
                const mainRiskKey = (Object.entries({
                  source: fv.mainRisk_source,
                  migration: fv.mainRisk_migration,
                  reservoir: fv.mainRisk_reservoir,
                  seal: fv.mainRisk_seal,
                  trap: fv.mainRisk_trap,
                  timing: fv.mainRisk_timing,
                }).find(([, v]) => v === 1)?.[0]) ?? '—';
                return (
                  <tr key={p.id} className="border-t border-slate-800 align-middle hover:bg-slate-800/35">
                    <td className="px-4 py-3 font-medium text-slate-200">{p.name}</td>
                    <td className="px-4 py-3 text-slate-400">{fv.basin}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{Math.round(fv.gcosExpert * 100)}%</td>
                    <td className="px-4 py-3 text-slate-300">{fv.dataConfidence}/100</td>
                    <td className="px-4 py-3 text-slate-300">{(fv.evidenceCompleteness * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{mainRiskKey}</td>
                    <td className="px-4 py-3 text-slate-300">{fv.riskedResource.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <span className={fv.simpleEMV >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        ${fv.simpleEMV.toFixed(0)}M
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{fv.prospectivityTierNumeric}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-sm text-slate-500">No prospects available.</p>
      )}
    </section>
  );
}
