# AMCOL Pure Physics Modules — v2.0.0 Stable

Stateless numerical modules used by the simulator compatibility/orchestration layer:

- `hull-geometry.js` — shared family station/section geometry queries
- `mass-properties.js` — mass/moment aggregation and free-surface correction algebra
- `hydrostatics.js` — hydrostatic interpolation and density-equivalent displacement
- `trim.js` — trimming moment and FWD/AFT draught distribution about LCF
- `kn.js` — KN interpolation and small-angle KM check
- `gz.js` — GZ construction from KN/KG/TCG
- `tank-sounding.js` — sounding/ullage calibration interpolation, volume/mass/VCG/FSM
- `longitudinal-strength.js` — SF/BM envelope interpolation and utilisation
- `damage-stability.js` — teaching exposure estimate and explicit-connectivity flooding graph
- `seakeeping-proxy.js` — educational response proxy, not ship-specific RAO
- `draft-survey.js` — six-draught survey, corrections, M/M/M, trim/density/deductibles
- `draft-survey-mission.js` — mission observation generation and grading

## Contract
These modules do not access the DOM, Three.js, Chart.js or localStorage. Inputs and outputs are plain values/objects/arrays. The core remains the stateful compatibility layer.

## Authority
Pure code does not make reconstructed data approved. Numerical authority still follows the active vessel/source matrix: source-backed data first, calibrated/derived training data where clearly identified, no silent extrapolation or invented statutory data.
