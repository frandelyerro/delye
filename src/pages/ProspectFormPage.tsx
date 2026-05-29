import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Prospect, validateProspect } from '../domain/prospect';
import { useProspectStore } from '../store/useProspectStore';
import type {
  BurialHistoryConfidence,
  CarrierBedPresence,
  ChargeTiming,
  EvidenceSourceType,
  FaultConnectivity,
  FaultSealRisk,
  MigrationEvidence,
  MigrationPathway,
  ProspectEvidence,
  ReservoirContinuity,
  ReservoirEvidence,
  ReservoirPresence,
  SealEvidence,
  SealLithology,
  SealPresence,
  ScoringMode,
  SeismicConfidence,
  SourceEvidence,
  SourcePresence,
  TargetPhase,
  TimingEvidence,
  TrapEvidence,
  TrapTimingRelation,
  TrapType,
} from '../domain/evidence';
import { assessPetroleumSystem } from '../domain/geoscienceEngine';
import {
  getProspectivityTier,
  getRecommendedAction,
  getRecommendedActionLabel,
  getTierLabel,
} from '../domain/recommendationEngine';
import { createDefaultEvidence } from '../domain/evidenceDefaults';
import { getEconomicAssumptionDefaults } from '../domain/economics';
import type { EconomicAssumptions } from '../domain/economicTypes';
import type { OutcomeLabel, ProspectOutcome } from '../domain/outcomes';
import { getOutcomeLabelText } from '../domain/outcomes';

// ── Form state type ────────────────────────────────────────────────────────────

type ProspectFormState = Record<keyof Pick<Prospect,
  'id' | 'name' | 'basin' | 'block' | 'playType' |
  'latitude' | 'longitude' |
  'sourceScore' | 'migrationScore' | 'reservoirScore' | 'sealScore' | 'trapScore' | 'timingScore' |
  'commercialScore' | 'resourceEstimate'
>, string>;

const emptyForm: ProspectFormState = {
  id: '', name: '', basin: '', block: '', playType: '',
  latitude: '', longitude: '',
  sourceScore: '', migrationScore: '', reservoirScore: '', sealScore: '', trapScore: '', timingScore: '',
  commercialScore: '', resourceEstimate: '',
};

const prospectToForm = (prospect: Prospect): ProspectFormState => ({
  id: prospect.id,
  name: prospect.name,
  basin: prospect.basin,
  block: prospect.block,
  playType: prospect.playType,
  latitude: String(prospect.latitude),
  longitude: String(prospect.longitude),
  sourceScore: String(prospect.sourceScore),
  migrationScore: String(prospect.migrationScore),
  reservoirScore: String(prospect.reservoirScore),
  sealScore: String(prospect.sealScore),
  trapScore: String(prospect.trapScore),
  timingScore: String(prospect.timingScore),
  commercialScore: String(prospect.commercialScore),
  resourceEstimate: String(prospect.resourceEstimate),
});

const formToBase = (form: ProspectFormState) => ({
  id: form.id.trim(),
  name: form.name.trim(),
  basin: form.basin.trim(),
  block: form.block.trim(),
  playType: form.playType.trim(),
  latitude: Number(form.latitude),
  longitude: Number(form.longitude),
  sourceScore: Number(form.sourceScore),
  migrationScore: Number(form.migrationScore),
  reservoirScore: Number(form.reservoirScore),
  sealScore: Number(form.sealScore),
  trapScore: Number(form.trapScore),
  timingScore: Number(form.timingScore),
  commercialScore: Number(form.commercialScore),
  resourceEstimate: Number(form.resourceEstimate),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const textFields: Array<keyof ProspectFormState> = ['id', 'name', 'basin', 'block', 'playType'];
const coordinateFields: Array<keyof ProspectFormState> = ['latitude', 'longitude'];
const scoreFields: Array<keyof ProspectFormState> = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'];
const businessFields: Array<keyof ProspectFormState> = ['commercialScore', 'resourceEstimate'];

const labels: Record<keyof ProspectFormState, string> = {
  id: 'ID', name: 'Prospect Name', basin: 'Basin', block: 'Block', playType: 'Play Type',
  latitude: 'Latitude', longitude: 'Longitude',
  sourceScore: 'Source Score', migrationScore: 'Migration Score', reservoirScore: 'Reservoir Score',
  sealScore: 'Seal Score', trapScore: 'Trap Score', timingScore: 'Timing Score',
  commercialScore: 'Commercial Score', resourceEstimate: 'Resource Estimate MMboe',
};

const ic = 'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500';

const ALL_SOURCE_TYPES: EvidenceSourceType[] = ['well', 'seismic', 'geochemistry', 'report', 'analog', 'assumption'];
const sourceTypeLabels: Record<EvidenceSourceType, string> = {
  well: 'Well data', seismic: 'Seismic', geochemistry: 'Geochemistry',
  report: 'Report', analog: 'Analog / Regional', assumption: 'Assumption',
};

// ── Evidence validation ────────────────────────────────────────────────────────

const validateEvidenceFields = (evidence: ProspectEvidence): string[] => {
  const errors: string[] = [];
  const nn = (val: number | undefined, label: string) => {
    if (val !== undefined && val < 0) errors.push(`${label} must be ≥ 0`);
  };
  const rng = (val: number | undefined, label: string, min: number, max: number) => {
    if (val !== undefined && (val < min || val > max)) errors.push(`${label} must be between ${min} and ${max}`);
  };
  const { source, migration, reservoir, seal, trap } = evidence;
  nn(source?.tocPercent, 'TOC (wt%)');
  nn(source?.roPercent, 'Ro (VRo %)');
  nn(source?.tmaxC, 'Tmax (°C)');
  nn(source?.sourceThicknessM, 'Source thickness (m)');
  nn(source?.distanceToKitchenKm, 'Distance to kitchen (km)');
  nn(migration?.distanceFromKitchenKm, 'Migration distance (km)');
  rng(reservoir?.porosityPercent, 'Porosity (%)', 0, 100);
  nn(reservoir?.permeabilityMd, 'Permeability (mD)');
  nn(reservoir?.netPayM, 'Net pay (m)');
  rng(reservoir?.vshaleFraction, 'Vsh fraction', 0, 1);
  nn(seal?.thicknessM, 'Seal thickness (m)');
  nn(trap?.closureAreaKm2, 'Closure area (km²)');
  nn(trap?.closureHeightM, 'Closure height (m)');
  return errors;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ProspectFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prospects = useProspectStore((s) => s.prospects);
  const createProspect = useProspectStore((s) => s.createProspect);
  const updateProspect = useProspectStore((s) => s.updateProspect);
  const existing = prospects.find((p) => p.id === id);
  const isEdit = Boolean(id);

  const [form, setForm] = useState<ProspectFormState>(() => existing ? prospectToForm(existing) : emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  const convertToEvidence = searchParams.get('mode') === 'evidence_derived';
  const [scoringMode, setScoringMode] = useState<ScoringMode>(() => {
    if (convertToEvidence) return 'evidence_derived';
    return existing?.scoringMode ?? 'manual';
  });
  const [targetPhase, setTargetPhase] = useState<TargetPhase>(() => existing?.targetPhase ?? 'unknown');
  const [evidence, setEvidence] = useState<ProspectEvidence>(() =>
    existing?.scoringMode === 'evidence_derived' && existing.evidence
      ? existing.evidence
      : createDefaultEvidence()
  );
  const [economicAssumptions, setEconomicAssumptions] = useState<EconomicAssumptions>(
    () => existing?.economicAssumptions ?? {}
  );
  const [showEconomics, setShowEconomics] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState<ProspectOutcome | undefined>(
    () => existing?.outcome
  );

  const title = isEdit ? 'Edit prospect' : 'New prospect';
  const backPath = existing ? `/prospects/${existing.id}` : '/';
  const duplicateId = !isEdit && Boolean(form.id.trim()) && prospects.some((p) => p.id === form.id.trim());

  if (isEdit && !existing) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-semibold">Prospect not found.</h1>
        <Link to="/" className="mt-4 inline-flex rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">Back to Dashboard</Link>
      </div>
    );
  }

  // ── Evidence component setters ──────────────────────────────────────────────
  const setSource = (u: Partial<SourceEvidence>) => setEvidence(e => ({ ...e, source: { ...e.source!, ...u } }));
  const setMigration = (u: Partial<MigrationEvidence>) => setEvidence(e => ({ ...e, migration: { ...e.migration!, ...u } }));
  const setReservoir = (u: Partial<ReservoirEvidence>) => setEvidence(e => ({ ...e, reservoir: { ...e.reservoir!, ...u } }));
  const setSealEv = (u: Partial<SealEvidence>) => setEvidence(e => ({ ...e, seal: { ...e.seal!, ...u } }));
  const setTrap = (u: Partial<TrapEvidence>) => setEvidence(e => ({ ...e, trap: { ...e.trap!, ...u } }));
  const setTiming = (u: Partial<TimingEvidence>) => setEvidence(e => ({ ...e, timing: { ...e.timing!, ...u } }));

  const toggleSourceType = (
    setter: (u: { sources: EvidenceSourceType[] }) => void,
    current: EvidenceSourceType[] | undefined,
    st: EvidenceSourceType,
    checked: boolean,
  ) => {
    const list = current ?? [];
    setter({ sources: checked ? [...list.filter(s => s !== st), st] : list.filter(s => s !== st) });
  };

  // ── Live derived preview ────────────────────────────────────────────────────
  const evidencePreview = useMemo(() => {
    if (scoringMode !== 'evidence_derived') return null;
    try {
      const assessment = assessPetroleumSystem(evidence, targetPhase);
      const s = assessment.derivedScores;
      const gcos = s.sourceScore * s.migrationScore * s.reservoirScore * s.sealScore * s.trapScore * s.timingScore;
      const weakKey = (Object.entries(s) as [string, number][]).sort(([, a], [, b]) => a - b)[0][0];
      const mainRisk = weakKey.replace('Score', '');

      const commercialScore = Number(form.commercialScore);
      const resourceEstimate = Number(form.resourceEstimate);
      const hasCommercials = Number.isFinite(commercialScore) && commercialScore > 0 && Number.isFinite(resourceEstimate);

      let targeting: { tierLabel: string; actionLabel: string } | null = null;
      if (hasCommercials) {
        try {
          const stub = {
            id: 'preview', name: 'Preview', basin: '-', block: '-', playType: '-',
            latitude: 0, longitude: 0, commercialScore, resourceEstimate,
            ...s,
            geologicalChanceOfSuccess: gcos,
            dataConfidence: assessment.overallConfidence === 'high' ? 80
              : assessment.overallConfidence === 'medium' ? 60
              : assessment.overallConfidence === 'low' ? 40 : 30,
            scoringMode: 'evidence_derived' as const,
            evidence,
            targetPhase,
          };
          const tier = getProspectivityTier(stub as Prospect);
          const action = getRecommendedAction(stub as Prospect);
          targeting = { tierLabel: getTierLabel(tier), actionLabel: getRecommendedActionLabel(action) };
        } catch { /* preview only */ }
      }

      return { assessment, gcos, mainRisk, scores: s, targeting };
    } catch {
      return null;
    }
  }, [evidence, targetPhase, scoringMode, form.commercialScore, form.resourceEstimate]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderField = (field: keyof ProspectFormState, options?: { type?: string; min?: number; max?: number; step?: string; disabled?: boolean }) => (
    <label key={field} className="block text-sm text-slate-300">
      {labels[field]}
      <input
        className={ic}
        disabled={options?.disabled}
        max={options?.max}
        min={options?.min}
        onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        required
        step={options?.step}
        type={options?.type ?? 'text'}
        value={form[field]}
      />
    </label>
  );

  const renderSelect = <T extends string>(
    label: string,
    value: T | undefined,
    options: T[],
    onChange: (v: T) => void,
    optLabels?: Partial<Record<T, string>>,
  ) => (
    <label className="block text-sm text-slate-300">
      {label}
      <select className={ic} value={value ?? ''} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(opt => <option key={opt} value={opt}>{optLabels?.[opt] ?? opt}</option>)}
      </select>
    </label>
  );

  const renderNum = (
    label: string,
    value: number | undefined,
    onChange: (v: number | undefined) => void,
    min?: number,
    max?: number,
  ) => (
    <label className="block text-sm text-slate-300">
      {label} <span className="text-xs text-slate-500">(optional)</span>
      <input
        type="number"
        className={ic}
        value={value ?? ''}
        min={min}
        max={max}
        step="any"
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  );

  const renderSourceTypes = (current: EvidenceSourceType[] | undefined, setter: (u: { sources: EvidenceSourceType[] }) => void) => (
    <div className="md:col-span-2 xl:col-span-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Data Sources</div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {ALL_SOURCE_TYPES.map(st => (
          <label key={st} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-300">
            <input
              type="checkbox"
              className="accent-cyan-500"
              checked={(current ?? []).includes(st)}
              onChange={(e) => toggleSourceType(setter, current, st, e.target.checked)}
            />
            <span className="text-xs">{sourceTypeLabels[st]}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // ── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const base = formToBase(form);

    let prospect: Prospect;
    const econOverrides = Object.fromEntries(Object.entries(economicAssumptions).filter(([, v]) => v !== undefined)) as EconomicAssumptions;
    const econFields = Object.keys(econOverrides).length > 0 ? { economicAssumptions: econOverrides } : {};

    const outcomeField = outcome ? { outcome } : {};

    if (scoringMode === 'evidence_derived') {
      const evErrors = validateEvidenceFields(evidence);
      if (evErrors.length) { setErrors(evErrors); return; }
      const placeholders = evidencePreview?.scores ?? {
        sourceScore: 0.5, migrationScore: 0.5, reservoirScore: 0.5,
        sealScore: 0.5, trapScore: 0.5, timingScore: 0.5,
      };
      prospect = { ...base, ...placeholders, scoringMode: 'evidence_derived', targetPhase, evidence, ...econFields, ...outcomeField };
    } else {
      prospect = { ...base, scoringMode: 'manual', ...econFields, ...outcomeField };
    }

    const validationErrors = validateProspect(prospect);
    if (duplicateId) validationErrors.push(`id "${prospect.id}" already exists`);
    if (validationErrors.length) { setErrors(validationErrors); return; }

    try {
      isEdit && id ? updateProspect(id, prospect) : createProspect(prospect);
      navigate(`/prospects/${prospect.id}`);
    } catch (error) {
      setErrors([(error as Error).message]);
    }
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  const ev = evidence;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Header */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Portfolio management</p>
            <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Manage prospect inputs locally. Scoring is recalculated after save.</p>
          </div>
          <Link to={backPath} className="inline-flex rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">Cancel</Link>
        </div>
      </section>

      {/* Errors */}
      {errors.length > 0 && (
        <section className="rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-200">
          <div className="font-medium">Fix these fields before saving:</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>
      )}

      {/* Overview */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {textFields.map((field) => renderField(field, { disabled: isEdit && field === 'id' }))}
        </div>
      </section>

      {/* Location & Commercials */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Location &amp; Commercials</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {coordinateFields.map((field) => renderField(field, { type: 'number', step: '0.0001', min: field === 'latitude' ? -90 : -180, max: field === 'latitude' ? 90 : 180 }))}
          {businessFields.map((field) => renderField(field, { type: 'number', step: field === 'commercialScore' ? '1' : '0.1', min: 0, max: field === 'commercialScore' ? 100 : undefined }))}
        </div>
      </section>

      {/* Scoring Method */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Scoring Method</h2>
        <p className="mt-1 text-xs text-slate-400">Manual scoring uses your direct component scores. Evidence-derived scoring derives scores from structured petroleum system evidence.</p>
        <div className="mt-4 flex flex-wrap gap-6">
          {(['manual', 'evidence_derived'] as ScoringMode[]).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="radio"
                className="accent-cyan-500"
                name="scoringMode"
                value={mode}
                checked={scoringMode === mode}
                onChange={() => setScoringMode(mode)}
              />
              <span className="font-medium">{mode === 'manual' ? 'Manual scoring' : 'Evidence-derived scoring'}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Manual: component scores */}
      {scoringMode === 'manual' && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Petroleum System Components</h2>
            <span className="text-xs text-slate-500">Scores must be between 0 and 1</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {scoreFields.map((field) => renderField(field, { type: 'number', min: 0, max: 1, step: '0.01' }))}
          </div>
        </section>
      )}

      {/* Evidence-derived: target phase + evidence sections */}
      {scoringMode === 'evidence_derived' && (
        <>
          {/* Target phase */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">Target Phase</h2>
            <div className="mt-4 max-w-xs">
              {renderSelect<TargetPhase>(
                'Target Phase',
                targetPhase,
                ['oil', 'gas', 'condensate', 'unknown'],
                setTargetPhase,
                { oil: 'Oil', gas: 'Gas', condensate: 'Condensate', unknown: 'Unknown' },
              )}
            </div>
          </section>

          {/* A. Source Rock Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-sky-300">A. Source Rock Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<SourcePresence>(
                'Source Rock Presence',
                ev.source?.presence,
                ['proven', 'probable', 'possible', 'unknown', 'absent'],
                (v) => setSource({ presence: v }),
              )}
              {renderNum('TOC (wt%)', ev.source?.tocPercent, (v) => setSource({ tocPercent: v }), 0)}
              {renderNum('Ro — VRo (%)', ev.source?.roPercent, (v) => setSource({ roPercent: v }), 0)}
              {renderNum('Tmax (°C)', ev.source?.tmaxC, (v) => setSource({ tmaxC: v }), 0)}
              {renderNum('Source Thickness (m)', ev.source?.sourceThicknessM, (v) => setSource({ sourceThicknessM: v }), 0)}
              {renderNum('Distance to Kitchen (km)', ev.source?.distanceToKitchenKm, (v) => setSource({ distanceToKitchenKm: v }), 0)}
              <label className="block text-sm text-slate-300">
                Kerogen Type <span className="text-xs text-slate-500">(optional)</span>
                <input
                  type="text"
                  className={ic}
                  value={ev.source?.keroGenType ?? ''}
                  placeholder="e.g. Type II"
                  onChange={(e) => setSource({ keroGenType: e.target.value || undefined })}
                />
              </label>
              {renderSourceTypes(ev.source?.sources, setSource)}
            </div>
          </section>

          {/* B. Migration Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-cyan-300">B. Migration Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<MigrationPathway>(
                'Migration Pathway',
                ev.migration?.pathway,
                ['proven', 'probable', 'possible', 'unknown', 'unlikely'],
                (v) => setMigration({ pathway: v }),
              )}
              {renderSelect<FaultConnectivity>(
                'Fault Connectivity',
                ev.migration?.faultConnectivity,
                ['good', 'moderate', 'poor', 'unknown'],
                (v) => setMigration({ faultConnectivity: v }),
              )}
              {renderSelect<CarrierBedPresence>(
                'Carrier Bed Presence',
                ev.migration?.carrierBedPresence,
                ['proven', 'probable', 'possible', 'absent', 'unknown'],
                (v) => setMigration({ carrierBedPresence: v }),
              )}
              {renderNum('Migration Distance from Kitchen (km)', ev.migration?.distanceFromKitchenKm, (v) => setMigration({ distanceFromKitchenKm: v }), 0)}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 self-end pb-2">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={ev.migration?.showsPresent ?? false}
                  onChange={(e) => setMigration({ showsPresent: e.target.checked })}
                />
                <span>Shows Present (oil/gas seeps or staining)</span>
              </label>
              {renderSourceTypes(ev.migration?.sources, setMigration)}
            </div>
          </section>

          {/* C. Reservoir Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-indigo-300">C. Reservoir Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<ReservoirPresence>(
                'Reservoir Presence',
                ev.reservoir?.presence,
                ['proven', 'probable', 'possible', 'unknown', 'absent'],
                (v) => setReservoir({ presence: v }),
              )}
              {renderSelect<ReservoirContinuity>(
                'Reservoir Continuity',
                ev.reservoir?.continuity,
                ['good', 'moderate', 'poor', 'unknown'],
                (v) => setReservoir({ continuity: v }),
              )}
              {renderNum('Porosity (%)', ev.reservoir?.porosityPercent, (v) => setReservoir({ porosityPercent: v }), 0, 100)}
              {renderNum('Permeability (mD)', ev.reservoir?.permeabilityMd, (v) => setReservoir({ permeabilityMd: v }), 0)}
              {renderNum('Net Pay (m)', ev.reservoir?.netPayM, (v) => setReservoir({ netPayM: v }), 0)}
              {renderNum('Vsh Fraction (0–1)', ev.reservoir?.vshaleFraction, (v) => setReservoir({ vshaleFraction: v }), 0, 1)}
              {renderSourceTypes(ev.reservoir?.sources, setReservoir)}
            </div>
          </section>

          {/* D. Seal Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-violet-300">D. Seal Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<SealPresence>(
                'Seal Presence',
                ev.seal?.presence,
                ['proven', 'probable', 'possible', 'unknown', 'absent'],
                (v) => setSealEv({ presence: v }),
              )}
              {renderSelect<SealLithology>(
                'Seal Lithology',
                ev.seal?.lithology,
                ['salt', 'evaporite', 'shale', 'mudstone', 'carbonate', 'other', 'unknown'],
                (v) => setSealEv({ lithology: v }),
              )}
              {renderSelect<FaultSealRisk>(
                'Fault Seal Risk',
                ev.seal?.faultSealRisk,
                ['low', 'medium', 'high', 'unknown'],
                (v) => setSealEv({ faultSealRisk: v }),
              )}
              {renderNum('Seal Thickness (m)', ev.seal?.thicknessM, (v) => setSealEv({ thicknessM: v }), 0)}
              {renderSourceTypes(ev.seal?.sources, setSealEv)}
            </div>
          </section>

          {/* E. Trap Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-rose-300">E. Trap Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<TrapType>(
                'Trap Type',
                ev.trap?.trapType,
                ['structural', 'stratigraphic', 'combination', 'subsalt', 'unknown'],
                (v) => setTrap({ trapType: v }),
              )}
              {renderSelect<SeismicConfidence>(
                'Seismic Confidence',
                ev.trap?.seismicConfidence,
                ['high', 'medium', 'low', 'unknown'],
                (v) => setTrap({ seismicConfidence: v }),
              )}
              {renderNum('Closure Area (km²)', ev.trap?.closureAreaKm2, (v) => setTrap({ closureAreaKm2: v }), 0)}
              {renderNum('Closure Height (m)', ev.trap?.closureHeightM, (v) => setTrap({ closureHeightM: v }), 0)}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 self-end pb-2">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={ev.trap?.closureMapped ?? false}
                  onChange={(e) => setTrap({ closureMapped: e.target.checked })}
                />
                <span>Closure Mapped on Seismic</span>
              </label>
              {renderSourceTypes(ev.trap?.sources, setTrap)}
            </div>
          </section>

          {/* F. Timing Evidence */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-orange-300">F. Timing Evidence</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderSelect<TrapTimingRelation>(
                'Trap Formed Before Migration',
                ev.timing?.trapFormedBeforeMigration,
                ['yes', 'likely', 'uncertain', 'unlikely', 'no'],
                (v) => setTiming({ trapFormedBeforeMigration: v }),
              )}
              {renderSelect<ChargeTiming>(
                'Charge Timing',
                ev.timing?.chargeTiming,
                ['favorable', 'possible', 'unfavorable', 'unknown'],
                (v) => setTiming({ chargeTiming: v }),
              )}
              {renderSelect<BurialHistoryConfidence>(
                'Burial History Confidence',
                ev.timing?.burialHistoryConfidence,
                ['high', 'medium', 'low', 'unknown'],
                (v) => setTiming({ burialHistoryConfidence: v }),
              )}
              {renderSourceTypes(ev.timing?.sources, setTiming)}
            </div>
          </section>

          {/* Derived Scoring Preview */}
          {evidencePreview && (
            <section className="rounded-lg border border-cyan-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-cyan-200">Derived Scoring Preview</h2>
                <span className="text-xs text-slate-400">Live — updates as you edit evidence</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {([
                  ['Source', evidencePreview.scores.sourceScore],
                  ['Migration', evidencePreview.scores.migrationScore],
                  ['Reservoir', evidencePreview.scores.reservoirScore],
                  ['Seal', evidencePreview.scores.sealScore],
                  ['Trap', evidencePreview.scores.trapScore],
                  ['Timing', evidencePreview.scores.timingScore],
                ] as [string, number][]).map(([label, score]) => (
                  <div key={label} className="rounded border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 text-xl font-semibold text-slate-100">{Math.round(score * 100)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Derived GCoS</div>
                  <div className="mt-2 text-xl font-semibold text-slate-100">{Math.round(evidencePreview.gcos * 100)}%</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Main Risk</div>
                  <div className="mt-2 text-sm capitalize text-slate-200">{evidencePreview.mainRisk}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Overall Confidence</div>
                  <div className="mt-2 text-sm capitalize text-slate-200">{evidencePreview.assessment.overallConfidence}</div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Critical Risk</div>
                  <div className="mt-2 text-sm capitalize text-slate-200">{evidencePreview.assessment.criticalRisk}</div>
                </div>
                {evidencePreview.targeting && (
                  <>
                    <div className="rounded border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Prospectivity Tier</div>
                      <div className="mt-2 text-xs text-slate-200">{evidencePreview.targeting.tierLabel}</div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950 p-3 xl:col-span-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Recommended Action</div>
                      <div className="mt-2 text-xs text-slate-200">{evidencePreview.targeting.actionLabel}</div>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">Preview only. Actual scores, GCoS, data confidence and targeting recommendation are computed on save.</p>
            </section>
          )}
        </>
      )}

      {/* Economic Assumptions (collapsible) */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setShowEconomics((v) => !v)}
        >
          <div>
            <h2 className="text-lg font-semibold">Economic Assumptions</h2>
            <p className="mt-1 text-xs text-slate-400">Optional — override default portfolio assumptions for EMV calculation. Leave blank to use defaults.</p>
          </div>
          <span className="shrink-0 text-slate-400 text-lg">{showEconomics ? '▲' : '▼'}</span>
        </button>

        {showEconomics && (() => {
          const d = getEconomicAssumptionDefaults();
          const setA = (key: keyof EconomicAssumptions, val: number | undefined) =>
            setEconomicAssumptions((prev) => ({ ...prev, [key]: val }));
          const numField = (label: string, key: keyof EconomicAssumptions, defaultVal: number, min?: number, max?: number) => (
            <label key={key} className="block text-sm text-slate-300">
              {label} <span className="text-xs text-slate-500">(default {defaultVal})</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                value={economicAssumptions[key] ?? ''}
                min={min}
                max={max}
                step="any"
                placeholder={String(defaultVal)}
                onChange={(e) => setA(key, e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
          );
          return (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {numField('Oil Price ($/bbl)', 'oilPriceUsdPerBbl', d.oilPriceUsdPerBbl, 0)}
              {numField('Gas Price ($/Mcf)', 'gasPriceUsdPerMcf', d.gasPriceUsdPerMcf, 0)}
              {numField('Development Cost ($M)', 'developmentCostUsdMM', d.developmentCostUsdMM, 0)}
              {numField('Exploration Well Cost ($M)', 'explorationWellCostUsdMM', d.explorationWellCostUsdMM, 0)}
              {numField('Seismic Cost ($M)', 'seismicCostUsdMM', d.seismicCostUsdMM, 0)}
              {numField('Lease / Entry Cost ($M)', 'leaseOrEntryCostUsdMM', d.leaseOrEntryCostUsdMM, 0)}
              {numField('Operating Cost ($/bbl)', 'operatingCostUsdPerBbl', d.operatingCostUsdPerBbl, 0)}
              {numField('Net Revenue Interest (0–1)', 'netRevenueInterest', d.netRevenueInterest, 0, 1)}
              {numField('Working Interest (0–1)', 'workingInterest', d.workingInterest, 0, 1)}
              {numField('Royalty Rate (0–1)', 'royaltyRate', d.royaltyRate, 0, 1)}
            </div>
          );
        })()}
      </section>

      {/* Historical Outcome (collapsible) */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setShowOutcome((v) => !v)}
        >
          <div>
            <h2 className="text-lg font-semibold">Historical Outcome</h2>
            <p className="mt-1 text-xs text-slate-400">
              Optional — record a real well outcome to build the supervised ML training dataset.
              {outcome ? ` Currently set: ${getOutcomeLabelText(outcome.label)}.` : ' No outcome recorded yet.'}
            </p>
          </div>
          <span className="shrink-0 text-slate-400 text-lg">{showOutcome ? '▲' : '▼'}</span>
        </button>

        {showOutcome && (() => {
          const ALL_OUTCOME_LABELS: OutcomeLabel[] = [
            'commercial_discovery', 'technical_discovery', 'dry_hole', 'non_commercial', 'unknown',
          ];
          const current: ProspectOutcome = outcome ?? {
            label: 'unknown',
            targetVariable: 'geological_success',
            resultConfidence: 'medium',
            source: 'historical',
          };
          const update = (patch: Partial<ProspectOutcome>) =>
            setOutcome({ ...current, ...patch });

          return (
            <div className="mt-4 space-y-4">
              <div className="rounded border border-amber-900/40 bg-amber-950/20 p-3">
                <p className="text-xs text-amber-300">
                  ⚠ Historical outcomes are used only for ML training dataset construction.
                  They do not modify the expert-system GCoS or any targeting recommendation.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm text-slate-300">
                  Outcome Label
                  <select
                    className={ic}
                    value={current.label}
                    onChange={(e) => update({ label: e.target.value as OutcomeLabel })}
                  >
                    {ALL_OUTCOME_LABELS.map((l) => (
                      <option key={l} value={l}>{getOutcomeLabelText(l)}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Target Variable
                  <select
                    className={ic}
                    value={current.targetVariable}
                    onChange={(e) => update({ targetVariable: e.target.value as ProspectOutcome['targetVariable'] })}
                  >
                    <option value="geological_success">Geological Success</option>
                    <option value="commercial_success">Commercial Success</option>
                    <option value="hydrocarbon_presence">Hydrocarbon Presence</option>
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Result Confidence
                  <select
                    className={ic}
                    value={current.resultConfidence}
                    onChange={(e) => update({ resultConfidence: e.target.value as ProspectOutcome['resultConfidence'] })}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Data Source
                  <select
                    className={ic}
                    value={current.source}
                    onChange={(e) => update({ source: e.target.value as ProspectOutcome['source'] })}
                  >
                    <option value="historical">Historical Records</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Well Name <span className="text-xs text-slate-500">(optional)</span>
                  <input
                    type="text"
                    className={ic}
                    value={current.wellName ?? ''}
                    placeholder="e.g. Well-1A"
                    onChange={(e) => update({ wellName: e.target.value || undefined })}
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Drill Year <span className="text-xs text-slate-500">(optional)</span>
                  <input
                    type="number"
                    className={ic}
                    value={current.drillYear ?? ''}
                    min={1900}
                    max={2100}
                    placeholder="e.g. 2019"
                    onChange={(e) => update({ drillYear: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Operator <span className="text-xs text-slate-500">(optional)</span>
                  <input
                    type="text"
                    className={ic}
                    value={current.operator ?? ''}
                    placeholder="e.g. Operator Corp"
                    onChange={(e) => update({ operator: e.target.value || undefined })}
                  />
                </label>

                <label className="block text-sm text-slate-300 md:col-span-2">
                  Notes <span className="text-xs text-slate-500">(optional)</span>
                  <input
                    type="text"
                    className={ic}
                    value={current.notes ?? ''}
                    placeholder="e.g. Commercial gas discovery, 3 development wells"
                    onChange={(e) => update({ notes: e.target.value || undefined })}
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded border border-red-800 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950"
                  onClick={() => setOutcome(undefined)}
                >
                  Clear outcome
                </button>
                <span className="text-xs text-slate-500">Clearing removes the outcome from this prospect and excludes it from the real training dataset.</span>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link to={backPath} className="inline-flex rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">Cancel</Link>
        <button className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600" type="submit">Save prospect</button>
      </div>
    </form>
  );
}
