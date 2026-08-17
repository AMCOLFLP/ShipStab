@echo off
cd /d %~dp0
python tests\regression.py || exit /b 1
node tests\physics_modules.test.js || exit /b 1
node tests\static_syntax.js || exit /b 1
python tests\release_lock.py || exit /b 1
python build\build_single_html.py
echo Build complete.
