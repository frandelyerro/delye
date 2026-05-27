# Petroleum Technical Parameters

## Status

These parameters are MVP heuristics.
They are not calibrated against historical drilling outcomes yet.
They must be reviewed and calibrated per basin/play in future releases.

## Current component scoring philosophy

Use conservative, explainable, auditable rules.

Scores:
- 0.00–0.20: very weak
- 0.20–0.40: weak
- 0.40–0.60: uncertain / moderate
- 0.60–0.80: strong
- 0.80–1.00: very strong

## Current thresholds

GCoS:
- High priority if GCoS >= 0.35 and commercialScore >= 70
- Medium if GCoS >= 0.18
- Low if GCoS < 0.18

Data Confidence:
- High >= 75
- Medium >= 50
- Low < 50

## Required future calibration

Parameters must eventually be calibrated by:
- basin
- play type
- conventional vs unconventional
- oil vs gas target
- frontier vs mature basin
- historical discovery / dry hole outcomes

## Technical gaps to address

### 1. Source

Need:
- HI / OI / S2 support
- kerogen quality
- source kitchen maps
- expulsion efficiency
- charge volume

### 2. Migration

Need:
- charge fairway model
- fault carrier vs fault seal distinction
- hydrocarbon shows / seeps
- migration distance
- pressure / buoyancy logic

### 3. Reservoir

Need:
- net-to-gross
- saturation
- facies model
- depositional environment
- reservoir depth/temperature effects
- analog wells

### 4. Seal

Need:
- top seal vs lateral seal
- fault seal / SGR
- column height capacity
- capillary entry pressure
- leakage indicators

### 5. Trap

Need:
- spill point
- closure confidence
- structural uncertainty
- stratigraphic pinchout confidence
- seismic horizon quality

### 6. Timing

Need:
- burial history
- charge timing
- trap formation timing
- events chart
- basin modeling

### 7. Volumetrics

Need:
- GRV
- net-to-gross
- porosity
- hydrocarbon saturation
- formation volume factor
- recovery factor
- P10 / P50 / P90 resources

### 8. Commercial

Need:
- depth
- water depth if offshore
- infrastructure distance
- fiscal/regulatory risk
- development concept
- breakeven estimate
