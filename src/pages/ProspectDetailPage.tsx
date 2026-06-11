import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TornadoChart } from '../components/ui/TornadoChart';
import { computeSensitivityDeltas } from '../domain/sensitivityAnalysis';
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
import {
  getTargetingRecommendation,
  getRecommendedActionLabel,
  getTierLabel,
} from '../domain/recommendationEngine';
import { assessExplorationMaturity } from '../domain/earlyExploration';
import { getDecisionSignalLabel, getEconomicGradeLabel } from '../domain/economics';
import { predictWithBaselineModel, compareExpertAndML } from '../domain/mlModel';
import { loadTrainedMLModel } from '../services/mlModelStorage';
import { compareTrainedModelWithExpertGCoS } from '../domain/mlTrainingService';
import { predictWithModel } from '../domain/mlLogisticRegression';
import type { MLTrainingTarget } from '../domain/mlTrainingTypes';
import { getOutcomeLabelText, getOutcomeSummary, isKnownOutcome } from '../domain/outcomes';
import { findAnalogs } from '../domain/analogFinder';
import { priorityBadgeClass, riskBadgeClass, tierBadgeClass, actionBadgeClass, economicGradeBadge, decisionSignalBadge, confidenceBadgeClass } from '../utils/badgeStyles';
import { safeGcos } from '../utils/numberUtils';

const mlTargetLabel: Record<MLTrainingTarget, string> = {
  hydrocarbon_presence: 'Hydrocarbon Presence',
  geological_success: 'Geological Success',
  commercial_success: 'Commercial Success',
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
  const allProspects = useProspectStore((s) => s.prospects);
  const deleteProspect = useProspectStore((s) => s.deleteProspect);
  const analogs = useMemo(
    () => (prospect ? findAnalogs(prospect, allProspects, 3) : []),
    [prospect, allProspects],
  );
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
    ['GCoS', `${Math.round(safeGcos(prospect) * 100)}%`],
    ['Commercial Score', `${prospect.commercialScore}/100`],
    ['Resource Estimate', `${prospect.resourceEstimate} MMboe`],
    ['Priority', prospect.priority],
    ['Main Risk', prospect.mainRisk],
    ['Data Confidence', `${dataConfidence}/100`]
  ];

  const targeting = getTargetingRecommendation(prospect);
  const maturity = assessExplorationMaturity(prospect);

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
            <p className="mt-2 text-slate-200">{Math.round(safeGcos(prospect) * 100)}%</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Interpretation</div>
            <p className="mt-2 leading-6 text-slate-300">{getGCoSInterpretation(prospect)}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Recommended next step</div>
            <p className="mt-2 leading-6 text-slate-300">{getRecommendedNextStep(prospect)}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">GCoS sensitivity (tornado)</div>
            <TornadoChart result={computeSensitivityDeltas(prospect)} />
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

    <section className="rounded-lg border border-indigo-900 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold text-indigo-200">Targeting Recommendation</h2>
      <p className="mt-1 text-xs text-slate-400">AI-assisted petroleum targeting — heuristic rules, not ML. Does not replace technical interpretation.</p>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Prospectivity Tier</div>
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tierBadgeClass[targeting.tier]}`}>{getTierLabel(targeting.tier)}</span>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recommended Action</div>
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionBadgeClass[targeting.action]}`}>{getRecommendedActionLabel(targeting.action)}</span>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Exploration Stage</div>
          <p className="mt-2 text-sm text-slate-200">{maturity.stageLabel}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Readiness Score</div>
          <p className="mt-2 text-sm font-semibold text-slate-200">{maturity.readinessScore}/100</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rationale</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{targeting.rationale}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Best Step</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{targeting.nextBestStep}</p>
        </div>
        {targeting.riskFlags.length > 0 && (
          <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">Risk Flags</div>
            <ul className="space-y-1">
              {targeting.riskFlags.map((flag, i) => (
                <li key={i} className="text-xs text-slate-300">⚠ {flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>

    {prospect.economicAssessment && (
      <section className="rounded-lg border border-amber-900 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-amber-200">Decision Economics</h2>
            <p className="mt-1 text-xs text-slate-400">Simple EMV model — illustrative only, not a substitute for full financial modelling.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${economicGradeBadge[prospect.economicAssessment.economicGrade]}`}>
              {getEconomicGradeLabel(prospect.economicAssessment.economicGrade)}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${decisionSignalBadge[prospect.economicAssessment.decisionSignal]}`}>
              {getDecisionSignalLabel(prospect.economicAssessment.decisionSignal)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Simple EMV</div>
            <div className={`mt-2 text-xl font-semibold ${prospect.economicAssessment.simpleEMVUsdMM >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              ${prospect.economicAssessment.simpleEMVUsdMM.toFixed(0)}M
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Risked Resources</div>
            <div className="mt-2 text-xl font-semibold text-slate-100">{prospect.economicAssessment.riskedResourceMMboe.toFixed(1)} MMboe</div>
            <div className="text-xs text-slate-500 mt-1">of {prospect.economicAssessment.unriskedResourceMMboe.toFixed(0)} MMboe unrisked</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Net Revenue</div>
            <div className="mt-2 text-xl font-semibold text-slate-100">${prospect.economicAssessment.estimatedNetRevenueUsdMM.toFixed(0)}M</div>
            <div className="text-xs text-slate-500 mt-1">unrisked, after NRI/WI/OpEx</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total CAPEX</div>
            <div className="mt-2 text-xl font-semibold text-slate-100">${prospect.economicAssessment.estimatedTotalCostUsdMM.toFixed(0)}M</div>
            <div className="text-xs text-slate-500 mt-1">value/risked boe: ${prospect.economicAssessment.valuePerRiskedBoeUsd.toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">EMV Rationale</div>
            <ul className="space-y-1">
              {prospect.economicAssessment.rationale.map((line, i) => (
                <li key={i} className="text-xs leading-5 text-slate-300">• {line}</li>
              ))}
            </ul>
          </div>
          {prospect.economicAssessment.warnings.length > 0 && (
            <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">Economic Warnings</div>
              <ul className="space-y-1">
                {prospect.economicAssessment.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-slate-300">⚠ {w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Economic assumptions use portfolio defaults (oil $75/bbl, dev cost $350M, explore $45M, seismic $12M, lease $20M, OpEx $18/bbl, royalty 20%, NRI 0.75, WI 1.0). Override per prospect via <Link to={`/prospects/${prospect.id}/edit`} className="text-cyan-400 hover:text-cyan-300 underline">Edit Prospect → Economic Assumptions</Link>.</p>
          </div>
        </div>
      </section>
    )}

    {prospect.scoringMode === 'evidence_derived' && prospect.geoscienceAssessment ? (
      <>
        <section className="rounded-lg border border-cyan-900 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-cyan-200">Geoscience Intelligence Engine</h2>
              <p className="mt-1 text-xs text-slate-400">Evidence-derived petroleum system assessment</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs font-medium text-cyan-300">Evidence-derived</span>
              <Link to={`/prospects/${prospect.id}/edit`} className="inline-flex rounded border border-cyan-800 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-950">Edit structured evidence</Link>
            </div>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-400">Geoscience Intelligence Engine</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This prospect currently uses manual scoring. Add structured evidence to enable the Geoscience Intelligence Engine,
              the Evidence Matrix and the Recommended Next Data sections.
            </p>
          </div>
          <Link
            to={`/prospects/${prospect.id}/edit?mode=evidence_derived`}
            className="inline-flex shrink-0 rounded border border-cyan-800 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-950"
          >
            Convert to evidence-derived scoring
          </Link>
        </div>
      </section>
    )}

    {/* Historical Outcome */}
    {prospect.outcome ? (() => {
      const o = prospect.outcome!;
      const outcomeBadgeClass: Record<string, string> = {
        commercial_discovery: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
        technical_discovery: 'border-teal-500/40 bg-teal-500/15 text-teal-200',
        dry_hole: 'border-red-500/40 bg-red-500/15 text-red-300',
        non_commercial: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
        unknown: 'border-slate-600 bg-slate-800 text-slate-400',
      };
      return (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Historical Outcome</h2>
              <p className="mt-1 text-xs text-slate-400">
                Recorded well outcome — used for ML training dataset construction only.
                Does not affect the expert-system GCoS or targeting recommendation.
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${outcomeBadgeClass[o.label]}`}>
              {getOutcomeLabelText(o.label)}
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Label', getOutcomeLabelText(o.label)],
              ['Target Variable', o.targetVariable.replace(/_/g, ' ')],
              ['Result Confidence', o.resultConfidence],
              ['Source', o.source],
              ...(o.wellName ? [['Well Name', o.wellName]] : []),
              ...(o.drillYear ? [['Drill Year', String(o.drillYear)]] : []),
              ...(o.operator ? [['Operator', o.operator]] : []),
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-2 text-sm capitalize text-slate-200">{value}</div>
              </div>
            ))}
          </div>
          {o.notes && (
            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Notes</div>
              <p className="text-xs text-slate-300">{o.notes}</p>
            </div>
          )}
          {isKnownOutcome(o) && (
            <div className="mt-3 rounded border border-emerald-900/40 bg-emerald-950/15 p-3">
              <p className="text-xs text-emerald-400">
                ✓ This outcome is included in the real historical training dataset. Export it from the ML Lab page.
              </p>
            </div>
          )}
        </section>
      );
    })() : (
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-400">Historical Outcome</h2>
            <p className="mt-1 text-sm text-slate-500">
              No well outcome recorded for this prospect. Add a historical outcome in the Edit Prospect form
              to include this prospect in the real ML training dataset.
            </p>
          </div>
          <Link
            to={`/prospects/${prospect.id}/edit`}
            className="inline-flex shrink-0 rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Add outcome
          </Link>
        </div>
      </section>
    )}

    {(() => {
      const agreementBadge = {
        high: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
        medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
        low: 'border-red-500/40 bg-red-500/15 text-red-300',
      };

      const trainedModel = loadTrainedMLModel();
      if (trainedModel) {
        const pred = predictWithModel(trainedModel, prospect);
        const cmp = compareTrainedModelWithExpertGCoS(trainedModel, prospect);
        return (
          <section className="rounded-lg border border-cyan-900/50 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-cyan-200">Trained ML Model (Advisory)</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Local logistic-regression prototype · target: {mlTargetLabel[trainedModel.target]} · trained {new Date(trainedModel.trainedAt).toLocaleDateString()}.
                </p>
              </div>
              <span className="inline-flex rounded-full border border-cyan-700 bg-cyan-950/30 px-3 py-1 text-xs font-semibold text-cyan-300">
                Trained Model (prototype)
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Expert-system GCoS</div>
                <div className="mt-2 text-xl font-semibold text-slate-100">{Math.round(cmp.expertGCoS * 100)}%</div>
                <div className="text-xs text-slate-500 mt-1">source of truth</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">ML Probability</div>
                <div className="mt-2 text-xl font-semibold text-cyan-200">{Math.round(cmp.mlProbability * 100)}%</div>
                <div className="text-xs text-slate-500 mt-1">advisory only</div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Delta</div>
                <div className={`mt-2 text-xl font-semibold ${cmp.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {cmp.delta >= 0 ? '+' : ''}{Math.round(cmp.delta * 100)}pp
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Agreement</div>
                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${agreementBadge[cmp.agreement]}`}>
                  {cmp.agreement}
                </span>
              </div>
            </div>
            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Top Factors</div>
              <ul className="space-y-1">
                {pred.topFactors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-300">
                    <span className={f.direction === 'positive' ? 'text-emerald-400' : 'text-red-400'}>
                      {f.direction === 'positive' ? '▲' : '▼'}
                    </span>{' '}
                    <span className="font-mono text-slate-400">{f.feature}</span>
                    {' '}({f.contribution >= 0 ? '+' : ''}{f.contribution.toFixed(2)})
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 rounded border border-cyan-900/30 bg-cyan-950/10 p-3">
              <p className="text-xs text-cyan-700">
                ⚠ ML output is advisory only. Expert-system GCoS and existing targeting gates remain unchanged.
                {' '}{cmp.interpretation}{' '}
                Manage the trained model from <Link to="/ml-lab" className="underline text-cyan-500 hover:text-cyan-400">ML Lab</Link>.
              </p>
            </div>
          </section>
        );
      }

      const mlPrediction = predictWithBaselineModel(prospect);
      const mlCompare = compareExpertAndML(prospect);
      return (
        <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-slate-400">ML Readiness Preview</h2>
              <p className="mt-1 text-xs text-amber-600">
                No trained ML model is connected yet. This is a deterministic baseline preview.
              </p>
            </div>
            <span className="inline-flex rounded-full border border-amber-700 bg-amber-950/30 px-3 py-1 text-xs font-semibold text-amber-300">
              No ML Model
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Expert-system GCoS</div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {Math.round(mlCompare.expertGCoS * 100)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">source of truth</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Baseline Predicted GCoS</div>
              <div className="mt-2 text-xl font-semibold text-amber-200">
                {Math.round(mlCompare.predictedGCoS * 100)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">deterministic baseline only</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Delta</div>
              <div className={`mt-2 text-xl font-semibold ${mlCompare.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {mlCompare.delta >= 0 ? '+' : ''}{Math.round(mlCompare.delta * 100)}pp
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Agreement</div>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${agreementBadge[mlCompare.agreement]}`}>
                {mlCompare.agreement}
              </span>
            </div>
          </div>
          <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Top Factors</div>
            <ul className="space-y-1">
              {mlPrediction.topFactors.map((f, i) => (
                <li key={i} className="text-xs text-slate-300">
                  <span className={f.direction === 'positive' ? 'text-emerald-400' : 'text-red-400'}>
                    {f.direction === 'positive' ? '▲' : '▼'}
                  </span>
                  {' '}{f.explanation}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 rounded border border-amber-900/30 bg-amber-950/10 p-3">
            <p className="text-xs text-amber-700">
              ⚠ {mlPrediction.warnings[0]} Expert-system GCoS remains the authoritative score for all targeting and investment decisions.
              Visit <Link to="/ml-lab" className="underline text-amber-500 hover:text-amber-400">ML Lab</Link> to view baseline predictions for the full portfolio.
            </p>
          </div>
        </section>
      );
    })()}

    {(() => {
      if (analogs.length === 0) return null;
      return (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Similar Prospects</h2>
          <p className="mt-1 text-xs text-slate-500">
            Prospects with the closest geological and commercial scoring profile — useful as analogs for de-risking.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {analogs.map((analog) => (
              <li key={analog.id}>
                <Link
                  to={`/prospects/${analog.id}`}
                  className="block rounded border border-slate-800 bg-slate-950 p-3 hover:border-indigo-700"
                >
                  <div className="font-medium text-slate-100">{analog.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{analog.basin} · {analog.playType}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    GCoS {Math.round(safeGcos(analog) * 100)}%
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    })()}
  </div>;
}
