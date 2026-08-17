# Core layer

`core.js` is the compatibility-preserving extraction of the validated v1.13.1 classic simulator script. It currently owns application state, physics orchestration, UI handlers, 2D rendering and scenario logic. Move functions only behind regression tests. Renderers must not duplicate hydrostatic or trim calculations.
