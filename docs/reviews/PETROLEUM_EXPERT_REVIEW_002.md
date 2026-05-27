# Petroleum Expert Review 002 — AI Targeting Workbench

**Review date:** 2026-05-27
**Branch:** feature/ai-targeting-workbench-v1
**Reviewer role:** Petroleum Systems / Exploration Decision Analysis
**Scope:** Recommendation Engine, Early Exploration Analyzer, Portfolio Intelligence, /targeting UI, Advisor extensions

---

## Technical Verdict

**CONDITIONALLY ACCEPTABLE — requires merge with documented limitations**

The Workbench adds a credible decision-support layer on top of the Geo AI Advisor Core. Tier classification logic is directionally sound. The hard rule preventing `drill_candidate` without Data Confidence ≥ 70 is the most important safety check and is correctly enforced. All recommended actions map to industry-standard workflows.

Significant limitations remain: thresholds are heuristic, no EMV or risked-resource modeling exists, and the system cannot account for basin-specific risk calibration. These are appropriate limitations for an MVP and are documented.

---

## Petroleum Correctness Assessment

### Tier Classification Logic

**Acceptable with caveats.**

- Tier 1 gates (GCoS ≥ 0.35, commercial ≥ 70, dc ≥ 70, min component ≥ 0.40) are defensible for a first-pass screening tool.
- **Issue:** GCoS of 35% is very high by global exploration standards. Industry average new-field wildcat success rates are typically 20–30%. Using 0.35 as the Tier 1 floor means the portfolio will have few Tier 1 prospects unless component scores are systematically high. Consider whether the threshold should be calibrated per play type or basin.
- **Issue:** A prospect with GCoS 34% and dc 95% receives Tier 2 treatment rather than Tier 1. The hard cutoff is logical but inflexible — real exploration teams would consider this a strong prospect.

### Recommended Actions

**Mostly correct. Minor concerns:**

- `drill_candidate` requiring dc ≥ 70 is correct. **Never** allow drilling on high GCoS + low Data Confidence.
- `appraisal_candidate` triggered at resourceEstimate ≥ 200 MMboe is reasonable but simplistic. Appraisal is driven by volume uncertainty range (P10/P90 spread), not just P50 estimate. A 200 MMboe estimate with a narrow range may not need appraisal; a 150 MMboe estimate with high volumetric uncertainty might.
- `acquire_additional_seismic` as the catch-all for trap risk and low-dc/high-GCoS is a reasonable proxy but conflates structural imaging programs with broader geophysical acquisition (AVO, full-azimuth, OBN). Real programs are geologically specific.
- `farm_in_candidate` and `acreage_review` are triggered purely by resource scale + GCoS. In practice, farm-in decisions depend on acreage commitment terms, partner obligations, and commercial strategy — none of which are modeled.

### Exploration Stage Classification

**Directionally correct.**

- The `concept_lead → lead → prospect → drill_ready_candidate → appraisal_candidate` progression mirrors standard industry maturation frameworks (PRMS, SPE).
- **Issue:** The stage classification does not use trap geometry (2D-only vs 3D-mapped), vintage of data, or regulatory status — all of which affect maturation in practice.
- `prospect` requires `scoringMode === 'evidence_derived'` and `trapScore ≥ 0.40`. This is an acceptable proxy for "trap has been technically evaluated." Manual prospects can never advance beyond `lead`, which is conservative but defensible for a data quality–gated system.

### Data Confidence Gate

**Correct and critical.**

The `dataConfidence ≥ 70` requirement for Tier 1 and `drill_candidate` is the most important safety guard in the entire system. The scoring engine correctly applies the `evidenceConfidencePenalty` to evidence-derived prospects with all-unknown inputs, so a prospect cannot inflate its way to a drill recommendation through sparse evidence.

---

## Parameter Issues

| Parameter | Current Value | Issue |
|---|---|---|
| Tier 1 GCoS threshold | 0.35 | High by industry standards; most global plays would rarely exceed this |
| Tier 2 GCoS threshold | 0.18 | Reasonable |
| dc gate for Tier 1 | 70 | Appropriate |
| dc gate for Tier 2 | 50 | Appropriate |
| Farm-in resource threshold | 150 MMboe | Arbitrary; real farm-in interest depends on acreage position, not just resource |
| Appraisal trigger | resourceEstimate ≥ 200 MMboe | Volumetric range (P10/P90) is a better trigger |
| do_not_prioritize GCoS floor | < 0.05 | Correct; below this, no realistic play concept remains |

---

## Missing Evidence / Model Fields

1. **No volumetric range.** P10/P50/P90 or GRV estimates are absent. The appraisal trigger uses a single P50 number.
2. **No EMV calculation.** Expected Monetary Value = GCoS × NPV(success) − (1 − GCoS) × dry-hole cost. Without this, commercial ranking is incomplete.
3. **No seismic vintage / data quality flag.** A prospect with 2D seismic only should never reach `drill_ready_candidate`; 3D reprocessed with modern imaging is a prerequisite.
4. **No license expiry / work program obligation.** Exploration decisions are heavily constrained by license timelines.
5. **No analogue calibration.** All GCoS inputs are raw scores, not calibrated against basin-specific success rates.

---

## Recommendation Quality

The recommended actions are qualitatively appropriate for a rule-based system:

- ✅ `drill_candidate` is never accessible without dc ≥ 70
- ✅ `validate_seal_continuity` correctly maps to seal risk
- ✅ `improve_timing_model` correctly maps to timing risk
- ✅ `acquire_additional_seismic` for trap risk is the right first step
- ⚠️ The waterfall ordering (trap → reservoir → seal → timing → farm-in → acreage → watchlist → do_not_prioritize) means mainRisk always wins over resource scale for mid-tier prospects. A 300 MMboe prospect with mainRisk = seal becomes `validate_seal_continuity`, not `farm_in_candidate`. This is technically defensible (seal must be resolved first) but a 300 MMboe resource would draw farm-in interest regardless.

---

## Risk of Overclaiming

**Managed but present.**

- The system must never be described as predicting discovery probability. The disclaimer "does not guarantee discoveries" and "does not replace technical interpretation" appear in the UI and documentation. These must be retained in all user-facing surfaces.
- The label "AI Targeting Workbench" and "AI-assisted petroleum targeting" could be misread as implying machine learning-trained recommendations. The disclaimer "rule-based heuristics, not ML" should be consistently visible in the UI.
- `drill_candidate` is a strong term. It should always be accompanied by the data confidence value and risk flags visible in the same view. The current Prospect Detail implementation satisfies this.

---

## Required Changes Before Merge

None blocking. The implementation is correct within its stated scope. The following are recommended improvements for future iterations:

1. Add a `dataSufficiency` note to each recommendation: "This recommendation is based on N of 6 components being evidence-derived."
2. Consider lowering the Tier 1 GCoS threshold to 0.25 after calibration against the mock data distribution.

---

## Future Improvements

1. **EMV ranking** — Replace pure GCoS ranking with `GCoS × unrisked NPV` for commercial portfolio ordering.
2. **P10/P90 volumetric range** — Add resource range field to trigger appraisal on volume uncertainty rather than point estimate.
3. **Basin-specific calibration** — Adjust GCoS thresholds per play type (e.g., deepwater structural plays vs. tight oil unconventional).
4. **Seismic vintage flag** — Add `seismicVintage: '2D' | '3D' | '3D-reprocessed'` to TrapEvidence; gate `drill_ready_candidate` on 3D coverage.
5. **Prospectivity surface** — Map GCoS spatial distribution over the basin grid to enable geospatial targeting (this is the path toward Mineral Forecast–style targeting).
6. **License obligations** — Add `licenseExpiry`, `workProgramCommitment` to Prospect type; include in action logic.
7. **Analogue database** — Build per-basin historical success rate calibration table to replace the heuristic GCoS thresholds.

---

## Questions for Product Owner

1. Should `drill_candidate` be gated behind an explicit human sign-off step in the UI, or is the risk flag display sufficient?
2. Should the Tier 1 GCoS threshold (0.35) be user-configurable per portfolio, or remain fixed?
3. Is there a plan to integrate real EMV/NPV inputs in a future release, or will commercial score remain the proxy?
4. Should `farm_in_candidate` be suppressed when the company is the sole operator (no farm-in appetite)?
5. Is the 200 MMboe appraisal trigger meaningful for the basins this portfolio represents, or should it be scaled by play type?
