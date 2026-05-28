import type { Prospect } from './prospect';
import { getProspectivityTier, getRecommendedActionLabel, getTierLabel, getPortfolioRecommendations } from './recommendationEngine';
import { getPortfolioSummary } from './portfolioIntelligence';
import { getDecisionSignalLabel, getEconomicGradeLabel } from './economics';

export type ReportSection = {
  title: string;
  content: string[];
};

export type ProspectReport = {
  generatedAt: string;
  prospect: Prospect;
  executiveSummary: string;
  sections: ReportSection[];
};

export type PortfolioReport = {
  generatedAt: string;
  prospects: Prospect[];
  executiveSummary: string;
  keyDataGaps: string[];
  sections: ReportSection[];
};

export const getProspectExecutiveSummary = (prospect: Prospect): string => {
  const gcos = Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100);
  const tier = getProspectivityTier(prospect);
  const tierLabel = getTierLabel(tier);
  const emvPart = prospect.economicAssessment
    ? ` Simple EMV of $${prospect.economicAssessment.simpleEMVUsdMM.toFixed(0)}M (${getEconomicGradeLabel(prospect.economicAssessment.economicGrade)}) with decision signal: ${getDecisionSignalLabel(prospect.economicAssessment.decisionSignal)}.`
    : '';
  return `${prospect.name} is a ${prospect.priority ?? 'low'}-priority ${prospect.playType} prospect in the ${prospect.basin} basin (Block ${prospect.block}). GCoS: ${gcos}%, Data Confidence: ${prospect.dataConfidence ?? 0}/100, classified as ${tierLabel}. Main risk: ${prospect.mainRisk}.${emvPart}`;
};

export const getPortfolioExecutiveSummary = (prospects: Prospect[]): string => {
  if (!prospects.length) return 'No prospects in portfolio.';
  const summary = getPortfolioSummary(prospects);
  const avgGcos = Math.round(
    prospects.reduce((acc, p) => acc + (p.geologicalChanceOfSuccess ?? 0), 0) / prospects.length * 100
  );
  const totalUnrisked = prospects.reduce((acc, p) => acc + p.resourceEstimate, 0);
  const totalRisked = prospects.reduce((acc, p) => acc + (p.economicAssessment?.riskedResourceMMboe ?? 0), 0);
  const positiveEMV = prospects.filter((p) => (p.economicAssessment?.simpleEMVUsdMM ?? 0) > 0).length;
  return (
    `Portfolio contains ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} across ${[...new Set(prospects.map((p) => p.basin))].length} basin(s). ` +
    `Average GCoS: ${avgGcos}%, average data confidence: ${summary.averageDataConfidence}/100. ` +
    `${summary.tier1Count} Tier 1 target${summary.tier1Count !== 1 ? 's' : ''}, ${summary.drillCandidateCount} drill candidate${summary.drillCandidateCount !== 1 ? 's' : ''}. ` +
    `Total unrisked resources: ${totalUnrisked.toFixed(0)} MMboe (risked: ${totalRisked.toFixed(1)} MMboe). ` +
    `${positiveEMV} prospect${positiveEMV !== 1 ? 's' : ''} with positive EMV. ` +
    `Dominant portfolio risk: ${summary.portfolioMainRisk}.`
  );
};

export const getPortfolioKeyDataGaps = (prospects: Prospect[]): string[] => {
  const gaps: string[] = [];

  const lowConfidence = prospects.filter((p) => (p.dataConfidence ?? 0) < 50);
  if (lowConfidence.length) {
    gaps.push(`${lowConfidence.length} prospect${lowConfidence.length > 1 ? 's' : ''} with low data confidence (<50): ${lowConfidence.map((p) => p.name).join(', ')}.`);
  }

  const highGcosLowDC = prospects.filter(
    (p) => (p.geologicalChanceOfSuccess ?? 0) >= 0.25 && (p.dataConfidence ?? 0) < 70
  );
  if (highGcosLowDC.length) {
    gaps.push(`${highGcosLowDC.length} high-GCoS prospect${highGcosLowDC.length > 1 ? 's' : ''} with data confidence <70 — do not advance to drill without additional data: ${highGcosLowDC.map((p) => p.name).join(', ')}.`);
  }

  const manualScoring = prospects.filter((p) => !p.scoringMode || p.scoringMode === 'manual');
  if (manualScoring.length) {
    gaps.push(`${manualScoring.length} prospect${manualScoring.length > 1 ? 's' : ''} still on manual scoring — add structured evidence to enable the Geoscience Intelligence Engine: ${manualScoring.map((p) => p.name).join(', ')}.`);
  }

  const evidenceDerived = prospects.filter((p) => p.scoringMode === 'evidence_derived' && p.geoscienceAssessment);
  const missingItems = evidenceDerived.flatMap((p) =>
    (p.geoscienceAssessment?.components ?? [])
      .flatMap((c) => c.missingEvidence.map((m) => `${p.name} (${c.component}): ${m}`))
  );
  missingItems.slice(0, 8).forEach((item) => gaps.push(item));

  if (!gaps.length) {
    gaps.push('No critical data gaps identified in the current portfolio.');
  }

  return gaps;
};

export const generateProspectReport = (prospect: Prospect): ProspectReport => {
  const sections: ReportSection[] = [];

  sections.push({
    title: 'Overview',
    content: [
      `Name: ${prospect.name}`,
      `Basin: ${prospect.basin}`,
      `Block: ${prospect.block}`,
      `Play Type: ${prospect.playType}`,
      `Latitude: ${prospect.latitude}`,
      `Longitude: ${prospect.longitude}`,
      `Resource Estimate: ${prospect.resourceEstimate} MMboe (unrisked)`,
      `Scoring Mode: ${prospect.scoringMode ?? 'manual'}`,
    ],
  });

  sections.push({
    title: 'Petroleum System Scores',
    content: [
      `Source: ${prospect.sourceScore.toFixed(2)}`,
      `Migration: ${prospect.migrationScore.toFixed(2)}`,
      `Reservoir: ${prospect.reservoirScore.toFixed(2)}`,
      `Seal: ${prospect.sealScore.toFixed(2)}`,
      `Trap: ${prospect.trapScore.toFixed(2)}`,
      `Timing: ${prospect.timingScore.toFixed(2)}`,
    ],
  });

  sections.push({
    title: 'Risk Assessment',
    content: [
      `GCoS: ${Math.round((prospect.geologicalChanceOfSuccess ?? 0) * 100)}%`,
      `Main Risk: ${prospect.mainRisk ?? 'unknown'}`,
      `Data Confidence: ${prospect.dataConfidence ?? 0}/100`,
      `Priority: ${prospect.priority ?? 'low'}`,
      `Commercial Score: ${prospect.commercialScore}/100`,
      `Recommendation: ${prospect.recommendation ?? ''}`,
      `Explanation: ${prospect.explanation ?? ''}`,
    ],
  });

  const tier = getProspectivityTier(prospect);
  const recs = getPortfolioRecommendations([prospect]);
  const rec = recs[0];
  sections.push({
    title: 'Targeting Recommendation',
    content: [
      `Prospectivity Tier: ${getTierLabel(tier)}`,
      ...(rec
        ? [
            `Recommended Action: ${getRecommendedActionLabel(rec.action)}`,
            `Rationale: ${rec.rationale}`,
            `Next Best Step: ${rec.nextBestStep}`,
            ...(rec.riskFlags.length ? [`Risk Flags: ${rec.riskFlags.join('; ')}`] : []),
          ]
        : []),
    ],
  });

  if (prospect.economicAssessment) {
    const ea = prospect.economicAssessment;
    sections.push({
      title: 'Decision Economics',
      content: [
        `Simple EMV: $${ea.simpleEMVUsdMM.toFixed(0)}M`,
        `Economic Grade: ${getEconomicGradeLabel(ea.economicGrade)}`,
        `Decision Signal: ${getDecisionSignalLabel(ea.decisionSignal)}`,
        `Risked Resources: ${ea.riskedResourceMMboe.toFixed(1)} MMboe`,
        `Unrisked Resources: ${ea.unriskedResourceMMboe.toFixed(0)} MMboe`,
        `Estimated Net Revenue: $${ea.estimatedNetRevenueUsdMM.toFixed(0)}M`,
        `Total CAPEX: $${ea.estimatedTotalCostUsdMM.toFixed(0)}M`,
        `Value per Risked Boe: $${ea.valuePerRiskedBoeUsd.toFixed(1)}`,
        ...(ea.rationale.length ? [`Rationale: ${ea.rationale.join(' | ')}`] : []),
        ...(ea.warnings.length ? [`Warnings: ${ea.warnings.join('; ')}`] : []),
      ],
    });
  }

  if (prospect.scoringMode === 'evidence_derived' && prospect.geoscienceAssessment) {
    const ga = prospect.geoscienceAssessment;
    sections.push({
      title: 'Geoscience Intelligence Assessment',
      content: [
        `Summary: ${ga.summary}`,
        `Critical Risk: ${ga.criticalRisk}`,
        `Overall Confidence: ${ga.overallConfidence}`,
        `Target Phase: ${ga.targetPhase}`,
        ...ga.components.map(
          (c) => `${c.component}: score ${(c.score * 100).toFixed(0)}%, confidence ${c.confidence} — ${c.rationale}`
        ),
      ],
    });

    const missing = ga.components.flatMap((c) =>
      c.missingEvidence.map((m) => `${c.component}: ${m}`)
    );
    if (missing.length) {
      sections.push({
        title: 'Recommended Next Data',
        content: missing,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    prospect,
    executiveSummary: getProspectExecutiveSummary(prospect),
    sections,
  };
};

export const generatePortfolioReport = (prospects: Prospect[]): PortfolioReport => {
  const sections: ReportSection[] = [];
  const summary = getPortfolioSummary(prospects);
  const recs = getPortfolioRecommendations(prospects);

  const totalUnrisked = prospects.reduce((acc, p) => acc + p.resourceEstimate, 0);
  const totalRisked = prospects.reduce((acc, p) => acc + (p.economicAssessment?.riskedResourceMMboe ?? 0), 0);
  const avgGcos = prospects.length
    ? Math.round(prospects.reduce((acc, p) => acc + (p.geologicalChanceOfSuccess ?? 0), 0) / prospects.length * 100)
    : 0;

  sections.push({
    title: 'Portfolio Summary',
    content: [
      `Total Prospects: ${prospects.length}`,
      `Basins: ${[...new Set(prospects.map((p) => p.basin))].join(', ')}`,
      `Average GCoS: ${avgGcos}%`,
      `Average Data Confidence: ${summary.averageDataConfidence}/100`,
      `Total Unrisked Resources: ${totalUnrisked.toFixed(0)} MMboe`,
      `Total Risked Resources: ${totalRisked.toFixed(1)} MMboe`,
      `Dominant Portfolio Risk: ${summary.portfolioMainRisk}`,
    ],
  });

  sections.push({
    title: 'Prospectivity Tier Distribution',
    content: [
      `Tier 1 (High Prospectivity): ${summary.tier1Count} prospect${summary.tier1Count !== 1 ? 's' : ''}`,
      `Tier 2 (Moderate Prospectivity): ${summary.tier2Count} prospect${summary.tier2Count !== 1 ? 's' : ''}`,
      `Tier 3 (Contingent Prospectivity): ${summary.tier3Count} prospect${summary.tier3Count !== 1 ? 's' : ''}`,
      `Tier 4 (Low Prospectivity): ${summary.tier4Count} prospect${summary.tier4Count !== 1 ? 's' : ''}`,
      `Drill Candidates: ${summary.drillCandidateCount}`,
    ],
  });

  const ranked = [...prospects].sort(
    (a, b) => (b.geologicalChanceOfSuccess ?? 0) - (a.geologicalChanceOfSuccess ?? 0)
  );
  sections.push({
    title: 'Top Prospects by GCoS',
    content: ranked.slice(0, 5).map((p, i) =>
      `#${i + 1} ${p.name} — GCoS ${Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%, ${p.priority} priority, main risk: ${p.mainRisk}, data confidence: ${p.dataConfidence ?? 0}/100`
    ),
  });

  const drillCandidates = recs.filter((r) => r.action === 'drill_candidate');
  const deRiskItems = recs.filter((r) =>
    ['acquire_additional_seismic', 'validate_reservoir_quality', 'validate_seal_continuity', 'improve_timing_model'].includes(r.action)
  );
  const farmInItems = recs.filter((r) => r.action === 'farm_in_candidate');
  sections.push({
    title: 'Targeting Recommendations Summary',
    content: [
      drillCandidates.length
        ? `Drill Candidates (${drillCandidates.length}): ${drillCandidates.map((r) => r.prospectName).join(', ')}`
        : 'Drill Candidates: none — no prospects have met all Tier 1 quality gates',
      deRiskItems.length
        ? `De-risk Before Drill (${deRiskItems.length}): ${deRiskItems.map((r) => r.prospectName).join(', ')}`
        : 'De-risk Before Drill: none',
      farmInItems.length
        ? `Farm-in Candidates (${farmInItems.length}): ${farmInItems.map((r) => r.prospectName).join(', ')}`
        : 'Farm-in Candidates: none',
    ],
  });

  const withEcon = prospects.filter((p) => p.economicAssessment);
  const positiveEMV = withEcon.filter((p) => (p.economicAssessment!.simpleEMVUsdMM) > 0);
  const negativeEMV = withEcon.filter((p) => (p.economicAssessment!.simpleEMVUsdMM) <= 0);
  const bestEMV = withEcon.length
    ? [...withEcon].sort((a, b) => b.economicAssessment!.simpleEMVUsdMM - a.economicAssessment!.simpleEMVUsdMM)[0]
    : null;
  sections.push({
    title: 'Economic Overview',
    content: [
      `Prospects with Economic Assessment: ${withEcon.length}`,
      `Positive EMV: ${positiveEMV.length} prospect${positiveEMV.length !== 1 ? 's' : ''}`,
      `Negative EMV: ${negativeEMV.length} prospect${negativeEMV.length !== 1 ? 's' : ''}`,
      ...(bestEMV
        ? [`Best Economic Prospect: ${bestEMV.name} (EMV $${bestEMV.economicAssessment!.simpleEMVUsdMM.toFixed(0)}M, ${getEconomicGradeLabel(bestEMV.economicAssessment!.economicGrade)})`]
        : []),
      `Total Risked Resources: ${totalRisked.toFixed(1)} MMboe`,
    ],
  });

  const riskCount = prospects.reduce<Record<string, number>>((acc, p) => {
    const risk = p.mainRisk ?? 'unknown';
    acc[risk] = (acc[risk] ?? 0) + 1;
    return acc;
  }, {});
  sections.push({
    title: 'Risk Distribution',
    content: Object.entries(riskCount)
      .sort((a, b) => b[1] - a[1])
      .map(([risk, count]) => `${risk.charAt(0).toUpperCase() + risk.slice(1)}: ${count} prospect${count !== 1 ? 's' : ''}`),
  });

  const keyDataGaps = getPortfolioKeyDataGaps(prospects);

  return {
    generatedAt: new Date().toISOString(),
    prospects,
    executiveSummary: getPortfolioExecutiveSummary(prospects),
    keyDataGaps,
    sections,
  };
};
