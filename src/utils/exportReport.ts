import type { Prospect } from '../domain/prospect';
import type { ProspectReport, PortfolioReport } from '../domain/reporting';
import { generateProspectReport, generatePortfolioReport } from '../domain/reporting';

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
  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const formatProspectReportAsMarkdown = (report: ProspectReport): string => {
  const lines: string[] = [];
  lines.push(`# Prospect Report: ${report.prospect.name}`);
  lines.push(`_Generated: ${new Date(report.generatedAt).toLocaleString()}_`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.executiveSummary);
  lines.push('');
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const line of section.content) {
      lines.push(`- ${line}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('_PetroTarget AI — heuristic scoring, not a substitute for technical interpretation._');
  return lines.join('\n');
};

export const formatPortfolioReportAsMarkdown = (report: PortfolioReport): string => {
  const lines: string[] = [];
  lines.push('# Portfolio Report');
  lines.push(`_Generated: ${new Date(report.generatedAt).toLocaleString()} — ${report.prospects.length} prospects_`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.executiveSummary);
  lines.push('');
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const line of section.content) {
      lines.push(`- ${line}`);
    }
    lines.push('');
  }
  if (report.keyDataGaps.length) {
    lines.push('## Key Data Gaps');
    lines.push('');
    for (const gap of report.keyDataGaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('_PetroTarget AI — heuristic scoring, not a substitute for technical interpretation._');
  return lines.join('\n');
};

export const exportProspectReportJson = (prospect: Prospect): void => {
  const report = generateProspectReport(prospect);
  const slug = prospect.name.toLowerCase().replace(/\s+/g, '-');
  downloadJson(`${slug}-prospect-report.json`, report);
};

export const exportProspectReportMarkdown = (prospect: Prospect): void => {
  const report = generateProspectReport(prospect);
  const slug = prospect.name.toLowerCase().replace(/\s+/g, '-');
  downloadText(`${slug}-prospect-report.md`, formatProspectReportAsMarkdown(report));
};

export const exportPortfolioReportJson = (prospects: Prospect[]): void => {
  const report = generatePortfolioReport(prospects);
  downloadJson('portfolio-report.json', report);
};

export const exportPortfolioReportMarkdown = (prospects: Prospect[]): void => {
  const report = generatePortfolioReport(prospects);
  downloadText('portfolio-report.md', formatPortfolioReportAsMarkdown(report));
};

export const exportProspectReport = (prospect: Prospect): void => {
  exportProspectReportJson(prospect);
};
