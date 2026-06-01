import type { Prospect } from './prospect';
import { isKnownOutcome, isGeologicalSuccess } from './outcomes';

export type MLReadinessResult = {
  readinessScore: number;
  status: 'not_ready' | 'partial' | 'ready_for_baseline' | 'ready_for_training';
  labeledExamples: number;
  knownSuccessFailureCount: number;
  totalProspects: number;
  evidenceDerivedCount: number;
  missingRequirements: string[];
  recommendations: string[];
};

export const assessMLReadiness = (prospects: Prospect[]): MLReadinessResult => {
  const totalProspects = prospects.length;
  const evidenceDerivedCount = prospects.filter(
    (p) => p.scoringMode === 'evidence_derived'
  ).length;
  const labeledExamples = prospects.filter(
    (p) => p.outcome && isKnownOutcome(p.outcome)
  ).length;
  const knownSuccessFailureCount = prospects.filter(
    (p) => p.outcome && isKnownOutcome(p.outcome) && (isGeologicalSuccess(p.outcome) || p.outcome.label === 'dry_hole')
  ).length;

  const missingRequirements: string[] = [];
  const recommendations: string[] = [];

  if (totalProspects === 0) {
    return {
      readinessScore: 0,
      status: 'not_ready',
      labeledExamples: 0,
      knownSuccessFailureCount: 0,
      totalProspects: 0,
      evidenceDerivedCount: 0,
      missingRequirements: ['No prospects in portfolio.'],
      recommendations: ['Add prospects to enable ML readiness assessment.'],
    };
  }

  // Check training requirements (thresholds per spec)
  const hasEnoughForTraining =
    labeledExamples >= 100 &&
    knownSuccessFailureCount >= 50 &&
    evidenceDerivedCount >= 30;

  // Check baseline requirements
  const hasEnoughForBaseline = totalProspects >= 10 && evidenceDerivedCount >= 5;

  if (totalProspects < 10) {
    missingRequirements.push(`At least 10 prospects required for baseline (have ${totalProspects}).`);
    recommendations.push('Add more prospects to the portfolio.');
  }

  if (evidenceDerivedCount < 5) {
    missingRequirements.push(`At least 5 evidence-derived prospects required for baseline (have ${evidenceDerivedCount}).`);
    recommendations.push('Convert manual-scoring prospects to evidence-derived using the Edit Prospect form.');
  }

  if (labeledExamples < 100) {
    missingRequirements.push(`At least 100 labeled historical examples required for training (have ${labeledExamples}).`);
    recommendations.push('Collect historical well outcome data (discoveries, dry holes, commercial wells) and label prospects using the Historical Outcome section in each prospect form.');
  }

  if (knownSuccessFailureCount < 50) {
    missingRequirements.push(`At least 50 known success/failure outcomes required for training (have ${knownSuccessFailureCount}).`);
    recommendations.push('Ensure labeled outcomes include both discoveries and dry holes for a balanced training set.');
  }

  if (evidenceDerivedCount < 30) {
    missingRequirements.push(`At least 30 evidence-derived prospects required for training (have ${evidenceDerivedCount}).`);
    recommendations.push('Expand the evidence-derived prospect set before model training.');
  }

  const hasAnyManual = prospects.some((p) => !p.scoringMode || p.scoringMode === 'manual');
  if (hasAnyManual) {
    recommendations.push('Switch remaining manual-scoring prospects to evidence-derived for richer ML features.');
  }

  recommendations.push(
    'Export the synthetic training dataset from the ML Lab page to inspect feature quality before real training.'
  );

  let status: MLReadinessResult['status'];
  let readinessScore: number;

  if (hasEnoughForTraining) {
    status = 'ready_for_training';
    readinessScore = 100;
  } else if (hasEnoughForBaseline) {
    status = 'ready_for_baseline';
    const trainingProgress =
      Math.min(labeledExamples / 100, 1) * 0.5 +
      Math.min(evidenceDerivedCount / 30, 1) * 0.3 +
      Math.min(totalProspects / 100, 1) * 0.2;
    readinessScore = Math.round(50 + trainingProgress * 50);
  } else if (totalProspects > 0) {
    status = 'partial';
    readinessScore = Math.round(
      Math.min(totalProspects / 10, 1) * 30 +
      Math.min(evidenceDerivedCount / 5, 1) * 20
    );
  } else {
    status = 'not_ready';
    readinessScore = 0;
  }

  return {
    readinessScore,
    status,
    labeledExamples,
    knownSuccessFailureCount,
    totalProspects,
    evidenceDerivedCount,
    missingRequirements,
    recommendations,
  };
};
