# AMCOL Simulator v2.0 Stable — Change-Control Policy

## Frozen baseline
The following are release-controlled in v2.0 Stable:
- pure physics modules,
- GREAT FORTUNE source data,
- AMCOL training-vessel data,
- ONE APUS and RCL NATTHA BHUM calibrated datasets,
- Draft Survey/tank-sounding numerical modules,
- vessel regression targets.

A change to any frozen item must include a reason, new/updated regression coverage and an intentional update of `RELEASE_LOCK.json`.

## Allowed stable maintenance
UI spacing, accessibility text, documentation and visual-only refinements may be patched if they do not change numerical outputs. They still require syntax and regression tests.

## Experimental development
New hydrostatic solvers, 6-DOF seakeeping, subdivision solvers, structural models and vessel-specific digital twins should be developed in a development version first. They should not silently replace stable algorithms.

## Authority rule
Completeness does not equal statutory authority. SOURCE, CALIBRATED, DERIVED, TRAINING, REPRESENTATIVE, USER IMPORTED and NOT AVAILABLE labels must remain visible and meaningful.
