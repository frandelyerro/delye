import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  componentLabels,
  getGCoSFormulaString,
  getGCoSInterpretation,
  getRecommendedNextStep,
  getStrongestComponents,
  getWeakestComponent
} from '../domain/explainability';
import type { ComponentAssessment, EvidenceConfidence } from '../domain/evidence';
import { useProspectStore } from '../store/useProspectStore';
import { exportProspectReport } from '../utils/exportReport';

const priorityBadgeClass = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/30 bg-red-500/15 text-red-200'
};

const riskBadgeClass = {
  source: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  migration: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
  reservoir: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200',
  seal: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
  trap: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
  timing: 'border-orange-500/30 bg-orange-500/15 text-orange-200'
};

const confidenceBadgeClass = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  medium: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  low: 'border-red-500/30 bg-red-500/15 text-red-200',
  unknown: 'border-slate-600 bg-slate-800 text-slate-400'
};

const evidenceScoreBadge = (score: number) => {
  if (score >= 0.70) return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  if (score >= 0.45) return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
  return 'border-red-500/30 bg-red-500/15 text-red-200';
};

export function ProspectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prospect = useProspectStore((s) => s.prospects.find((p) => p.id === id));
  const deleteProspect = useProspectStore((s) => s.deleteProspect);
  if (!prospect) return <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">Prospect not found.</div>;
  const strongestComponents = getStrongestComponents(prospect).map((component) => componentLabels[component]).join(' and ');
  const weakestComponent = componentLabels[getWeakestComponent(prospect)];
  const dataConfidence = prospect.dataConfidence ?? 0;
  const dataConfidenceLevel = dataConfidence >= 75 ? 'high' : dataConfidence >= 50 ? 'medium' : 'low';

  const chartData = [
    { name: 'source', value: prospect.sourceScore },
    { name: 'migration', value: prospect.migrationScore },
    { name: 'reservoir', value: prospect.reservoirScore },
    { name: 'seal', value: prospect.sealScore },
    { name: 'trap', value: prospect.trapScore },
    { name: 'timing', value: prospect.timingScore }
  ];
  const primaryMetrics = [
    ['GCoS', `${Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100)}%`],
    ['Commercial Score', `${prospect.commercialScore}/100`],
    ['Resource Estimate', `${prospect.resourceEstimate} MMboe`],
    ['Priority', prospect.priority],
    ['Main Risk', prospect.mainRisk],
    ['Data Confidence', `${dataConfidence}/100`]
  ];

  return <div className="space-y-6">
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Technical prospect file</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{prospect.name}</h1>
          <p className="mt-2 text-sm text-slate-400">{prospect.basin} / {prospect.block} / {prospect.playType}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/prospects/${prospect.id}/edit`} className="inline-flex rounded border border-cyan-800 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950">Edit prospect</Link>
          <button
            className="rounded border border-red-800 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950"
            onClick={() => {
              if (window.confirm(`Delete ${prospect.name}?`)) {
                deleteProspect(prospect.id);
                navigate('/');
              }
            }}
            type="button"
          >
            Delete prospect
          </button>
          <button className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600" onClick={() => exportProspectReport(prospect)}>Export report JSON</button>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {primaryMetrics.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          {label === 'Priority' ? (
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${priorityBadgeClass[prospect.priority ?? 'low']}`}>{value}</span>
          ) : label === 'Main Risk' ? (
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${riskBadgeClass[prospect.mainRisk ?? 'timing']}`}>{value}</span>
          ) : label === 'Data Confidence' ? (
            <div className="mt-3 space-y-3">
              <div className="text-2xl font-semibold text-slate-50">{value}</div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${confidenceBadgeClass[dataConfidenceLevel]}`}>
                {dataConfidenceLevel} confidence
              </span>
            </div>
          ) : (
            <div className="mt-3 text-2xl font-semibold text-slate-50">{value}</div>
          )}
        </div>
      ))}
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Overview</h2>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        {[
          ['Basin', prospect.basin],
          ['Block', prospect.block],
          ['Play Type', prospect.playType],
          ['Latitude', prospect.latitude],
          ['Longitude', prospect.longitude],
          ['Resource Class', 'Unrisked estimate']
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-slate-200">{value}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Petroleum System Components</h2>
        <span className="text-xs text-slate-500">Scores normalized 0-1</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="name"/>
            <YAxis domain={[0, 1]}/>
            <Tooltip/>
            <Bar dataKey="value" fill="#38bdf8"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.2fr_320px]">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Why this score?</h2>
          <span className="text-xs text-slate-500">Scoring explainability</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">GCoS calculation</div>
            <p className="mt-2 font-mono text-sm text-slate-200">{getGCoSFormulaString(prospect)}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Strongest components</div>
            <p className="mt-2 text-slate-200">{strongestComponents}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Weakest component</div>
            <p className="mt-2 text-slate-200">{weakestComponent}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Main risk</div>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${riskBadgeClass[prospect.mainRisk ?? 'timing']}`}>{prospect.mainRisk}</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Final GCoS</div>
            <p className="mt-2 text-slate-200">{Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100)}%</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Interpretation</div>
            <p className="mt-2 leading-6 text-slate-300">{getGCoSInterpretation(prospect)}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Recommended next step</div>
            <p className="mt-2 leading-6 text-slate-300">{getRecommendedNextStep(prospect)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Data Confidence</h2>
        <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
          <div className="text-3xl font-semibold text-slate-50">{dataConfidence}/100</div>
          <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${confidenceBadgeClass[dataConfidenceLevel]}`}>
            {dataConfidenceLevel} confidence
          </span>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Data Confidence reflects the completeness and consistency of the inputs used in the scoring model.
          </p>
        </div>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Risk & Recommendation</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Main Risk</div>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${riskBadgeClass[prospect.mainRisk ?? 'timing']}`}>{prospect.mainRisk}</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Recommendation</div>
            <p className="mt-2 leading-6 text-slate-200">{prospect.recommendation}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">AI Explanation</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">{prospect.explanation}</p>
      </div>
    </section>

    {prospect.scoringMode === 'evidence_derived' && prospect.geoscienceAssessment ? (
      <>
        <section className="rounded-lg border border-cyan-900 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-cyan-200">Geoscience Intelligence Engine</h2>
              <p className="mt-1 text-xs text-slate-400">Evidence-derived petroleum system assessment</p>
            </div>
            <span className="inline-flex rounded-full border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs font-medium text-cyan-300">Evidence-derived</span>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Target Phase</div>
              <p className="mt-2 capitalize text-slate-200">{prospect.geoscienceAssessment.targetPhase}</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Critical Risk</div>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${riskBadgeClass[prospect.geoscienceAssessment.criticalRisk]}`}>{prospect.geoscienceAssessment.criticalRisk}</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Overall Confidence</div>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${confidenceBadgeClass[prospect.geoscienceAssessment.overallConfidence as EvidenceConfidence]}`}>{prospect.geoscienceAssessment.overallConfidence}</span>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3 md:col-span-2 xl:col-span-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Scoring Mode</div>
              <p className="mt-2 text-slate-200">Evidence-derived</p>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Assessment Summary</div>
              <p className="mt-2 leading-6 text-slate-300">{prospect.geoscienceAssessment.summary}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Evidence Matrix</h2>
          <p className="mt-1 text-xs text-slate-400">Per-component geoscience assessment — positive, negative and missing evidence</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {prospect.geoscienceAssessment.components.map((c: ComponentAssessment) => (
              <div key={c.component} className="rounded border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold capitalize text-slate-200">{c.component}</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${evidenceScoreBadge(c.score)}`}>{(c.score * 100).toFixed(0)}%</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${confidenceBadgeClass[c.confidence as EvidenceConfidence]}`}>{c.confidence}</span>
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-400">{c.rationale}</p>
                {c.positiveEvidence.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-emerald-400 mb-1">Positive</div>
                    <ul className="space-y-0.5">{c.positiveEvidence.map((e, i) => <li key={i} className="text-xs text-slate-300">✓ {e}</li>)}</ul>
                  </div>
                )}
                {c.negativeEvidence.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-400 mb-1">Negative</div>
                    <ul className="space-y-0.5">{c.negativeEvidence.map((e, i) => <li key={i} className="text-xs text-slate-300">✗ {e}</li>)}</ul>
                  </div>
                )}
                {c.missingEvidence.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-amber-400 mb-1">Missing data</div>
                    <ul className="space-y-0.5">{c.missingEvidence.map((e, i) => <li key={i} className="text-xs text-slate-500">? {e}</li>)}</ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Recommended Next Data</h2>
          <p className="mt-1 mb-4 text-xs text-slate-400">Data gaps identified by the Geoscience Intelligence Engine</p>
          <div className="grid gap-3 md:grid-cols-2">
            {prospect.geoscienceAssessment.components
              .filter((c: ComponentAssessment) => c.missingEvidence.length > 0)
              .map((c: ComponentAssessment) => (
                <div key={c.component} className="rounded border border-amber-900/40 bg-amber-950/20 p-3">
                  <div className="text-xs font-semibold capitalize text-amber-300 mb-2">{c.component}</div>
                  <ul className="space-y-1">{c.missingEvidence.map((e, i) => <li key={i} className="text-xs text-slate-300">→ {e}</li>)}</ul>
                </div>
              ))
            }
          </div>
        </section>
      </>
    ) : (
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-slate-400">Geoscience Intelligence Engine</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          This prospect currently uses manual scoring. Add structured evidence to enable the Geoscience Intelligence Engine,
          the Evidence Matrix and the Recommended Next Data sections.
        </p>
      </section>
    )}
  </div>;
}
