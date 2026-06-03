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
import { assessMLReadiness } from './mlReadiness';
import { compareExpertAndML } from './mlModel';
import { buildTrainingRows } from './mlTrainingFeatures';
import { getDefaultMLTrainingConfig } from './mlTrainingService';
import { isKnownOutcome, isGeologicalSuccess, isCommercialSuccess, getOutcomeLabelText } from './outcomes';

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

  if ((q.includes('why this score') || q.includes('why is')) && !(q.includes('ml') && q.includes('ready'))) {
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
    return `You currently have ${labeled} real labeled example(s) (${positives} positive / ${negatives} negative). The baseline trains with at least ${minExamples}; for more reliable metrics aim for 100+ labeled outcomes with at least 10 of each class (discoveries and dry holes). Synthetic labels do not count toward real training. Add outcomes via the Historical Outcome section on each prospect, or import a labeled dataset from ML Lab.`;
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
      return 'No prospects have recorded historical outcomes yet. Add well outcomes in the Edit Prospect form (Historical Outcome section) to build a real ML training dataset. No trained ML model is connected.';
    }
    return `Prospects with recorded outcomes (${withOutcomes.length}): ${withOutcomes.map((p) => `${p.name} (${getOutcomeLabelText(p.outcome!.label)})`).join(', ')}. These are included in the real training dataset export on the ML Lab page. No trained ML model is connected yet.`;
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

  return 'I can answer: "top prospects", "best prospect", "why this score", "data confidence", "weakest component", "strongest components", "main risk", "high resource high risk", "need more data", "portfolio summary", "evidence-derived", "manual scoring", "evidence supports [name]", "missing evidence for [name]", "need more seismic", "seal risk", "timing uncertainty", "critical geoscience risk", "drill candidates", "where should we drill first", "de-risk before drill", "farm-in candidates", "acreage review", "tier 1 targets", "tier 2 targets", "high GCoS low data confidence", "main portfolio risk", "what should we do next as an exploration team", "positive EMV prospects", "negative EMV prospects", "best economic prospect", "high resource low GCoS", "de-risk before investment", "does [name] look economic", "portfolio risked resources", "what are the default economic assumptions", "is the ML model trained", "can we train ML", "what data do we need for ML", "export training dataset", "how does ML compare to expert GCoS", "which prospects are ML-ready", "prospects with outcomes", "how many labeled examples", "dry hole prospects", "commercial discoveries", "how do I import a dataset", "why did my dataset fail validation", "what columns are required for import", "can I train with this dataset", "what is post-drill leakage", "how do I train the ML model", "how accurate is the ML model", "what features drive the ML model", "can we use ML to decide drilling", "why is ML not ready", or "how many labels do we need".';
};
