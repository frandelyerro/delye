import {
  createSyntheticTrainingDataset,
  createTrainingDatasetFromOutcomes,
  exportTrainingDatasetAsCsv,
} from '../../domain/mlDataset';
import { getOutcomeLabelText } from '../../domain/outcomes';
import type { MLFeatureVector } from '../../domain/mlTypes';
import type { Prospect } from '../../domain/prospect';
import { downloadJson, downloadText } from '../../utils/exportReport';

interface Props {
  prospects: Prospect[];
  features: MLFeatureVector[];
  prospectsWithOutcomes: Prospect[];
}

export function DatasetExportPanel({ prospects, features, prospectsWithOutcomes }: Props) {
  const hasRealOutcomes = prospectsWithOutcomes.length > 0;

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
  );
}
