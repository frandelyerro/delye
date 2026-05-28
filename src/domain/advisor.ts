import { Prospect } from './prospect';
import {
  componentLabels,
  getGCoSFormulaString,
  getGCoSInterpretation,
  getRecommendedNextStep,
  getStrongestComponents,
  getWeakestComponent
} from './explainability';
import {
  getPortfolioRecommendations,
  getRecommendedAction,
  getRecommendedActionLabel,
  getProspectivityTier,
  getTierLabel,
} from './recommendationEngine';
import { getHighGCoSLowConfidenceProspects, getPortfolioMainRisk } from './portfolioIntelligence';
import { getEconomicAssumptionDefaults, getDecisionSignalLabel } from './economics';

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

  if (q.includes('main risk') && !q.includes('portfolio risk')) {
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

  if ((q.includes('data confidence') || q.includes('confidence')) && !q.includes('high gcos')) {
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

  // ---- Targeting Workbench queries ----

  if (q.includes('drill first') || q.includes('where should we drill') || q.includes('drill candidates') || q.includes('which prospects are drill')) {
    const recs = getPortfolioRecommendations(prospects);
    const drillCandidates = recs.filter((r) => r.action === 'drill_candidate');
    return drillCandidates.length
      ? `Drill candidates: ${drillCandidates.map((r) => `${r.prospectName} (T1, GCoS ${Math.round((prospects.find((p) => p.id === r.prospectId)?.geologicalChanceOfSuccess ?? 0) * 100)}%)`).join(', ')}. All quality gates met — advance to well planning.`
      : 'No drill candidates in the current portfolio. Prospects require additional data or de-risking before FID.';
  }

  if (q.includes('de-risk') || q.includes('derisk') || q.includes('before drill') || q.includes('before drilling')) {
    const recs = getPortfolioRecommendations(prospects);
    const deRisk = recs.filter((r) => ['acquire_additional_seismic', 'validate_reservoir_quality', 'validate_seal_continuity', 'improve_timing_model'].includes(r.action));
    return deRisk.length
      ? `Prospects to de-risk before drilling: ${deRisk.map((r) => `${r.prospectName} (${getRecommendedActionLabel(r.action)})`).join('; ')}.`
      : 'No prospects currently flagged for de-risking.';
  }

  if (q.includes('farm-in') || q.includes('farm in') || q.includes('farmin')) {
    const recs = getPortfolioRecommendations(prospects);
    const farmIn = recs.filter((r) => r.action === 'farm_in_candidate');
    return farmIn.length
      ? `Farm-in candidates: ${farmIn.map((r) => `${r.prospectName} (${prospects.find((p) => p.id === r.prospectId)?.resourceEstimate ?? 0} MMboe)`).join(', ')}.`
      : 'No prospects currently classified as farm-in candidates.';
  }

  if (q.includes('acreage review') || q.includes('acreage')) {
    const recs = getPortfolioRecommendations(prospects);
    const acreage = recs.filter((r) => r.action === 'acreage_review');
    return acreage.length
      ? `Acreage review candidates: ${acreage.map((r) => r.prospectName).join(', ')}.`
      : 'No prospects currently flagged for acreage review.';
  }

  if (q.includes('tier 1') || q.includes('tier1')) {
    const tier1 = prospects.filter((p) => getProspectivityTier(p) === 'tier_1');
    return tier1.length
      ? `Tier 1 targets (${tier1.length}): ${tier1.map((p) => `${p.name} (GCoS ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%, DC ${p.dataConfidence ?? 0}/100)`).join('; ')}.`
      : 'No Tier 1 prospects in the current portfolio.';
  }

  if (q.includes('tier 2') || q.includes('tier2')) {
    const tier2 = prospects.filter((p) => getProspectivityTier(p) === 'tier_2');
    return tier2.length
      ? `Tier 2 targets (${tier2.length}): ${tier2.map((p) => p.name).join(', ')}.`
      : 'No Tier 2 prospects in the current portfolio.';
  }

  if (q.includes('high gcos') && q.includes('low') && (q.includes('confidence') || q.includes('data'))) {
    const flagged = getHighGCoSLowConfidenceProspects(prospects);
    return flagged.length
      ? `High GCoS / low data confidence prospects: ${flagged.map((p) => `${p.name} (GCoS ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%, DC ${p.dataConfidence ?? 0}/100)`).join('; ')}. Do not advance to drill without additional data.`
      : 'No prospects currently flagged with high GCoS and low data confidence.';
  }

  if (q.includes('main portfolio risk') || q.includes('portfolio risk')) {
    const mainRisk = getPortfolioMainRisk(prospects);
    const count = prospects.filter((p) => p.mainRisk === mainRisk).length;
    return `Main portfolio risk: ${mainRisk} is the dominant risk factor in ${count} prospect(s). Target ${mainRisk}-specific data acquisition to achieve the largest risk reduction across the portfolio.`;
  }

  if (q.includes('what should we do next') || q.includes('next as an exploration team') || q.includes('exploration team')) {
    const recs = getPortfolioRecommendations(prospects);
    const drillCount = recs.filter((r) => r.action === 'drill_candidate').length;
    const deRiskCount = recs.filter((r) => ['acquire_additional_seismic', 'validate_reservoir_quality', 'validate_seal_continuity', 'improve_timing_model'].includes(r.action)).length;
    const mainRisk = getPortfolioMainRisk(prospects);
    const topProspect = recs[0];
    const lines = [];
    if (drillCount) lines.push(`${drillCount} drill candidate${drillCount > 1 ? 's' : ''} ready for well planning.`);
    if (deRiskCount) lines.push(`${deRiskCount} prospect${deRiskCount > 1 ? 's' : ''} require ${mainRisk}-risk reduction before upgrade.`);
    const highLowDC = getHighGCoSLowConfidenceProspects(prospects);
    if (highLowDC.length) lines.push(`${highLowDC.length} prospect${highLowDC.length > 1 ? 's' : ''} with high GCoS but low data confidence — acquire data before committing.`);
    if (topProspect) lines.push(`Top-ranked prospect is ${topProspect.prospectName}: ${getRecommendedActionLabel(topProspect.action)}.`);
    return lines.length ? lines.join(' ') : 'Portfolio analysis inconclusive — review prospect data inputs.';
  }

  // ---- Decision Economics queries ----

  if (q.includes('positive emv') || (q.includes('emv') && (q.includes('positive') || q.includes('economic')))) {
    const positive = prospects.filter((p) => (p.economicAssessment?.simpleEMVUsdMM ?? 0) > 0);
    if (!positive.length) return 'No prospects currently show a positive Simple EMV under default assumptions.';
    const sorted = [...positive].sort((a, b) => (b.economicAssessment!.simpleEMVUsdMM) - (a.economicAssessment!.simpleEMVUsdMM));
    return `Prospects with positive EMV (${positive.length}): ${sorted.slice(0, 5).map((p) => `${p.name} ($${p.economicAssessment!.simpleEMVUsdMM.toFixed(0)}M)`).join(', ')}.`;
  }

  if (q.includes('negative emv') || (q.includes('emv') && q.includes('negative'))) {
    const negative = prospects.filter((p) => (p.economicAssessment?.simpleEMVUsdMM ?? 0) < 0);
    if (!negative.length) return 'No prospects currently show a negative Simple EMV.';
    return `Prospects with negative EMV (${negative.length}): ${negative.map((p) => `${p.name} ($${p.economicAssessment!.simpleEMVUsdMM.toFixed(0)}M)`).join(', ')}.`;
  }

  if (q.includes('best economic') || (q.includes('highest emv') || q.includes('best emv'))) {
    const withEcon = prospects.filter((p) => p.economicAssessment);
    if (!withEcon.length) return 'No economic assessments available.';
    const best = [...withEcon].sort((a, b) => (b.economicAssessment!.simpleEMVUsdMM) - (a.economicAssessment!.simpleEMVUsdMM))[0];
    const ea = best.economicAssessment!;
    return `Best economic prospect: ${best.name} — Simple EMV $${ea.simpleEMVUsdMM.toFixed(0)}M, risked resources ${ea.riskedResourceMMboe.toFixed(1)} MMboe, economic grade: ${ea.economicGrade}, decision signal: ${getDecisionSignalLabel(ea.decisionSignal)}.`;
  }

  if ((q.includes('high resource') || q.includes('large resource')) && (q.includes('low gcos') || q.includes('low chance'))) {
    const matches = prospects.filter((p) => p.resourceEstimate >= 100 && (p.geologicalChanceOfSuccess ?? 0) < 0.20);
    if (!matches.length) return 'No prospects currently have high resource (≥100 MMboe) with low GCoS (<20%).';
    return `High resource / low GCoS prospects (${matches.length}): ${matches.map((p) => `${p.name} (${p.resourceEstimate} MMboe, ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}% GCoS, EMV $${(p.economicAssessment?.simpleEMVUsdMM ?? 0).toFixed(0)}M)`).join('; ')}.`;
  }

  if (q.includes('de-risk before investment') || q.includes('de risk before investment') || (q.includes('investment') && q.includes('de-risk'))) {
    const deRisk = prospects.filter((p) => p.economicAssessment?.decisionSignal === 'de_risk_before_investment');
    if (!deRisk.length) return 'No prospects currently flagged as "de-risk before investment".';
    return `Prospects to de-risk before investment (${deRisk.length}): ${deRisk.map((p) => `${p.name} (GCoS ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%, DC ${p.dataConfidence ?? 0}/100)`).join('; ')}. These prospects show geological potential but lack data confidence.`;
  }

  if (q.includes('look economic') || (q.includes('economic') && findMentionedProspect(q, prospects))) {
    const target = findMentionedProspect(q, prospects);
    if (target && target.economicAssessment) {
      const ea = target.economicAssessment;
      return `${target.name} economics: Simple EMV $${ea.simpleEMVUsdMM.toFixed(0)}M, risked resources ${ea.riskedResourceMMboe.toFixed(1)} MMboe, economic grade: ${ea.economicGrade}. Decision signal: ${getDecisionSignalLabel(ea.decisionSignal)}. ${ea.warnings.length ? 'Warnings: ' + ea.warnings[0] : ''}`;
    }
    if (target) return `${target.name} does not have an economic assessment — save the prospect to recalculate.`;
  }

  if (q.includes('portfolio risked resource') || (q.includes('risked resource') && q.includes('portfolio'))) {
    const total = prospects.reduce((acc, p) => acc + (p.economicAssessment?.riskedResourceMMboe ?? 0), 0);
    const unrisked = prospects.reduce((acc, p) => acc + p.resourceEstimate, 0);
    return `Portfolio risked resources: ${total.toFixed(1)} MMboe (vs ${unrisked.toFixed(0)} MMboe unrisked). Risked-to-unrisked ratio: ${unrisked > 0 ? ((total / unrisked) * 100).toFixed(1) : 0}%.`;
  }

  if (q.includes('what assumptions') || q.includes('default assumptions') || (q.includes('economic assumptions') && (q.includes('what') || q.includes('default')))) {
    const d = getEconomicAssumptionDefaults();
    return `Default economic assumptions: oil price $${d.oilPriceUsdPerBbl}/bbl, development cost $${d.developmentCostUsdMM}M, exploration well cost $${d.explorationWellCostUsdMM}M, seismic cost $${d.seismicCostUsdMM}M, lease cost $${d.leaseOrEntryCostUsdMM}M, operating cost $${d.operatingCostUsdPerBbl}/bbl, royalty ${d.royaltyRate * 100}%, NRI ${d.netRevenueInterest}, WI ${d.workingInterest}. These can be customised per prospect in the Edit Prospect form.`;
  }

  return 'I can answer: "top prospects", "best prospect", "why this score", "data confidence", "weakest component", "strongest components", "main risk", "high resource high risk", "need more data", "portfolio summary", "evidence-derived", "manual scoring", "evidence supports [name]", "missing evidence for [name]", "need more seismic", "seal risk", "timing uncertainty", "critical geoscience risk", "drill candidates", "where should we drill first", "de-risk before drill", "farm-in candidates", "acreage review", "tier 1 targets", "tier 2 targets", "high GCoS low data confidence", "main portfolio risk", "what should we do next as an exploration team", "positive EMV prospects", "negative EMV prospects", "best economic prospect", "high resource low GCoS", "de-risk before investment", "does [name] look economic", "portfolio risked resources", or "what are the default economic assumptions".';
};
