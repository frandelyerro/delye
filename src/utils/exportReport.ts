import { Prospect } from '../domain/prospect';

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
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prospect.name.toLowerCase().replace(/\s+/g, '-')}-report.json`;
  a.click();
  URL.revokeObjectURL(url);
};
