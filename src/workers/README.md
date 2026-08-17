# Physics Worker

`physics-worker.js` exposes the pure v1.14.1 physics modules through a message interface.

The main simulator intentionally does **not** move the full calculation pipeline into the worker yet. The existing calculation sequence contains stateful damage, coupled-equilibrium, strength, scenario and UI dependencies that should be migrated in stages after equivalence tests are in place.

Supported worker operations currently include mass aggregation/free surface, hydro interpolation, density-equivalent displacement, trim solving, KN interpolation and GZ from KN.
