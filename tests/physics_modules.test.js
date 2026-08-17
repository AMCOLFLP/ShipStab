const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const ctx={console,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['src/physics/hull-geometry.js','src/physics/mass-properties.js','src/physics/hydrostatics.js','src/physics/trim.js','src/physics/kn.js','src/physics/gz.js','src/physics/tank-sounding.js','src/physics/longitudinal-strength.js','src/physics/damage-stability.js','src/physics/seakeeping-proxy.js','src/physics/draft-survey.js','src/physics/draft-survey-mission.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const P=ctx.AMCOLPhysics;let pass=0,fail=0;
function test(name,cond,detail=''){if(cond){console.log('PASS',name,detail);pass++;}else{console.error('FAIL',name,detail);fail++;}}
function near(a,b,tol){return Number.isFinite(a)&&Math.abs(a-b)<=tol;}
const m=P.mass.aggregate({lightship:{mass:1000,kg:5,tcg:0,lcg:-2},items:[{mass:100,vcg:10,tcg:2,lcg:3},{mass:50,vcg:4,tcg:-1,lcg:8}]});
test('mass displacement',near(m.mass,1150,1e-12),m.mass);
test('mass KG',near(m.kgSolid,(5000+1000+200)/1150,1e-12),m.kgSolid);
test('mass TCG',near(m.tcg,(200-50)/1150,1e-12),m.tcg);
test('mass LCG',near(m.lcg,(-2000+300+400)/1150,1e-12),m.lcg);
const f=P.mass.applyFreeSurface({displacement:10000,kgSolid:8,genericFSM:1200,individualFSM:800,cargoFSM:300});
test('free-surface FSC',near(f.fsc,.2,1e-12),f.fsc);test('free-surface KGcorr',near(f.kgCorr,8.2,1e-12),f.kgCorr);
const hydro=[{disp:100,draft:2,kmt:10},{disp:200,draft:4,kmt:8}],hr=P.hydro.interpolateRows(hydro,'disp',150);
test('hydro interpolation',near(hr.draft,3,1e-12)&&near(hr.kmt,9,1e-12),JSON.stringify(hr));
test('hydro no extrapolation',P.hydro.interpolateRows(hydro,'disp',250)===null);
const gf=JSON.parse(fs.readFileSync(path.join(root,'data/great-fortune/workbook-condition.json'),'utf8')).target;
const tr=P.trim.solve({displacement:gf.disp,lcg:gf.lcg,lcb:gf.lcb,lcf:gf.lcf,mct1cm:gf.mctc,length:177,meanDraft:gf.draft,waterDepth:50});
test('GREAT FORTUNE trim metres',near(tr.trimMeters,-gf.trimByStern,0.001),tr.trimMeters);
test('GREAT FORTUNE forward draft',near(tr.draftForward,gf.draftFwd,0.04),tr.draftForward);
test('GREAT FORTUNE aft draft',near(tr.draftAft,gf.draftAft,0.04),tr.draftAft);
for(const file of ['data/reference-vessels/one-apus.json','data/reference-vessels/rcl-nattha-bhum.json']){
 const v=JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),cond=v.loadingConditions[0],q=cond.displacement;
 const h=P.hydro.interpolateRows(v.hydrostatics,'disp',q);test(v.name+' hydro design draft',near(h.draft,cond.meanDraft,0.002),`${h.draft} vs ${cond.meanDraft}`);
 const k=P.kn.interpolateKNRows(v.knCrossCurves,q,5,'starboard');const km=P.kn.smallAngleKM(k.kn,5);test(v.name+' KN valid',k.valid,JSON.stringify(k));test(v.name+' KN-KMT <=1%',Math.abs(km/h.kmt-1)*100<=1,`${(Math.abs(km/h.kmt-1)*100).toFixed(6)}%`);
 const gz=P.gz.fromKN(5,k.kn,cond.correctedKG||0,0);test(v.name+' GZ finite',Number.isFinite(gz),gz);
}

// v1.15.0 draft-survey module tests.
const ds=P.draftSurvey;
const six=ds.correctedDrafts({forwardPort:5,forwardStarboard:5.02,midshipPort:5.12,midshipStarboard:5.14,aftPort:5.30,aftStarboard:5.32},{lbp:100,forwardMarkOffset:0,midshipMarkOffset:0,aftMarkOffset:0,keelThickness:0});
test('draft survey six-reading means',six.valid&&near(six.forward,5.01,1e-12)&&near(six.midship,5.13,1e-12)&&near(six.aft,5.31,1e-12),JSON.stringify(six));
test('draft survey hog sign',six.hogSagSense==='HOG'&&six.hogSag<0,six.hogSag);
test('draft survey M/M/M',near(six.mmm,( (5.01+5.31)/2 + 3*5.13)/4,1e-12),six.mmm);
const mark=ds.correctedDrafts({forwardPort:7,forwardStarboard:7,midshipPort:7.5,midshipStarboard:7.5,aftPort:8,aftStarboard:8},{lbp:100,forwardMarkOffset:-2,midshipMarkOffset:0,aftMarkOffset:3});
test('draft survey mark-to-PP correction',mark.valid&&mark.forward<7&&mark.aft>8,`${mark.forward} / ${mark.aft}`);
const gfRows=JSON.parse(fs.readFileSync(path.join(root,'data/great-fortune/hydrostatics.json'),'utf8')).map(r=>({...r,lcf:Number.isFinite(r.lcf)?-r.lcf:r.lcf}));
const gfMid=7.913108858265166;
const gfSurvey=ds.calculateSurvey({hydroRows:gfRows,tableDensity:1.025,observedDensity:1.025,geometry:{lbp:177,forwardMarkOffset:0,midshipMarkOffset:0,aftMarkOffset:0,keelThickness:0},readings:{forwardPort:gf.draftFwd,forwardStarboard:gf.draftFwd,midshipPort:gfMid,midshipStarboard:gfMid,aftPort:gf.draftAft,aftStarboard:gf.draftAft},deductibles:{}});
test('GREAT FORTUNE draft survey valid',gfSurvey.valid,JSON.stringify(gfSurvey));
test('GREAT FORTUNE draft survey displacement closure',gfSurvey.valid&&near(gfSurvey.correctedDisplacement,gf.disp,.05),gfSurvey.correctedDisplacement);
test('GREAT FORTUNE draft survey trim closure',gfSurvey.valid&&near(gfSurvey.drafts.trimAft,gf.trimByStern,.002),gfSurvey.drafts.trimAft);
const den=ds.densityCorrection(10000,1.010,1.025);test('draft survey density correction',near(den.corrected,10000*1.010/1.025,1e-9),den.corrected);
const c=ds.cargoDifference({valid:true,netDisplacement:10000},{valid:true,netDisplacement:12500});test('draft survey cargo difference',c.valid&&near(c.cargo,2500,1e-12)&&c.direction==='LOADED',JSON.stringify(c));


// v1.15.1 tank sounding / ullage calibration tests.
const ts=P.tankSounding;
const cal=[
 {tankId:'T1',tankName:'T1',soundingPercent:0,volumePercent:0,volumeM3:0,massT:0,liquidVCG:0,FSM:0},
 {tankId:'T1',tankName:'T1',soundingPercent:10,volumePercent:8,volumeM3:80,massT:82,liquidVCG:1,FSM:100},
 {tankId:'T1',tankName:'T1',soundingPercent:20,volumePercent:18,volumeM3:180,massT:184.5,liquidVCG:1.5,FSM:160},
 {tankId:'T1',tankName:'T1',soundingPercent:100,volumePercent:100,volumeM3:1000,massT:1025,liquidVCG:5,FSM:0}
];
const ti=ts.interpolateCalibration(cal,'T1',15);test('tank sounding calibration interpolation',ti&&near(ti.volumeM3,130,1e-12)&&near(ti.volumePercent,13,1e-12),JSON.stringify(ti));
test('tank sounding reading → percent',near(ts.soundingPercentFromReading('sounding',2,10),20,1e-12));
test('tank ullage reading → percent',near(ts.soundingPercentFromReading('ullage',2,10),80,1e-12));
test('tank percent reading passthrough',near(ts.soundingPercentFromReading('percent',37.5,10),37.5,1e-12));
const inv=ts.soundingPercentFromVolumePercent(cal,'T1',13);test('tank volume% inverse → sounding%',near(inv,15,1e-12),inv);
const tc=ts.calculateTank({tank:{id:'T1',name:'T1',height:10,density:1.025},mode:'sounding',reading:1.5,density:1.000,calibrationRows:cal});test('tank sounding mass uses entered density',tc.valid&&near(tc.volumeM3,130,1e-12)&&near(tc.massT,130,1e-12),JSON.stringify(tc));
const many=ts.calculateMany([{tank:{id:'T1',height:10,density:1.025},mode:'sounding',reading:1,density:1.025},{tank:{id:'T1',height:10,density:1.025},mode:'sounding',reading:2,density:1.025}],cal);test('tank sounding total mass',many.valid&&near(many.totalMassT,82+184.5,1e-9),JSON.stringify(many));

// v1.15.2 formal tank-measurement grouping/comparison tests.
test('tank side normalisation',ts.normalizeTankSide({side:'port'})==='PORT'&&ts.normalizeTankSide({side:'starboard'})==='STARBOARD'&&ts.normalizeTankSide({side:'centre'})==='CENTRE');
test('tank category classification',ts.classifyTank({name:'No.2 WBT P',fluid:'seawater'})==='BALLAST'&&ts.classifyTank({name:'DO Service Tank'})==='DIESEL OIL'&&ts.classifyTank({name:'Fresh Water Tank'})==='FRESH WATER');
const grouped=ts.summarizeResults([{valid:true,side:'PORT',category:'BALLAST',volumeM3:100,massT:102.5,FSM:20},{valid:true,side:'STARBOARD',category:'BALLAST',volumeM3:80,massT:82,FSM:10}]);
test('tank report side/category totals',near(grouped.bySide.PORT.massT,102.5,1e-12)&&near(grouped.bySide.STARBOARD.massT,82,1e-12)&&near(grouped.byCategory.BALLAST.massT,184.5,1e-12),JSON.stringify(grouped));
const compared=ts.compareResults([{valid:true,tankId:'A',tankName:'A',side:'PORT',category:'BALLAST',volumeM3:100,massT:102.5}],[{valid:true,tankId:'A',tankName:'A',side:'PORT',category:'BALLAST',volumeM3:120,massT:123}]);
test('tank report initial-final change',near(compared.totalDeltaMassT,20.5,1e-12)&&near(compared.rows[0].deltaVolumeM3,20,1e-12),JSON.stringify(compared));

const amcolVesselPack=JSON.parse(fs.readFileSync(path.join(root,'data/amcol-training/vessels.json'),'utf8'));const amcolVessels=amcolVesselPack.vessels||[];
const fortune=amcolVessels.find(v=>v.id==='AMCOL-FORTUNE');if(fortune){const tank=fortune.ballastTanks[0],row50=fortune.tankCalibration.find(r=>r.tankId===tank.id&&r.soundingPercent===50),actual=ts.calculateTank({tank,mode:'percent',reading:50,density:tank.density,calibrationRows:fortune.tankCalibration});test('AMCOL FORTUNE 50% sounding exact calibration',actual.valid&&row50&&near(actual.volumeM3,row50.volumeM3,1e-6)&&near(actual.massT,row50.volumeM3*tank.density,1e-6),JSON.stringify(actual));}


// v1.15.3 draft-survey mission generation / grading tests.
const dsm=P.draftSurveyMission;
const missionObs=dsm.observationReadings(8,1.2,.01);
test('draft mission observation trim',missionObs&&near(((missionObs.aftPort+missionObs.aftStarboard)/2)-((missionObs.forwardPort+missionObs.forwardStarboard)/2),1.2,1e-12),JSON.stringify(missionObs));
if(fortune){
 const cond=fortune.loadingConditions[0],sol=dsm.solveSurveyDraft({hydroRows:fortune.hydrostatics,tableDensity:fortune.sourceDensity||1.025,observedDensity:1.025,lbp:fortune.principalParticulars.LBP,displacement:cond.displacement,trimAft:-(cond.trim||0)});
 test('draft mission solve AMCOL FORTUNE displacement',sol.valid&&near(sol.result.correctedDisplacement,cond.displacement,.02),sol.valid?`${sol.result.correctedDisplacement} vs ${cond.displacement}`:sol.reason);
}
const perfectTruth={initialReadings:{forwardPort:5,forwardStarboard:5,midshipPort:5,midshipStarboard:5,aftPort:5,aftStarboard:5},finalReadings:{forwardPort:6,forwardStarboard:6,midshipPort:6,midshipStarboard:6,aftPort:6,aftStarboard:6},initialDensity:1.025,finalDensity:1.025,initialBallast:1000,finalBallast:500,initialOther:100,finalOther:80,cargo:5000};
const perfectGrade=dsm.gradeMission({truth:perfectTruth,entered:{...perfectTruth,calculatedCargo:5000,reportedCargo:5000}});
test('draft mission perfect grade',near(perfectGrade.score,100,1e-12)&&perfectGrade.grade==='DISTINCTION',JSON.stringify(perfectGrade));
const weakGrade=dsm.gradeMission({truth:perfectTruth,entered:{...perfectTruth,calculatedCargo:5500,reportedCargo:4500,initialBallast:1300,finalBallast:700}});
test('draft mission grading penalises error',weakGrade.score<100&&weakGrade.score>=0,weakGrade.score);
const strictGrade=dsm.gradeMission({truth:perfectTruth,entered:{...perfectTruth,calculatedCargo:5075,reportedCargo:5075,initialOther:103,finalOther:83},toleranceScale:.7}),guidedGrade=dsm.gradeMission({truth:perfectTruth,entered:{...perfectTruth,calculatedCargo:5075,reportedCargo:5075,initialOther:103,finalOther:83},toleranceScale:2});test('draft mission tolerance scale affects all graded errors',guidedGrade.score>strictGrade.score,`${strictGrade.score} -> ${guidedGrade.score}`);


// v1.20 shared geometry / strength / damage / seakeeping tests.
const hp=P.hull.midshipPolygon('bulk',30,15);test('shared hull bulk midship polygon',Array.isArray(hp)&&hp.length===8&&near(hp[0][0],-9.3,1e-12),JSON.stringify(hp[0]));
const hs=P.hull.stationEnvelopeAt(.9,'container');test('shared hull station envelope',hs&&hs.beamFactor>0&&hs.beamFactor<1&&hs.source==='family',JSON.stringify(hs));
const hb=P.hull.halfBreadthAtDraft(8,0,30,15,'bulk');test('shared hull half-breadth finite',Number.isFinite(hb)&&hb>0&&hb<16,hb);
const ls=P.longitudinalStrength.evaluate({xs:[-50,0,50],shear:[0,150,0],moment:[0,-200,0],length:100,limits:[{xNorm:-.5,allowableSFPos:100,allowableSFNeg:-100,allowableBMHog:100,allowableBMSag:-100},{xNorm:0,allowableSFPos:100,allowableSFNeg:-100,allowableBMHog:100,allowableBMSag:-100},{xNorm:.5,allowableSFPos:100,allowableSFNeg:-100,allowableBMHog:100,allowableBMSag:-100}]});
test('longitudinal envelope utilization',ls.valid&&near(ls.maxUtil,2,1e-12)&&ls.status==='EXCEEDS ENVELOPE',JSON.stringify(ls.governing));
const dmg=P.damageStability.estimate({length:100,beam:20,depth:10,density:1.025,damage:{side:1,widthPct:25,heightPct:60,lengthPct:20,lcg:0,permeability:.95},cargoSpaces:[{id:'C1',name:'C1',lcg:0,tcg:6,length:20,breadth:8,height:8,capacityVolume:1000,side:'starboard'}],ballastTanks:[]});
test('damage exposure estimate',dmg.valid&&dmg.affected.length===1&&dmg.totalMass>0,JSON.stringify(dmg));
const prog=P.damageStability.progressiveFlooding([{id:'A',connections:['B']},{id:'B',connections:['C']},{id:'C'}],['A']);test('explicit progressive flooding only',prog.hasConnectivity&&prog.flooded.length===3&&prog.progressionOrder.join(',')==='A,B,C',JSON.stringify(prog));
const sk=P.seakeepingProxy.evaluate({length:180,beam:30,draft:9,gm:1.5,waveHeight:3,wavelength:120,wavePeriod:9,encounterPeriod:8,rollNaturalPeriod:9,heading:'beam'});test('seakeeping proxy finite',Number.isFinite(sk.heaveAmplitudeM)&&Number.isFinite(sk.pitchAmplitudeDeg)&&sk.rollRisk>=0&&sk.rollRisk<=1,JSON.stringify(sk));

console.log(`Physics module tests: ${pass}/${pass+fail} PASS`);process.exit(fail?1:0);
