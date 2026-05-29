import { useProspectStore } from '../store/useProspectStore';
import { assessMLReadiness } from '../domain/mlReadiness';
import { extractMLFeaturesForPortfolio } from '../domain/mlFeatures';
import { compareExpertAndML, getMLModelStatus, predictWithBaselineModel } from '../domain/mlModel';
import { createSyntheticTrainingDataset, exportTrainingDatasetAsCsv, exportTrainingDatasetAsJson } from '../domain/mlDataset';
import { downloadJson, downloadText } from '../utils/exportReport';

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

const agreementBadge: Record<string, string> = {
  high: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/40 bg-red-500/15 text-red-300',
};

export function MLLabPage() {
  const { prospects } = useProspectStore();
  const readiness = assessMLReadiness(prospects);
  const features = extractMLFeaturesForPortfolio(prospects);
  const modelStatus = getMLModelStatus();

  const handleExportFeaturesJson = () => {
    downloadJson('ml-features.json', features);
  };

  const handleExportSyntheticJson = () => {
    const dataset = createSyntheticTrainingDataset(prospects);
    downloadJson('ml-synthetic-training-dataset.json', dataset);
  };

  const handleExportSyntheticCsv = () => {
    const dataset = createSyntheticTrainingDataset(prospects);
    const csv = exportTrainingDatasetAsCsv(dataset);
    downloadText('ml-synthetic-training-dataset.csv', csv);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ML Foundation</p>
            <h1 className="mt-2 text-2xl font-semibold">ML Lab</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Feature extraction, baseline model preview, and dataset export for future ML training.
              No trained ML model is connected — all predictions are deterministic baselines for development only.
            </p>
          </div>
          <span className="mt-2 inline-flex shrink-0 items-center rounded-full border border-amber-700 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-300">
            No ML Model Connected
          </span>
        </div>
      </section>

      {/* A. ML Readiness */}
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

      {/* B. Feature Extraction Preview */}
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

      {/* C. Baseline Prediction Preview */}
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

      {/* D. Dataset Export */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Dataset Export</h2>
        <p className="mt-1 text-sm text-slate-400">
          Export feature vectors and synthetic training examples for offline inspection or future training pipeline setup.
          Synthetic labels are derived from expert scores and are <strong className="text-amber-300">development-only</strong> — not suitable for real ML claims.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600"
            onClick={handleExportFeaturesJson}
            type="button"
          >
            Export ML Features JSON
          </button>
          <button
            className="rounded border border-cyan-700 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950"
            onClick={handleExportSyntheticJson}
            type="button"
          >
            Export Synthetic Training Dataset JSON
          </button>
          <button
            className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            onClick={handleExportSyntheticCsv}
            type="button"
          >
            Export Synthetic Training Dataset CSV
          </button>
        </div>
      </section>

      {/* E. Model Status */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Model Status</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600" />
                <span className="text-sm font-medium text-slate-400">No trained model connected</span>
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Model Name</div>
              <div className="mt-2 text-sm text-slate-300">{modelStatus.modelName}</div>
            </div>
          </div>
          <div className="rounded border border-slate-700 bg-slate-950 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Limitations</div>
            <ul className="space-y-1.5">
              {modelStatus.limitations.map((l, i) => (
                <li key={i} className="text-xs text-slate-400">• {l}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded border border-amber-900/40 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-300">
            To connect a trained ML model: collect labeled historical well outcome data, export features via the Dataset Export section, train a classifier offline, and integrate the inference endpoint in <code className="text-amber-200">src/domain/mlModel.ts</code>.
            See <code className="text-amber-200">docs/ml-core.md</code> for the training roadmap.
          </p>
        </div>
      </section>
    </div>
  );
}
