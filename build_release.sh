#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 tests/regression.py
node tests/physics_modules.test.js
node tests/static_syntax.js
python3 build/build_single_html.py
echo "Build complete."
