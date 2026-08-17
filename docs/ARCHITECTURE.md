# AMCOL Simulator v2.0.0 Stable — Architecture

## Runtime flow

```text
Vessel package / condition / user controls
                ↓
       Core orchestration
       src/core/core.js
                ↓
 ┌──────────────┼─────────────────┐
 ↓              ↓                 ↓
Pure physics   Stateful coupled   Assessment / missions
modules        simulator flow
 ↓              ↓
Worker-ready   Authoritative state snapshot
 └──────────────┬─────────────────┘
                ↓
       ┌────────┼────────┐
       ↓        ↓        ↓
      2D       3D       UI / charts / reports
```

## Shared geometry kernel
`src/physics/hull-geometry.js` is the common family geometry source for station envelopes, transverse family polygons and half-breadth queries. The core and 3D renderer delegate to it where applicable.

This does not overwrite source hydrostatic/KN data. A vessel with approved/source hydrostatics still uses those data as the numerical authority. Complete exact geometry-driven hydrostatics require actual lines/offsets.

## Pure physics modules
- `hull-geometry.js`
- `mass-properties.js`
- `hydrostatics.js`
- `trim.js`
- `kn.js`
- `gz.js`
- `tank-sounding.js`
- `longitudinal-strength.js`
- `damage-stability.js`
- `seakeeping-proxy.js`
- `draft-survey.js`
- `draft-survey-mission.js`

Pure modules accept plain objects/arrays and do not access the DOM, Three.js, Chart.js or localStorage.

## Worker boundary
`src/workers/physics-worker.js` exposes pure numerical operations. `physics-worker-client.js` provides an asynchronous client with synchronous-authority fallback. The standalone release embeds a Worker source as a Blob.

The complete stateful `calculateAll()` routine is not yet moved wholesale because coupled equilibrium, damage mode, mission state and UI/render lifecycle still share synchronous state. This is deliberate risk control, not an accuracy claim.

## Rendering boundary
The renderer receives solved simulator state. Camera, visual LOD, wave rendering and vessel-specific appearance must not modify hydrostatics, GM, GZ, trim, damage mass or challenge grading.

Container stacks use InstancedMesh. Fine windows/railing elements have distance-based LOD. 3D frame work stops when the 3D workspace is hidden.

## Damage boundary
The existing main damage calculation remains the teaching lost-buoyancy/added-weight pathway. `damage-stability.js` adds exposure diagnostics and optional progressive flooding only through explicit connectivity. No missing connection is inferred.

## Longitudinal-strength boundary
SF/BM distributions can be compared against active station envelopes. AMCOL/calibrated envelopes are educational unless an approved vessel loading manual is supplied.

## Seakeeping boundary
`seakeeping-proxy.js` is an educational response proxy. The existing nonlinear roll model remains separate. Neither is a substitute for a vessel-specific 6-DOF RAO/strip-theory/CFD solution.

## Vessel data packages
An imported vessel package must include positive LBP/beam/depth/lightship values and a monotonic hydrostatic table. KN and other datasets are optional but validated when present. Imported packages are labelled USER IMPORTED.

## Condition portability
Condition schema v3 embeds the active user-imported vessel package where applicable. This makes the condition portable without converting the imported data into AMCOL-verified data.

## Offline architecture
The modular HTTP version uses `service-worker.js` to cache resources after successful retrieval. The standalone build omits service-worker registration because it has no reliable sibling service-worker file. External CDN libraries remain an initial-load dependency until they are locally vendored.
