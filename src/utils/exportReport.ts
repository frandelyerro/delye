import { Prospect } from '../domain/prospect';

export const downloadJson = (filename: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const CSV_HEADERS = [
  'id', 'name', 'basin', 'block', 'playType',
  'latitude', 'longitude',
  'sourceScore', 'migrationScore', 'reservoirScore', 'sealScore', 'trapScore', 'timingScore',
  'gcos', 'priority', 'mainRisk', 'commercialScore', 'resourceEstimate',
  'dataConfidence', 'recommendation',
  'riskedResourceMMboe', 'simpleEMVUsdMM',
] as const;

const csvEscape = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportPortfolioAsCsv = (prospects: Prospect[]): void => {
  const rows = prospects.map((p) => [
    p.id, p.name, p.basin, p.block, p.playType,
    p.latitude, p.longitude,
    p.sourceScore, p.migrationScore, p.reservoirScore, p.sealScore, p.trapScore, p.timingScore,
    p.geologicalChanceOfSuccess != null ? (p.geologicalChanceOfSuccess * 100).toFixed(2) : '',
    p.priority ?? '', p.mainRisk ?? '', p.commercialScore, p.resourceEstimate,
    p.dataConfidence ?? '', p.recommendation ?? '',
    p.economicAssessment?.riskedResourceMMboe ?? '',
    p.economicAssessment?.simpleEMVUsdMM ?? '',
  ].map(csvEscape).join(','));

  const csv = [CSV_HEADERS.join(','), ...rows].join('\n');
  downloadText(`portfolio-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
};

export const exportPortfolioAsJson = (prospects: Prospect[]): void => {
  downloadJson(`portfolio-export-${new Date().toISOString().slice(0, 10)}.json`, prospects);
};

export const exportProspectReport = (prospect: Prospect): void => {
  const payload = {
    name: prospect.name,
    basin: prospect.basin,
    block: prospect.block,
    playType: prospect.playType,
    geologicalChanceOfSuccess: prospect.geologicalChanceOfSuccess,
    commercialScore: prospect.commercialScore,
    resourceEstimate: prospect.resourceEstimate,
    priority: prospect.priority,
    mainRisk: prospect.mainRisk,
    recommendation: prospect.recommendation,
    explanation: prospect.explanation
  };
  downloadJson(`${prospect.name.toLowerCase().replace(/\s+/g, '-')}-report.json`, payload);
};
