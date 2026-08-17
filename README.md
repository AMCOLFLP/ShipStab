# AMCOL Advanced Ship Stability & Hydrostatic Simulator v2.0.1 Stable UI Maintenance

This is the frozen AMCOL classroom-stable baseline produced from the v1.20 comprehensive architecture. The release keeps source-backed and calibrated vessel data authority boundaries, modular physics, Draft Survey training, tank sounding/ullage, instructor missions, 2D/3D visualisation, damage/strength teaching diagnostics and the staged Web Worker architecture.

## Release policy

v2.0 Stable is a **validated training release**, not class-approved loading software. Physics/data are frozen unless a documented defect is found. Future experimental changes should be developed in a new development branch/version and must pass the complete regression and release-lock suite before being merged into a stable release.

## Run the modular version
- Windows: `start_dev_server.bat`
- Linux/macOS: `./start_dev_server.sh`
- Open the local URL (normally `http://localhost:8080/`).

## Build the standalone classroom release
- Windows: `build_release.bat`
- Linux/macOS: `./build_release.sh`

The build must pass:
1. vessel regression tests,
2. pure-physics/module tests,
3. JavaScript/module syntax tests,
4. frozen release-integrity hashes.

The resulting one-file classroom build is created in `dist/AMCOL_Ship_Stability_Simulator_v2.0.1_Camera_Controls_UI.html`.

## Classroom hardware acceptance

In the simulator go to **Data → Physics, Challenge & Release Diagnostics → Classroom Acceptance**. The self-test checks modern browser APIs, Canvas 2D, local storage, Chart.js, WebGL, Three.js module loading, Physics Web Worker round-trip and a short browser frame-cadence sample. Export the generated acceptance report and keep it with the classroom-PC record.

The automated acceptance test does not replace the short manual workflow in `docs/CLASSROOM_ACCEPTANCE_CHECKLIST.md`, because mouse/touch interaction, 2D↔3D switching and prolonged GPU behaviour must be observed on the actual hardware.

## Data authority
- **GREAT FORTUNE:** supplied workbook hydrostatics, KN and loading-condition data are the strongest source-backed vessel dataset in this simulator.
- **ONE APUS / RCL NATTHA BHUM:** verified public particulars anchor AMCOL-calibrated/derived training hydrostatics, KN, tanks and conditions; they are not the vessels' approved stability books.
- **AMCOL Training Vessels:** complete educational calibrated/synthetic vessel models.
- **Imported vessels:** remain USER IMPORTED unless independently verified by the instructor.

## Important limitations
- Not a replacement for an approved stability booklet, loading manual, loading computer or class software.
- Damage calculations are advanced teaching models unless actual watertight subdivision/opening/connectivity data are supplied.
- Longitudinal-strength envelopes are training limits unless an approved loading manual is supplied.
- Seakeeping output is an educational response proxy, not ship-specific RAO/strip-theory/CFD.
- Exact near-operational hydrostatic fidelity for named vessels requires actual lines/offset data and approved vessel documentation.

See `docs/ARCHITECTURE.md`, `docs/V2_STABILITY_POLICY.md` and `docs/CLASSROOM_ACCEPTANCE_CHECKLIST.md`.


## v2.0.1 UI maintenance
The 3D Camera panel can now be expanded, minimised or hidden. The selected state persists locally. No release-locked physics or vessel datasets were modified.
