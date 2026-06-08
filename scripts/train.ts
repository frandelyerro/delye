/**
 * End-to-end ML training pipeline script.
 * Generates a realistic synthetic dataset, trains the logistic-regression
 * baseline, and prints metrics, confusion matrix, and top weights.
 *
 * Run:  npx vite-node scripts/train.ts
 */

import { scoreProspect } from '../src/domain/scoring';
import type { Prospect } from '../src/domain/prospect';
import { trainBaselineMLModel } from '../src/domain/mlTrainingService';

// ── Seeded PRNG (same seed → same dataset every run) ────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1337);
const randn = () => rand() * 2 - 1; // uniform [-1, 1] — enough for synthetic variation
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// ── Realistic geological archetypes ─────────────────────────────────────────
type WellArchetype = {
  name: string;
  basin: string;
  playType: string;
  source: [number, number];     // [mean, spread]
  migration: [number, number];
  reservoir: [number, number];
  seal: [number, number];
  trap: [number, number];
  timing: [number, number];
  lat: number; lon: number;
  successRate: number;          // probability of discovery label
};

const archetypes: WellArchetype[] = [
  // Rich prolific basins → high success rate
  {
    name: 'NorthSea_Structural', basin: 'North Sea', playType: 'Structural',
    source: [0.80, 0.08], migration: [0.75, 0.08], reservoir: [0.70, 0.10],
    seal: [0.72, 0.08], trap: [0.68, 0.10], timing: [0.78, 0.07],
    lat: 57.5, lon: 3.0, successRate: 0.65,
  },
  {
    name: 'NorthSea_Stratigraphic', basin: 'North Sea', playType: 'Stratigraphic',
    source: [0.75, 0.08], migration: [0.68, 0.09], reservoir: [0.60, 0.12],
    seal: [0.65, 0.10], trap: [0.55, 0.12], timing: [0.72, 0.08],
    lat: 58.0, lon: 2.5, successRate: 0.45,
  },
  // Norwegian Sea — good source, weaker reservoir
  {
    name: 'NorwegianSea_Deep', basin: 'Norwegian Sea', playType: 'Structural',
    source: [0.70, 0.10], migration: [0.60, 0.10], reservoir: [0.50, 0.14],
    seal: [0.58, 0.12], trap: [0.60, 0.10], timing: [0.65, 0.10],
    lat: 65.0, lon: 5.0, successRate: 0.38,
  },
  // Barents Sea — mixed, some large discoveries
  {
    name: 'BarentsSea_Platform', basin: 'Barents Sea', playType: 'Structural',
    source: [0.60, 0.12], migration: [0.55, 0.12], reservoir: [0.65, 0.10],
    seal: [0.55, 0.12], trap: [0.62, 0.10], timing: [0.58, 0.12],
    lat: 74.0, lon: 22.0, successRate: 0.30,
  },
  // Poor quality plays → mostly dry holes
  {
    name: 'Frontier_DeepWater', basin: 'Norwegian Sea', playType: 'Stratigraphic',
    source: [0.38, 0.12], migration: [0.35, 0.12], reservoir: [0.40, 0.14],
    seal: [0.38, 0.12], trap: [0.35, 0.12], timing: [0.42, 0.12],
    lat: 68.0, lon: 8.0, successRate: 0.10,
  },
  {
    name: 'Tight_Barents', basin: 'Barents Sea', playType: 'Structural',
    source: [0.30, 0.10], migration: [0.28, 0.10], reservoir: [0.30, 0.10],
    seal: [0.35, 0.12], trap: [0.40, 0.12], timing: [0.32, 0.10],
    lat: 76.0, lon: 30.0, successRate: 0.08,
  },
  // Neuquén (Argentina) — good shale source but seal risk
  {
    name: 'Neuquen_Unconventional', basin: 'Neuquén', playType: 'Unconventional',
    source: [0.78, 0.07], migration: [0.72, 0.08], reservoir: [0.55, 0.12],
    seal: [0.45, 0.14], trap: [0.60, 0.10], timing: [0.70, 0.08],
    lat: -38.0, lon: -69.0, successRate: 0.42,
  },
  // Gulf of Mexico deepwater — high risk, big reward
  {
    name: 'GOM_Deepwater', basin: 'Gulf of Mexico', playType: 'Stratigraphic',
    source: [0.82, 0.07], migration: [0.70, 0.10], reservoir: [0.68, 0.10],
    seal: [0.60, 0.12], trap: [0.55, 0.14], timing: [0.75, 0.08],
    lat: 26.0, lon: -90.0, successRate: 0.48,
  },
];

// ── Generate prospects ───────────────────────────────────────────────────────
const WELLS_PER_ARCHETYPE = 20; // 160 total

let idx = 0;
const rawProspects: Prospect[] = [];

for (const a of archetypes) {
  for (let i = 0; i < WELLS_PER_ARCHETYPE; i++) {
    const score = (mean: number, spread: number) =>
      clamp(mean + randn() * spread);

    const base: Prospect = {
      id: `synth-${a.name}-${i + 1}`,
      name: `${a.name.replace(/_/g, ' ')} #${i + 1}`,
      basin: a.basin,
      block: `Block-${(i % 8) + 1}`,
      playType: a.playType,
      latitude: a.lat + randn() * 1.5,
      longitude: a.lon + randn() * 1.5,
      sourceScore: score(...a.source),
      migrationScore: score(...a.migration),
      reservoirScore: score(...a.reservoir),
      sealScore: score(...a.seal),
      trapScore: score(...a.trap),
      timingScore: score(...a.timing),
      commercialScore: Math.round(clamp(rand() * 40 + 40, 0, 100) * 10) / 10,
      resourceEstimate: Math.round(rand() * 200 + 10),
      scoringMode: 'manual',
      outcome: {
        label: rand() < a.successRate
          ? (rand() < 0.4 ? 'commercial_discovery' : 'technical_discovery')
          : 'dry_hole',
        targetVariable: 'geological_success',
        resultConfidence: 'high',
        source: 'historical',
      },
    };

    rawProspects.push(scoreProspect(base));
    idx++;
  }
}

// ── Dataset summary ──────────────────────────────────────────────────────────
const discoveries = rawProspects.filter(
  (p) => p.outcome?.label === 'commercial_discovery' || p.outcome?.label === 'technical_discovery',
);
const dryHoles = rawProspects.filter((p) => p.outcome?.label === 'dry_hole');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║         PetroTarget AI — ML Training Pipeline                ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
console.log('Dataset:');
console.log(`  Total wells:      ${rawProspects.length}`);
console.log(`  Discoveries:      ${discoveries.length} (commercial: ${rawProspects.filter(p => p.outcome?.label === 'commercial_discovery').length}, technical: ${rawProspects.filter(p => p.outcome?.label === 'technical_discovery').length})`);
console.log(`  Dry holes:        ${dryHoles.length}`);
console.log(`  Success rate:     ${((discoveries.length / rawProspects.length) * 100).toFixed(1)}%`);
console.log(`  Basins:           ${[...new Set(rawProspects.map(p => p.basin))].join(', ')}\n`);

// ── Train ────────────────────────────────────────────────────────────────────
console.log('Training logistic-regression baseline...');
console.log('  Target:           geological_success');
console.log('  Feature mode:     safe_pre_drill');
console.log('  Train/test split: 80/20');
console.log('  Iterations:       1000');
console.log('  L2 penalty:       0.001\n');

const t0 = Date.now();
const result = trainBaselineMLModel(rawProspects, {
  target: 'geological_success',
  featureMode: 'safe_pre_drill',
  trainRatio: 0.8,
  learningRate: 0.05,
  iterations: 1000,
  l2Penalty: 0.001,
  minExamples: 30,
  excludeSynthetic: false, // we generated these as 'historical'
});
const elapsed = Date.now() - t0;

// ── Results ──────────────────────────────────────────────────────────────────
const { model, metrics } = result;
const { confusionMatrix: cm } = metrics;
const TP = cm.truePositive;
const FP = cm.falsePositive;
const TN = cm.trueNegative;
const FN = cm.falseNegative;

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                        METRICS                              ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Accuracy:   ${(metrics.accuracy * 100).toFixed(1).padStart(6)}%                                        ║`);
console.log(`║  Precision:  ${(metrics.precision * 100).toFixed(1).padStart(6)}%   (of predicted positives, how many real) ║`);
console.log(`║  Recall:     ${(metrics.recall * 100).toFixed(1).padStart(6)}%   (of real positives, how many found)    ║`);
console.log(`║  F1 score:   ${metrics.f1.toFixed(4).padStart(6)}                                         ║`);
console.log(`║  Brier:      ${metrics.brierScore.toFixed(4).padStart(6)}   (lower is better, 0.25 = random)        ║`);
console.log(`║  Train rows: ${String(metrics.trainSize).padStart(6)}   Test rows: ${String(metrics.testSize).padStart(3)}                     ║`);
console.log(`║  Training:   ${String(elapsed).padStart(5)}ms                                          ║`);
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║                    CONFUSION MATRIX                         ║');
console.log('╠═══════════════════════════╦═════════════╦═════════════╣');
console.log('║                           ║ Pred Pos     ║ Pred Neg    ║');
console.log('╠═══════════════════════════╬═════════════╬═════════════╣');
console.log(`║ Actual Positive (disc.)   ║ TP: ${String(TP).padStart(4)}     ║ FN: ${String(FN).padStart(4)}    ║`);
console.log(`║ Actual Negative (dry)     ║ FP: ${String(FP).padStart(4)}     ║ TN: ${String(TN).padStart(4)}    ║`);
console.log('╚═══════════════════════════╩═════════════╩═════════════╝');

// ── Feature weights ──────────────────────────────────────────────────────────
const weightPairs = model.featureNames.map((name, i) => ({
  name,
  weight: model.weights[i],
}));
weightPairs.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

console.log('\n── Top 10 feature weights (by |weight|) ──────────────────────');
console.log('  Feature                         Weight');
for (const { name, weight } of weightPairs.slice(0, 10)) {
  const bar = (weight > 0 ? '+' : '-').repeat(Math.min(Math.round(Math.abs(weight) * 20), 30));
  const sign = weight >= 0 ? '+' : '';
  console.log(`  ${name.padEnd(32)} ${sign}${weight.toFixed(4)}  ${bar}`);
}
console.log(`\n  Intercept: ${model.intercept >= 0 ? '+' : ''}${model.intercept.toFixed(4)}`);

// ── Model warnings ───────────────────────────────────────────────────────────
console.log('\n── Model warnings ────────────────────────────────────────────');
for (const w of model.warnings ?? []) {
  console.log(`  ⚠  ${w}`);
}

// ── Sample predictions ───────────────────────────────────────────────────────
console.log('\n── Sample predictions (first 8 test wells) ───────────────────');
console.log('  Well                          Expert  ML prob  Label      Match');
const testPreds = result.predictions.slice(0, 8);
for (const p of testPreds) {
  const prospect = rawProspects.find(r => r.id === p.prospectId)!;
  const gcos = (prospect.geologicalChanceOfSuccess ?? 0) * 100;
  const ml = (p.probability * 100).toFixed(1).padStart(5);
  const label = prospect.outcome?.label ?? '?';
  const predicted = p.predictedLabel === 1 ? 'discovery' : 'dry_hole';
  const match = predicted === (label === 'dry_hole' ? 'dry_hole' : 'discovery') ? '✓' : '✗';
  console.log(`  ${prospect.name.slice(0, 29).padEnd(29)} ${gcos.toFixed(1).padStart(5)}%  ${ml}%  ${label.padEnd(24)} ${match}`);
}

console.log(`\n✓ Model trained at ${model.trainedAt}`);
console.log(`  Model file would save to localStorage key: petrotarget-ai:trained-ml-model`);
console.log('\n  SAFETY: This model is advisory only. It must never override');
console.log('  expert-system GCoS, prospect priority, recommended actions,');
console.log('  drill-candidate logic, or economics decision signals.\n');
