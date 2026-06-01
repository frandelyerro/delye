import { useRef, useState } from 'react';
import { useProspectStore } from '../store/useProspectStore';
import { assessMLReadiness } from '../domain/mlReadiness';
import { extractMLFeaturesForPortfolio } from '../domain/mlFeatures';
import { compareExpertAndML, getMLModelStatus, predictWithBaselineModel } from '../domain/mlModel';
import {
  createSyntheticTrainingDataset,
  createTrainingDatasetFromOutcomes,
  exportTrainingDatasetAsCsv,
  exportTrainingDatasetAsJson,
} from '../domain/mlDataset';
import {
  parseCsvText,
  validateImportedDataset,
  convertImportedRowsToProspects,
  getMinimumTemplateContent,
  getRecommendedTemplateContent,
  type DatasetImportPreview,
} from '../domain/mlDatasetImport';
import { isKnownOutcome, getOutcomeLabelText } from '../domain/outcomes';
import type { OutcomeLabel } from '../domain/mlTypes';
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
  const { prospects, importProspects } = useProspectStore();
  const readiness = assessMLReadiness(prospects);
  const features = extractMLFeaturesForPortfolio(prospects);
  const modelStatus = getMLModelStatus();

  const prospectsWithOutcomes = prospects.filter((p) => p.outcome && isKnownOutcome(p.outcome));
  const hasRealOutcomes = prospectsWithOutcomes.length > 0;

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<DatasetImportPreview | null>(null);
  const [importConfirming, setImportConfirming] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicates: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);
    setImportError(null);
    setImportConfirming(false);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const { headers, rows, issues: parseIssues } = parseCsvText(text);
        const preview = validateImportedDataset(headers, rows);
        preview.issues.unshift(...parseIssues.filter((i) => !preview.issues.some((pi) => pi.message === i.message)));
        setImportPreview(preview);
      } catch (err) {
        setImportError((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (!importPreview) return;
    const allRows = importPreview.rows;
    const { prospects: converted, issues } = convertImportedRowsToProspects(allRows);
    if (issues.some((i) => i.severity === 'critical')) {
      setImportError(`Import failed: ${issues.filter((i) => i.severity === 'critical').map((i) => i.message).join('; ')}`);
      return;
    }
    const result = importProspects(converted);
    setImportResult(result);
    setImportConfirming(false);
  };

  const handleExportFeaturesJson = () => {
    downloadJson('ml-features.json', features);
  };

  const handleExportRealJson = () => {
    const dataset = createTrainingDatasetFromOutcomes(prospects);
    downloadJson('ml-real-training-dataset.json', dataset);
  };

  const handleExportRealCsv = () => {
    const dataset = createTrainingDatasetFromOutcomes(prospects);
    const csv = exportTrainingDatasetAsCsv(dataset);
    downloadText('ml-real-training-dataset.csv', csv);
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
          Export feature vectors and training examples for offline inspection or future training pipeline setup.
        </p>

        {hasRealOutcomes ? (
          <div className="mt-3 rounded border border-emerald-900/40 bg-emerald-950/15 p-3">
            <p className="text-xs text-emerald-300 font-medium mb-2">
              ✓ {prospectsWithOutcomes.length} prospect{prospectsWithOutcomes.length > 1 ? 's' : ''} with real historical outcomes available for export.
            </p>
            <div className="flex flex-wrap gap-2">
              {(['commercial_discovery', 'technical_discovery', 'dry_hole', 'non_commercial'] as const).map((label) => {
                const count = prospectsWithOutcomes.filter((p) => p.outcome?.label === label).length;
                return count > 0 ? (
                  <span key={label} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {getOutcomeLabelText(label)}: {count}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-slate-700 bg-slate-800/40 p-3">
            <p className="text-xs text-slate-400">
              No real historical outcomes recorded yet. Add well outcomes in the Edit Prospect form to build a real training dataset.
              Only synthetic labels (derived from expert scores) are available for export.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Real Historical Outcomes</p>
            <div className="flex flex-wrap gap-3">
              <button
                className={`rounded px-4 py-2 text-sm font-medium ${hasRealOutcomes ? 'bg-emerald-700 hover:bg-emerald-600' : 'cursor-not-allowed bg-slate-700 text-slate-500'}`}
                onClick={handleExportRealJson}
                type="button"
                disabled={!hasRealOutcomes}
                title={hasRealOutcomes ? undefined : 'No real historical outcomes recorded yet'}
              >
                Export Real Training Dataset JSON
              </button>
              <button
                className={`rounded border px-4 py-2 text-sm font-medium ${hasRealOutcomes ? 'border-emerald-700 text-emerald-200 hover:bg-emerald-950' : 'cursor-not-allowed border-slate-700 text-slate-500'}`}
                onClick={handleExportRealCsv}
                type="button"
                disabled={!hasRealOutcomes}
                title={hasRealOutcomes ? undefined : 'No real historical outcomes recorded yet'}
              >
                Export Real Training Dataset CSV
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Synthetic Labels (Development Only)</p>
            <div className="flex flex-wrap gap-3">
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
            <p className="mt-2 text-xs text-amber-600">
              ⚠ Synthetic labels are derived from expert scores and are <strong>development-only</strong> — not suitable for real ML claims or investment decisions.
            </p>
          </div>
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

      {/* F. Import Historical Dataset */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Import Historical Dataset</h2>
            <p className="mt-1 text-sm text-slate-400">
              Upload a CSV file with real historical well outcomes to build a supervised ML training dataset.
              The tool validates your file, flags issues, and lets you import valid rows into the portfolio.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              onClick={() => downloadText('ml-dataset-template-minimum.csv', getMinimumTemplateContent())}
            >
              Download Minimum Template
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              onClick={() => downloadText('ml-dataset-template-recommended.csv', getRecommendedTemplateContent())}
            >
              Download Recommended Template
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">
            <span>Select CSV file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {importFileName && (
            <span className="ml-3 text-sm text-slate-300">{importFileName}</span>
          )}
        </div>

        {importError && (
          <div className="mt-3 rounded border border-red-800 bg-red-950/40 p-3">
            <p className="text-xs text-red-300">⚠ {importError}</p>
          </div>
        )}

        {importResult && (
          <div className="mt-3 rounded border border-emerald-800/50 bg-emerald-950/30 p-3">
            <p className="text-xs text-emerald-300 font-medium">
              ✓ Import complete: {importResult.imported} prospect{importResult.imported !== 1 ? 's' : ''} imported.
              {importResult.skippedDuplicates > 0 && ` ${importResult.skippedDuplicates} skipped (duplicate ID).`}
            </p>
          </div>
        )}

        {importPreview && (() => {
          const { readiness: dr, issues, rowCount, rows, headers } = importPreview;
          const criticals = issues.filter((i) => i.severity === 'critical');
          const warnings = issues.filter((i) => i.severity === 'warning');
          const outcomeCounts: Record<OutcomeLabel, number> = {
            commercial_discovery: 0, technical_discovery: 0,
            dry_hole: 0, non_commercial: 0, unknown: 0,
          };
          for (const row of rows) {
            const l = row['outcome_label']?.trim().toLowerCase() as OutcomeLabel;
            if (l && l in outcomeCounts) outcomeCounts[l]++;
          }

          return (
            <div className="mt-4 space-y-4">
              {/* Summary */}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ['Rows', String(rowCount)],
                  ['Columns', String(headers.length)],
                  ['Valid Rows', String(dr.validRows)],
                  ['Labeled Rows', String(dr.labeledRows)],
                  ['Critical Issues', String(dr.criticalIssues)],
                  ['Warnings', String(dr.warnings)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                    <div className={`mt-1 text-xl font-semibold ${label === 'Critical Issues' && dr.criticalIssues > 0 ? 'text-red-300' : label === 'Warnings' && dr.warnings > 0 ? 'text-amber-300' : 'text-slate-100'}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Readiness + outcomes */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Outcome Distribution (preview rows)</div>
                  <div className="space-y-1">
                    {(Object.entries(outcomeCounts) as [OutcomeLabel, number][]).map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{getOutcomeLabelText(label)}</span>
                        <span className={count > 0 ? 'font-medium text-slate-200' : 'text-slate-600'}>{count}</span>
                      </div>
                    ))}
                    {dr.syntheticRows > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400">Synthetic rows</span>
                        <span className="font-medium text-amber-200">{dr.syntheticRows}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Import Readiness</div>
                  <div className={`text-2xl font-semibold ${dr.readinessScore >= 70 ? 'text-emerald-300' : dr.readinessScore >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                    {dr.readinessScore}/100
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {dr.canImport ? `${dr.validRows} valid row${dr.validRows !== 1 ? 's' : ''} can be imported.` : 'Fix critical issues before importing.'}
                  </div>
                </div>
              </div>

              {/* Issues */}
              {issues.length > 0 && (
                <div className="rounded border border-slate-700 bg-slate-950 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Validation Issues ({issues.length})
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {criticals.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-red-400 mt-1">Critical ({criticals.length})</div>
                        {criticals.slice(0, 20).map((issue, i) => (
                          <div key={i} className="text-xs text-red-300">✗ {issue.message}</div>
                        ))}
                        {criticals.length > 20 && <div className="text-xs text-red-500">… and {criticals.length - 20} more critical issues</div>}
                      </>
                    )}
                    {warnings.length > 0 && (
                      <>
                        <div className="text-xs font-medium text-amber-400 mt-2">Warnings ({warnings.length})</div>
                        {warnings.slice(0, 10).map((issue, i) => (
                          <div key={i} className="text-xs text-amber-300">⚠ {issue.message}</div>
                        ))}
                        {warnings.length > 10 && <div className="text-xs text-amber-500">… and {warnings.length - 10} more warnings</div>}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && (
                <div className="rounded border border-slate-800 bg-slate-900">
                  <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Row Preview (first {rows.length} of {rowCount})</span>
                    <span className="text-xs text-slate-500">{headers.length} columns</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-950/70">
                        <tr>
                          {headers.slice(0, 8).map((h) => (
                            <th key={h} className="px-3 py-2 text-left uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                          {headers.length > 8 && <th className="px-3 py-2 text-slate-600">+{headers.length - 8} more</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                            {headers.slice(0, 8).map((h) => (
                              <td key={h} className="px-3 py-1.5 text-slate-300 whitespace-nowrap max-w-[120px] truncate" title={row[h]}>
                                {row[h] ?? ''}
                              </td>
                            ))}
                            {headers.length > 8 && <td className="px-3 py-1.5 text-slate-600">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {dr.canImport && !importResult && (
                  importConfirming ? (
                    <>
                      <span className="text-xs text-slate-300">Import {dr.validRows} valid row{dr.validRows !== 1 ? 's' : ''} into portfolio?</span>
                      <button
                        type="button"
                        className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600"
                        onClick={handleImportConfirm}
                      >
                        Confirm import
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        onClick={() => setImportConfirming(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600"
                      onClick={() => setImportConfirming(true)}
                    >
                      Import valid rows into portfolio
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                  onClick={() => downloadJson('ml-import-preview.json', importPreview)}
                >
                  Export cleaned JSON
                </button>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
