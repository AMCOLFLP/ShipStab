# AMCOL Simulator v1.15.0 — Modular Physics Architecture

## Runtime flow

```text
Vessel data / condition
        ↓
Core orchestration (`src/core/core.js`)
        ↓
Pure physics modules (`src/physics/*.js`)
        ↓
State result snapshot
   ┌────┼─────┐
   ↓    ↓     ↓
  2D    3D    UI/charts
```

## Physics modules now extracted

- Mass and moment aggregation / FSC algebra
- Hydrostatic row/angle interpolation and density conversion
- Longitudinal trim and FWD/AFT draught distribution about LCF
- KN interpolation across heel and displacement
- GZ construction from KN/KG/TCG

All extracted modules are stateless and DOM-free.

## Compatibility layer

Existing simulator functions remain in `core.js` so scenarios, challenges, UI callbacks and the 3D renderer keep their previous API. Those wrappers now delegate their numerical algebra to the pure modules.

## Worker boundary

`src/workers/physics-worker.js` already exposes the extracted pure operations through a message API. Full stateful `calculateAll()` is deliberately not moved yet because damage, coupled equilibrium, longitudinal strength and mission/UI state still share synchronous dependencies. This is the next safe migration boundary.

## Single-file build

`build/build_single_html.py` inlines CSS, data, pure physics modules, core and Three.js renderer into a standalone classroom HTML release.


## Draught Survey boundary (v1.15.0)

`src/physics/draft-survey.js` is a pure numerical module. It accepts six observed draughts, signed draft-mark offsets, active hydrostatic rows, water densities and deductibles. The UI orchestration in `core.js` only collects inputs and renders results. 3D midship draft marks are visual aids and do not calculate survey displacement.

## v1.15.2 Tank Sounding / Ullage Boundary

`src/physics/tank-sounding.js` is a pure numerical module. It converts sounding, ullage, or sounding-percent readings to calibrated volume, mass, liquid VCG and FSM by interpolation within the active vessel tank calibration dataset.

Authority boundary:
- AMCOL Training Vessels: synthetic/derived training tank calibration.
- ONE APUS / RCL NATTHA BHUM: AMCOL calibrated training tank geometry/calibration, not approved company/class tank tables.
- M.V. GREAT FORTUNE: sounding/ullage conversion is disabled because the supplied workbook contains source tank weights/VCG/FSM but no tank calibration/sounding table.

The Draft Survey UI may use calculated tank mass as the ballast deductible, but the tank-sounding module does not alter vessel hydrostatics or the main stability physics engine.

## v1.15.3 Draft Survey Mission Layer

`src/physics/draft-survey-mission.js` is a pure numerical assessment helper. It:
- solves the survey draught required to reproduce a target displacement at a specified observed water density
- generates consistent six-reading observation geometry
- grades draught, density, ballast, deductible and cargo accuracy

The stateful mission UI remains in `src/core/core.js` because it coordinates vessel loading, student forms, tank observation sheets and printable assessment reports. The underlying mission solver/grader contains no DOM or Three.js dependencies and is Worker-ready.
