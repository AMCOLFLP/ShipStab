# AMCOL Simulator v2.0 Stable — Classroom Acceptance Checklist

Run this checklist once on each classroom-PC type and again after major browser/GPU-driver updates.

## A. Automated acceptance
1. Open the simulator in the normal classroom browser.
2. Open **Data → Physics, Challenge & Release Diagnostics**.
3. Run **Core Physics**, **Vessel Data**, **25 Challenges** and **Classroom Acceptance**.
4. Export the Classroom Acceptance report.
5. Required checks should pass. A WebGL failure means the 3D view is not accepted even if 2D numerical work remains available.

## B. Manual functional smoke test
1. Load **M.V. GREAT FORTUNE** and confirm the known source condition is approximately: Δ 32,787 t; FWD 7.201 m; AFT 8.637 m; trim 1.436 m by stern.
2. Switch 2D → 3D → 2D. Confirm the vessel remains loaded and controls continue responding.
3. Rotate/zoom the 3D camera for at least 30 seconds. Confirm no severe stutter, black canvas or missing vessel.
4. Enable waves and observe the sea/wave motion for at least 60 seconds.
5. Move/add cargo and change ballast. Confirm the quick live response updates and the final full GZ update settles afterwards.
6. Load ONE APUS and RCL NATTHA BHUM. Confirm vessel data authority shows calibrated/derived boundaries rather than class-approved claims.
7. Open Draft Survey, load the GREAT FORTUNE validation and confirm corrected displacement closes to 32,787 t.
8. Run one Draft Survey training mission and submit a result.
9. For a vessel with calibration tables, use Tank Sounding/Ullage and transfer ballast to Draft Survey.
10. Export then re-import one condition JSON and confirm vessel/cargo/ballast state returns correctly.

## C. Soak test
Leave 3D with moderate waves enabled for 10–15 minutes. During the test, change camera view several times. Accept if there is no browser crash, progressive severe slowdown, unrecoverable black WebGL canvas or runaway memory behaviour visible to the user.

## D. Recommended classroom minimum
- Current Chrome or Edge.
- WebGL enabled.
- Hardware acceleration enabled where permitted by IT policy.
- 8 GB RAM recommended for comfortable multi-tab use.
- Use the modular HTTP package when dependable offline-after-first-load caching is required.

Record PC model, browser version, date, acceptance result and any advisory in the exported report or local equipment log.
