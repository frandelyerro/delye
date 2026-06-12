import { Prospect } from './prospect';
import { analyzeSealTrapRisk } from './sealAnalysis';
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
import { getHighGCoSLowConfidenceProspects, getPortfolioMainRisk, getDrillSequenceOrder, getOutcomeStats, getBasinOutcomeStats, getPlayTypeOutcomeStats, getOutcomeCalibration, finiteGcos } from './portfolioIntelligence';
import { getEconomicAssumptionDefaults, getDecisionSignalLabel } from './economics';
import { assessMLReadiness } from './mlReadiness';
import { compareExpertAndML } from './mlModel';
import { buildTrainingRows } from './mlTrainingFeatures';
import { getDefaultMLTrainingConfig } from './mlTrainingService';
import { isKnownOutcome, isGeologicalSuccess, isCommercialSuccess, getOutcomeLabelText } from './outcomes';
import { haversineKm, isValidCoordinate, findNearest, findNearestOutcome, rankByAnalogProximity, basinClusteringStats } from './geoUtils';
import { findAnalogs } from './analogFinder';
import { identifyTargets } from './targetIdentification';

// Summarizes the real labeled training set the baseline model would use.
// Kept pure (no localStorage): advisor answers are based on portfolio
// readiness and the documented model behavior, not the saved model blob.
const summarizeTrainingLabels = (prospects: Prospect[]) => {
  const config = getDefaultMLTrainingConfig();
  const { rows } = buildTrainingRows(prospects, config);
  const positives = rows.filter((r) => r.label === 1).length;
  const negatives = rows.length - positives;
  return { labeled: rows.length, positives, negatives, minExamples: config.minExamples };
};

const findMentionedProspect = (question: string, prospects: Prospect[]): Prospect | undefined => {
  const lowerQuestion = question.toLowerCase();
  return [...prospects]
    .sort((a, b) => b.name.length - a.name.length)
    .find((prospect) => lowerQuestion.includes(prospect.name.toLowerCase()));
};

// Finds up to two distinct prospects mentioned by name in the question, longest names first
// so a shorter name that is a substring of a longer one isn't matched twice.
const findMentionedProspects = (question: string, prospects: Prospect[]): Prospect[] => {
  const lowerQuestion = question.toLowerCase();
  const matches: Prospect[] = [];
  for (const prospect of [...prospects].sort((a, b) => b.name.length - a.name.length)) {
    const name = prospect.name.toLowerCase();
    // Only push if this name doesn't overlap (substring either direction) an already
    // matched name — prevents "Tupi North" also matching a shorter "Tupi" in the same
    // question and producing a bogus self-comparison / wrong second prospect.
    if (
      lowerQuestion.includes(name) &&
      !matches.some((m) => {
        const mn = m.name.toLowerCase();
        return mn.includes(name) || name.includes(mn);
      })
    ) {
      matches.push(prospect);
    }
    if (matches.length === 2) break;
  }
  return matches;
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

  if (q.includes('how is gcos calculated') || q.includes('explain gcos') || q.includes('gcos methodology') || q.includes('how does gcos work')) {
    return 'GCoS (Geological Chance of Success) is the product of 6 independent component probabilities: ' +
      'Source × Migration × Reservoir × Seal × Trap × Timing — each scored 0-1 based on the available evidence. ' +
      'This multiplicative approach follows standard exploration risk methodology (Rose, "Risk Analysis and Management of Petroleum Exploration Ventures" / SPE 26592): ' +
      'a prospect needs ALL elements of the petroleum system to work, so a weakness in any single component drags down the overall chance of success. ' +
      'The known limitation is the independence assumption — in reality some risks are correlated (e.g., a working source often implies migration potential), ' +
      'which the formula does not explicitly capture. Use "why this score" for a specific prospect to see its component breakdown.';
  }

  if ((q.includes('why this score') || q.includes('why is')) && !(q.includes('ml') && q.includes('ready'))) {
    const target = findMentionedProspect(q, prospects) ?? ranked[0];
    return `${target.name}: GCoS calculation ${getGCoSFormulaString(target)}. Strongest components: ${formatComponents(target)}. ` +
      `Weakest component: ${componentLabels[getWeakestComponent(target)]}. Main risk: ${target.mainRisk}. ` +
      `Data Confidence: ${target.dataConfidence ?? 0}/100. ${getGCoSInterpretation(target)} Recommended next step: ${getRecommendedNextStep(target)}`;
  }

  if (q.includes('main risk') && !q.includes('portfolio risk') && !q.includes('migration')) {
    const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
      const risk = p.mainRisk ?? 'unknown';
      acc[risk] = (acc[risk] ?? 0) + 1;
      return acc;
    }, {});
    const riskEntries = Object.entries(riskCount).sort((a, b) => b[1] - a[1]);
    if (!riskEntries.length) return 'No prospects in portfolio to assess main risk.';
    const [risk, count] = riskEntries[0];
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
    const riskEntries = Object.entries(riskCount).sort((a, b) => b[1] - a[1]);
    if (!riskEntries.length) return 'No prospects in portfolio to assess weakest component.';
    const [weakest, count] = riskEntries[0];
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

  const comparePair = q.includes('compare') ? findMentionedProspects(q, prospects) : [];
  if (comparePair.length === 2) {
    const [a, b] = comparePair;
    const componentEntries = (Object.keys(componentLabels) as (keyof typeof componentLabels)[]).map((key) => {
      const componentKey = `${key}Score` as keyof Prospect;
      const aVal = Number(a[componentKey]) || 0;
      const bVal = Number(b[componentKey]) || 0;
      return { key, label: componentLabels[key], aVal, bVal, delta: Math.abs(aVal - bVal) };
    });
    const biggest = [...componentEntries].sort((x, y) => y.delta - x.delta)[0];
    const gcosA = Math.round((a.geologicalChanceOfSuccess ?? 0) * 100);
    const gcosB = Math.round((b.geologicalChanceOfSuccess ?? 0) * 100);
    return `${a.name} (${gcosA}% GCoS) vs ${b.name} (${gcosB}% GCoS): the largest divergence is in ${biggest.label} `
      + `(${a.name} ${biggest.aVal.toFixed(2)} vs ${b.name} ${biggest.bVal.toFixed(2)}). `
      + `${a.name} is strongest in ${formatComponents(a)}; ${b.name} is strongest in ${formatComponents(b)}.`;
  }

  if (q.includes('which component') && (q.includes('prioritize') || q.includes('focus') || q.includes('most') || q.includes('matters most') || q.includes('budget'))) {
    const componentAverages = (Object.keys(componentLabels) as (keyof typeof componentLabels)[]).map((key) => {
      const componentKey = `${key}Score` as keyof Prospect;
      const avg = prospects.reduce((sum, p) => sum + (Number(p[componentKey]) || 0), 0) / prospects.length;
      return { key, label: componentLabels[key], avg };
    });
    const lowest = [...componentAverages].sort((x, y) => x.avg - y.avg)[0];
    const weakestCounts = prospects.reduce<Record<string, number>>((acc, prospect) => {
      const weakest = getWeakestComponent(prospect);
      acc[weakest] = (acc[weakest] ?? 0) + 1;
      return acc;
    }, {});
    const mostFrequentWeakest = Object.entries(weakestCounts).sort((x, y) => y[1] - x[1])[0];
    return `${lowest.label} has the lowest portfolio-average score (${lowest.avg.toFixed(2)}) across ${prospects.length} prospects, `
      + `and ${componentLabels[mostFrequentWeakest[0] as keyof typeof componentLabels]} is the weakest component for ${mostFrequentWeakest[1]} of them. `
      + `Prioritizing ${lowest.label.toLowerCase()}-related data acquisition (e.g. additional seismic, geochemistry, or pressure data depending on which component) is likely to give the best portfolio-wide de-risking return.`;
  }

  if (q.includes('portfolio summary')) {
    const avg = prospects.reduce((acc, p) => acc + finiteGcos(p), 0) / prospects.length;
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

  if (q.includes('fault seal') || q.includes('faulted seal')) {
    const withFaultRisk = prospects
      .map((p) => ({ p, risk: p.evidence?.seal?.faultSealRisk }))
      .filter((x): x is { p: Prospect; risk: 'low' | 'medium' | 'high' } =>
        x.risk === 'low' || x.risk === 'medium' || x.risk === 'high');
    if (!withFaultRisk.length) {
      return 'No prospects have fault seal risk recorded in their seal evidence. Add faultSealRisk (low/medium/high) to seal evidence to enable fault-seal-specific risking.';
    }
    const high = withFaultRisk.filter((x) => x.risk === 'high');
    const medium = withFaultRisk.filter((x) => x.risk === 'medium');
    return `Fault seal risk: ${high.length} prospect(s) flagged HIGH${high.length ? `: ${high.map((x) => x.p.name).join(', ')}` : ''}. ${medium.length} prospect(s) flagged MEDIUM${medium.length ? `: ${medium.map((x) => x.p.name).join(', ')}` : ''}. High fault seal risk indicates potential cross-fault leakage via low shale gouge ratio or unfavorable juxtaposition — de-risk with fault seal analysis (SGR, juxtaposition diagrams) and offset-well pressure data.`;
  }

  if (q.includes('seal lithology') || q.includes('subsalt seal') || q.includes('seal type') || q.includes('evaporite seal')) {
    const { crossTab, subsaltNonEvaporiteRisks } = analyzeSealTrapRisk(prospects);
    const recorded = crossTab.filter((row) => row.lithology !== 'unrecorded');
    const distribution = recorded.length
      ? recorded.map((row) => `${row.lithology}${row.trapType !== 'unrecorded' ? `/${row.trapType}` : ''} (${row.count})`).join(', ')
      : 'no seal lithology recorded across the portfolio';
    const subsaltNote = subsaltNonEvaporiteRisks.length
      ? ` ${subsaltNonEvaporiteRisks.length} subsalt trap(s) have a non-evaporite or unrecorded seal lithology: ${subsaltNonEvaporiteRisks.map((r) => `${r.prospectName} (${r.sealLithology})`).join(', ')}. Per AAPG Memoir 74 and Knipe et al. (1997), subsalt traps typically rely on the overlying salt itself as the top seal — a non-evaporite seal here suggests either an unproven internal/secondary seal or a data-entry inconsistency worth reviewing.`
      : ' No subsalt traps with a non-evaporite seal lithology were found.';
    return `Seal lithology x trap type distribution: ${distribution}.${subsaltNote}`;
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

  if (q.includes('migration risk') || q.includes('charge risk') ||
      (q.includes('migration') && (q.includes('assess') || q.includes('pathway') || q.includes('carrier')))) {
    const lowMig = prospects.filter((p) => p.migrationScore < 0.30);
    const mainMigRisk = prospects.filter((p) => p.mainRisk === 'migration');
    const avgMig = prospects.length ? prospects.reduce((s, p) => s + p.migrationScore, 0) / prospects.length : 0;
    return `Migration risk: avg migration score ${(avgMig * 100).toFixed(0)}%. ${lowMig.length} prospect(s) score <30%${lowMig.length ? `: ${lowMig.map((p) => p.name).join(', ')}` : ''}. ${mainMigRisk.length} prospect(s) list migration as main risk${mainMigRisk.length ? `: ${mainMigRisk.map((p) => p.name).join(', ')}` : ': none'}. De-risk via carrier bed mapping, fault connectivity analysis, and hydrocarbon shows correlation.`;
  }

  if (q.includes('kitchen') || q.includes('charge distance') || q.includes('migration distance')) {
    const withDistance = prospects
      .map((p) => ({ p, km: p.evidence?.migration?.distanceFromKitchenKm }))
      .filter((x): x is { p: Prospect; km: number } => typeof x.km === 'number');
    if (!withDistance.length) {
      return 'No source-kitchen distance evidence is recorded for this portfolio. Capture distanceFromKitchenKm in migration evidence to assess lateral charge risk.';
    }
    const farFromKitchen = withDistance.filter((x) => x.km > 50);
    return farFromKitchen.length
      ? `Prospects with long migration distance from the source kitchen (>50 km): ${farFromKitchen.map((x) => `${x.p.name} (${x.km.toFixed(0)} km)`).join(', ')}. Lateral migration over long distances increases charge risk — validate with seismic mapping and pressure data.`
      : `All ${withDistance.length} prospect(s) with recorded kitchen distance are within 50 km of the source kitchen — lateral charge risk from migration distance is limited.`;
  }

  if (q.includes('critical geoscience risk') || q.includes('critical risk')) {
    const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
      const risk = p.mainRisk ?? 'unknown';
      acc[risk] = (acc[risk] ?? 0) + 1;
      return acc;
    }, {});
    const riskEntries = Object.entries(riskCount).sort((a, b) => b[1] - a[1]);
    if (!riskEntries.length) return 'No prospects in portfolio to assess critical geoscience risk.';
    const [risk, count] = riskEntries[0];
    return `Critical geoscience risk: ${risk} is the main risk in ${count} prospect(s) across the portfolio.`;
  }

  if (q.includes('risk reward') || q.includes('risk-reward') || q.includes('capital efficiency') ||
      (q.includes('best value') && (q.includes('risk') || q.includes('capital') || q.includes('portfolio')))) {
    const seq = getDrillSequenceOrder(prospects, 5);
    if (!seq.length) return 'No prospects in portfolio to rank for risk-reward.';
    return `Risk-reward ranking (50% GCoS + 30% commercial score + 20% data confidence): ${seq.map((e) => `#${e.rank} ${e.prospectName} (score ${e.compositeScore}, GCoS ${e.gcos}%)`).join('; ')}. Highest composite score indicates best capital-efficiency candidate. Where EMV data is available, prefer prospects with both high composite score and positive EMV — negative-EMV top-ranked prospects may not clear the commercial hurdle.`;
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

  // ---- Trained ML baseline queries ----

  if (
    q.includes('use ml to decide') ||
    q.includes('ml to decide drilling') ||
    (q.includes('ml') && q.includes('decide') && q.includes('drill')) ||
    (q.includes('ml') && q.includes('drilling') && q.includes('decision'))
  ) {
    return 'No. The trained ML model is a local prototype and is advisory only — it must not be used to decide drilling. Expert-system GCoS, prospect priority, recommended actions, drill-candidate logic, and economics decision signals remain the source of truth. Use the ML probability only as a secondary cross-check, never as the deciding factor.';
  }

  if (
    q.includes('how accurate') ||
    q.includes('model accuracy') ||
    (q.includes('ml') && q.includes('accuracy'))
  ) {
    const { labeled, positives, negatives } = summarizeTrainingLabels(prospects);
    const balanceNote = positives < 10 || negatives < 10
      ? ' The current label set is small or imbalanced, so any reported accuracy will be unstable.'
      : '';
    return `The trained baseline is a local logistic-regression prototype. Accuracy is measured on a held-out test split and shown in ML Lab (accuracy, precision, recall, F1, Brier score) after you train. With ${labeled} labeled example(s) (${positives} positive / ${negatives} negative), expect limited reliability.${balanceNote} ML output is advisory only and never overrides expert-system GCoS or targeting gates.`;
  }

  if (
    q.includes('features drive') ||
    q.includes('drive the ml') ||
    (q.includes('feature') && q.includes('ml') && (q.includes('which') || q.includes('what') || q.includes('drive')))
  ) {
    return 'The baseline model uses only safe pre-drill features: latitude, longitude, the six geoscience component scores (source, migration, reservoir, seal, trap, timing), data confidence, the evidence-derived flag, evidence completeness, main-risk one-hot flags, and encoded basin/play type. Expert-calibration mode additionally includes the expert-system GCoS. Post-drill measurements, reserves, economics, prospectivity tier, priority, and the outcome label are never used as inputs — including them would cause data leakage. Per-prospect top factors appear in ML Lab and on each Prospect Detail page. ML is advisory only.';
  }

  if (
    q.includes('why is ml not ready') ||
    q.includes('why not ready') ||
    (q.includes('ml') && q.includes('not ready'))
  ) {
    const readiness = assessMLReadiness(prospects);
    const { labeled, positives, negatives, minExamples } = summarizeTrainingLabels(prospects);
    const reasons: string[] = [];
    if (labeled < minExamples) reasons.push(`only ${labeled} labeled real outcome(s) (need at least ${minExamples} to train)`);
    if (positives < 10) reasons.push(`only ${positives} positive example(s)`);
    if (negatives < 10) reasons.push(`only ${negatives} negative example(s)`);
    if (!reasons.length) reasons.push('the dataset meets the minimum size but still needs more balanced, calibrated examples for reliable metrics');
    return `ML is not ready because ${reasons.join('; ')}. Portfolio readiness: ${readiness.readinessScore}/100 (${readiness.status}). Record real historical outcomes (discoveries and dry holes) on prospects, then train in ML Lab. The trained model stays advisory only and never overrides expert-system GCoS.`;
  }

  if (
    q.includes('how many labels') ||
    q.includes('labels do we need') ||
    q.includes('labels needed') ||
    (q.includes('how many') && q.includes('label') && q.includes('need'))
  ) {
    const { labeled, positives, negatives, minExamples } = summarizeTrainingLabels(prospects);
    return `You currently have ${labeled} real labeled example(s) (${positives} positive / ${negatives} negative). The baseline trains with at least ${minExamples}; for more reliable metrics aim for 100+ labeled outcomes with at least 10 of each class (discoveries and dry holes). Synthetic labels do not count toward real training. Add outcomes via the Historical Outcome section on each prospect, label many at once on the Outcome Labeling page (/outcomes), or import a labeled dataset from ML Lab.`;
  }

  if (
    q.includes('train the ml model') ||
    q.includes('train the model') ||
    q.includes('how do i train') ||
    q.includes('how to train')
  ) {
    const { labeled, minExamples } = summarizeTrainingLabels(prospects);
    const readyNote = labeled >= minExamples
      ? `You have ${labeled} labeled example(s) — enough to train.`
      : `You have ${labeled} labeled example(s); at least ${minExamples} are required.`;
    return `To train the local baseline: open ML Lab → "Train Baseline ML Model", choose a target (hydrocarbon presence, geological success, or commercial success) and feature mode (safe pre-drill or expert calibration), pick a train/test split, and click Train baseline model. ${readyNote} Training runs entirely in your browser — no backend, no external API. The result is a logistic-regression prototype that is advisory only and never overrides expert-system GCoS or targeting gates.`;
  }

  // ---- ML queries ----

  if (
    q.includes('is the ml model trained') ||
    q.includes('is ml trained') ||
    q.includes('ml model trained') ||
    (q.includes('ml') && q.includes('trained'))
  ) {
    return 'No trained ML model is wired into targeting — expert-system GCoS remains the source of truth. You can now train a local baseline prototype in ML Lab from labeled historical outcomes; once trained and saved it appears as an advisory prediction on each Prospect Detail page, but it never overrides GCoS, priority, or drill-candidate logic. See the ML Lab page (/ml-lab) for readiness and training.';
  }

  if (
    q.includes('can we train ml') ||
    q.includes('can we train') ||
    (q.includes('train') && q.includes('ml'))
  ) {
    const readiness = assessMLReadiness(prospects);
    if (readiness.status === 'ready_for_training') {
      return `The portfolio meets baseline training thresholds, but real training requires labeled historical outcomes (discoveries, dry holes). Current status: ${readiness.status} (${readiness.readinessScore}/100). Export features from ML Lab and connect a training pipeline.`;
    }
    return `Not yet ready for ML training. Status: ${readiness.status} (${readiness.readinessScore}/100). Missing: ${readiness.missingRequirements.slice(0, 2).join('; ')}. Collect labeled historical well outcomes and increase evidence-derived prospect coverage.`;
  }

  if (
    q.includes('data for ml') ||
    q.includes('ml data') ||
    q.includes('data do we need for ml') ||
    q.includes('ml data requirements') ||
    (q.includes('ml') && q.includes('need') && q.includes('data'))
  ) {
    return 'To train a real ML model you need: (1) labeled historical well outcomes — commercial discoveries, technical discoveries, dry holes, non-commercial wells; (2) at least 100 labeled examples; (3) at least 30 evidence-derived prospects with structured geological evidence; (4) basin and play-type labels; (5) seismic, well log, and geochemical attributes where available. Synthetic labels derived from expert scores are development-only and not suitable for real ML claims.';
  }

  if (
    q.includes('export training dataset') ||
    q.includes('training dataset') ||
    (q.includes('export') && q.includes('training'))
  ) {
    return 'You can export the synthetic training dataset from the ML Lab page (/ml-lab) in JSON or CSV format. The dataset is built from current portfolio features with synthetic labels derived from expert-system scores. Remember: synthetic labels are development-only and must not be used for real ML claims or investment decisions.';
  }

  if (
    q.includes('how does ml compare') ||
    q.includes('ml vs expert') ||
    q.includes('ml compared') ||
    (q.includes('ml') && q.includes('compare'))
  ) {
    const target = findMentionedProspect(q, prospects);
    if (target) {
      const cmp = compareExpertAndML(target);
      return `${target.name}: expert GCoS ${Math.round(cmp.expertGCoS * 100)}%, baseline predicted ${Math.round(cmp.predictedGCoS * 100)}%, delta ${cmp.delta >= 0 ? '+' : ''}${Math.round(cmp.delta * 100)}pp, agreement: ${cmp.agreement}. ${cmp.interpretation} Note: baseline is deterministic, not a trained ML model.`;
    }
    const highDivergence = prospects
      .map((p) => ({ p, cmp: compareExpertAndML(p) }))
      .filter(({ cmp }) => cmp.agreement === 'low')
      .map(({ p }) => p.name);
    return highDivergence.length
      ? `Prospects with low expert/baseline agreement (${highDivergence.length}): ${highDivergence.join(', ')}. These prospects have the largest divergence between expert-system GCoS and the deterministic baseline — they benefit most from additional evidence collection. No trained ML model is connected yet.`
      : 'All prospects currently show medium or high agreement between expert-system GCoS and the deterministic baseline. No trained ML model is connected yet — baseline is development-only.';
  }

  if (
    q.includes('ml-ready prospects') ||
    q.includes('ml ready prospects') ||
    q.includes('which prospects are ml') ||
    (q.includes('ml') && q.includes('ready'))
  ) {
    const readiness = assessMLReadiness(prospects);
    const evidenceDerived = prospects.filter((p) => p.scoringMode === 'evidence_derived');
    const highDC = prospects.filter((p) => (p.dataConfidence ?? 0) >= 70);
    return `ML readiness: ${readiness.readinessScore}/100 (${readiness.status}). Evidence-derived prospects (${evidenceDerived.length}): ${evidenceDerived.length ? evidenceDerived.map((p) => p.name).join(', ') : 'none'}. High data confidence (${highDC.length}): ${highDC.length ? highDC.map((p) => p.name).join(', ') : 'none'}. ${readiness.missingRequirements[0] ?? 'Portfolio is ready for baseline testing.'}`;
  }

  // ---- Outcome queries ----

  if (
    q.includes('prospects with outcomes') ||
    q.includes('which prospects have outcomes') ||
    q.includes('labeled prospects') ||
    (q.includes('outcome') && (q.includes('which') || q.includes('list') || q.includes('have')))
  ) {
    const withOutcomes = prospects.filter((p) => p.outcome && isKnownOutcome(p.outcome));
    if (!withOutcomes.length) {
      return 'No prospects have recorded historical outcomes yet. Add well outcomes in the Edit Prospect form (Historical Outcome section), or label several at once on the Outcome Labeling page (/outcomes), to build a real ML training dataset. No trained ML model is connected.';
    }
    return `Prospects with recorded outcomes (${withOutcomes.length}): ${withOutcomes.map((p) => `${p.name} (${getOutcomeLabelText(p.outcome!.label)})`).join(', ')}. These are included in the real training dataset export on the ML Lab page. Use the Outcome Labeling page (/outcomes) to label more prospects in bulk. No trained ML model is connected yet.`;
  }

  if (
    q.includes('how many labeled') ||
    q.includes('labeled examples') ||
    q.includes('how many outcomes') ||
    (q.includes('labeled') && q.includes('count'))
  ) {
    const readiness = assessMLReadiness(prospects);
    return `Labeled examples: ${readiness.labeledExamples} of ${readiness.totalProspects} prospects have known historical outcomes. Known success/failure count: ${readiness.knownSuccessFailureCount}. ML training requires at least 100 labeled examples and 50 known success/failure outcomes. No trained ML model is connected yet — collect real historical well outcomes first.`;
  }

  if (
    q.includes('can we train') && (q.includes('outcome') || q.includes('labeled')) ||
    (q.includes('ready to train') && !q.includes('ml model trained'))
  ) {
    const readiness = assessMLReadiness(prospects);
    return `Training readiness: ${readiness.readinessScore}/100 (${readiness.status}). Labeled examples: ${readiness.labeledExamples}/100 required. Known success/failure: ${readiness.knownSuccessFailureCount}/50 required. Evidence-derived prospects: ${readiness.evidenceDerivedCount}/30 required. ${readiness.labeledExamples < 100 ? 'Collect more historical well outcomes before initiating ML training.' : 'Minimum labeled examples reached — proceed to feature export and model training pipeline setup.'}`;
  }

  if (
    q.includes('dry holes') ||
    q.includes('dry hole prospects') ||
    (q.includes('outcome') && q.includes('dry'))
  ) {
    const dryHoles = prospects.filter((p) => p.outcome?.label === 'dry_hole');
    if (!dryHoles.length) return 'No prospects currently recorded as dry holes. Add historical well outcomes in the Edit Prospect form to build a real ML training dataset.';
    return `Dry hole prospects (${dryHoles.length}): ${dryHoles.map((p) => `${p.name}${p.outcome?.wellName ? ` (${p.outcome.wellName})` : ''}${p.outcome?.drillYear ? `, ${p.outcome.drillYear}` : ''}`).join('; ')}. These are included in the real training dataset as negative examples.`;
  }

  if (
    q.includes('commercial discoveries') ||
    q.includes('discovery prospects') ||
    (q.includes('outcome') && (q.includes('commercial') || q.includes('discover')))
  ) {
    const discoveries = prospects.filter((p) => p.outcome && isCommercialSuccess(p.outcome));
    const technical = prospects.filter((p) => p.outcome && isGeologicalSuccess(p.outcome) && !isCommercialSuccess(p.outcome));
    if (!discoveries.length && !technical.length) return 'No discovery outcomes recorded yet. Add historical well outcomes in the Edit Prospect form.';
    const lines: string[] = [];
    if (discoveries.length) lines.push(`Commercial discoveries (${discoveries.length}): ${discoveries.map((p) => p.name).join(', ')}.`);
    if (technical.length) lines.push(`Technical discoveries (${technical.length}): ${technical.map((p) => p.name).join(', ')}.`);
    return lines.join(' ') + ' These are positive examples in the real training dataset. No trained ML model is connected yet.';
  }

  if (
    q.includes('success rate') ||
    q.includes('success rates') ||
    (q.includes('success') && (q.includes('by basin') || q.includes('by play') || q.includes('per basin') || q.includes('per play')))
  ) {
    const stats = getOutcomeStats(prospects);
    if (!stats.totalDrilled) {
      return 'No drilled outcomes recorded yet, so no success rates can be computed. Label outcomes in bulk on the Outcome Labeling page (/outcomes) or per prospect via the Historical Outcome section.';
    }
    const byBasin = getBasinOutcomeStats(prospects);
    const byPlay = getPlayTypeOutcomeStats(prospects);
    const lines: string[] = [
      `Portfolio success rates (${stats.totalDrilled} drilled): ${stats.geologicalSuccessRate}% geological, ${stats.commercialSuccessRate}% commercial (${stats.commercialDiscoveries} commercial discoveries, ${stats.technicalDiscoveries} technical, ${stats.dryHoles} dry holes, ${stats.nonCommercial} non-commercial).`,
    ];
    if (byBasin.length) {
      lines.push(`By basin: ${byBasin.map((b) => `${b.group} ${b.geologicalSuccessRate}% geological over ${b.drilled} well${b.drilled !== 1 ? 's' : ''} (avg pre-drill GCoS ${b.avgPredrillGcos}%)`).join('; ')}.`);
    }
    if (byPlay.length) {
      lines.push(`By play type: ${byPlay.map((p) => `${p.group} ${p.geologicalSuccessRate}% geological over ${p.drilled} well${p.drilled !== 1 ? 's' : ''} (avg pre-drill GCoS ${p.avgPredrillGcos}%)`).join('; ')}.`);
    }
    lines.push('Groups with fewer than 5 wells are statistically noisy — treat their rates as indicative only. See the Calibration page (/calibration) for the actual-vs-predicted breakdown.');
    return lines.join(' ');
  }

  if (
    q.includes('calibrat') ||
    q.includes('actual vs predicted') ||
    q.includes('predicted vs actual') ||
    (q.includes('gcos') && q.includes('outcome') && (q.includes('match') || q.includes('compare')))
  ) {
    const populated = getOutcomeCalibration(prospects).filter((b) => b.drilled > 0);
    if (!populated.length) {
      return 'GCoS calibration compares predicted chance of success against observed drilling outcomes (Rose & Associates lookback methodology). No drilled outcomes are recorded yet — label outcomes on the Outcome Labeling page (/outcomes), then check the Calibration page (/calibration).';
    }
    const rows = populated.map((b) => `${b.label} GCoS bucket: ${b.actualSuccessRate}% actual success over ${b.drilled} well${b.drilled !== 1 ? 's' : ''} (calibrated would be ~${b.expectedSuccessRate}%)`);
    const overconfident = populated.filter((b) => b.drilled >= 5 && b.actualSuccessRate < b.expectedSuccessRate - 10);
    const underconfident = populated.filter((b) => b.drilled >= 5 && b.actualSuccessRate > b.expectedSuccessRate + 10);
    let verdict = 'Buckets with fewer than 5 wells are too small to judge calibration.';
    if (overconfident.length) verdict = `GCoS appears OPTIMISTIC in ${overconfident.map((b) => b.label).join(', ')} — actual success ran below prediction; tighten risking in those ranges.`;
    else if (underconfident.length) verdict = `GCoS appears CONSERVATIVE in ${underconfident.map((b) => b.label).join(', ')} — actual success ran above prediction.`;
    else if (populated.some((b) => b.drilled >= 5)) verdict = 'Populated buckets with 5+ wells are within ±10% of prediction — GCoS looks reasonably calibrated so far.';
    return `GCoS calibration vs drilled outcomes: ${rows.join('; ')}. ${verdict} Full chart on the Calibration page (/calibration).`;
  }

  // ---- Norway FactPages Adapter queries ----

  if (
    q.includes('norway factpages') ||
    q.includes('factpages') ||
    q.includes('sokkeldirektoratet') ||
    q.includes('norwegian wells') ||
    q.includes('npd data') ||
    (q.includes('norway') && (q.includes('wellbore') || q.includes('adapter') || q.includes('import') || q.includes('data') || q.includes('offshore')))
  ) {
    return 'PetroTarget AI includes a Norway Sokkeldirektoratet FactPages adapter. Download the wellbore_exploration_all CSV export from factpages.sodir.no, then upload it in the ML Lab Import section. The tool automatically detects the Norway wellbore format and shows a "Convert using Norway adapter" button. Optionally enrich with discovery, reserves, description, and field CSVs from the same site. Outcome labels (dry_hole, technical_discovery, commercial_discovery) are derived from the HC content column and discovery/field association. Note: FactPages does not include pre-drill geological scores — all six component scores default to 0.5 and GCoS defaults to 0.015625. These defaults cannot substitute for real expert-system scoring.';
  }

  if (
    q.includes('convert norway') ||
    q.includes('norway convert') ||
    q.includes('norway csv') ||
    (q.includes('norway') && q.includes('convert'))
  ) {
    return 'To convert a Norway FactPages wellbore CSV: (1) Upload wellbore_exploration_all.csv in ML Lab → Import Historical Dataset. (2) The adapter detects the Norway format and shows enrichment file slots. (3) Optionally upload discovery.csv, discovery_reserves.csv, discovery_description.csv, and field.csv from Sokkeldirektoratet FactPages for better outcome coverage. (4) Click "Convert using Norway adapter" to map the Norway columns to PetroTarget\'s 28-column import schema. (5) Review the validation results and import valid rows. Geological component scores default to 0.5 — update them manually per prospect after import.';
  }

  if (
    q.includes('norway limitations') ||
    q.includes('norway scores') ||
    q.includes('norway gcos') ||
    (q.includes('norway') && (q.includes('limitation') || q.includes('score') || q.includes('default')))
  ) {
    return 'Norway FactPages limitations: (1) No pre-drill geological scores are published — all six component scores (source, migration, reservoir, seal, trap, timing) default to 0.5, and GCoS defaults to 0.015625 (the product of six 0.5 scores). (2) Outcome labels are inferred from the HC content column and discovery/field status — accuracy depends on the completeness of the FactPages data. (3) Resource estimates come from the reserves dataset (Rec. oil eq. [mill OE]) and may not reflect current reserve estimates. (4) Scoring mode is always set to manual — no geoscience evidence is captured from FactPages. Review and update each imported prospect with real geological data to produce meaningful GCoS estimates.';
  }

  // ---- Dataset import queries ----

  if (
    q.includes('how do i import') ||
    q.includes('how to import') ||
    q.includes('import ml data') ||
    q.includes('import dataset') ||
    (q.includes('import') && q.includes('csv'))
  ) {
    return 'To import a historical ML dataset: go to the ML Lab page (/ml-lab) and scroll to the "Import Historical Dataset" section. Upload a CSV file containing the required columns (prospect_id, prospect_name, basin, play_type, latitude, longitude, component scores, outcome_label, target_variable, and others). The tool will validate your CSV, flag missing columns and invalid values, and allow you to preview rows before importing into the portfolio. Synthetic rows (is_synthetic=true) and unknown outcome labels are excluded from the real labeled training set. Download the minimum CSV template from ML Lab to see the exact required format.';
  }

  if (
    q.includes('dataset fail') ||
    q.includes('validation failed') ||
    q.includes('why did') && q.includes('fail') ||
    (q.includes('import') && q.includes('fail'))
  ) {
    return 'Dataset validation failures have two severity levels. Critical issues block row import: missing required columns, invalid lat/lon coordinates (outside [-90,90] / [-180,180]), scores outside [0,1], data_confidence or commercial_score outside [0,100], resource_estimate_mmboe below 0, unrecognised outcome_label or target_variable, or invalid main_risk. Warnings do not block import but indicate quality problems: synthetic rows, unknown outcome labels, no dry holes (class imbalance), and post-drill leakage columns. Fix critical issues in your source data and re-upload.';
  }

  if (
    q.includes('columns required') ||
    q.includes('required columns') ||
    q.includes('what columns') && q.includes('import') ||
    (q.includes('column') && q.includes('import') && q.includes('need'))
  ) {
    return 'Required columns for ML dataset import: prospect_id, prospect_name, basin, country, block, play_type, latitude, longitude, source_score, migration_score, reservoir_score, seal_score, trap_score, timing_score, gcos_expert, main_risk, data_confidence, resource_estimate_mmboe, commercial_score, scoring_mode, outcome_label, target_variable, hydrocarbon_present, geological_success, commercial_success, result_confidence, data_source, is_synthetic. Optional geology columns: toc_percent, ro_percent, tmax_c, porosity_percent, permeability_md, seal_thickness_m, closure_area_km2. Download the CSV template from the ML Lab page for the exact format.';
  }

  if (
    q.includes('can i train') && q.includes('dataset') ||
    q.includes('train with this') ||
    (q.includes('ready to train') && (q.includes('import') || q.includes('dataset')))
  ) {
    const readiness = assessMLReadiness(prospects);
    return `Training readiness: ${readiness.readinessScore}/100 (${readiness.status}). An imported dataset is ready for training when it provides at least 100 labeled real outcomes (outcome_label ≠ unknown, is_synthetic = false), at least 50 known success/failure examples (discoveries + dry holes), and at least 30 evidence-derived prospects. Synthetic labels (is_synthetic=true) do NOT count as real training examples. Current portfolio labeled count: ${readiness.labeledExamples}/100 required. Import a real historical dataset from the ML Lab page (/ml-lab) and ensure is_synthetic=false for real well outcomes.`;
  }

  if (
    q.includes('post-drill leakage') ||
    q.includes('post drill leakage') ||
    q.includes('leakage') && q.includes('column') ||
    q.includes('what is leakage')
  ) {
    return 'Post-drill leakage refers to columns that contain information only available AFTER a well has been drilled: actual_net_pay_m, actual_porosity_percent, actual_permeability_md, actual_initial_rate_bopd, actual_reserves_mmboe, actual_recoverable_resource_mmboe, actual_development_status. If these are used as predictive ML features, the model will appear to perform well in training but will fail completely on new undrilled prospects — because the "feature" values are not available at prediction time. These columns should be used for outcome labeling and evaluation only, never as model inputs. PetroTarget AI will flag these columns as warnings during import.';
  }

  // ── Spatial / map queries ─────────────────────────────────────────────────

  if (
    (q.includes('basin') && (q.includes('distribution') || q.includes('overview') || q.includes('analysis') || q.includes('breakdown') || q.includes('stats'))) ||
    q.includes('by basin') ||
    q.includes('basin summary')
  ) {
    const basinMap = new Map<string, Prospect[]>();
    for (const p of prospects) {
      if (!isValidCoordinate(p.latitude, p.longitude)) continue;
      const list = basinMap.get(p.basin) ?? [];
      list.push(p);
      basinMap.set(p.basin, list);
    }
    const sorted = [...basinMap.entries()]
      .map(([basin, ps]) => ({
        basin,
        count: ps.length,
        avgGcos: ps.reduce((s, p) => s + finiteGcos(p), 0) / ps.length,
        high: ps.filter((p) => p.priority === 'high').length,
      }))
      .sort((a, b) => b.avgGcos - a.avgGcos);
    const lines = sorted
      .map((b) => `${b.basin}: ${b.count} prospect${b.count !== 1 ? 's' : ''}, avg GCoS ${Math.round(b.avgGcos * 100)}%, ${b.high} high-priority`)
      .join('; ');
    return `Basin distribution across ${sorted.length} basin${sorted.length !== 1 ? 's' : ''} — ${lines}. Best performing basin by average GCoS: ${sorted[0]?.basin ?? '—'}. Focus exploration budget on the highest-GCoS basin with adequate data confidence.`;
  }

  if (
    q.includes('best basin') || q.includes('strongest basin') || q.includes('top basin') ||
    q.includes('worst basin') || q.includes('weakest basin')
  ) {
    const basinMap = new Map<string, Prospect[]>();
    for (const p of prospects) {
      if (!isValidCoordinate(p.latitude, p.longitude)) continue;
      const list = basinMap.get(p.basin) ?? [];
      list.push(p);
      basinMap.set(p.basin, list);
    }
    const sorted = [...basinMap.entries()]
      .map(([basin, ps]) => ({
        basin,
        count: ps.length,
        avgGcos: ps.reduce((s, p) => s + finiteGcos(p), 0) / ps.length,
      }))
      .sort((a, b) => b.avgGcos - a.avgGcos);
    if (!sorted.length) return 'No prospects with valid coordinates to compare basins.';
    const best = sorted[0];
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;
    const middle = sorted.slice(1, -1).map((b) => `${b.basin} (${Math.round(b.avgGcos * 100)}%)`).join(', ');
    const worstStr = worst ? ` Weakest basin: ${worst.basin} (${Math.round(worst.avgGcos * 100)}%, ${worst.count} prospect${worst.count !== 1 ? 's' : ''}).` : '';
    return `Best basin by avg GCoS: ${best.basin} (${Math.round(best.avgGcos * 100)}%, ${best.count} prospect${best.count !== 1 ? 's' : ''}).${worstStr}${middle ? ` Other basins: ${middle}.` : ''}`;
  }

  if (
    q.includes('map overview') || q.includes('map summary') || q.includes('map insights') ||
    q.includes('spatial overview') || q.includes('spatial summary') ||
    (q.includes('geographic') && (q.includes('overview') || q.includes('summary') || q.includes('distribution')))
  ) {
    const basinCount = new Set(prospects.map((p) => p.basin)).size;
    const avgGcos = (prospects.reduce((s, p) => s + finiteGcos(p), 0) / prospects.length * 100).toFixed(1);
    const high = prospects.filter((p) => p.priority === 'high').length;
    const medium = prospects.filter((p) => p.priority === 'medium').length;
    const low = prospects.filter((p) => p.priority === 'low').length;
    const lats = prospects.map((p) => p.latitude).filter(Number.isFinite);
    const lons = prospects.map((p) => p.longitude).filter(Number.isFinite);
    const latRange = lats.length ? `${Math.min(...lats).toFixed(1)}° to ${Math.max(...lats).toFixed(1)}°` : '?';
    const lonRange = lons.length ? `${Math.min(...lons).toFixed(1)}° to ${Math.max(...lons).toFixed(1)}°` : '?';
    return `Spatial map overview: ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} across ${basinCount} basin${basinCount !== 1 ? 's' : ''}. Geographic extent — lat ${latRange}, lon ${lonRange}. Portfolio average GCoS: ${avgGcos}%. Priority split: ${high} high, ${medium} medium, ${low} low. Use the basin/priority filters on the map to zoom in on specific areas. Export as GeoJSON from the Map page to open in GeoLibre for advanced spatial analysis.`;
  }

  if (
    q.includes('basin spacing') || q.includes('basin density') ||
    q.includes('cluster density') || q.includes('cluster spacing') ||
    q.includes('nearest neighbor') || q.includes('nearest-neighbor') ||
    (q.includes('infrastructure') && (q.includes('shar') || q.includes('tie-back') || q.includes('tieback')))
  ) {
    const stats = basinClusteringStats(prospects);
    if (!stats.length) {
      return 'Basin clustering/spacing analysis requires at least 2 prospects with valid coordinates in the same basin. No basin currently qualifies.';
    }
    const dense = stats.filter((s) => s.isDense);
    const scattered = stats.filter((s) => !s.isDense);
    const summary = stats
      .map((s) => `${s.basin} (${s.count} prospects, avg NN ${Math.round(s.avgNearestNeighborKm)} km, range ${Math.round(s.minNearestNeighborKm)}–${Math.round(s.maxNearestNeighborKm)} km)`)
      .join('; ');
    return `Basin cluster spacing: ${summary}. ${dense.length ? `Dense basins (avg nearest-neighbor < ${100} km) — ${dense.map((s) => s.basin).join(', ')} — are strong candidates for shared facilities, pipelines, or multi-well pads.` : 'No basin currently averages under 100 km between nearest neighbors.'} ${scattered.length ? `Scattered basins (${scattered.map((s) => s.basin).join(', ')}) likely require standalone tie-backs.` : ''}`;
  }

  if (
    q.includes('cluster') &&
    (q.includes('basin') || q.includes('region') || q.includes('group') || q.includes('spatial') || q.includes('analysis'))
  ) {
    const basinMap = new Map<string, Prospect[]>();
    for (const p of prospects) {
      const list = basinMap.get(p.basin) ?? [];
      list.push(p);
      basinMap.set(p.basin, list);
    }
    const clusters = [...basinMap.entries()]
      .map(([basin, ps]) => ({
        basin,
        count: ps.length,
        avgGcos: ps.reduce((s, p) => s + finiteGcos(p), 0) / ps.length,
      }))
      .sort((a, b) => b.count - a.count);
    const largest = clusters[0];
    const highValue = clusters.filter((c) => c.avgGcos > 0.2 && c.count >= 3);
    return `Spatial cluster analysis: largest cluster is ${largest?.basin ?? '—'} with ${largest?.count} prospect${largest?.count !== 1 ? 's' : ''}. ${highValue.length ? `High-value clusters (≥3 prospects, avg GCoS > 20%): ${highValue.map((c) => `${c.basin} (${c.count}, ${Math.round(c.avgGcos * 100)}%)`).join(', ')}.` : 'No basin cluster has both ≥3 prospects and avg GCoS > 20% yet.'} Zoom into clusters on the map to explore individual prospects.`;
  }

  if (
    q.includes('frontier') &&
    (q.includes('basin') || q.includes('play') || q.includes('region') || q.includes('opportunit'))
  ) {
    const frontier = prospects.filter((p) => (p.dataConfidence ?? 0) < 50);
    if (!frontier.length)
      return 'No frontier prospects identified (all prospects have data confidence ≥ 50). Frontier plays typically have low data confidence due to limited seismic, wells, or outcrop data.';
    const withPotential = frontier.filter((p) => (p.geologicalChanceOfSuccess ?? 0) > 0.1);
    const basinFrontier = [...new Set(frontier.map((p) => p.basin))];
    return `Frontier region analysis: ${frontier.length} prospect${frontier.length !== 1 ? 's' : ''} with data confidence < 50 across ${basinFrontier.length} basin${basinFrontier.length !== 1 ? 's' : ''} (${basinFrontier.join(', ')}). ${withPotential.length} of these still show GCoS > 10% despite limited data — candidates for seismic acquisition before drilling. Increasing data confidence in frontier prospects improves ML readiness and reduces pre-drill uncertainty.`;
  }

  if (q.includes('identified targets') || q.includes('spatial targets') || q.includes('target summary')) {
    const targets = identifyTargets(prospects);
    if (!targets.length) {
      return 'No spatial targets identified yet — add prospects with valid coordinates to enable target identification, or visit the Identified Targets page (/targets).';
    }
    const summary = targets
      .map((t) => `${t.name}: ${t.prospectCount} prospect${t.prospectCount !== 1 ? 's' : ''} (mostly ${t.topBasin}, ${t.topPlayType}), avg GCoS ${Math.round(t.avgGcos * 100)}%, radius ~${Math.round(t.radiusKm)} km${t.successRate !== null ? `, drilled success rate ${Math.round(t.successRate * 100)}%` : ''}`)
      .join('; ');
    return `Identified targets (spatial clusters within 150 km, ranked by avg GCoS × √count): ${summary}. See the Identified Targets page (/targets) for the heat-grid map. The 150 km radius is a spatial heuristic — verify clustered prospects share source, seal, and trap-style petroleum-system elements before infrastructure or JV planning.`;
  }

  if (q.includes('drilled analogs')) {
    const target = findMentionedProspect(q, prospects);
    if (!target) {
      return 'Specify a prospect: "drilled analogs for [name]". This ranks portfolio prospects with a known drilling outcome (discovery/dry hole/non-commercial) by scoring-profile similarity to the named prospect — the highest-confidence calibration data per the Rose & Associates lookback methodology.';
    }
    const analogs = findAnalogs(target, prospects, 3, { outcomeOnly: true });
    if (!analogs.length) {
      return `No drilled (known-outcome) analogs found for ${target.name} yet. Record drilling outcomes on the Outcome Labeling page (/outcomes) to enable this comparison.`;
    }
    return `Drilled analogs for ${target.name} (ranked by scoring-profile similarity): ${analogs.map((p) => `${p.name} — ${getOutcomeLabelText(p.outcome!.label)}`).join('; ')}. These are the most comparable known outcomes by component-score profile, not just spatial proximity — use them to calibrate expectations for ${target.name}, but verify they share play type, reservoir age, and trap style before treating them as a strong analog.`;
  }

  if (
    q.includes('nearest analog') ||
    q.includes('closest analog') ||
    q.includes('analog proximity') ||
    q.includes('nearest outcome') ||
    q.includes('nearest discovery') ||
    q.includes('nearest dry hole') ||
    ((q.includes('analog') || q.includes('outcome')) && (q.includes('nearest') || q.includes('closest')))
  ) {
    const labeled = prospects.filter((p) => p.outcome && isKnownOutcome(p.outcome) && isValidCoordinate(p.latitude, p.longitude));
    if (!labeled.length) {
      return 'No outcome-labeled prospects with valid coordinates exist yet, so analog proximity cannot be computed. Record drilling outcomes on the Outcome Labeling page (/outcomes) first.';
    }
    const target = findMentionedProspect(q, prospects);
    if (target) {
      if (!isValidCoordinate(target.latitude, target.longitude)) {
        return `${target.name} has no valid coordinates — cannot compute analog proximity. Fix its latitude/longitude in the Edit Prospect form.`;
      }
      if (target.outcome && isKnownOutcome(target.outcome)) {
        return `${target.name} is already outcome-labeled (${getOutcomeLabelText(target.outcome.label)}) — it serves as a spatial analog for nearby undrilled prospects rather than needing one itself.`;
      }
      const nearest = findNearestOutcome(target, prospects);
      if (!nearest) return `No outcome-labeled analog found for ${target.name}.`;
      const o = nearest.item.outcome!;
      const detail = [o.wellName ? `well ${o.wellName}` : '', o.drillYear ? `${o.drillYear}` : ''].filter(Boolean).join(', ');
      return `Nearest drilled analog to ${target.name}: ${nearest.item.name} — ${getOutcomeLabelText(o.label)}${detail ? ` (${detail})` : ''} at ${Math.round(nearest.distanceKm)} km. ${o.label === 'dry_hole' || o.label === 'non_commercial' ? 'A nearby failure is a de-risking warning — review whether it tested the same play elements (source, charge, seal) before relying on it as a negative analog.' : 'A nearby success de-risks shared play elements, but only if it tested the same reservoir/seal pair — verify play equivalence before crediting it.'}`;
    }
    const ranked = rankByAnalogProximity(prospects).slice(0, 3);
    if (!ranked.length) {
      return 'All prospects with valid coordinates already have recorded outcomes — there are no undrilled prospects to rank by analog proximity.';
    }
    return `Undrilled prospects closest to a drilled analog: ${ranked.map((r) => `${r.item.name} → ${r.nearest.name} (${getOutcomeLabelText(r.nearest.outcome!.label)}, ${Math.round(r.distanceKm)} km)`).join('; ')}. Proximity to drilled wells provides the most direct calibration data — start de-risking reviews with these. Ask "nearest analog to [name]" for a specific prospect.`;
  }

  if (
    q.includes('analog field') ||
    q.includes('analog play') ||
    q.includes('basin analog') ||
    q.includes('similar field') ||
    (q.includes('analog') && (q.includes('prospect') || q.includes('discovery') || q.includes('basin')))
  ) {
    const sorted = [...prospects].sort((a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0));
    const top = sorted.slice(0, 3);
    const basins = [...new Set(prospects.map((p) => p.basin))];
    return `Analog field analysis: In petroleum exploration, analog calibration compares an undrilled prospect to known discoveries in the same or similar basins to de-risk components where data is sparse. Your current portfolio covers ${basins.length} basin${basins.length !== 1 ? 's' : ''} (${basins.join(', ')}). Highest-GCoS prospects that could serve as within-basin analogs: ${top.map((p) => `${p.name} (${p.basin}, GCoS ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%)`).join('; ')}. For formal analog calibration, import historical wellbore outcomes via the ML Lab Import section — the Norway Sokkeldirektoratet FactPages adapter provides an open analog dataset. Strong analogs should share play type, reservoir age, trap geometry, and structural style.`;
  }

  if (
    q.includes('source rock maturity') ||
    q.includes('maturity') && (q.includes('source') || q.includes('thermal') || q.includes('generation')) ||
    q.includes('toc') ||
    q.includes('ro percent') ||
    q.includes('vitrinite') ||
    q.includes('kerogen type') ||
    q.includes('kitchen') && (q.includes('source') || q.includes('generation') || q.includes('hydrocarbon'))
  ) {
    const lowSource = prospects.filter((p) => p.sourceScore < 0.3);
    const avgSource = prospects.length ? prospects.reduce((s, p) => s + p.sourceScore, 0) / prospects.length : 0;
    return `Source rock maturity assessment: Thermal maturity (Ro%, VR, Tmax) determines whether a source rock has entered the oil or gas window. In PetroTarget AI, source rock quality is captured by sourceScore (0–1), which aggregates source presence, richness (TOC), maturity, and expulsion efficiency. Portfolio average source score: ${(avgSource * 100).toFixed(0)}%. ${lowSource.length} prospect${lowSource.length !== 1 ? 's have' : ' has'} sourceScore < 30%, indicating high source risk. To improve source scoring: use evidence-derived mode and add seismic/well data for source kitchen proximity, maturity indicators (Ro, seismic velocity), and regional source rock mapping. Source maturity is the most irreducible geological risk — unlike trap or seal, it cannot be de-risked by additional drilling without penetrating the kitchen.`;
  }

  if (
    q.includes('seal integrity') ||
    q.includes('seal continuity') ||
    q.includes('seal thickness') ||
    q.includes('seal quality') ||
    q.includes('caprock integrity') ||
    q.includes('seal failure') ||
    (q.includes('seal') && (q.includes('assess') || q.includes('risk') || q.includes('evaluat') || q.includes('concern')))
  ) {
    const lowSeal = prospects.filter((p) => p.sealScore < 0.3);
    const avgSeal = prospects.length ? prospects.reduce((s, p) => s + p.sealScore, 0) / prospects.length : 0;
    const mainSealRisk = prospects.filter((p) => p.mainRisk === 'seal');
    return `Seal integrity assessment: Seal effectiveness depends on caprock continuity, column height capacity, and retention through structural reactivation. In PetroTarget AI, sealScore (0–1) encodes these risks. Portfolio average seal score: ${(avgSeal * 100).toFixed(0)}%. ${lowSeal.length} prospect${lowSeal.length !== 1 ? 's have' : ' has'} sealScore < 30%. ${mainSealRisk.length} prospect${mainSealRisk.length !== 1 ? 's' : ''} ha${mainSealRisk.length !== 1 ? 've' : 's'} seal identified as main risk: ${mainSealRisk.map((p) => p.name).join(', ') || 'none'}. De-risking seal integrity: regional seal mapping (seismic character, mudstone isopachs), pressure data from adjacent wells, and fault seal analysis (shale gouge ratio, juxtaposition) are standard workflows. Seal failure is one of the most common causes of dry holes globally.`;
  }

  if (
    q.includes('reservoir quality') ||
    q.includes('reservoir productivity') ||
    q.includes('permeability') ||
    q.includes('porosity') ||
    q.includes('net to gross') ||
    (q.includes('reservoir') && (q.includes('quality') || q.includes('flow') || q.includes('assess') || q.includes('potential')))
  ) {
    const lowReservoir = prospects.filter((p) => p.reservoirScore < 0.3);
    const avgReservoir = prospects.length ? prospects.reduce((s, p) => s + p.reservoirScore, 0) / prospects.length : 0;
    const mainReservoirRisk = prospects.filter((p) => p.mainRisk === 'reservoir');
    return `Reservoir quality assessment: Productive reservoir requires sufficient porosity (>8% for carbonates, >10% for clastics), permeability, and continuity. In PetroTarget AI, reservoirScore (0–1) encodes porosity type, diagenetic risk, net-to-gross ratio, and lateral continuity. Portfolio average reservoir score: ${(avgReservoir * 100).toFixed(0)}%. ${lowReservoir.length} prospect${lowReservoir.length !== 1 ? 's have' : ' has'} reservoirScore < 30% — high reservoir risk. ${mainReservoirRisk.length} prospect${mainReservoirRisk.length !== 1 ? 's identify' : ' identifies'} reservoir as main risk. Typical de-risking: analog well log correlations, AVO analysis on 3D seismic, direct hydrocarbon indicators (DHI), and sedimentological facies models. Reservoir quality often improves (or collapses) dramatically at the drill bit.`;
  }

  // ── Trap geometry / trap-type risk ──────────────────────────────────────────

  if (
    q.includes('trap type') ||
    q.includes('trap geometry') ||
    q.includes('trap style') ||
    q.includes('stratigraphic trap') ||
    q.includes('structural trap') ||
    q.includes('closure') ||
    q.includes('subsalt') ||
    q.includes('sub-salt') ||
    (q.includes('trap') && (q.includes('risk') || q.includes('assess') || q.includes('mapped') || q.includes('breakdown') || q.includes('geometry')))
  ) {
    const withTrap = prospects.filter((p) => p.evidence?.trap);
    const typeCounts: Record<string, number> = {};
    for (const p of withTrap) {
      const t = p.evidence!.trap!.trapType ?? 'unspecified';
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const dist = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${n} ${t}`)
      .join(', ');
    const unmapped = withTrap.filter((p) => p.evidence!.trap!.closureMapped === false || p.evidence!.trap!.trapType === 'unknown');
    const subsaltRisk = withTrap.filter((p) => p.evidence!.trap!.trapType === 'subsalt' && p.evidence!.trap!.seismicConfidence !== 'high');
    const trapLimited = prospects.filter((p) => p.mainRisk === 'trap' || p.trapScore < 0.40);
    const noTrapEvidence = prospects.length - withTrap.length;

    const parts: string[] = [];
    parts.push(`Trap geometry assessment across ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''}.`);
    if (withTrap.length > 0) {
      parts.push(`Trap-type distribution (${withTrap.length} with trap evidence): ${dist}.`);
    }
    if (unmapped.length > 0) {
      parts.push(`${unmapped.length} prospect${unmapped.length !== 1 ? 's have' : ' has'} no defined structural closure (closure not mapped or trap type unknown) — these require seismic mapping before a drill decision: ${unmapped.map((p) => p.name).join(', ')}.`);
    }
    if (subsaltRisk.length > 0) {
      parts.push(`${subsaltRisk.length} subsalt trap${subsaltRisk.length !== 1 ? 's' : ''} carr${subsaltRisk.length !== 1 ? 'y' : 'ies'} sub-high seismic confidence (${subsaltRisk.map((p) => p.name).join(', ')}) — velocity pull-up/push-down increases sub-salt imaging uncertainty; reprocess/PSDM before committing capital.`);
    }
    if (trapLimited.length > 0) {
      parts.push(`Trap-limited prospects (trap is the main risk or trapScore < 40%): ${trapLimited.map((p) => p.name).join(', ')}.`);
    }
    if (noTrapEvidence > 0) {
      parts.push(`${noTrapEvidence} prospect${noTrapEvidence !== 1 ? 's are' : ' is'} manually scored without structured trap evidence — switch to evidence-derived mode to capture closure type, area, height and seismic confidence.`);
    }
    parts.push(`Methodology: four-way structural closures are the lowest-risk trap class because they are seismically well-imaged; stratigraphic and fault-dependent traps carry higher pre-drill risk since they rely on lateral seal/pinch-out continuity that seismic resolves poorly. Trap risk is the most seismically-reducible of the six petroleum-system components — well-imaged closures justify drilling, poorly-defined traps justify acquiring or reprocessing seismic first.`);
    return parts.join(' ');
  }

  if (
    q.includes('target depth') ||
    q.includes('depth target') ||
    q.includes('drilling depth') ||
    q.includes('depth range') ||
    q.includes('formation target') ||
    q.includes('formation name') ||
    q.includes('what formation') ||
    (q.includes('depth') && (q.includes('prospect') || q.includes('drilling') || q.includes('well') || q.includes('target')))
  ) {
    return `Target depth and formation: PetroTarget AI currently stores play type and basin but does not yet capture target formation name or total depth (TVD). These are critical well-planning inputs — TD determines drilling cost, casing program, and BHA design. Standard depth risk buckets: shallow (<1500 m, lowest cost/risk), moderate (1500–3500 m), deep (3500–5000 m), ultra-deep (>5000 m, highest cost/risk). To add depth/formation information: edit each prospect and add it to the notes field for now. A future version will add dedicated depth and formation fields to the Prospect schema. If you have well prognosis data (formation tops, predicted depths), export your portfolio as GeoJSON from the Map page and annotate in GeoLibre or a GIS tool.`;
  }

  // ── Point-to-point distance between two named prospects ─────────────────────

  if (
    q.includes('how far') ||
    q.includes('distance between') ||
    q.includes('distance from')
  ) {
    const mentioned = findMentionedProspects(question, prospects);
    if (mentioned.length < 2) {
      return 'To compute a point-to-point distance, name two prospects in your question — e.g. "how far is Vaca Norte from Austral Shelf Fan". I could not resolve two distinct prospect names from that question.';
    }
    const [a, b] = mentioned;
    const invalid = [a, b].filter((p) => !isValidCoordinate(p.latitude, p.longitude));
    if (invalid.length > 0) {
      return `Cannot compute distance: ${invalid.map((p) => p.name).join(' and ')} ${invalid.length > 1 ? 'have' : 'has'} no valid coordinates (non-zero lat/lon). Add coordinates on the prospect edit page to enable spatial distance queries.`;
    }
    const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    const sameBasin = a.basin === b.basin;
    const infra = km < 50
      ? 'At under 50 km they are close enough to share seismic acquisition, infrastructure and tie-back development — consider a joint development scenario.'
      : km < 200
        ? 'At this separation some regional seismic and logistics may be shared, but standalone development economics likely apply.'
        : 'At this distance they are effectively independent developments with separate infrastructure and standalone economics.';
    return `${a.name} and ${b.name} are approximately ${km.toFixed(0)} km apart (great-circle distance). ${a.name} sits in the ${a.basin} basin; ${b.name} sits in the ${b.basin} basin${sameBasin ? ' (same basin)' : ''}. ${infra}`;
  }

  // ── Nearest prospect spatial query ──────────────────────────────────────────

  if (
    (q.includes('nearest') || q.includes('closest') || q.includes('near') || q.includes('proximity')) &&
    (q.includes('prospect') || q.includes('well') || q.includes('location'))
  ) {
    const withCoords = prospects.filter((p) => isValidCoordinate(p.latitude, p.longitude));
    if (withCoords.length < 2) {
      return 'Proximity search requires at least 2 prospects with valid coordinates (non-zero lat/lon). Add coordinates to your prospects to enable spatial proximity analysis.';
    }
    const pairs: { a: string; b: string; dist: number }[] = [];
    for (let i = 0; i < Math.min(withCoords.length, 30); i++) {
      const result = findNearest(withCoords.filter((_, j) => j !== i), withCoords[i].latitude, withCoords[i].longitude);
      if (result) pairs.push({ a: withCoords[i].name, b: result.item.name, dist: result.distanceKm });
    }
    if (pairs.length === 0) {
      return `All prospects with valid coordinates are at the same location — no pairwise distance can be computed. Ensure each prospect has unique lat/lon coordinates.`;
    }
    const sortedPairs = [...pairs].sort((x, y) => x.dist - y.dist);
    const closestPair = sortedPairs[0];
    const farthestPair = sortedPairs[sortedPairs.length - 1];
    const avgDist = pairs.reduce((s, p) => s + p.dist, 0) / pairs.length;
    return `Spatial proximity analysis across ${withCoords.length} prospects with valid coordinates: Closest pair — ${closestPair.a} and ${closestPair.b} (${closestPair.dist.toFixed(0)} km apart). Farthest pair — ${farthestPair.a} and ${farthestPair.b} (${farthestPair.dist.toFixed(0)} km apart). Average nearest-neighbor distance: ${avgDist.toFixed(0)} km. Tightly clustered prospects share infrastructure and seismic acquisition costs — consider joint development scenarios. Isolated prospects (far from cluster) carry higher standalone development costs. Use the Map page to visualize spatial distribution.`;
  }

  // ── Play-type distribution ───────────────────────────────────────────────────

  if (
    q.includes('play type') ||
    q.includes('play distribution') ||
    q.includes('play mix') ||
    (q.includes('play') && (q.includes('breakdown') || q.includes('split') || q.includes('summary') || q.includes('portfolio')))
  ) {
    const playMap = new Map<string, Prospect[]>();
    for (const p of prospects) {
      const list = playMap.get(p.playType || 'Unknown') ?? [];
      list.push(p);
      playMap.set(p.playType || 'Unknown', list);
    }
    const sorted = [...playMap.entries()]
      .map(([play, ps]) => ({
        play,
        count: ps.length,
        avgGcos: ps.reduce((s, p) => s + finiteGcos(p), 0) / ps.length,
      }))
      .sort((a, b) => b.count - a.count);
    const lines = sorted.map((pt) => `${pt.play}: ${pt.count} prospect${pt.count !== 1 ? 's' : ''} (avg GCoS ${Math.round(pt.avgGcos * 100)}%)`).join('; ');
    const dominant = sorted[0];
    return `Play-type distribution across ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''}: ${lines}. Dominant play type: ${dominant?.play ?? '—'} with ${dominant?.count} prospect${dominant?.count !== 1 ? 's' : ''}. Diversifying across play types reduces correlated geological risk — if all prospects share the same source kitchen or seal type, a single regional failure could eliminate the entire portfolio value. The Map page play-type filter lets you visualize spatial play concentration.`;
  }

  return 'I can answer: "top prospects", "best prospect", "why this score", "data confidence", "weakest component", "strongest components", "main risk", "high resource high risk", "need more data", "portfolio summary", "evidence-derived", "manual scoring", "evidence supports [name]", "missing evidence for [name]", "need more seismic", "seal risk", "fault seal risk", "seal lithology", "subsalt seal", "timing uncertainty", "critical geoscience risk", "drill candidates", "where should we drill first", "de-risk before drill", "farm-in candidates", "acreage review", "tier 1 targets", "tier 2 targets", "high GCoS low data confidence", "main portfolio risk", "migration risk", "risk reward", "risk-reward", "capital efficiency", "what should we do next as an exploration team", "positive EMV prospects", "negative EMV prospects", "best economic prospect", "high resource low GCoS", "de-risk before investment", "does [name] look economic", "portfolio risked resources", "what are the default economic assumptions", "is the ML model trained", "can we train ML", "what data do we need for ML", "export training dataset", "how does ML compare to expert GCoS", "which prospects are ML-ready", "prospects with outcomes", "how many labeled examples", "dry hole prospects", "commercial discoveries", "how do I import a dataset", "why did my dataset fail validation", "what columns are required for import", "can I train with this dataset", "what is post-drill leakage", "how do I train the ML model", "how accurate is the ML model", "what features drive the ML model", "can we use ML to decide drilling", "why is ML not ready", "how many labels do we need", "norway factpages adapter", "convert norway csv", "norway limitations", "basin distribution", "best basin", "map overview", "spatial overview", "cluster analysis", "frontier basin", "analog field", "source rock maturity", "seal integrity", "reservoir quality", "trap geometry", "target depth", "nearest prospect", "how far is [name] from [name]", "play type distribution", "success rate by basin", "gcos calibration", "nearest analog to [name]", "drilled analogs for [name]", "identified targets", "basin cluster spacing", or "explain GCoS".';
};
