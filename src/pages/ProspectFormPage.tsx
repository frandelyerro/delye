import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Prospect, validateProspect } from '../domain/prospect';
import { useProspectStore } from '../store/useProspectStore';

type ProspectFormState = Record<keyof Pick<Prospect,
  'id' | 'name' | 'basin' | 'block' | 'playType' |
  'latitude' | 'longitude' |
  'sourceScore' | 'migrationScore' | 'reservoirScore' | 'sealScore' | 'trapScore' | 'timingScore' |
  'commercialScore' | 'resourceEstimate'
>, string>;

const emptyForm: ProspectFormState = {
  id: '',
  name: '',
  basin: '',
  block: '',
  playType: '',
  latitude: '',
  longitude: '',
  sourceScore: '',
  migrationScore: '',
  reservoirScore: '',
  sealScore: '',
  trapScore: '',
  timingScore: '',
  commercialScore: '',
  resourceEstimate: ''
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
  resourceEstimate: String(prospect.resourceEstimate)
});

const formToProspect = (form: ProspectFormState): Prospect => ({
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
  resourceEstimate: Number(form.resourceEstimate)
});

const textFields: Array<keyof ProspectFormState> = ['id', 'name', 'basin', 'block', 'playType'];
const coordinateFields: Array<keyof ProspectFormState> = ['latitude', 'longitude'];
const scoreFields: Array<keyof ProspectFormState> = ['sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore'];
const businessFields: Array<keyof ProspectFormState> = ['commercialScore', 'resourceEstimate'];

const labels: Record<keyof ProspectFormState, string> = {
  id: 'ID',
  name: 'Prospect Name',
  basin: 'Basin',
  block: 'Block',
  playType: 'Play Type',
  latitude: 'Latitude',
  longitude: 'Longitude',
  sourceScore: 'Source Score',
  migrationScore: 'Migration Score',
  reservoirScore: 'Reservoir Score',
  sealScore: 'Seal Score',
  trapScore: 'Trap Score',
  timingScore: 'Timing Score',
  commercialScore: 'Commercial Score',
  resourceEstimate: 'Resource Estimate MMboe'
};

const inputClass = 'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500';

export function ProspectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prospects = useProspectStore((s) => s.prospects);
  const createProspect = useProspectStore((s) => s.createProspect);
  const updateProspect = useProspectStore((s) => s.updateProspect);
  const existing = prospects.find((p) => p.id === id);
  const isEdit = Boolean(id);
  const [form, setForm] = useState<ProspectFormState>(() => existing ? prospectToForm(existing) : emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  const title = isEdit ? 'Edit prospect' : 'New prospect';
  const backPath = existing ? `/prospects/${existing.id}` : '/';
  const duplicateId = useMemo(() => !isEdit && Boolean(form.id.trim()) && prospects.some((p) => p.id === form.id.trim()), [form.id, isEdit, prospects]);

  if (isEdit && !existing) {
    return <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-xl font-semibold">Prospect not found.</h1>
      <Link to="/" className="mt-4 inline-flex rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600">Back to Dashboard</Link>
    </div>;
  }

  const updateField = (field: keyof ProspectFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const prospect = formToProspect(form);
    const validationErrors = validateProspect(prospect);
    if (duplicateId) validationErrors.push(`id "${prospect.id}" already exists`);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (isEdit && id) {
        updateProspect(id, prospect);
      } else {
        createProspect(prospect);
      }
      navigate(`/prospects/${prospect.id}`);
    } catch (error) {
      setErrors([(error as Error).message]);
    }
  };

  const renderField = (field: keyof ProspectFormState, options?: { type?: string; min?: number; max?: number; step?: string; disabled?: boolean }) => (
    <label key={field} className="block text-sm text-slate-300">
      {labels[field]}
      <input
        className={inputClass}
        disabled={options?.disabled}
        max={options?.max}
        min={options?.min}
        onChange={(event) => updateField(field, event.target.value)}
        required
        step={options?.step}
        type={options?.type ?? 'text'}
        value={form[field]}
      />
    </label>
  );

  return <form onSubmit={onSubmit} className="space-y-5">
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

    {errors.length > 0 && (
      <section className="rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-200">
        <div className="font-medium">Fix these fields before saving:</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      </section>
    )}

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Overview</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {textFields.map((field) => renderField(field, { disabled: isEdit && field === 'id' }))}
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Location & Commercials</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {coordinateFields.map((field) => renderField(field, { type: 'number', step: '0.0001', min: field === 'latitude' ? -90 : -180, max: field === 'latitude' ? 90 : 180 }))}
        {businessFields.map((field) => renderField(field, { type: 'number', step: field === 'commercialScore' ? '1' : '0.1', min: 0, max: field === 'commercialScore' ? 100 : undefined }))}
      </div>
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Petroleum System Components</h2>
        <span className="text-xs text-slate-500">Scores must be between 0 and 1</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {scoreFields.map((field) => renderField(field, { type: 'number', min: 0, max: 1, step: '0.01' }))}
      </div>
    </section>

    <div className="flex justify-end gap-3">
      <Link to={backPath} className="inline-flex rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">Cancel</Link>
      <button className="rounded bg-cyan-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600" type="submit">Save prospect</button>
    </div>
  </form>;
}
