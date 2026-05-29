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
