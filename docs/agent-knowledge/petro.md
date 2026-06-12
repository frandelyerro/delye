# Petroleum Domain Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Unconventional reservoir flag-consistency check (`geoscienceEngine.ts` ~line 174):
  porosity/permeability assessment branches on `evidence.isUnconventional`, but there's
  no validation that this flag matches the actual porosity/permeability profile (e.g.
  a tight sandstone with `isUnconventional=false` gets penalized under conventional
  thresholds). Proposal: add `validateUnconventionalFlagConsistency()` producing a
  `GeoscienceAssessment.warnings` entry (not a hard gate) when porosity/permeability
  contradicts the flag. Touches geoscienceEngine.ts (hard constraint) — needs a PR with
  methodology citation (SPE/AAPG/SEG unconventional definitions) and before/after test
  evidence for a tight-sandstone case.
## Completed
- 2026-06-12 (cycle 25): SHIPPED `src/domain/sealAnalysis.ts` per the cycle-24
  spec — `analyzeSealTrapRisk(prospects)` cross-tabs prospects by seal lithology x
  trap type (returns sorted counts, `'unrecorded'` for missing lithology/trapType)
  and `getSubsaltNonEvaporiteRisks(prospects)` flags subsalt-trap prospects whose
  seal lithology is missing or outside the evaporite class (salt/evaporite/
  anhydrite — matches `geoscienceEngine.ts assessSeal`'s `isEvaporiteSeal` grouping
  at lines 252/258/270, confirming consistency). New advisor handler triggered by
  "seal lithology"/"subsalt seal"/"seal type"/"evaporite seal", placed in
  `advisor.ts` immediately after the cycle-21 "fault seal" handler and before the
  broader "seal risk" handler (no pattern collision: the line-1016 "subsalt"
  trap-geometry handler is later in the chain and our trigger requires "subsalt
  seal" specifically). 6 new tests (4 sealAnalysis unit tests, 2 advisor tests
  using the neutral name "Vaca Norte Lead" per the cycle-18 naming convention).
  724/724 tests pass, 0 TS errors, build clean. The "drilled analogs for
  [prospect]" follow-on (~10L, outcomeOnly analog filter surfacing) remains open
  for a future cycle.
- 2026-06-11 (cycle 24): sealAnalysis.ts re-verified and READY but DEFERRED to
  cycle 25 (this cycle's budget went to the Zustand selector refactor + the
  security CSV-injection fix). Verified plan: new `src/domain/sealAnalysis.ts`
  (~85L) with `analyzeSealTrapRisk()` (cross-tab by SealLithology × TrapType,
  flagging subsalt traps with non-evaporite/non-salt/non-anhydrite seals per AAPG
  Memoir 74 / Knipe 1997) + `getSubsaltNonEvaporiteRisks()`, plus an advisor
  handler triggered by "seal lithology"/"subsalt seal"/"seal type"/"evaporite
  seal" inserted AFTER the cycle-21 "fault seal" handler but BEFORE the broader
  "seal risk" handler (precedence). ~145 LOC incl. tests. Also a cheap follow-on:
  surface the cycle-23 `outcomeOnly` analog filter via a "drilled analogs for
  [prospect]" advisor phrase (~10L).
- 2026-06-11 (cycle 23): Outcome-conditioned analog variant IMPLEMENTED — added
  `outcomeOnly?: boolean` to `AnalogFilters` in `analogFinder.ts`; when set,
  candidates are restricted to prospects with a known historical outcome
  (`isKnownOutcome(p.outcome)` — discovery/dry hole/non-commercial). Composes
  with samePlayType/sameBasin/byMainRisk. 3 new analogFinder tests. This
  completes the findAnalogs filter set started in cycle 19.
- 2026-06-11 (cycle 22): Added the three petroleum-system interaction features
  proposed in cycle 21 to `extractTrainingFeatures()` in `mlTrainingFeatures.ts`:
  `sourceTimesMigration` (sourceScore*migrationScore), `reservoirTimesSeal`
  (reservoirScore*sealScore), and `minTrapTiming` (min(trapScore, timingScore)) —
  all safe pre-drill, derived from the existing 6 component scores, alongside
  componentMin/Max/Range/Variance. 3 new mlTrainingFeatures tests.

- 2026-06-11 (cycle 21): Added a "fault seal risk" / "faulted seal" advisor handler
  in `advisor.ts`, placed BEFORE the existing broader "seal risk" handler (pattern
  precedence — "fault seal risk" contains "seal risk" as a substring). Reads
  `evidence?.seal?.faultSealRisk` (low/medium/high/unknown) across the portfolio and
  reports prospects flagged HIGH/MEDIUM with fault-seal-analysis de-risking guidance
  (SGR, juxtaposition diagrams, offset-well pressure data). Returns a "no data
  recorded" message when no prospects have this evidence field set. Pure
  read/aggregation over existing evidence — no geoscience engine or scoring change.
  2 new advisor tests.
- Outcome success-rate analytics — IMPLEMENTED in cycle 18: `getBasinOutcomeStats()`,
  `getPlayTypeOutcomeStats()` (shared `groupOutcomeStats` helper) and
  `getOutcomeCalibration()` (10 GCoS buckets, actual vs midpoint-expected success rate,
  Rose & Associates lookback methodology) in `portfolioIntelligence.ts`, plus two
  advisor handlers: "success rate (by basin/play)" and "gcos calibration" (flags
  OPTIMISTIC/CONSERVATIVE buckets only when n>=5). Only outcomes with
  `label !== 'unknown'` count; small-sample caveat included in every response.
  Surfaced in the new Calibration page (/calibration, see dev.md). Pure aggregation —
  no scoring/engine change.
- Trap-geometry advisor query — IMPLEMENTED in cycle 17: new handler in `advisor.ts`
  triggered by trap-type/geometry/closure/subsalt keywords. Reads `evidence?.trap`
  (`TrapEvidence`: `closureMapped`, `trapType`, `closureAreaKm2`, `closureHeightM`,
  `seismicConfidence`) and returns: trap-type distribution across the portfolio,
  prospects with `closureMapped === false` (unmapped closures), subsalt traps with
  `seismicConfidence` below "high" (velocity pull-up/push-down imaging risk —
  consistent with the subsalt penalty already in `geoscienceEngine.ts assessTrap`),
  and trap-score-limited prospects, plus a methodology note. Pure read/aggregation
  over existing evidence — no geoscience engine or scoring change.

- 2026-06-11 (cycle 19): Extended `findAnalogs()` in `analogFinder.ts` with an optional
  `AnalogFilters` argument (`samePlayType`, `sameBasin`, `byMainRisk`) so callers can
  restrict candidates to truly comparable prospects (same play type, same basin, or
  same dominant risk factor) before ranking by scoring-profile distance. `byMainRisk`
  matches nothing if the target has no `mainRisk` set. 6 new analogFinder tests.

## Reference material / methodology notes
- 2026-06-10 (cycle 16): NPV advisor handler (explaining "positive EMV but negative
  NPV" using `discountRate`/`simpleNPVAtDiscountUsdMM`) and a `mlFeatures.ts` NPV
  feature are both BLOCKED until PR #23 (`feature/economics-npv`, commit `b81ce6b`)
  merges to main — those fields don't exist on `claude/funny-allen-BLz4j` yet.
  Revisit once PR #23 is merged.
- 2026-06-10: Added an advisor handler for source-kitchen / migration-distance queries
  using `evidence.migration.distanceFromKitchenKm` (>50 km flagged as elevated lateral
  charge risk). This is additive only (advisor.ts), no geoscience engine change.
- 2026-06-10: Kerogen-type-aware TOC thresholds — CONFIRMED ALREADY IMPLEMENTED in
  `geoscienceEngine.ts assessSource()` (coaly/terrestrial sources use a 0.5%/2% TOC
  scale vs. 1%/2%/4% for Type I/II). No further action needed; removed from open items.
- 2026-06-10: IRR/NPV for `EconomicAssessment` — RESOLVED via PR #23 (commit `b81ce6b`,
  branch `feature/economics-npv`): added `discountRate` (default 10%) and
  `simpleNPVAtDiscountUsdMM` (5-year single-point realization assumption) to
  `EconomicAssessment`, plus a "positive EMV but negative NPV" warning. IRR intentionally
  not added (no multi-year cash-flow timeline exists). Awaiting human review/merge to main.
- 2026-06-10: Added two safe/additive advisor handlers (advisor.ts): "compare <prospect
  A> and <prospect B>" (highlights largest component-score divergence) and "which
  component should we prioritize/focus to de-risk the portfolio" (lowest portfolio-
  average component score + most-frequent weakest component). Both are pure aggregation
  over existing scores, no geoscience engine change.
- 2026-06-12 (cycle 26): Added a "drilled analogs for [name]" advisor handler
  (`advisor.ts`, triggers on `q.includes('drilled analogs')` — plural, to avoid
  colliding with the existing "closest to a drilled analog" handler) that ranks
  known-outcome portfolio prospects by scoring-profile similarity to the named
  prospect via `findAnalogs(target, prospects, 3, { outcomeOnly: true })` (cycle 23
  infrastructure). Returns "no drilled analogs yet" pointing to `/outcomes` when none
  exist. Also added a caveat paragraph to the new Identified Targets page
  (`IdentifiedTargetsPage.tsx`) noting the 150 km clustering radius is a spatial
  heuristic, not a play-fairway model — clustered prospects must be verified to share
  source/seal/trap-style petroleum-system elements before using a target grouping for
  infrastructure or JV planning. 3 new advisor tests.
- 2026-06-12 (cycle 27): No petro item implemented this cycle (priority went to
  correctness fixes). Deferred with concrete plans on file: (1) standalone
  unconventional-flag consistency validator (~82L additive module flagging
  isUnconventional=false with tight-reservoir data, surfaced as a warning, NOT
  a geoscienceEngine change); (2) target petroleum-system consistency
  validator (~103L, play/seal homogeneity flags on IdentifiedTarget); (3)
  Ro phase-boundary guidance — REJECTED as proposed because it edits
  assessSource() in geoscienceEngine.ts (hard-constraint file); would need an
  advisor-only reformulation.
