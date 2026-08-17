AMCOL Simulator v2.0.0 Stable — Offline Notes

MODULAR HTTP PACKAGE
- service-worker.js caches resources that load successfully.
- After one successful connected load, later offline use can improve because cached resources may be reused.

STANDALONE HTML
- CSS/data/physics/core/3D application code is inlined.
- The pure-physics Worker is embedded as a Blob source.
- Tailwind CSS runtime, Chart.js, Font Awesome and Three.js are still referenced from external CDNs.

Therefore v2.0.0 Stable is NOT described as a guaranteed first-time fully offline release.
A future fully offline distribution should vendor those third-party runtime assets locally, then include them in the release package/service-worker precache.
