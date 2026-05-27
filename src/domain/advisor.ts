import { Prospect } from './prospect';
import {
  componentLabels,
  getGCoSFormulaString,
  getGCoSInterpretation,
  getRecommendedNextStep,
  getStrongestComponents,
  getWeakestComponent
} from './explainability';

const findMentionedProspect = (question: string, prospects: Prospect[]): Prospect | undefined => {
  const lowerQuestion = question.toLowerCase();
  return [...prospects]
    .sort((a, b) => b.name.length - a.name.length)
    .find((prospect) => lowerQuestion.includes(prospect.name.toLowerCase()));
};

const formatConfidence = (prospect: Prospect) => `${prospect.name} (${prospect.dataConfidence ?? 0}/100)`;
const formatComponents = (prospect: Prospect) =>
  getStrongestComponents(prospect).map((component) => componentLabels[component]).join(' and ');

export const getAdvisorResponse = (question: string, prospects: Prospect[]): string => {
  const q = question.toLowerCase();
  if (!prospects.length) return 'No prospects available in the current portfolio.';
  const ranked = [...prospects].sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));

  if (q.includes('top prospects') || q.includes('top ranked')) {
    return `Top prospects: ${ranked.slice(0, 3).map((p) => `${p.name} (${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%)`).join(', ')}.`;
  }

  if (q.includes('best prospect')) {
    const best = ranked[0];
    const explanationSnippet = best.explanation
      ? ` Explanation: ${best.explanation.split('. ')[0]}.`
      : '';
    return `Best prospect is ${best.name} with GCoS ${Math.round((best.geologicalChanceOfSuccess ?? 0) * 100)}%, commercial score ${best.commercialScore}, and main risk ${best.mainRisk}.${explanationSnippet}`;
  }

  if (q.includes('why this score') || q.includes('why is')) {
    const target = findMentionedProspect(q, prospects) ?? ranked[0];
    return `${target.name}: GCoS calculation ${getGCoSFormulaString(target)}. Strongest components: ${formatComponents(target)}. ` +
      `Weakest component: ${componentLabels[getWeakestComponent(target)]}. Main risk: ${target.mainRisk}. ` +
      `Data Confidence: ${target.dataConfidence ?? 0}/100. ${getGCoSInterpretation(target)} Recommended next step: ${getRecommendedNextStep(target)}`;
  }

  if (q.includes('main risk')) {
    const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
      const risk = p.mainRisk ?? 'unknown';
      acc[risk] = (acc[risk] ?? 0) + 1;
      return acc;
    }, {});
    const [risk, count] = Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0];
    return `${risk} appears as the main risk in ${count} prospects.`;
  }

  if (q.includes('high resource high risk')) {
    const matches = prospects.filter((p) => p.resourceEstimate >= 100 && (p.priority === 'medium' || p.priority === 'low'));
    return matches.length
      ? `High resource / high risk prospects: ${matches.map((p) => `${p.name} (${p.resourceEstimate} MMboe, ${p.priority})`).join(', ')}.`
      : 'No prospects currently match high-resource high-risk criteria.';
  }

  if (q.includes('need more data')) {
    const needs = prospects.filter((p) => p.priority === 'medium' || p.priority === 'low');
    return needs.length
      ? `Prospects needing more data: ${needs.map((p) => `${p.name} [${p.priority}] - main risk: ${p.mainRisk}`).join('; ')}.`
      : 'No medium/low-priority prospects currently require additional data by this rule.';
  }

  if (q.includes('data confidence') || q.includes('confidence')) {
    const target = findMentionedProspect(q, prospects);
    if (target) {
      return `${target.name} has Data Confidence ${target.dataConfidence ?? 0}/100. Data Confidence reflects the completeness and consistency of the inputs used in the scoring model.`;
    }

    const lowConfidence = ranked.filter((prospect) => (prospect.dataConfidence ?? 0) < 50);
    if (q.includes('low')) {
      return lowConfidence.length
        ? `Low data confidence prospects: ${lowConfidence.map(formatConfidence).join(', ')}.`
        : 'No prospects currently have low data confidence.';
    }

    const averageConfidence = Math.round(prospects.reduce((acc, prospect) => acc + (prospect.dataConfidence ?? 0), 0) / prospects.length);
    return `Portfolio Data Confidence averages ${averageConfidence}/100. Lowest confidence prospects: ${ranked.slice().sort((a, b) => (a.dataConfidence ?? 0) - (b.dataConfidence ?? 0)).slice(0, 3).map(formatConfidence).join(', ')}.`;
  }

  if (q.includes('weakest component')) {
    const target = findMentionedProspect(q, prospects);
    if (target) {
      return `${target.name} is most limited by ${componentLabels[getWeakestComponent(target)]}.`;
    }

    const riskCount = prospects.reduce<Record<string, number>>((acc, prospect) => {
      const weakest = getWeakestComponent(prospect);
      acc[weakest] = (acc[weakest] ?? 0) + 1;
      return acc;
    }, {});
    const [weakest, count] = Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0];
    return `${componentLabels[weakest as keyof typeof componentLabels]} is the weakest component most often in the portfolio, appearing in ${count} prospects.`;
  }

  if (q.includes('strongest components')) {
    const target = findMentionedProspect(q, prospects);
    if (target) {
      return `${target.name} is strongest in ${formatComponents(target)}.`;
    }

    const best = ranked[0];
    return `The highest-ranked current prospect is strongest in ${formatComponents(best)}.`;
  }

  if (q.includes('portfolio summary')) {
    const avg = prospects.reduce((acc, p) => acc + (p.geologicalChanceOfSuccess ?? 0), 0) / prospects.length;
    const resources = prospects.reduce((acc, p) => acc + p.resourceEstimate, 0);
    return `Portfolio summary: ${prospects.length} prospects, average GCoS ${Math.round(avg * 100)}%, total unrisked resources ${resources} MMboe.`;
  }

  if (q.includes('evidence-derived') || q.includes('evidence derived')) {
    const evProspects = prospects.filter((p) => p.scoringMode === 'evidence_derived');
    return evProspects.length
      ? `Evidence-derived prospects (${evProspects.length}): ${evProspects.map((p) => p.name).join(', ')}.`
      : 'No prospects are currently using evidence-derived scoring.';
  }

  if (q.includes('manual scoring') || q.includes('still manual')) {
    const manual = prospects.filter((p) => !p.scoringMode || p.scoringMode === 'manual');
    return manual.length
      ? `Manual scoring prospects (${manual.length}): ${manual.map((p) => p.name).join(', ')}. Add structured evidence to enable the Geoscience Intelligence Engine.`
      : 'All prospects are using evidence-derived scoring.';
  }

  if (q.includes('evidence supports') || (q.includes('what evidence') && q.includes('support'))) {
    const target = findMentionedProspect(q, prospects) ?? ranked[0];
    if (target.geoscienceAssessment) {
      const positives = target.geoscienceAssessment.components
        .flatMap((c) => c.positiveEvidence)
        .slice(0, 4);
      return positives.length
        ? `Evidence supporting ${target.name}: ${positives.join('; ')}.`
        : `No positive evidence flagged for ${target.name}.`;
    }
    return `${target.name} uses manual scoring and has no structured evidence model yet.`;
  }

  if ((q.includes('evidence') && q.includes('missing')) || q.includes('missing evidence')) {
    const target = findMentionedProspect(q, prospects) ?? ranked[0];
    if (target.geoscienceAssessment) {
      const missing = target.geoscienceAssessment.recommendedNextData.slice(0, 4);
      return missing.length
        ? `Missing evidence for ${target.name}: ${missing.join('; ')}.`
        : `No missing evidence flagged for ${target.name}.`;
    }
    return `${target.name} uses manual scoring. Add structured evidence to enable the Geoscience Intelligence Engine.`;
  }

  if (q.includes('need more seismic') || q.includes('more seismic') || q.includes('needs seismic')) {
    const needSeismic = prospects.filter((p) => p.mainRisk === 'trap' || p.trapScore < 0.40);
    return needSeismic.length
      ? `Prospects needing more seismic data: ${needSeismic.map((p) => `${p.name} (trap score ${p.trapScore.toFixed(2)})`).join(', ')}.`
      : 'No prospects currently flagged for additional seismic.';
  }

  if (q.includes('seal risk')) {
    const sealRisk = prospects.filter((p) => p.mainRisk === 'seal' || p.sealScore < 0.40);
    return sealRisk.length
      ? `Prospects with seal risk: ${sealRisk.map((p) => `${p.name} (seal ${p.sealScore.toFixed(2)})`).join(', ')}.`
      : 'No prospects currently flagged with critical seal risk.';
  }

  if (q.includes('timing uncertainty') || q.includes('timing risk')) {
    const timingRisk = prospects.filter((p) => p.mainRisk === 'timing' || p.timingScore < 0.40);
    return timingRisk.length
      ? `Prospects with timing uncertainty: ${timingRisk.map((p) => `${p.name} (timing ${p.timingScore.toFixed(2)})`).join(', ')}.`
      : 'No prospects currently flagged with critical timing uncertainty.';
  }

  if (q.includes('critical geoscience risk') || q.includes('critical risk')) {
    const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
      const risk = p.mainRisk ?? 'unknown';
      acc[risk] = (acc[risk] ?? 0) + 1;
      return acc;
    }, {});
    const [risk, count] = Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0];
    return `Critical geoscience risk: ${risk} is the main risk in ${count} prospect(s) across the portfolio.`;
  }

  return 'I can answer: "top prospects", "best prospect", "why this score", "data confidence", "weakest component", "strongest components", "main risk", "high resource high risk", "need more data", "portfolio summary", "evidence-derived", "manual scoring", "evidence supports [name]", "missing evidence for [name]", "need more seismic", "seal risk", "timing uncertainty", or "critical geoscience risk".';
};
