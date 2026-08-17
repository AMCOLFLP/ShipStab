# AMCOL Pure Physics Modules — v1.15.0

These files contain stateless numerical functions used by the compatibility layer in `src/core/core.js`.

- `mass-properties.js` — mass/moment aggregation and free-surface correction algebra
- `hydrostatics.js` — hydrostatic table and angle interpolation plus density-equivalent displacement
- `trim.js` — trimming moment, trim, forward/aft draught distribution about LCF and UKC
- `kn.js` — KN interpolation in angle and displacement and small-angle KM check
- `gz.js` — GZ construction from KN/CG and signed/restoring conversions
- `draft-survey.js` — UN/ECE-style six-draught averaging, mark-to-perpendicular corrections, M/M/M draught, trim corrections, density correction and deductibles

## Architecture contract

Physics modules do not access the DOM, Three.js, Chart.js, localStorage or simulator global state. Inputs are plain objects/arrays and outputs are plain objects/numbers.

`core.js` remains the compatibility/orchestration layer and is responsible for collecting cargo/tank inputs and updating simulator state/UI.

This makes the numerical foundation independently testable and suitable for staged migration to `src/workers/physics-worker.js`.
