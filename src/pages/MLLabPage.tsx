import { useMemo, useRef, useState } from 'react';
import { useProspectStore } from '../store/useProspectStore';
import { assessMLReadiness } from '../domain/mlReadiness';
import { extractMLFeaturesForPortfolio } from '../domain/mlFeatures';
import { getMLModelStatus } from '../domain/mlModel';
import { MLReadinessPanel } from '../components/MLLab/MLReadinessPanel';
import { FeatureExtractionPanel } from '../components/MLLab/FeatureExtractionPanel';
import { BaselinePredictionPanel } from '../components/MLLab/BaselinePredictionPanel';
import { DatasetExportPanel } from '../components/MLLab/DatasetExportPanel';
import {
  parseCsvText,
  validateImportedDataset,
  convertImportedRowsToProspects,
  getMinimumTemplateContent,
  getRecommendedTemplateContent,
  type DatasetImportPreview,
} from '../domain/mlDatasetImport';
import { useNorwayAdapter, isNorwayWellboreDataset } from '../hooks/useNorwayAdapter';
import { useMLTraining } from '../hooks/useMLTraining';
import {
  buildTrainingRows,
} from '../domain/mlTrainingFeatures';
import { computeFeatureCorrelations, evaluateBaselineOnLabeledOutcomes } from '../domain/mlEvaluation';
import {
  getDefaultMLTrainingConfig,
  validateTrainingReadinessForModel,
  compareTrainedModelWithExpertGCoS,
} from '../domain/mlTrainingService';
import type { MLClassWeight, MLFeatureMode, MLTrainingTarget } from '../domain/mlTrainingTypes';
import { isKnownOutcome, getOutcomeLabelText } from '../domain/outcomes';
import type { OutcomeLabel } from '../domain/mlTypes';
import { downloadJson, downloadText } from '../utils/exportReport';

const trainingTargetLabel: Record<MLTrainingTarget, string> = {
  hydrocarbon_presence: 'Hydrocarbon Presence',
  geological_success: 'Geological Success',
  commercial_success: 'Commercial Success',
};

const featureModeLabel: Record<MLFeatureMode, string> = {
  safe_pre_drill: 'Safe pre-drill features',
  expert_calibration: 'Expert calibration (adds expert GCoS)',
};

const trainAgreementBadge: Record<string, string> = {
  high: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/40 bg-red-500/15 text-red-300',
};


export function MLLabPage() {
  const { prospects, importProspects } = useProspectStore();
  const readiness = useMemo(() => assessMLReadiness(prospects), [prospects]);
  const features = useMemo(() => extractMLFeaturesForPortfolio(prospects), [prospects]);
  const modelStatus = useMemo(() => getMLModelStatus(), []);

  const prospectsWithOutcomes = useMemo(
    () => prospects.filter((p) => p.outcome && isKnownOutcome(p.outcome)),
    [prospects],
  );

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<DatasetImportPreview | null>(null);
  const [importConfirming, setImportConfirming] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicates: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Norway FactPages adapter (extracted to hook)
  const {
    isNorwayDataset,
    setIsNorwayDataset,
    norwayRawRows,
    setNorwayRawRows,
    norwayDiscoveryRows,
    setNorwayDiscoveryRows,
    norwayReserveRows,
    setNorwayReserveRows,
    norwayDescriptionRows,
    setNorwayDescriptionRows,
    norwayFieldRows,
    setNorwayFieldRows,
    norwayAdapterIssues,
    resetNorwayState,
    handleNorwayEnrichmentFile,
    handleNorwayConvert,
  } = useNorwayAdapter({ setImportPreview, setImportError });

  // Training state (extracted to hook)
  const [trainTarget, setTrainTarget] = useState<MLTrainingTarget>('geological_success');
  const [trainFeatureMode, setTrainFeatureMode] = useState<MLFeatureMode>('safe_pre_drill');
  const [trainRatio, setTrainRatio] = useState(0.8);
  const [trainExcludeSynthetic, setTrainExcludeSynthetic] = useState(true);
  const [trainClassWeight, setTrainClassWeight] = useState<MLClassWeight>('none');

  const trainingConfig = useMemo(
    () => ({
      ...getDefaultMLTrainingConfig(),
      target: trainTarget,
      featureMode: trainFeatureMode,
      trainRatio,
      excludeSynthetic: trainExcludeSynthetic,
      classWeight: trainClassWeight,
    }),
    [trainTarget, trainFeatureMode, trainRatio, trainExcludeSynthetic, trainClassWeight],
  );

  const {
    runCV,
    setRunCV,
    cvFolds,
    setCvFolds,
    trainingResult,
    trainingError,
    savedModel,
    handleTrainModel,
    handleSaveModel,
    handleLoadModel,
    handleClearModel,
    handleExportModelJson,
    handleExportMetricsJson,
  } = useMLTraining({ prospects, trainingConfig });

  const trainingPreview = useMemo(() => {
    const { rows, excluded } = buildTrainingRows(prospects, trainingConfig);
    const positives = rows.filter((r) => r.label === 1).length;
    const negatives = rows.length - positives;
    const syntheticExcluded = excluded.filter((e) => /synthetic/i.test(e.reason)).length;
    const readinessWarnings = validateTrainingReadinessForModel(rows, trainingConfig);
    const featureCorrelations = computeFeatureCorrelations(rows).slice(0, 8);
    const baselineCalibration = evaluateBaselineOnLabeledOutcomes(prospects, trainingConfig.target).metrics;
    return {
      labeled: rows.length,
      positives,
      negatives,
      syntheticExcluded,
      readinessWarnings,
      featureCorrelations,
      baselineCalibration,
      canTrain: rows.length >= trainingConfig.minExamples,
    };
  }, [prospects, trainingConfig]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);
    setImportError(null);
    setImportConfirming(false);
    resetNorwayState();
    const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setImportError('File too large — maximum 10 MB. Please split your dataset into smaller files.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const { headers, rows, issues: parseIssues } = parseCsvText(text);
        if (isNorwayWellboreDataset(headers)) {
          setIsNorwayDataset(true);
          setNorwayRawRows(rows);
          setImportPreview(null);
        } else {
          const preview = validateImportedDataset(headers, rows);
          preview.issues.unshift(...parseIssues.filter((i) => !preview.issues.some((pi) => pi.message === i.message)));
          setImportPreview(preview);
        }
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
      <MLReadinessPanel readiness={readiness} prospects={prospects} />

      {/* B. Feature Extraction Preview */}
      <FeatureExtractionPanel features={features} prospects={prospects} />

      {/* C. Baseline Prediction Preview */}
      <BaselinePredictionPanel prospects={prospects} />

      {/* D. Dataset Export */}
      <DatasetExportPanel prospects={prospects} features={features} prospectsWithOutcomes={prospectsWithOutcomes} />

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

      {/* E2. Train Baseline ML Model */}
      <section className="rounded-lg border border-cyan-900/50 bg-slate-900 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-cyan-200">Train Baseline ML Model</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Train a transparent, local logistic-regression model on your labeled historical outcomes.
              This proves the ML workflow end-to-end and lets you compare a trained model against the expert-system GCoS.
            </p>
          </div>
          {savedModel && (
            <span className="mt-2 inline-flex shrink-0 items-center rounded-full border border-emerald-700 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-300">
              Saved model: {trainingTargetLabel[savedModel.target]}
            </span>
          )}
        </div>

        <div className="mt-3 rounded border border-amber-900/40 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-300">
            ⚠ This is a local supervised baseline prototype. It is not a calibrated production model and must not be used as a
            drilling or investment decision by itself. Expert-system GCoS and existing targeting gates remain the source of truth.
          </p>
        </div>

        {/* Controls */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Target</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={trainTarget}
              onChange={(e) => setTrainTarget(e.target.value as MLTrainingTarget)}
            >
              <option value="hydrocarbon_presence">Hydrocarbon presence</option>
              <option value="geological_success">Geological success</option>
              <option value="commercial_success">Commercial success</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Feature mode</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={trainFeatureMode}
              onChange={(e) => setTrainFeatureMode(e.target.value as MLFeatureMode)}
            >
              <option value="safe_pre_drill">Safe pre-drill features</option>
              <option value="expert_calibration">Expert calibration</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Train / test split</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={trainRatio}
              onChange={(e) => setTrainRatio(Number(e.target.value))}
            >
              <option value={0.7}>70 / 30</option>
              <option value={0.8}>80 / 20</option>
              <option value={0.9}>90 / 10</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Class weighting</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={trainClassWeight}
              onChange={(e) => setTrainClassWeight(e.target.value as MLClassWeight)}
            >
              <option value="none">None (uniform)</option>
              <option value="balanced">Balanced (handles imbalance)</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trainExcludeSynthetic}
              onChange={(e) => setTrainExcludeSynthetic(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950"
            />
            <span className="text-sm text-slate-300">Exclude synthetic</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={runCV}
              onChange={(e) => setRunCV(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950"
            />
            <span className="text-sm text-slate-300">Run k-fold cross-validation</span>
          </label>
          {runCV && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Folds:</span>
              <select
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                value={cvFolds}
                onChange={(e) => setCvFolds(Number(e.target.value))}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <span className="text-xs text-slate-500">(slower)</span>
            </label>
          )}
        </div>

        {/* Pre-training readiness */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Labeled examples', String(trainingPreview.labeled)],
            ['Positives', String(trainingPreview.positives)],
            ['Negatives', String(trainingPreview.negatives)],
            ['Synthetic excluded', String(trainingPreview.syntheticExcluded)],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
            </div>
          ))}
        </div>

        {trainingPreview.readinessWarnings.length > 0 && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness Warnings</div>
            <ul className="space-y-1">
              {trainingPreview.readinessWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300">⚠ {w}</li>
              ))}
            </ul>
          </div>
        )}

        {trainingPreview.labeled >= 5 && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Feature Correlations (Exploratory)
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Point-biserial correlation between each feature and the {trainingTargetLabel[trainTarget].toLowerCase()} label
              on the {trainingPreview.labeled} currently-labeled prospects. Exploratory only — not used for feature
              selection or causal claims, and may shift substantially as more outcomes are recorded.
            </p>
            <ul className="space-y-1">
              {trainingPreview.featureCorrelations.map(({ feature, correlation }) => (
                <li key={feature} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{feature}</span>
                  <span className={correlation >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {correlation >= 0 ? '+' : ''}{correlation.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {trainingPreview.baselineCalibration.testSize >= 5 && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Baseline Calibration Report (Experimental)
            </div>
            <p className="mb-2 text-xs text-slate-500">
              How the deterministic baseline formula (not a trained model) scores against the{' '}
              {trainingPreview.baselineCalibration.testSize} prospects with real (non-synthetic){' '}
              {trainingTargetLabel[trainTarget].toLowerCase()} outcomes, at a 0.5 probability threshold.
              Experimental — sample size is small and this does not represent a calibrated, trained model.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Accuracy', trainingPreview.baselineCalibration.accuracy.toFixed(2)],
                ['Brier Score', trainingPreview.baselineCalibration.brierScore.toFixed(3)],
                ['ROC-AUC', trainingPreview.baselineCalibration.rocAUC.toFixed(2)],
                ['Sample Size', String(trainingPreview.baselineCalibration.testSize)],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-slate-800 bg-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`rounded px-4 py-2 text-sm font-medium ${trainingPreview.canTrain ? 'bg-cyan-700 hover:bg-cyan-600' : 'cursor-not-allowed bg-slate-700 text-slate-500'}`}
            onClick={handleTrainModel}
            disabled={!trainingPreview.canTrain}
            title={trainingPreview.canTrain ? undefined : `Need at least ${trainingConfig.minExamples} labeled examples (have ${trainingPreview.labeled}).`}
          >
            Train baseline model
          </button>
          {!trainingPreview.canTrain && (
            <span className="text-xs text-slate-500">
              Need at least {trainingConfig.minExamples} labeled examples to train (have {trainingPreview.labeled}).
            </span>
          )}
        </div>

        {trainingError && (
          <div className="mt-3 rounded border border-red-800 bg-red-950/40 p-3">
            <p className="text-xs text-red-300">⚠ {trainingError}</p>
          </div>
        )}

        {trainingResult && (() => {
          const { model, metrics, warnings, predictions, cvResult } = trainingResult;
          const cm = metrics.confusionMatrix;
          const prospectById = new Map(prospects.map((p) => [p.id, p]));
          const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
          return (
            <div className="mt-5 space-y-4">
              {/* Model metadata */}
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {[
                  ['Model', 'Logistic Regression'],
                  ['Target', trainingTargetLabel[model.target]],
                  ['Feature mode', featureModeLabel[model.featureMode]],
                  ['Train size', String(model.trainingExamples)],
                  ['Test size', String(model.testExamples)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">Trained at {new Date(model.trainedAt).toLocaleString()}</p>

              {/* Metrics */}
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {[
                  ['Accuracy', pct(metrics.accuracy)],
                  ['Precision', pct(metrics.precision)],
                  ['Recall', pct(metrics.recall)],
                  ['F1', metrics.f1.toFixed(3)],
                  ['Brier score', metrics.brierScore.toFixed(3)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-1 text-xl font-semibold text-cyan-200">{value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">ROC-AUC</div>
                  <div className="mt-1 text-xl font-semibold text-cyan-200">{metrics.rocAUC.toFixed(3)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">1.0 = perfect · 0.5 = random</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Optimal Threshold</div>
                  <div className="mt-1 text-xl font-semibold text-cyan-200">{pct(metrics.optimalThreshold)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">F1-maximising classification cutoff</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Convergence</div>
                  <div className={`mt-1 text-sm font-semibold ${model.stoppedEarly ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {model.stoppedEarly ? `Early stop @ iter ${model.finalIteration}` : `Completed ${model.finalIteration} iters`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{model.lossHistory.length} loss samples</div>
                </div>
              </div>

              {/* Confusion matrix */}
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confusion Matrix (test set, threshold {pct(metrics.optimalThreshold)})
                </div>
                <div className="grid max-w-md grid-cols-3 gap-px overflow-hidden rounded border border-slate-800 bg-slate-800 text-center text-xs">
                  <div className="bg-slate-950 p-2 text-slate-600" />
                  <div className="bg-slate-950 p-2 font-medium text-slate-400">Pred +</div>
                  <div className="bg-slate-950 p-2 font-medium text-slate-400">Pred −</div>
                  <div className="bg-slate-950 p-2 font-medium text-slate-400">Actual +</div>
                  <div className="bg-emerald-950/40 p-2 font-semibold text-emerald-300">{cm.truePositive}</div>
                  <div className="bg-red-950/40 p-2 font-semibold text-red-300">{cm.falseNegative}</div>
                  <div className="bg-slate-950 p-2 font-medium text-slate-400">Actual −</div>
                  <div className="bg-red-950/40 p-2 font-semibold text-red-300">{cm.falsePositive}</div>
                  <div className="bg-emerald-950/40 p-2 font-semibold text-emerald-300">{cm.trueNegative}</div>
                </div>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded border border-amber-900/40 bg-amber-950/15 p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">Model Warnings</div>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-300">⚠ {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CV results */}
              {cvResult && (
                <div className="rounded border border-violet-900/40 bg-violet-950/15 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
                    {cvResult.folds}-Fold Cross-Validation (mean ± std)
                  </div>
                  <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    {(['accuracy', 'precision', 'recall', 'f1', 'rocAUC', 'brierScore'] as const).map((key) => (
                      <div key={key} className="rounded border border-slate-800 bg-slate-950 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">{key}</div>
                        <div className="mt-0.5 text-sm font-semibold text-violet-200">
                          {cvResult.meanMetrics[key].toFixed(3)}
                        </div>
                        <div className="text-[10px] text-slate-500">±{cvResult.stdMetrics[key].toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Predictions table */}
              <div className="rounded border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-2">
                  <span className="text-xs font-semibold text-slate-300">Model Predictions ({predictions.length} labeled prospects)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-slate-950/70">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Prospect</th>
                        <th className="px-4 py-3">Outcome</th>
                        <th className="px-4 py-3">Expert GCoS</th>
                        <th className="px-4 py-3">ML Probability</th>
                        <th className="px-4 py-3">Delta</th>
                        <th className="px-4 py-3">Agreement</th>
                        <th className="px-4 py-3">Top + Factor</th>
                        <th className="px-4 py-3">Top − Factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((pred) => {
                        const prospect = prospectById.get(pred.prospectId);
                        if (!prospect) return null;
                        const cmp = compareTrainedModelWithExpertGCoS(model, prospect);
                        const topPos = pred.topFactors.find((f) => f.direction === 'positive');
                        const topNeg = pred.topFactors.find((f) => f.direction === 'negative');
                        return (
                          <tr key={pred.prospectId} className="border-t border-slate-800 align-middle hover:bg-slate-800/35">
                            <td className="px-4 py-3 font-medium text-slate-200">{prospect.name}</td>
                            <td className="px-4 py-3 text-slate-400">{prospect.outcome ? getOutcomeLabelText(prospect.outcome.label) : '—'}</td>
                            <td className="px-4 py-3 text-slate-100">{Math.round(cmp.expertGCoS * 100)}%</td>
                            <td className="px-4 py-3 font-semibold text-cyan-200">{Math.round(cmp.mlProbability * 100)}%</td>
                            <td className="px-4 py-3">
                              <span className={cmp.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                {cmp.delta >= 0 ? '+' : ''}{Math.round(cmp.delta * 100)}pp
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${trainAgreementBadge[cmp.agreement]}`}>
                                {cmp.agreement}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-emerald-400">{topPos ? topPos.feature : '—'}</td>
                            <td className="px-4 py-3 text-xs text-red-400">{topNeg ? topNeg.feature : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Model actions */}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600" onClick={handleSaveModel}>
                  Save model locally
                </button>
                <button type="button" className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800" onClick={handleExportModelJson}>
                  Export model JSON
                </button>
                <button type="button" className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800" onClick={handleExportMetricsJson}>
                  Export metrics JSON
                </button>
              </div>
            </div>
          );
        })()}

        {/* Saved model controls */}
        <div className="mt-5 rounded border border-slate-800 bg-slate-950 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {savedModel ? (
                <>
                  Saved model in browser storage: <span className="text-slate-200">{trainingTargetLabel[savedModel.target]}</span>{' '}
                  · {featureModeLabel[savedModel.featureMode]} · trained {new Date(savedModel.trainedAt).toLocaleDateString()}.
                  It is used for the advisory prediction on each Prospect Detail page.
                </>
              ) : (
                'No trained model is saved in browser storage. Train and save a model to enable the advisory prediction on Prospect Detail pages.'
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800" onClick={handleLoadModel}>
                Load saved model
              </button>
              <button type="button" className="rounded border border-red-800 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/40" onClick={handleClearModel} disabled={!savedModel}>
                Clear saved model
              </button>
            </div>
          </div>
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

        {isNorwayDataset && (
          <div className="mt-4 rounded border border-cyan-700/60 bg-cyan-950/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-cyan-300">Norway FactPages Detected</span>
              <span className="rounded-full bg-cyan-800/50 px-2 py-0.5 text-[11px] text-cyan-200">Sokkeldirektoratet</span>
            </div>
            <p className="mb-2 text-xs text-slate-300">
              This file matches the Norway wellbore exploration export format (wellbore_exploration_all.csv from factpages.sodir.no).
              Optionally upload enrichment files below, then click "Convert using Norway adapter" to map the data to PetroTarget's 28-column import schema.
            </p>
            <p className="mb-3 text-[11px] text-amber-400">
              ⚠ FactPages does not include pre-drill geological scores. All six component scores default to 0.5 and GCoS to 0.015625.
              Outcome labels are derived from the HC content column and discovery/field association. Update scores per prospect after import.
            </p>
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              {([
                ['Discovery dataset', norwayDiscoveryRows, setNorwayDiscoveryRows],
                ['Reserves dataset', norwayReserveRows, setNorwayReserveRows],
                ['Descriptions dataset', norwayDescriptionRows, setNorwayDescriptionRows],
                ['Field dataset', norwayFieldRows, setNorwayFieldRows],
              ] as [string, Record<string, string>[], React.Dispatch<React.SetStateAction<Record<string, string>[]>>][]).map(([label, rows, setter]) => (
                <label
                  key={label}
                  className="flex cursor-pointer items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs hover:bg-slate-800"
                >
                  <span className="shrink-0 text-slate-400">{label}</span>
                  <span className={rows.length ? 'text-emerald-300' : 'text-slate-600'}>
                    {rows.length ? `✓ ${rows.length} rows` : 'Optional'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => handleNorwayEnrichmentFile(e, setter)}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600"
              onClick={handleNorwayConvert}
            >
              Convert using Norway adapter ({norwayRawRows.length} rows)
            </button>
          </div>
        )}

        {norwayAdapterIssues.length > 0 && !isNorwayDataset && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Norway Adapter Messages ({norwayAdapterIssues.length})
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {norwayAdapterIssues.slice(0, 10).map((issue, i) => (
                <div
                  key={i}
                  className={`text-xs ${issue.severity === 'critical' ? 'text-red-300' : issue.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}`}
                >
                  {issue.severity === 'critical' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ'} {issue.message}
                </div>
              ))}
              {norwayAdapterIssues.length > 10 && (
                <div className="text-xs text-slate-600">… and {norwayAdapterIssues.length - 10} more messages</div>
              )}
            </div>
          </div>
        )}

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
