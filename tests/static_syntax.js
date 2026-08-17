const fs=require('fs'),path=require('path'),cp=require('child_process');const root=path.resolve(__dirname,'..');
const classic=[
 'src/data/great-fortune.data.js','src/data/training-vessels.data.js',
 'src/physics/hull-geometry.js','src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js','src/physics/longitudinal-strength.js','src/physics/damage-stability.js','src/physics/seakeeping-proxy.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js',
 'src/workers/physics-worker-client.js','src/core/core.js','src/workers/physics-worker.js','service-worker.js'
];
for(const f of classic){const code=fs.readFileSync(path.join(root,f),'utf8');try{new Function(code);console.log('PASS',f)}catch(e){console.error('FAIL',f,e.message);process.exit(1)}}
try{cp.execFileSync(process.execPath,['--check',path.join(root,'src/render3d/render3d.js')],{stdio:'pipe'});console.log('PASS src/render3d/render3d.js')}catch(e){console.error('FAIL render3d',String(e.stderr||e.message));process.exit(1)}
