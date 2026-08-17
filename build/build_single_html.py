from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'css/simulator.css').read_text(encoding='utf-8')
classic_files=[
 'src/data/great-fortune.data.js','src/data/training-vessels.data.js',
 'src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js',
 'src/core/core.js'
]
out=index.replace('<link rel="stylesheet" href="css/simulator.css">','<style>\n'+css+'\n</style>')
needle='\n'.join(f'<script src="{f}"></script>' for f in classic_files)
inline='\n'.join((ROOT/f).read_text(encoding='utf-8') for f in classic_files)
out=out.replace(needle,'<script>\n'+inline+'\n</script>')
mod=(ROOT/'src/render3d/render3d.js').read_text(encoding='utf-8')
out=out.replace('<script type="module" src="src/render3d/render3d.js"></script>','<script type="module">\n'+mod+'\n</script>')
out=out.replace('<title>AMCOL Advanced Ship Stability Simulator</title>','<title>AMCOL Advanced Ship Stability Simulator</title>\n<!-- Built from v1.15.4 clean Draft Survey layout + v1.15.3 validated physics/mission source -->',1)
dist=ROOT/'dist/AMCOL_Ship_Stability_Simulator_v1.15.4_Clean_Draft_Survey_Layout.html'
dist.write_text(out,encoding='utf-8')
print(dist)
