from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'css/simulator.css').read_text(encoding='utf-8')
classic_files=[
 'src/data/great-fortune.data.js','src/data/training-vessels.data.js',
 'src/physics/hull-geometry.js','src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js',
 'src/physics/longitudinal-strength.js','src/physics/damage-stability.js','src/physics/seakeeping-proxy.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js',
 'src/workers/physics-worker-client.js','src/core/core.js'
]
physics_for_worker=[
 'src/physics/hull-geometry.js','src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js',
 'src/physics/longitudinal-strength.js','src/physics/damage-stability.js','src/physics/seakeeping-proxy.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js'
]

out=index.replace('<link rel="stylesheet" href="css/simulator.css">','<style>\n'+css+'\n</style>')

# Build a self-contained classic Worker source for the standalone release. This keeps the
# staged pure-physics Worker available even when the single HTML is opened via file://.
worker=(ROOT/'src/workers/physics-worker.js').read_text(encoding='utf-8')
worker=re.sub(r"importScripts\([^;]+\);",'\n'.join((ROOT/f).read_text(encoding='utf-8') for f in physics_for_worker),worker,count=1)
worker_boot='<script>window.AMCOL_INLINE_PHYSICS_WORKER_SOURCE='+json.dumps(worker,ensure_ascii=False)+';</script>\n'

for f in classic_files:
    tag=f'<script src="{f}"></script>'
    code=(ROOT/f).read_text(encoding='utf-8')
    prefix=worker_boot if f=='src/workers/physics-worker-client.js' else ''
    out=out.replace(tag,prefix+'<script>\n'+code+'\n</script>')

mod=(ROOT/'src/render3d/render3d.js').read_text(encoding='utf-8')
out=out.replace('<script type="module" src="src/render3d/render3d.js"></script>','<script type="module">\n'+mod+'\n</script>')

# A one-file release cannot provide a sibling service-worker.js reliably. The modular HTTP
# distribution retains service-worker registration and offline-after-first-load caching.
out=re.sub(r"<script>if\('serviceWorker' in navigator.*?</script>","<!-- Standalone build: service-worker registration omitted; use the modular HTTP package for offline-after-first-load caching. -->",out,flags=re.S)
out=out.replace('<title>AMCOL Advanced Ship Stability Simulator</title>','<title>AMCOL Advanced Ship Stability Simulator</title>\n<!-- AMCOL v2.0.1 Stable UI Maintenance · camera controls minimise/hide option -->',1)

dist=ROOT/'dist/AMCOL_Ship_Stability_Simulator_v2.0.1_Camera_Controls_UI.html'
dist.parent.mkdir(parents=True,exist_ok=True)
dist.write_text(out,encoding='utf-8')
print(dist)
