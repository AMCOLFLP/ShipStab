const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const classic=[
 'src/data/great-fortune.data.js','src/data/training-vessels.data.js',
 'src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js',
 'src/core/core.js','src/workers/physics-worker.js'
];
for(const f of classic){const code=fs.readFileSync(path.join(root,f),'utf8');try{new Function(code);console.log('PASS',f)}catch(e){console.error('FAIL',f,e.message);process.exit(1)}}
