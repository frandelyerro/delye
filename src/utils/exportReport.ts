import { Prospect } from '../domain/prospect';

export const exportProspectReport = (prospect: Prospect) => {
  const blob = new Blob([JSON.stringify(prospect, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prospect.name.replace(/\s+/g, '_')}_report.json`;
  a.click();
  URL.revokeObjectURL(url);
};
