import type {
  BurialHistoryConfidence,
  ComponentAssessment,
  ComponentName,
  EvidenceConfidence,
  GeoscienceAssessment,
  MigrationEvidence,
  ProspectEvidence,
  ReservoirEvidence,
  SealEvidence,
  SourceEvidence,
  TargetPhase,
  TimingEvidence,
  TrapEvidence,
} from './evidence';

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const assessSource = (evidence: SourceEvidence, targetPhase?: TargetPhase): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  const presenceBase: Record<string, number> = {
    proven: 0.90, probable: 0.75, possible: 0.55, unknown: 0.35, absent: 0.05,
  };
  let score = presenceBase[evidence.presence] ?? 0.35;

  if (evidence.presence === 'proven' || evidence.presence === 'probable') {
    pos.push(`Source rock ${evidence.presence}`);
  } else if (evidence.presence === 'absent') {
    neg.push('Source rock is absent');
  } else if (evidence.presence === 'possible') {
    pos.push('Source rock possible');
  }

  if (evidence.tocPercent !== undefined) {
    if (evidence.tocPercent >= 4) { score += 0.12; pos.push(`Excellent TOC ${evidence.tocPercent}%`); }
    else if (evidence.tocPercent >= 2) { score += 0.08; pos.push(`Good TOC ${evidence.tocPercent}%`); }
    else if (evidence.tocPercent >= 1) { score += 0.04; pos.push(`Moderate TOC ${evidence.tocPercent}%`); }
    else if (evidence.tocPercent < 0.5) { score -= 0.15; neg.push(`Very low TOC ${evidence.tocPercent}% — poor source quality`); }
  } else {
    missing.push('TOC data not available');
  }

  if (evidence.roPercent !== undefined) {
    const forGas = targetPhase === 'gas';
    if (!forGas && evidence.roPercent >= 0.6 && evidence.roPercent <= 1.35) {
      score += 0.10; pos.push(`Favorable oil maturity window Ro ${evidence.roPercent}%`);
    } else if (forGas && evidence.roPercent >= 1.0 && evidence.roPercent <= 3.5) {
      score += 0.10; pos.push(`Favorable gas maturity window Ro ${evidence.roPercent}%`);
    } else if (evidence.roPercent < 0.5) {
      score -= 0.10; neg.push(`Immature source Ro ${evidence.roPercent}% — below oil window`);
    } else if (!forGas && evidence.roPercent > 1.35) {
      score -= 0.05; neg.push(`Overmature for oil Ro ${evidence.roPercent}% — consider gas target`);
    } else {
      pos.push(`Ro ${evidence.roPercent}%`);
    }
  } else {
    missing.push('Maturity data (Ro) not available');
  }

  if (evidence.sourceThicknessM !== undefined) {
    if (evidence.sourceThicknessM >= 30) { score += 0.05; pos.push(`Adequate source thickness ${evidence.sourceThicknessM}m`); }
    else { pos.push(`Source thickness ${evidence.sourceThicknessM}m — below 30m benchmark`); }
  } else {
    missing.push('Source thickness not measured');
  }

  if (evidence.distanceToKitchenKm !== undefined && evidence.distanceToKitchenKm > 80) {
    score -= 0.08; neg.push(`Distant from kitchen ${evidence.distanceToKitchenKm}km`);
  }

  const finalScore = clamp01(score);
  const hasBoth = evidence.tocPercent !== undefined && evidence.roPercent !== undefined;
  const hasOne = evidence.tocPercent !== undefined || evidence.roPercent !== undefined;
  let confidence: EvidenceConfidence;
  if (evidence.presence === 'unknown' && !hasOne) confidence = 'unknown';
  else if ((evidence.presence === 'proven' || evidence.presence === 'probable') && hasBoth) confidence = 'high';
  else if (hasOne) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Source rock ${evidence.presence}${evidence.tocPercent !== undefined ? `, TOC ${evidence.tocPercent}%` : ''}${evidence.roPercent !== undefined ? `, Ro ${evidence.roPercent}%` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'source', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

export const assessMigration = (evidence: MigrationEvidence): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  const pathwayBase: Record<string, number> = {
    proven: 0.85, probable: 0.70, possible: 0.50, unknown: 0.30, unlikely: 0.10,
  };
  let score = pathwayBase[evidence.pathway] ?? 0.30;

  if (evidence.pathway === 'proven' || evidence.pathway === 'probable') {
    pos.push(`Migration pathway ${evidence.pathway}`);
  } else if (evidence.pathway === 'unlikely') {
    neg.push('Migration pathway unlikely');
  }

  if (evidence.faultConnectivity !== undefined) {
    if (evidence.faultConnectivity === 'good') { score += 0.08; pos.push('Good fault connectivity'); }
    else if (evidence.faultConnectivity === 'poor') { score -= 0.10; neg.push('Poor fault connectivity'); }
    else { pos.push(`Fault connectivity ${evidence.faultConnectivity}`); }
  } else {
    missing.push('Fault connectivity not assessed');
  }

  const isLateralOrMixed = evidence.migrationStyle === 'lateral' || evidence.migrationStyle === 'mixed';
  if (evidence.carrierBedPresence !== undefined) {
    if (evidence.carrierBedPresence === 'proven') { score += 0.08; pos.push('Carrier bed proven'); }
    else if (evidence.carrierBedPresence === 'absent' && !isLateralOrMixed) { score -= 0.12; neg.push('Carrier bed absent'); }
    else if (evidence.carrierBedPresence === 'probable') { pos.push('Carrier bed probable'); }
    else if (!isLateralOrMixed) { missing.push('Carrier bed presence uncertain'); }
  } else if (!isLateralOrMixed) {
    missing.push('Carrier bed not evaluated');
  }

  if (isLateralOrMixed) {
    if (evidence.carrierBedPresence === 'absent' || evidence.carrierBedPresence === 'unknown') {
      score -= 0.15; neg.push('Lateral migration inferred but carrier bed absent/unknown — critical charge risk');
    }
    if (evidence.distanceFromKitchenKm !== undefined && evidence.distanceFromKitchenKm > 50) {
      score -= 0.10; neg.push(`Lateral migration distance ${evidence.distanceFromKitchenKm}km exceeds 50km threshold`);
    }
  } else if (evidence.distanceFromKitchenKm !== undefined && evidence.distanceFromKitchenKm > 100) {
    score -= 0.08; neg.push(`Long migration distance ${evidence.distanceFromKitchenKm}km`);
  }

  if (evidence.showsPresent === true) { pos.push('Hydrocarbon shows documented'); }
  if (evidence.showsPresent === false) { missing.push('No hydrocarbon shows reported'); }

  const finalScore = clamp01(score);
  const hasSupporting = evidence.faultConnectivity !== undefined || evidence.carrierBedPresence !== undefined;
  let confidence: EvidenceConfidence;
  if (evidence.pathway === 'unknown' && !hasSupporting) confidence = 'unknown';
  else if ((evidence.pathway === 'proven' || evidence.pathway === 'probable') && hasSupporting) confidence = 'high';
  else if (hasSupporting) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Migration pathway ${evidence.pathway}${evidence.faultConnectivity ? `, fault connectivity ${evidence.faultConnectivity}` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'migration', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

export const assessReservoir = (evidence: ReservoirEvidence): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  const presenceBase: Record<string, number> = {
    proven: 0.85, probable: 0.70, possible: 0.50, unknown: 0.30, absent: 0.05,
  };
  let score = presenceBase[evidence.presence] ?? 0.30;

  if (evidence.presence === 'proven' || evidence.presence === 'probable') {
    pos.push(`Reservoir ${evidence.presence}`);
  } else if (evidence.presence === 'absent') {
    neg.push('Reservoir absent');
  }

  if (evidence.porosityPercent !== undefined) {
    if (evidence.isUnconventional) {
      if (evidence.porosityPercent >= 10) { score += 0.12; pos.push(`Excellent unconventional porosity ${evidence.porosityPercent}%`); }
      else if (evidence.porosityPercent >= 5) { score += 0.08; pos.push(`Good unconventional porosity ${evidence.porosityPercent}%`); }
      else if (evidence.porosityPercent >= 2) { score += 0.03; pos.push(`Marginal unconventional porosity ${evidence.porosityPercent}%`); }
      else { score -= 0.12; neg.push(`Poor porosity ${evidence.porosityPercent}% — below unconventional threshold`); }
    } else {
      if (evidence.porosityPercent >= 18) { score += 0.12; pos.push(`Excellent porosity ${evidence.porosityPercent}%`); }
      else if (evidence.porosityPercent >= 12) { score += 0.08; pos.push(`Good porosity ${evidence.porosityPercent}%`); }
      else if (evidence.porosityPercent >= 8) { score += 0.03; pos.push(`Marginal porosity ${evidence.porosityPercent}%`); }
      else { score -= 0.12; neg.push(`Poor porosity ${evidence.porosityPercent}% — below conventional threshold`); }
    }
  } else {
    missing.push('Porosity data not available');
  }

  if (evidence.permeabilityMd !== undefined) {
    if (evidence.permeabilityMd >= 100) { score += 0.12; pos.push(`Excellent permeability ${evidence.permeabilityMd}mD`); }
    else if (evidence.permeabilityMd >= 10) { score += 0.08; pos.push(`Good permeability ${evidence.permeabilityMd}mD`); }
    else if (evidence.permeabilityMd >= 1) { score += 0.03; pos.push(`Low permeability ${evidence.permeabilityMd}mD`); }
    else { score -= 0.12; neg.push(`Very low permeability ${evidence.permeabilityMd}mD — tight reservoir`); }
  } else {
    missing.push('Permeability data not available');
  }

  if (evidence.netPayM !== undefined && evidence.netPayM >= 10) {
    score += 0.06; pos.push(`Net pay ${evidence.netPayM}m`);
  } else if (evidence.netPayM === undefined) {
    missing.push('Net pay not measured');
  }

  if (evidence.vshaleFraction !== undefined && evidence.vshaleFraction > 0.35) {
    score -= 0.08; neg.push(`High Vshale ${(evidence.vshaleFraction * 100).toFixed(0)}% — reservoir quality risk`);
  }

  if (evidence.continuity !== undefined) {
    if (evidence.continuity === 'good') { score += 0.05; pos.push('Good reservoir continuity'); }
    else if (evidence.continuity === 'poor') { score -= 0.08; neg.push('Poor reservoir continuity'); }
  } else {
    missing.push('Reservoir continuity not assessed');
  }

  const finalScore = clamp01(score);
  const hasPetrophysics = evidence.porosityPercent !== undefined && evidence.permeabilityMd !== undefined;
  const hasSome = evidence.porosityPercent !== undefined || evidence.permeabilityMd !== undefined;
  let confidence: EvidenceConfidence;
  if (evidence.presence === 'unknown' && !hasSome) confidence = 'unknown';
  else if ((evidence.presence === 'proven' || evidence.presence === 'probable') && hasPetrophysics) confidence = 'high';
  else if (hasSome) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Reservoir ${evidence.presence}${evidence.porosityPercent !== undefined ? `, porosity ${evidence.porosityPercent}%` : ''}${evidence.permeabilityMd !== undefined ? `, permeability ${evidence.permeabilityMd}mD` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'reservoir', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

export const assessSeal = (evidence: SealEvidence): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  const presenceBase: Record<string, number> = {
    proven: 0.85, probable: 0.70, possible: 0.50, unknown: 0.30, absent: 0.05,
  };
  let score = presenceBase[evidence.presence] ?? 0.30;

  if (evidence.presence === 'proven' || evidence.presence === 'probable') {
    pos.push(`Seal ${evidence.presence}`);
  } else if (evidence.presence === 'absent') {
    neg.push('Seal absent');
  }

  if (evidence.lithology !== undefined) {
    if (evidence.lithology === 'salt' || evidence.lithology === 'evaporite') {
      score += 0.10; pos.push(`Excellent seal lithology: ${evidence.lithology}`);
    } else if (evidence.lithology === 'shale') {
      score += 0.07; pos.push('Good seal lithology: shale');
    } else if (evidence.lithology === 'mudstone') {
      score += 0.04; pos.push('Moderate seal lithology: mudstone');
    } else if (evidence.lithology === 'anhydrite') {
      score += 0.08; pos.push('Excellent seal lithology: anhydrite — world-class caprock');
    } else if (evidence.lithology === 'carbonate') {
      score += 0.05; pos.push('Good seal lithology: tight carbonate caprock');
    } else if (evidence.lithology === 'other') {
      score -= 0.15; neg.push('Poor seal lithology — effectiveness uncertain');
    }
  } else {
    missing.push('Seal lithology not identified');
  }

  if (evidence.thicknessM !== undefined) {
    if (evidence.thicknessM >= 30) { score += 0.06; pos.push(`Adequate seal thickness ${evidence.thicknessM}m`); }
    else { pos.push(`Seal thickness ${evidence.thicknessM}m — below 30m benchmark`); }
  } else {
    missing.push('Seal thickness not measured');
  }

  if (evidence.faultSealRisk !== undefined) {
    if (evidence.faultSealRisk === 'low') { score += 0.05; pos.push('Low fault seal risk'); }
    else if (evidence.faultSealRisk === 'high') { score -= 0.20; neg.push('HIGH fault seal risk — critical concern'); }
    else if (evidence.faultSealRisk === 'unknown') { missing.push('Fault seal risk not assessed'); }
  } else {
    missing.push('Fault seal risk not evaluated');
  }

  const finalScore = clamp01(score);
  // Exclude 'unknown' values — they carry no information and must not inflate confidence
  const hasLithology = evidence.lithology !== undefined && evidence.lithology !== 'unknown';
  const hasFaultRisk = evidence.faultSealRisk !== undefined && evidence.faultSealRisk !== 'unknown';
  const hasSealData = hasLithology && hasFaultRisk;
  const hasSome = hasLithology || hasFaultRisk;
  let confidence: EvidenceConfidence;
  if (evidence.presence === 'unknown' && !hasSome) confidence = 'unknown';
  else if ((evidence.presence === 'proven' || evidence.presence === 'probable') && hasSealData) confidence = 'high';
  else if (hasSome) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Seal ${evidence.presence}${evidence.lithology ? `, ${evidence.lithology}` : ''}${evidence.faultSealRisk ? `, fault seal risk ${evidence.faultSealRisk}` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'seal', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

export const assessTrap = (evidence: TrapEvidence): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  let score = evidence.closureMapped ? 0.70 : 0.30;

  if (evidence.closureMapped) {
    pos.push('Closure mapped');
  } else {
    neg.push('Closure not mapped');
    missing.push('Structural closure mapping required');
  }

  if (evidence.trapType !== undefined) {
    if (evidence.trapType === 'structural' || evidence.trapType === 'combination' || evidence.trapType === 'subsalt') {
      score += 0.07; pos.push(`${evidence.trapType.charAt(0).toUpperCase() + evidence.trapType.slice(1)} trap`);
    } else if (evidence.trapType === 'unknown') {
      score -= 0.10; missing.push('Trap type not defined');
    } else {
      pos.push(`${evidence.trapType} trap`);
    }
  } else {
    missing.push('Trap type not identified');
  }

  if (evidence.closureAreaKm2 !== undefined) {
    if (evidence.closureAreaKm2 >= 20) { score += 0.05; pos.push(`Closure area ${evidence.closureAreaKm2}km²`); }
    else { pos.push(`Closure area ${evidence.closureAreaKm2}km²`); }
  } else {
    missing.push('Closure area not estimated');
  }

  if (evidence.closureHeightM !== undefined) {
    if (evidence.closureHeightM >= 50) { score += 0.05; pos.push(`Closure height ${evidence.closureHeightM}m`); }
    else { pos.push(`Closure height ${evidence.closureHeightM}m`); }
  } else {
    missing.push('Closure height not estimated');
  }

  if (evidence.seismicConfidence !== undefined) {
    if (evidence.seismicConfidence === 'high') { score += 0.10; pos.push('High seismic confidence'); }
    else if (evidence.seismicConfidence === 'low') { score -= 0.10; neg.push('Low seismic confidence — structural interpretation uncertain'); }
    else if (evidence.seismicConfidence === 'unknown') { score -= 0.05; missing.push('Seismic confidence not assessed'); }
  } else {
    missing.push('Seismic quality not evaluated');
  }

  const finalScore = clamp01(score);
  const hasSeismic = evidence.seismicConfidence !== undefined && evidence.seismicConfidence !== 'unknown';
  let confidence: EvidenceConfidence;
  if (!evidence.closureMapped && !hasSeismic) confidence = 'unknown';
  else if (evidence.closureMapped && evidence.seismicConfidence === 'high') confidence = 'high';
  else if (evidence.closureMapped || hasSeismic) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Closure ${evidence.closureMapped ? 'mapped' : 'not mapped'}${evidence.trapType ? `, ${evidence.trapType} trap` : ''}${evidence.seismicConfidence ? `, seismic confidence ${evidence.seismicConfidence}` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'trap', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

export const assessTiming = (evidence: TimingEvidence): ComponentAssessment => {
  const pos: string[] = [];
  const neg: string[] = [];
  const missing: string[] = [];

  const timingBase: Record<string, number> = {
    yes: 0.85, likely: 0.70, uncertain: 0.45, unlikely: 0.20, no: 0.05,
  };
  let score = timingBase[evidence.trapFormedBeforeMigration] ?? 0.45;

  if (evidence.trapFormedBeforeMigration === 'yes' || evidence.trapFormedBeforeMigration === 'likely') {
    pos.push(`Trap formed before migration (${evidence.trapFormedBeforeMigration})`);
  } else if (evidence.trapFormedBeforeMigration === 'no') {
    neg.push('Trap formed after migration — charge timing failure');
  } else {
    missing.push(`Trap timing relationship uncertain (${evidence.trapFormedBeforeMigration})`);
  }

  if (evidence.chargeTiming !== undefined) {
    if (evidence.chargeTiming === 'favorable') { score += 0.08; pos.push('Favorable charge timing'); }
    else if (evidence.chargeTiming === 'possible') { score += 0.04; pos.push('Possible charge timing'); }
    else if (evidence.chargeTiming === 'unfavorable') { score -= 0.20; neg.push('Unfavorable charge timing — significant risk'); }
    else { missing.push('Charge timing unknown'); }
  } else {
    missing.push('Charge timing not assessed');
  }

  if (evidence.burialHistoryConfidence !== undefined) {
    const bhc = evidence.burialHistoryConfidence as BurialHistoryConfidence;
    if (bhc === 'high') { score += 0.05; pos.push('High burial history confidence'); }
    else if (bhc === 'low' || bhc === 'unknown') { score -= 0.08; neg.push(`Low burial history confidence — timing model uncertain`); }
  } else {
    missing.push('Burial history model not available');
  }

  const finalScore = clamp01(score);
  const hasTimingData = evidence.chargeTiming !== undefined && evidence.burialHistoryConfidence !== undefined;
  let confidence: EvidenceConfidence;
  if (evidence.trapFormedBeforeMigration === 'uncertain' && !hasTimingData) confidence = 'unknown';
  else if ((evidence.trapFormedBeforeMigration === 'yes' || evidence.trapFormedBeforeMigration === 'likely') && hasTimingData) confidence = 'high';
  else if (evidence.chargeTiming !== undefined || evidence.burialHistoryConfidence !== undefined) confidence = 'medium';
  else confidence = 'low';

  const rationale = `Trap formed before migration: ${evidence.trapFormedBeforeMigration}${evidence.chargeTiming ? `, charge timing ${evidence.chargeTiming}` : ''}${evidence.burialHistoryConfidence ? `, burial history confidence ${evidence.burialHistoryConfidence}` : ''}. Derived score ${(finalScore * 100).toFixed(0)}%.`;

  return { component: 'timing', score: finalScore, confidence, rationale, positiveEvidence: pos, negativeEvidence: neg, missingEvidence: missing };
};

const defaultUnknownComponents: ProspectEvidence = {
  source: { presence: 'unknown' },
  migration: { pathway: 'unknown' },
  reservoir: { presence: 'unknown' },
  seal: { presence: 'unknown' },
  trap: { closureMapped: false },
  timing: { trapFormedBeforeMigration: 'uncertain' },
};

const computeOverallConfidence = (components: ComponentAssessment[]): EvidenceConfidence => {
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const c of components) counts[c.confidence]++;
  if (counts.high >= 4) return 'high';
  if (counts.high + counts.medium >= 4) return 'medium';
  if (counts.unknown >= 3) return 'unknown';
  return 'low';
};

export const assessPetroleumSystem = (evidence: ProspectEvidence, targetPhase?: TargetPhase): GeoscienceAssessment => {
  const phase = targetPhase ?? 'unknown';

  const sourceAssessment = assessSource(evidence.source ?? defaultUnknownComponents.source!, phase);
  const migrationAssessment = assessMigration(evidence.migration ?? defaultUnknownComponents.migration!);
  const reservoirAssessment = assessReservoir(evidence.reservoir ?? defaultUnknownComponents.reservoir!);
  const sealAssessment = assessSeal(evidence.seal ?? defaultUnknownComponents.seal!);
  const trapAssessment = assessTrap(evidence.trap ?? defaultUnknownComponents.trap!);
  const timingAssessment = assessTiming(evidence.timing ?? defaultUnknownComponents.timing!);

  const components: ComponentAssessment[] = [
    sourceAssessment, migrationAssessment, reservoirAssessment,
    sealAssessment, trapAssessment, timingAssessment,
  ];

  const derivedScores = {
    sourceScore: sourceAssessment.score,
    migrationScore: migrationAssessment.score,
    reservoirScore: reservoirAssessment.score,
    sealScore: sealAssessment.score,
    trapScore: trapAssessment.score,
    timingScore: timingAssessment.score,
  };

  const criticalRisk = [...components].sort((a, b) => a.score - b.score)[0].component as ComponentName;
  const overallConfidence = computeOverallConfidence(components);
  const recommendedNextData = components.flatMap((c) => c.missingEvidence);

  const gcos = Object.values(derivedScores).reduce((acc, v) => acc * v, 1);
  const summary = `Evidence-derived assessment (phase: ${phase}). GCoS ${(gcos * 100).toFixed(1)}%. Critical risk: ${criticalRisk}. Overall confidence: ${overallConfidence}. ${components.find(c => c.negativeEvidence.length > 0)?.negativeEvidence[0] ?? ''}`.trim();

  return {
    scoringMode: 'evidence_derived',
    targetPhase: phase,
    components,
    derivedScores,
    criticalRisk,
    overallConfidence,
    summary,
    recommendedNextData,
  };
};

export const deriveScoresFromEvidence = (evidence: ProspectEvidence, targetPhase?: TargetPhase) =>
  assessPetroleumSystem(evidence, targetPhase).derivedScores;
