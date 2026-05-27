# Petroleum Technical Review Checklist

Use this checklist before approving any change to the geoscience engine, scoring logic, advisor, dashboard, targeting workflow or recommendation engine.

## A. Domain model review

Check:
- Does Prospect separate manual scoring from evidence-derived scoring?
- Is evidence structured by petroleum system component?
- Does every component keep rationale, positive evidence, negative evidence and missing evidence?
- Can the model support both oil and gas?
- Is targetPhase represented?
- Are evidence sources tracked?
- Are manual assumptions clearly marked?

Required fields to review:
- source evidence
- migration evidence
- reservoir evidence
- seal evidence
- trap evidence
- timing evidence
- data confidence
- GCoS
- main risk
- recommendation
- recommended next data

## B. Source rock review

Check:
- Is sourceRockPresence represented?
- Is TOC included?
- Is Ro or maturity included?
- Is Tmax optional but supported?
- Is kerogen type supported?
- Is source thickness included?
- Is distance to kitchen included?
- Are missing TOC and maturity penalized through confidence rather than blindly through risk?

Expected interpretation:
- TOC < 0.5 is poor.
- TOC 0.5–1 is marginal/fair.
- TOC 1–2 is good.
- TOC 2–4 is very good.
- TOC > 4 is excellent.

For oil:
- Ro around 0.6–1.1 is generally favorable.

For gas:
- Ro around 1.0–2.0 can be favorable.

Important:
These are heuristics, not universal laws. They must be configurable by basin/play later.

## C. Migration review

Check:
- Is migration pathway represented?
- Is kitchen distance represented?
- Is carrier bed presence represented?
- Is fault connectivity represented?
- Can the engine distinguish migration support from source quality?
- Does the advisor explain whether charge path is proven, probable, possible or unknown?

Red flags:
- High migration score with unknown pathway.
- High migration score with absent carrier and poor fault connectivity.
- High GCoS if source exists but charge pathway is unclear.

## D. Reservoir review

Check:
- Is reservoir presence represented?
- Are porosity, permeability, net pay and continuity included?
- Is vshale supported?
- Does low permeability penalize reservoir quality?
- Does missing petrophysics reduce confidence?

Expected heuristic:
- Porosity < 8% is weak unless special fractured/tight context is specified.
- 8–12% is marginal.
- 12–18% is good.
- >18% is strong.
- Permeability <1 mD is weak for conventional reservoir unless unconventional context is specified.
- 10–100 mD is generally good.
- >100 mD is strong.

## E. Seal review

Check:
- Is seal presence represented?
- Is seal lithology represented?
- Is seal thickness represented?
- Is fault seal risk represented?
- Does high faultSealRisk penalize strongly?
- Does the system distinguish top seal from fault seal?

Red flags:
- High priority with sealScore very low.
- Recommendation to drill when mainRisk is seal and dataConfidence is low.

## F. Trap review

Check:
- Is trap type represented?
- Is closure mapped?
- Are closure area and closure height represented?
- Is seismic confidence represented?
- Is spill point or structural closure planned for future?
- Does closureMapped false prevent drill-ready recommendation?

Red flags:
- Drill candidate without mapped closure.
- High trap score with unknown trap type and low seismic confidence.

## G. Timing review

Check:
- Is trapFormedBeforeMigration represented?
- Is burial history confidence represented?
- Is charge timing represented?
- Does unfavorable chargeTiming penalize strongly?
- Does low timing confidence generate recommended next data?

Red flags:
- High GCoS with timingScore low.
- Drill recommendation when timing is uncertain and data confidence is low.

## H. Data Confidence review

Check:
- Does Data Confidence measure evidence quality, not petroleum chance?
- Does it penalize missing critical data?
- Does it reward direct evidence from wells, seismic and reports?
- Does it avoid giving high confidence to purely manual assumptions?
- Does it influence recommended action?

Required rule:
High GCoS + low Data Confidence must not become drill candidate automatically.

## I. Recommendation review

Check:
- Does recommendation follow mainRisk?
- Does recommendation suggest next data to reduce uncertainty?
- Does recommendation avoid overclaiming?
- Does recommendation distinguish:
  - drill candidate
  - de-risk first
  - acquire seismic
  - validate reservoir
  - validate seal
  - improve timing model
  - farm-in / acreage review
  - do not prioritize?

## J. Explainability review

Every recommendation must answer:
- Why is this prospect ranked this way?
- Which components are strongest?
- Which component is weakest?
- What evidence supports the score?
- What evidence is missing?
- What is the recommended next technical step?
- How confident are we in the inputs?
