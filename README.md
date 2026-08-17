# AMCOL Advanced Ship Stability Simulator v1.15.4
## Clean Draft Survey Layout + Cleaner Control Panel

This is the modular development source for the AMCOL Advanced Ship Stability Simulator.

### Development
Run `start_dev_server.bat` on Windows or `./start_dev_server.sh` on Linux/macOS and open the local URL shown by the server.

### Build
Run `build_release.bat` or `./build_release.sh`.
The build executes vessel regression tests, pure physics tests and static syntax checks before creating the standalone HTML in `dist/`.

### v1.15.4 additions
- Guided bulk-carrier Clean Draft Survey Layout
- Hidden cargo ground truth and 100-point grading
- Initial/Final six-draught observation sheets
- Initial/Final tank sounding/ullage observation sheets
- Dock-water density-correction mission
- Printable student mission assessment
- Assisted-practice tracking
- Wider/cleaner left control workspace
- New pure module: `src/physics/draft-survey-mission.js`

### Important authority boundary
AMCOL Training Vessel and calibrated reference-vessel data are educational/calibrated datasets unless explicitly identified as source-backed. GREAT FORTUNE source-workbook hydrostatics/KN/loading data remain separately identified. The simulator and its Draft Survey mission reports do not replace approved stability booklets, loading computers, tank calibration books or commercial draught survey documentation.


## v1.15.4 layout patch
- Left control workspace widened to 384 px on normal desktop screens and 326 px on medium desktop/tablet-landscape screens.
- Initial and Final Draft Survey cards now stack vertically in normal sidebar mode.
- They use two columns only when Controls Focus/maximised mode gives them enough actual width.
- Tank sounding tables scroll horizontally inside their own card instead of forcing the sidebar wider.
