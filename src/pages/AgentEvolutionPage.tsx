import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend,
} from 'recharts';

const CURRENT_CYCLE = 17;

type AgentId = 'architect' | 'petro' | 'review' | 'security' | 'dev' | 'geodata';

type AgentDef = {
  id: AgentId;
  label: string;
  color: string;
  ring: string;
  description: string;
  specialties: string[];
  precision: number;
  recall: number;
  depth: number;
  totalFindings: number;
  implemented: number;
  latestFinding: string;
  knownGaps: string[];
};

const AGENTS: AgentDef[] = [
  {
    id: 'architect',
    label: 'Architecture',
    color: '#6366f1',
    ring: 'border-indigo-500/40',
    description: 'Files >300 lines, circular deps, hook extraction, memoization gaps.',
    specialties: ['Hook extraction', 'Code splitting', 'Component boundaries', 'Memo usage'],
    precision: 82,
    recall: 71,
    depth: 78,
    totalFindings: 25,
    implemented: 20,
    latestFinding: 'Extracted shared chart styling into src/utils/chartConfig.ts (CHART_TOOLTIP_STYLE, PRIORITY_COLOR, BASIN_PALETTE) — removed duplicated tooltip and palette constants from DashboardPage, MapPage, VisualizationsPage, and ComparisonPage.',
    knownGaps: ['Missing useMemo on O(n²) renders', 'ProspectFormPage (915), ProspectDetailPage (728), MapPage (601) still >300 lines', '<PanelSection> extraction still pending (~10 call sites)'],
  },
  {
    id: 'petro',
    label: 'Petroleum',
    color: '#f59e0b',
    ring: 'border-amber-500/40',
    description: 'GCoS formula accuracy, play-type thresholds, advisor geological correctness.',
    specialties: ['Maturity windows', 'Seal lithology', 'Migration modeling', 'Unconventional thresholds'],
    precision: 90,
    recall: 68,
    depth: 85,
    totalFindings: 36,
    implemented: 33,
    latestFinding: 'Added a trap-geometry advisor handler covering trap-type distribution, unmapped closures, and subsalt seismic-confidence flags from evidence.trap — surfaces trap-limited prospects with a methodology note.',
    knownGaps: ['Play-type-specific source rock Ro windows', 'Basin analog validation'],
  },
  {
    id: 'review',
    label: 'Code Review',
    color: '#22c55e',
    ring: 'border-emerald-500/40',
    description: 'Bugs, null checks, React hook ordering, query conflicts, edge cases.',
    specialties: ['Query routing conflicts', 'Null guards', 'Hook deps', 'Stale closures'],
    precision: 95,
    recall: 80,
    depth: 90,
    totalFindings: 20,
    implemented: 19,
    latestFinding: 'Fixed findMentionedProspects() matching prospects whose names overlap as substrings (e.g. "Tupi" inside "Tupi North") — now excludes overlapping matches so multi-prospect advisor queries (compare, distance) target the correct pair.',
    knownGaps: ['useEffect stale closure detection', 'Missing useCallback on memoized-child setters'],
  },
  {
    id: 'security',
    label: 'Security',
    color: '#ef4444',
    ring: 'border-red-500/40',
    description: 'npm audit, XSS in popups, localStorage injection, import parsing.',
    specialties: ['CVE patching', 'XSS prevention', 'esc() coverage', 'CSV injection'],
    precision: 88,
    recall: 76,
    depth: 82,
    totalFindings: 9,
    implemented: 8,
    latestFinding: 'vitest upgraded to 4.1.8 — patched CVSS 9.8 arbitrary file read (GHSA-5xrq-8626-4rwp).',
    knownGaps: ['Dynamic property access on external data', 'Vite CSP header config'],
  },
  {
    id: 'dev',
    label: 'Dev Features',
    color: '#06b6d4',
    ring: 'border-cyan-500/40',
    description: 'Feature backlog, visual improvements, color encoding, UX polish.',
    specialties: ['Play-type encoding', 'Color palettes', 'Chart types', 'Dashboard widgets'],
    precision: 75,
    recall: 82,
    depth: 70,
    totalFindings: 18,
    implemented: 14,
    latestFinding: 'Shipped the Outcome Labeling page (/outcomes) — bulk-edit drilling outcomes with basin/unlabeled filters and a one-click "apply to visible" action, wired to a new batchUpdateOutcomes store mutation that feeds ML readiness.',
    knownGaps: ['Play-type legend WCAG AA contrast not yet verified', 'Mobile breakpoint validation'],
  },
  {
    id: 'geodata',
    label: 'Geospatial',
    color: '#a855f7',
    ring: 'border-purple-500/40',
    description: 'GeoJSON encoding, cluster properties, spatial insight strings, coordinate validation.',
    specialties: ['Cluster aggregation', 'Spatial insights', 'Coordinate validation', 'GeoJSON properties'],
    precision: 80,
    recall: 74,
    depth: 76,
    totalFindings: 14,
    implemented: 12,
    latestFinding: 'Added a great-circle distance advisor query ("how far is X from Y") using haversineKm — returns distance plus shared-infrastructure guidance tiered at <50km / <200km / >=200km.',
    knownGaps: ['Antimeridian wrapping', 'clusterProperties avg-GCoS aggregation deferred — requires MapLibre expression-based clusterProperties, untestable by unit tests, risk of cluster regressions'],
  },
];

type CycleRow = {
  cycle: number;
  architect: number;
  petro: number;
  review: number;
  security: number;
  dev: number;
  geodata: number;
  highlight: string;
};

const CYCLE_HISTORY: CycleRow[] = [
  { cycle: 1, architect: 2, petro: 2, review: 1, security: 2, dev: 1, geodata: 0, highlight: 'Bootstrap — evidence types, domain scoring' },
  { cycle: 2, architect: 2, petro: 3, review: 2, security: 1, dev: 1, geodata: 0, highlight: 'GCoS formula hardening, advisor base queries' },
  { cycle: 3, architect: 3, petro: 2, review: 2, security: 1, dev: 2, geodata: 0, highlight: 'Map clustering, XSS esc() in popups' },
  { cycle: 4, architect: 2, petro: 3, review: 1, security: 1, dev: 2, geodata: 1, highlight: 'Decision economics, seal/timing scoring' },
  { cycle: 5, architect: 3, petro: 3, review: 2, security: 1, dev: 2, geodata: 2, highlight: 'ML Core v1 — feature extraction, baseline model' },
  { cycle: 6, architect: 2, petro: 3, review: 3, security: 1, dev: 2, geodata: 2, highlight: 'Norway adapter, ML readiness assessment' },
  { cycle: 7, architect: 3, petro: 4, review: 2, security: 1, dev: 2, geodata: 2, highlight: 'Oil/gas maturity windows, anhydrite seal' },
  { cycle: 8, architect: 3, petro: 3, review: 2, security: 1, dev: 3, geodata: 3, highlight: 'Portfolio intelligence, HHI basin diversity' },
  { cycle: 9, architect: 4, petro: 3, review: 3, security: 1, dev: 3, geodata: 2, highlight: 'Migration lateral/mixed, double-penalty fix' },
  { cycle: 10, architect: 4, petro: 3, review: 1, security: 0, dev: 1, geodata: 2, highlight: 'Play-type map, Norway hook, unconventional porosity' },
  { cycle: 11, architect: 3, petro: 2, review: 1, security: 0, dev: 1, geodata: 2, highlight: 'Play-type legend, unconventional perm, fault-conduit migration, advisor false-positives' },
  { cycle: 12, architect: 0, petro: 2, review: 0, security: 0, dev: 1, geodata: 1, highlight: 'Analog prospect finder, play-type legend filtering, source-rock-type TOC scoring, evaporite seal thickness' },
  { cycle: 13, architect: 1, petro: 3, review: 2, security: 0, dev: 1, geodata: 1, highlight: 'useMLTraining hook extraction, subsalt trap risk, GCoS methodology advisor query, comparison-page analogs, coordinate precision warning' },
  { cycle: 14, architect: 1, petro: 1, review: 2, security: 0, dev: 0, geodata: 1, highlight: 'NaN-safety fixes, kitchen-distance advisor query, isolated-prospect spatial insight' },
  { cycle: 15, architect: 1, petro: 2, review: 2, security: 1, dev: 0, geodata: 1, highlight: 'GCoS NaN-safety (numberUtils), density heatmap layer, advisor compare/prioritize handlers' },
  { cycle: 16, architect: 2, petro: 1, review: 2, security: 1, dev: 0, geodata: 1, highlight: 'VisualizationsPage NaN fixes, badge-style dedup, basin bounding-circle overlay' },
  { cycle: 17, architect: 1, petro: 2, review: 3, security: 1, dev: 1, geodata: 2, highlight: 'Trap-geometry advisor query, great-circle distance query, findMentionedProspects substring fix, chart-config dedup, batch outcome labeling' },
];

const AGENT_COLORS: Record<AgentId, string> = {
  architect: '#6366f1',
  petro: '#f59e0b',
  review: '#22c55e',
  security: '#ef4444',
  dev: '#06b6d4',
  geodata: '#a855f7',
};

const META_IMPROVEMENTS = [
  {
    agent: 'architect',
    label: 'Architecture',
    color: '#6366f1',
    suggestion: 'Add — "Check for repeated JSX blocks >15 lines duplicated in 2+ places → extract component."',
    priority: 'high',
  },
  {
    agent: 'petro',
    label: 'Petroleum',
    color: '#f59e0b',
    suggestion: 'Add — "Verify play-type-specific source rock Ro windows (tight/shale differ from conventional)."',
    priority: 'high',
  },
  {
    agent: 'review',
    label: 'Code Review',
    color: '#22c55e',
    suggestion: 'Add — "Check useEffect deps for stale closures; audit useCallback on setters passed to memo children."',
    priority: 'medium',
  },
  {
    agent: 'security',
    label: 'Security',
    color: '#ef4444',
    suggestion: 'Add — "Grep for dynamic property access on external data (obj[userInput]). Check Vite CSP headers."',
    priority: 'medium',
  },
  {
    agent: 'dev',
    label: 'Dev Features',
    color: '#06b6d4',
    suggestion: 'Add — "Verify WCAG AA contrast (4.5:1) for all new color-encoded UI; check mobile breakpoints."',
    priority: 'low',
  },
  {
    agent: 'geodata',
    label: 'Geospatial',
    color: '#a855f7',
    suggestion: 'Add — "Validate coordinate precision ≥4 decimals; check antimeridian wrapping for ±180° basins."',
    priority: 'low',
  },
];

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-300 border border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  low: 'bg-slate-700 text-slate-400 border border-slate-600',
};

const radarData = AGENTS.map((a) => ({
  subject: a.label,
  Precision: a.precision,
  Recall: a.recall,
  Depth: a.depth,
}));

export function AgentEvolutionPage() {
  const totalFindings = AGENTS.reduce((s, a) => s + a.totalFindings, 0);
  const totalImplemented = AGENTS.reduce((s, a) => s + a.implemented, 0);
  const avgPrecision = Math.round(AGENTS.reduce((s, a) => s + a.precision, 0) / AGENTS.length);
  const findingsThisCycle = CYCLE_HISTORY[CYCLE_HISTORY.length - 1];
  const cycleFindingsSum = (['architect', 'petro', 'review', 'security', 'dev', 'geodata'] as AgentId[])
    .reduce((s, k) => s + (findingsThisCycle[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Agent Evolution</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cycle {CURRENT_CYCLE} · {AGENTS.length} specialist agents · {totalFindings} findings across all cycles
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{totalImplemented}</div>
            <div className="text-xs text-slate-500">Implemented</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-indigo-400">{avgPrecision}%</div>
            <div className="text-xs text-slate-500">Avg Precision</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{cycleFindingsSum}</div>
            <div className="text-xs text-slate-500">This Cycle</div>
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {AGENTS.map((agent) => (
          <div
            key={agent.id}
            className={`rounded-xl border bg-slate-900 p-5 ${agent.ring}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="font-semibold text-slate-100">{agent.label}</span>
              </div>
              <span className="text-xs text-slate-500">
                {agent.implemented}/{agent.totalFindings} impl
              </span>
            </div>

            <p className="mb-3 text-xs text-slate-400">{agent.description}</p>

            {/* Score bars */}
            <div className="mb-3 space-y-1.5">
              {[
                { label: 'Precision', value: agent.precision },
                { label: 'Recall', value: agent.recall },
                { label: 'Depth', value: agent.depth },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-14 text-right text-xs text-slate-500">{label}</span>
                  <div className="flex-1 rounded-full bg-slate-800 h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${value}%`, backgroundColor: agent.color, opacity: 0.85 }}
                    />
                  </div>
                  <span className="w-7 text-xs text-slate-400">{value}</span>
                </div>
              ))}
            </div>

            {/* Latest finding */}
            <div className="mb-3 rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="text-slate-500 mr-1">C{CURRENT_CYCLE}→</span>
              {agent.latestFinding}
            </div>

            {/* Known gaps */}
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Gaps</div>
              <div className="space-y-0.5">
                {agent.knownGaps.map((g) => (
                  <div key={g} className="text-xs text-amber-400/80">· {g}</div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Findings per cycle stacked bar */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 text-sm font-semibold text-slate-200">Findings per Cycle</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CYCLE_HISTORY} barSize={14}>
              <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {(['architect', 'petro', 'review', 'security', 'dev', 'geodata'] as AgentId[]).map((k) => (
                <Bar key={k} dataKey={k} stackId="a" fill={AGENT_COLORS[k]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar: agent capability profile */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 text-sm font-semibold text-slate-200">Agent Capability Radar</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} outerRadius={80}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
              <Radar
                name="Precision"
                dataKey="Precision"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
              />
              <Radar
                name="Recall"
                dataKey="Recall"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.1}
              />
              <Radar
                name="Depth"
                dataKey="Depth"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.1}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cycle timeline table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 text-sm font-semibold text-slate-200">Cycle Timeline</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="pb-2 text-left text-slate-500 font-medium">Cycle</th>
                {(['architect', 'petro', 'review', 'security', 'dev', 'geodata'] as AgentId[]).map((k) => (
                  <th key={k} className="pb-2 text-center text-slate-500 font-medium capitalize">{k}</th>
                ))}
                <th className="pb-2 text-left text-slate-500 font-medium pl-4">Highlight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {CYCLE_HISTORY.map((row) => {
                const total = (['architect', 'petro', 'review', 'security', 'dev', 'geodata'] as AgentId[]).reduce((s, k) => s + row[k], 0);
                const isCurrent = row.cycle === CURRENT_CYCLE;
                return (
                  <tr key={row.cycle} className={isCurrent ? 'bg-slate-800/40' : ''}>
                    <td className={`py-2 font-semibold ${isCurrent ? 'text-indigo-400' : 'text-slate-400'}`}>
                      C{row.cycle} {isCurrent && <span className="text-xs text-indigo-400">← now</span>}
                    </td>
                    {(['architect', 'petro', 'review', 'security', 'dev', 'geodata'] as AgentId[]).map((k) => (
                      <td key={k} className="py-2 text-center">
                        {row[k] > 0 ? (
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: AGENT_COLORS[k] + '25', color: AGENT_COLORS[k] }}
                          >
                            {row[k]}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 pl-4 text-slate-400 max-w-xs truncate">{row.highlight}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meta-Agent improvement plan */}
      <div className="rounded-xl border border-indigo-500/30 bg-slate-900 p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          <span className="font-semibold text-slate-100">Meta-Agent — Next Cycle Improvements</span>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Run <code className="rounded bg-slate-800 px-1 py-0.5 text-indigo-300">/meta</code> to analyze agent gaps and update this list.
        </p>
        <div className="space-y-3">
          {META_IMPROVEMENTS.map((imp) => (
            <div key={imp.agent} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: imp.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-200">{imp.label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_BADGE[imp.priority]}`}>{imp.priority}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{imp.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
