const G=9.80665;
let canvas,ctx,gzChart=null,strengthChart=null,dragging=false,lastPointerX=0,lastPointerY=0,showVectors=true,showInternalArrangement=true;
let displayMode='2d';
// Rendering lifecycle: vessel/data changes are committed atomically. 3D is never allowed to break physics.
let vesselVisualTransaction=false,pendingHard3DReload=true,renderLifecycleRevision=0,simulatorResizeObserver=null;
let last3DVisualError='',last3DVisualErrorAt=0;
let sidebarCollapsed=false,controlsMaximized=false,gzPanelExpanded=false,gzPanelCollapsed=false;
let gzDragState=null;
let cameraZoom=1,cameraPanX=0,cameraPanY=0,cameraPanMode=false,cameraPanning=false;
const CAMERA_ZOOM_MIN=.70,CAMERA_ZOOM_MAX=4.00;
let curveCache=[],downfloodAngle=null,downfloodAnglePort=null,deckEdgeAngle=null,deckEdgeAnglePort=null,curveDirty=true,dynamicsRunning=false,lastFrameTime=null,dynPhi=0,dynOmega=0,dynTime=0;
let stabilityTestRuntime={active:false,endAt:0,showToast:true,originalHeel:0};
let animationLoopHeartbeat=0,renderErrorCount=0,lastRenderErrorMessage='';
let stabilityMission={active:false,index:0,key:null,attempts:0,hints:0,initial:null};
let unifiedMission={active:false,key:null,attempts:0,initial:null,initialEvaluation:null,autoTesting:false,pendingSubmit:false,lastResult:null};
let challengeBaselineSnapshot=null;

// v1.9.1: the physically loaded mission is authoritative. Changing the selector only chooses
// the next mission to load; it never silently changes grading/reference-solution logic.
function activeScenarioKey(){
 const loaded=unifiedMission?.active&&unifiedMission.key&&unifiedMission.key!=='free'?unifiedMission.key:null;
 return loaded||(document.getElementById('scenarioSelect')?.value||'free');
}
function activeMissionLoaded(){return !!(unifiedMission?.active&&unifiedMission.key&&unifiedMission.key!=='free');}

function cancelStabilityTestRuntime(){
 const wasActive=!!stabilityTestRuntime.active;
 stabilityTestRuntime={active:false,endAt:0,showToast:true,originalHeel:Number.isFinite(state?.heel)?state.heel:0};
 dynamicsRunning=false;dynOmega=0;dynPhi=Number.isFinite(state?.heel)?state.heel*Math.PI/180:0;lastFrameTime=null;
 try{setTestingUI(false);}catch(e){}
 return wasActive;
}
function prepareReferenceVesselLoad(){
 cancelStabilityTestRuntime();
 stabilityMission.active=false;challengeBaselineSnapshot=null;
 unifiedMission={active:false,key:'free',attempts:0,initial:null,initialEvaluation:null,autoTesting:false,pendingSubmit:false,lastResult:null};
 const sel=document.getElementById('scenarioSelect');if(sel)sel.value='free';
 try{closeChallengeBriefing();}catch(e){}try{hideReferenceSolution();}catch(e){}try{hideGlobalTestToast();}catch(e){}
 try{updateMissionSelectorUI();}catch(e){}
}


let state={
 hullType:'general',spaceLayoutRevision:1,spaceLayoutFamily:'general',spaceLayoutLabel:'General cargo ship',companyName:'',vesselName:'',viewMode:'bow',length:80,beam:16,depth:10,density:1.025,waterDepth:15,
 lightshipMass:4200,lightshipKG:6.80,lightshipTCG:0,lightshipLCG:0,heel:0,
 fse:false,tankCount:1,tankLength:20,tankBreadth:8,tankDensity:1.025,tankFill:50,
 crane:false,craneMass:60,craneHeight:15,craneOutreach:5,craneSide:1,craneLCG:0,
 damage:false,damageMode:'added',dmgMass:250,dmgVCG:2,dmgTCG:5.5,dmgLCG:0,damageSide:1,damageWidth:22,damageHeight:55,damageLengthPct:20,damageLCG:0,damagePerm:0.95,
 krRatio:0.35,damping:0.08,waveMoment:0,wavePeriod:10,waveEnabled:false,waveHeight:1.5,waveLength:60,waveSpeed:12,waveHeading:'beam',waveGain:1.0,rollMode:'free',shipSpeedKts:0,parametricVariation:0.20,encounterPeriod:null,dynamicRisk:null,instabilityClass:'stable',physicsFidelity:'enhanced',waveModel:'physical',quadraticDamping:0.35,shipHeadingDeg:0,currentMode:'relative',currentSetDeg:90,ballastPlanEnabled:false,ballastPlanSource:'none',ballastPlanLabel:'No ballast tank plan',
 weatherPreset:'calm',windEnabled:false,windSpeedKts:0,gustFactor:1.0,windDirection:'port_to_starboard',windCd:1.10,autoWindage:true,windageArea:0,windLever:0,
 oceanPreset:'standard',currentEnabled:false,currentSpeedKts:0,currentDirection:'port_to_starboard',currentCd:1.00,autoCurrentArea:true,currentArea:0,currentLever:0,
 rainIntensity:0,visibilityNm:12,environmentMoment:0,environmentHeelingArm:0,
 dispMass:0,kgSolid:0,tcg:0,lcg:0,fsc:0,fsmGeneric:0,fsmIndividual:0,kgCorr:0,gm:0,gmLong:0,bmLong:0,lcf:0,mct1cm:0,trimCm:0,trimMeters:0,longitudinalMoment:0,waterplaneArea:0,trimAngle:0,draftBow:0,draftStern:0,eqDraft:0,geometryUprightDraft:0,visualHeelDraftDelta:0,visualReferenceDraft:null,visualReferenceDraftSource:'calculated condition',ukc:0,tpc:0,fwa:0,hydro:null,equilibrium:0,equilibriumValid:true,naturalPeriod:null,
 coupledValid:false,coupledMode:'full',coupledHeel:0,coupledTrim:0,coupledSinkage:0,coupledTCB:0,coupledVCB:0,coupledLCB:0,coupledResidualT:0,coupledResidualL:0,coupledResidualMass:0,coupledResidualTMoment:0,coupledResidualLMoment:0,coupledIterations:0,coupledConvergenceQuality:'UNTESTED',coupledWaterplaneArea:0,coupledHydro:null,
 physicsAuthorityLevel:'D',physicsAuthorityLabel:'Generic Teaching Vessel',physicsIntegrity:null,knInterpolationStatus:null,finiteAngleLiquid:null,
 individualBallastFSE:false,ballastTankPhysics:[],strength:null,
 grainEnabled:false,grainMoment:350,grainResult:null,staticGZResult:null,staticGZPortResult:null,hydroDataKey:'geometry',hydroDataReference:null,operationalGZ:0,operationalRM:0,gzShowMoment:false,gzShowConstruction:true,gzDataDrawer:false
};
let cargoItems=[];
let ballastTanks=[];
const BALLAST_PLAN_STORAGE_KEY='amcol_ballast_tank_plan_v2';
const CONDITION_LIBRARY_STORAGE_KEY='amcol_stability_condition_library_v1';
let savedConditionLibrary=[];
let operationalLimits={enabled:false,source:'user',label:'User limits',minForwardDraft:null,minAftDraft:null,maxDraft:null,minUKC:null,maxList:null,maxTrim:null};
window.AMCOL_CUSTOM_HULL_FORM=window.AMCOL_CUSTOM_HULL_FORM||null;







/*
 GREAT FORTUNE WORKBOOK INTEGRATION
 Source: user-supplied MV. GREAT FORTUNE loading-program workbook.
 Spreadsheet longitudinal item coordinates use +AFT / -FWD and are converted here to
 the simulator convention +FWD / -AFT. Hydrostatic LCB is already +FWD in the workbook;
 hydrostatic LCF is +AFT in the workbook trim-distribution formulas and is converted to simulator +FWD.
 Raw workbook values are preserved in the embedded source dataset. Operational hydrostatic
 interpolation quarantines non-monotonic spreadsheet rows, and five isolated KN transcription
 anomalies are retained in the quality note but excluded from operational interpolation.
*/

function isGreatFortuneWorkbookVessel(){
 return state?.hydroDataKey==='great_fortune_workbook'||state?.sourceConditionKey==='great_fortune_workbook'||/GREAT\s+FORTUNE/i.test(String(state?.vesselName||''));
}
function isGreatFortuneVisualState(s){
 return !!(s&&(String(s.hydroDataKey||'')==='great_fortune_workbook'||String(s.sourceConditionKey||'')==='great_fortune_workbook'||/GREAT\s+FORTUNE/i.test(String(s.vesselName||''))));
}
function greatFortuneVisualHoldLayout(s){
 const L=Math.max(20,+s.length||177),B=Math.max(4,+s.beam||29.1);
 const holds=(GREAT_FORTUNE_WORKBOOK_DATA?.holds||[]).map((h,i)=>{
   const z=Math.max(-L*.38,Math.min(L*.27,-(+h.lcg||0)));
   const holdLen=Math.max(L*.090,Math.min(L*.145,(+h.length||24)*.82));
   const hatchLen=Math.max(holdLen*.78,Math.min(holdLen*.90,holdLen-1.8));
   const width=Math.max(B*.64,Math.min(B*.78,(+h.breadth||24)*.88));
   return {index:i+1,name:h.name||`No.${i+1} Hatch`,z,holdLen,hatchLen,width};
 });
 return holds.length?holds:[
   {index:1,z:-L*.28,holdLen:L*.12,hatchLen:L*.10,width:B*.72},
   {index:2,z:-L*.15,holdLen:L*.13,hatchLen:L*.11,width:B*.76},
   {index:3,z:L*.00,holdLen:L*.13,hatchLen:L*.11,width:B*.76},
   {index:4,z:L*.15,holdLen:L*.13,hatchLen:L*.11,width:B*.76},
   {index:5,z:L*.29,holdLen:L*.12,hatchLen:L*.10,width:B*.72}
 ];
}
function greatFortuneCraneStations(s,holds){
 if(Array.isArray(holds)&&holds.length>=5){
   return [0,1,2,3].map(i=>({z:(holds[i].z+holds[i+1].z)*.5,swing:i%2===0?1:-1}));
 }
 const L=Math.max(20,+s.length||177);
 return [{z:-L*.20,swing:1},{z:-L*.06,swing:-1},{z:L*.08,swing:1},{z:L*.22,swing:-1}];
}
function greatFortuneWorkbookCargoSpaces(){
 return GREAT_FORTUNE_WORKBOOK_DATA.holds.map((h,i)=>({...h,id:h.id||`gf_hold_${i+1}`,source:'GREAT FORTUNE workbook · hold capacity/LCG',reference:GREAT_FORTUNE_WORKBOOK_DATA.sourceFile,sourceSpecific:true}));
}
function greatFortuneWorkbookEngineRoom(){
 const B=Math.max(4,state.beam),D=Math.max(3,state.depth);
 return {label:'Engine Room / Machinery Zone',lcg:-70.0,length:30.0,breadth:B*.72,bottom:D*.045,height:D*.68,source:'source-informed inferred envelope',reference:'Workbook machinery/service-tank LCG cluster is approximately 61.5–87.6 m AFT; exact engine-room bulkheads require the GA plan.',sourceSpecific:true};
}
function greatFortuneWorkbookBallastTanks(){
 const rows=GREAT_FORTUNE_WORKBOOK_DATA.sourceItems.filter(r=>String(r.content).toUpperCase()==='B.W.');
 const holdLen={1:25.911,2:27.206,3:28.500,4:28.263,5:28.026};
 return rows.map((r,i)=>{
   const nm=String(r.name||''),u=nm.toUpperCase();
   let type='Wing Ballast',length=12,breadth=Math.max(4,state.beam*.18),height=Math.max(4,state.depth*.45);
   if(u.includes('FOREPEAK')||u.includes('AFTPEAK')){type='Peak';length=13.0;breadth=state.beam*.62;height=state.depth*.58;}
   else if(u.includes('STERNTUBE')){type='Deep Tank';length=8.0;breadth=state.beam*.34;height=state.depth*.34;}
   else if(u.includes('FWDBAL')){type='Wing Ballast';length=11.5;breadth=state.beam*.22;height=state.depth*.50;}
   else {const m=u.match(/NO\.(\d)/);if(m)length=(holdLen[+m[1]]||14)*.92;breadth=state.beam*.18;height=state.depth*.50;}
   const bottom=Math.max(.15,Math.min(state.depth-height-.15,(+r.vcg||height*.5)-height*.5));
   const side=(+r.tcg||0)<-.01?'port':(+r.tcg||0)>.01?'starboard':'centre';
   const density=1.025,blockFactor=type==='Peak'?.58:type==='Deep Tank'?.76:.80;
   const capacity=Math.max(1,length*breadth*height*blockFactor*density);
   const visualFill=(+r.mass||0)>0?Math.max(2,Math.min(96,100*(+r.mass||0)/capacity)):0;
   return {id:`gf_bw_${i+1}`,name:nm,type,zone:ballastTankZoneFromLCG(+r.lcg||0),side,fluid:'seawater',autoCapacity:true,blockFactor,capacity,fill:visualFill,lcg:+r.lcg||0,tcg:+r.tcg||0,bottom,length,breadth,height,density,fsmFactor:1,source:'GREAT FORTUNE workbook',sourceRow:r.row,sourceLocked:true,sourceMass:+r.mass||0,sourceVCG:+r.vcg||0,sourceFSM:+r.fsm||0,sourceSpecific:true};
 });
}
function greatFortuneWorkbookCargoItems(){
 const sf=GREAT_FORTUNE_WORKBOOK_DATA.target.stowageFactor||1.63;
 const holdMap=new Map(GREAT_FORTUNE_WORKBOOK_DATA.holds.map((h,i)=>[i+1,h]));
 return GREAT_FORTUNE_WORKBOOK_DATA.sourceItems.filter(r=>r.name!=='LIGHT SHIP'&&String(r.content).toUpperCase()!=='B.W.'&&(r.mass>0||r.fsm>0)).map((r,i)=>{
   const u=String(r.name||'').toUpperCase(),content=String(r.content||'').toUpperCase();
   const hm=u.match(/NO\.(\d) HOLD/);
   if(hm){const n=+hm[1],sp=holdMap.get(n),fill=sp?Math.min(100,(r.mass*sf/Math.max(1,sp.capacityVolume))*100):100;return {id:91000+i,name:`No.${n} Hold · Wheat`,cargoKey:'grain',physicsClass:'grain',quantity:1,unitMass:0,density:1/sf,fill,spaceId:`gf_hold_${n}`,autoMass:false,autoVCG:false,volume:sp?.capacityVolume||0,mass:r.mass,vcg:r.vcg,tcg:r.tcg,lcg:r.lcg,moisture:0,tml:0,grainMoment:0,fsmFactor:.85,tier:1,source:'GREAT FORTUNE workbook',sourceRow:r.row,sourceSpecific:true};}
   const liquid=/H\.F\.O\.|D\.O\.|F\.W\.|L\.O\.|MISC/.test(content)||/TK|TANK|BILGE/i.test(u);
   const hide3D=/CREW|STORE|EFFECT/i.test(u)||(+r.mass===0);
   return {id:91000+i,name:r.name,cargoKey:'manual',physicsClass:liquid?'liquid':'discrete',quantity:1,unitMass:r.mass,density:liquid?1:0,fill:50,spaceId:'',autoMass:false,autoVCG:false,volume:0,mass:r.mass,vcg:r.vcg,tcg:r.tcg,lcg:r.lcg,moisture:0,tml:0,grainMoment:0,fsmFactor:.85,tier:1,source:'GREAT FORTUNE workbook',sourceRow:r.row,sourceLocked:true,sourceFSM:r.fsm||0,sourceSpecific:true,hide3D};
 });
}
function greatFortuneConditionValidationHTML(){
 if(state.sourceConditionKey!=='great_fortune_workbook')return '';
 const t=GREAT_FORTUNE_WORKBOOK_DATA.target;
 const metrics=[
  ['Δ',state.dispMass,t.disp,'t',1,.8],['KGc',state.kgCorr,t.kgCorr,'m',3,.015],['GM',state.gm,t.gmCondition,'m',3,.025],
  ['Mean draft',state.eqDraft,t.draft,'m',3,.02],['Fwd draft',state.draftBow,t.draftFwd,'m',3,.03],['Aft draft',state.draftStern,t.draftAft,'m',3,.03],
  ['Trim by stern',state.draftStern-state.draftBow,t.trimByStern,'m',3,.03],['List STBD',Math.max(0,state.equilibrium),t.listStarboard,'°',3,.03],
  ['FSC',state.fsc,t.fsc,'m',3,.003],['TCG',state.tcg,t.tcg,'m',3,.004]
 ];
 const rows=metrics.map(([n,a,b,u,d,tol])=>{const err=Math.abs(a-b),ok=err<=tol;return `<div class="flex justify-between gap-2"><span>${n}</span><span class="font-mono ${ok?'text-emerald-300':'text-amber-300'}">${Number(a).toFixed(d)} / ${Number(b).toFixed(d)} ${u}</span></div>`}).join('');
 return `<div class="mt-2 rounded border border-emerald-900/40 bg-emerald-950/15 p-2"><div class="font-bold text-emerald-300 mb-1">Workbook-condition validation · simulator / source</div>${rows}<div class="mt-1 text-[8px] text-slate-500">Trim uses source LCB–LCG separation. GZ uses two-dimensional KN interpolation by displacement and heel; therefore it intentionally differs slightly from the workbook's lower-displacement VLOOKUP method.</div></div>`;
}
function loadGreatFortuneWorkbookCondition(){
 prepareReferenceVesselLoad();vesselVisualTransaction=true;
 try{
   resetCore();cargoItems=[];
   state.companyName='Company not stated in workbook';state.vesselName='M.V. GREAT FORTUNE';state.hullType='bulk';
   state.length=177.0;state.beam=29.10;state.depth=14.50;state.waterDepth=30;state.density=1.025;
   state.lightshipMass=10138;state.lightshipKG=9.87;state.lightshipTCG=0;state.lightshipLCG=-14.50;state.krRatio=.35;
   state.hydroDataKey='great_fortune_workbook';state.sourceConditionKey='great_fortune_workbook';state.visualReferenceDraft=GREAT_FORTUNE_WORKBOOK_DATA.target.draft;state.visualReferenceDraftSource='workbook loading condition';
   cargoItems=greatFortuneWorkbookCargoItems();
   ballastTanks=greatFortuneWorkbookBallastTanks();state.ballastPlanEnabled=true;state.ballastPlanSource='vessel';state.ballastPlanLabel='M.V. GREAT FORTUNE workbook ballast condition · source masses/VCG/FSM';
   state.fse=true;state.individualBallastFSE=false;state.grainEnabled=false;state.grainMoment=0;
   state.spaceLayoutFamily='bulk';state.spaceLayoutLabel='M.V. GREAT FORTUNE source-informed bulk carrier';bumpSpaceLayoutRevision('great-fortune-workbook');
   const hs=document.getElementById('hydroDataPackSelect');if(hs)hs.value='great_fortune_workbook';
   const rs=document.getElementById('referenceVesselSelect');if(rs)rs.value='greatfortune_workbook';
   syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});updateHydroDataPackInfo();showSelectedReferenceVesselInfo();renderUnifiedMissionPanel();updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('great-fortune-workbook');
}

/*
 BUILT-IN REFERENCE VESSELS
 Dimensions below come from official operator, shipbuilder, class-register or
 company fleet publications. They are reference dimensions only.
 Lightship mass and KG are NOT inferred from DWT or gross tonnage.
 Where public lightship data are unavailable, the simulator deliberately uses
 a clearly labelled teaching-model lightship/KG until the instructor replaces
 them with approved vessel data.
*/
/*
 AMCOL TRAINING VESSELS v1.0 — embedded comprehensive educational fleet data.
 Synthetic/derived educational models benchmarked against the GREEN FORTUNE source-data workflow.
 These data are NOT class-approved loading-computer, stability-booklet, tank-calibration or statutory vessel data.
*/
AMCOL_TRAINING_VESSELS_MASTER.vessels.push(...AMCOL_REAL_REFERENCE_CALIBRATED_VESSELS);
const AMCOL_TRAINING_VESSELS_BY_ID=Object.fromEntries((AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).map(v=>[v.id,v]));
function amcolTrainingHydroKey(id){return 'amcol_training_'+String(id||'').toLowerCase().replace(/[^a-z0-9]+/g,'_');}
function activeAMCOLTrainingVessel(){const v=AMCOL_TRAINING_VESSELS_BY_ID[state?.amcolTrainingVesselId];return v&&state?.vesselName===v.name?v:null;}
function clearAMCOLTrainingContext(){state.amcolTrainingVesselId=null;window.AMCOL_ACTIVE_TANK_CALIBRATION=[];window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=[];window.AMCOL_ACTIVE_TRAINING_CONDITIONS=[];if(window.AMCOL_CUSTOM_HULL_FORM?.trainingModel)window.AMCOL_CUSTOM_HULL_FORM=null;}
function restoreAMCOLTrainingContextFromState(){
 const id=state?.amcolTrainingVesselId,v=window.AMCOL_TRAINING_VESSELS_BY_ID?.[id]||((typeof AMCOL_TRAINING_VESSELS_BY_ID!=='undefined')?AMCOL_TRAINING_VESSELS_BY_ID[id]:null);
 if(v){
  window.AMCOL_ACTIVE_TANK_CALIBRATION=deepClonePlain(v.tankCalibration||[]);
  window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=deepClonePlain(v.structuralLimits||[]);
  window.AMCOL_ACTIVE_TRAINING_CONDITIONS=deepClonePlain(v.loadingConditions||[]);
 }else{
  window.AMCOL_ACTIVE_TANK_CALIBRATION=[];window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=[];window.AMCOL_ACTIVE_TRAINING_CONDITIONS=[];
 }
 return !!v;
}

const referenceVesselPresets={
 greatfortune_workbook:{
  companyName:'Company not stated in workbook',vesselName:'M.V. GREAT FORTUNE',vesselTypeLabel:'Open-Hatch Bulk Carrier',hullType:'bulk',
  length:177.00,beam:29.10,depth:14.50,depthVerified:false,identityVerified:true,hydroDataKey:'great_fortune_workbook',loadingProgramKey:'great_fortune_workbook',dataCompleteness:'FULL WORKBOOK · HYDRO + KN + LOADING',
  source:'User-supplied “MV. GREAT FORTUNE Loading program - แก้ไข 16มี.ค.2569.xlsx”',
  verified:'Workbook vessel name M.V. GREAT FORTUNE · LBP 177 m · source loading condition Δ 32,787 t · five wheat holds · hydrostatic table · KN cross-curves',
  extra:'The workbook does not state the operating company. Beam 29.10 m and model depth 14.50 m are retained from the existing 37,000 DWT open-hatch/GHS teaching model rather than claimed from this workbook.',
  modelNote:'Loading weights, VCG/LCG/TCG, source FSM, hold capacities, source hydrostatics and KN ordinates are integrated. Exact hold/tank shell boundaries and machinery bulkheads remain source-informed 3D visual geometry until the vessel GA/capacity plan is supplied.'
 },
 dijksgracht:{
  companyName:'Spliethoff',vesselName:'Dijksgracht',vesselTypeLabel:'Multipurpose General Cargo Ship',hullType:'general',
  length:156.93,beam:22.80,depth:14.00,depthVerified:true,
  source:'Spliethoff · D-type fleet page',
  verified:'LOA 156.93 m · Breadth 22.80 m · Moulded depth 14.00 m',
  extra:'D-type multipurpose/general cargo vessel. Dijksgracht is listed in the D-type fleet.',
  modelNote:'Lightship mass and KG are teaching-model values because the cited public fleet page does not publish them.'
 },
 greenfortune:{
  companyName:'NYK Line (user attribution)',vesselName:'GREEN FORTUNE',vesselTypeLabel:'Open-Hatch Bulk Carrier',hullType:'bulk',
  length:177.00,beam:29.10,depth:14.50,depthVerified:false,identityVerified:false,hydroDataKey:'nyk_green_fortune_hydro',dataCompleteness:'SOURCE HYDROSTATICS · NO KN',
  source:'User-supplied GHS 6.40 Extreme Hydrostatics · 37,000 DWT Open Hatch Bulk Carrier · 25 Jun 1997',
  verified:'Source hydrostatics: 37,000 DWT open-hatch bulk carrier · FP/AP span 177.00 m · SG 1.025 · draft table 1.50–12.50 m',
  extra:'The GREEN FORTUNE / NYK vessel name is retained from the user-supplied vessel context. The supplied pages themselves identify the design as a 37,000 DWT OPEN HATCH BULK CARRIER but do not print the vessel name.',
  modelNote:'Upright draft, KB, KMT, KML, TPC, MCTC, LCB and LCF use the digitised source hydrostatics. Beam ≈29.1 m is a source-derived geometry estimate from the curves-of-form page; moulded depth 14.5 m, lightship mass and KG remain teaching-model inputs until approved particulars are supplied. No KN/cross-curves were supplied, so large-angle GZ still uses the geometry model.'
 },
 greenfuture:{
  companyName:'NYK Line / NYK Bulk & Projects Carriers',vesselName:'Green Future',vesselTypeLabel:'Bulk Carrier',hullType:'bulk',
  length:199.99,beam:32.25,depth:19.15,depthVerified:true,referenceDraft:13.8,
  source:'NYK Line · Green Future delivery release (2025)',
  verified:'LOA 199.99 m · Breadth 32.25 m · Depth 19.15 m',
  extra:'Published deadweight approx. 65,700 t and draft 13.8 m.',
  modelNote:'DWT is not lightship. Lightship mass and KG therefore remain teaching-model values.'
 },
 onestork:{
  companyName:'Ocean Network Express (ONE)',vesselName:'ONE STORK',vesselTypeLabel:'Container Ship',hullType:'container',
  length:364.0,beam:50.6,depth:29.5,depthVerified:true,
  source:'Ocean Network Express · ONE STORK official vessel particulars',
  verified:'Length 364.0 m · Breadth 50.6 m · Depth 29.5 m',
  extra:'Published deadweight 139,500 t and capacity 14,026 TEU.',
  modelNote:'DWT is not lightship. Lightship mass and KG remain teaching-model values.'
 },
 oneapus:{
  companyName:'Ocean Network Express (ONE)',vesselName:'ONE APUS',vesselTypeLabel:'Container Ship',hullType:'container',
  length:364.150,beam:50.600,depth:23.040,depthVerified:true,referenceDraft:15.786,dataCompleteness:'OFFICIAL CLASS PARTICULARS + JTSB SEA-STATE / ROLL CASE',
  source:'Ocean Network Express official delivery release · ClassNK Register of Ships IMO 9806079 · Japan Transport Safety Board MA2024-2',
  verified:'LOA 364.150 m · ClassNK moulded L×B×D 349.200 × 50.600 × 23.040 m · summer draught 15.786 m · DWT 138,611 t · capacity 14,052 TEU',
  extra:'ClassNK also publishes summer freeboard 7.301 m, FO capacity 11,014.26 m³, FW capacity 599.34 m³, main-engine power 42,180 kW, one 1,020 mm propeller shaft and JMU Kure as builder. The ONE delivery release separately lists “Depth 29.5 m”; because ClassNK explicitly identifies 23.040 m as moulded depth, this simulator uses 23.040 m for hull geometry. JTSB MA2024-2 documents the 2020 heavy-roll case, including approximately 5–6 m swell, about 20° roll in the first event and 25° or more in the second event.',
  officialFacts:{IMO:'9806079',Flag:'Japan','Gross tonnage':'146,694','Deadweight':'138,611 t','Summer draught':'15.786 m','Summer freeboard':'7.301 m','Container capacity':'14,052 TEU','FO capacity':'11,014.26 m³','FW capacity':'599.34 m³','Main engine':'42,180 kW','Propeller shaft':'1 × 1,020 mm','Shipbuilder':'Japan Marine United Corporation · Kure Shipyard','Build date':'12 Apr 2019'},
  researchBoundary:'No public official hydrostatic table, KN/cross-curves, tank calibration book, lightship KG/LCG or approved loading-condition booklet was located. ClassNK publishes summer draught 15.786 m but not separate forward/aft draughts or operating trim. Hydrostatics, KN and FWD/AFT/trim loading targets are therefore AMCOL-calibrated/derived rather than ONE APUS approved stability data.',
  modelNote:'Official particulars, summer draught and the JTSB sea-state/roll case are source-backed. Lightship mass/KG and all hydrostatic/KN outputs remain teaching-model values unless an approved ONE APUS stability booklet is supplied.'
 },
 natthabhum:{
  companyName:'Regional Container Lines (RCL)',vesselName:'NATTHA BHUM',vesselTypeLabel:'Bangkok Max Container Ship',hullType:'container',
  length:172.000,beam:27.500,depth:14.600,depthVerified:true,referenceDraft:10.014,dataCompleteness:'OFFICIAL RCL + CLASSNK PARTICULARS',
  source:'Regional Container Lines official vessel information / investor newsletter · ClassNK Register of Ships IMO 9937775',
  verified:'LOA 172.000 m · ClassNK moulded L×B×D 168.720 × 27.500 × 14.600 m · summer draught 10.014 m · DWT 24,712.303 t · capacity 1,930 TEU',
  extra:'RCL identifies NATTHA BHUM as a Bangkok Max container ship. ClassNK lists RCL as registered owner, RCL Shipmanagement Pte. Ltd. as management company, summer freeboard 4.632 m, FO capacity 1,391.24 m³, FW capacity 206.57 m³, main-engine power 10,380 kW, one 568 mm propeller shaft and CSSC Huangpu Wenchong Shipbuilding as builder.',
  officialFacts:{IMO:'9937775',Flag:'Thailand','Registered owner':'Regional Container Lines Public Company Limited','Management':'RCL Shipmanagement Pte. Ltd.','Gross tonnage':'18,526','Deadweight':'24,712.303 t','Summer draught':'10.014 m','Summer freeboard':'4.632 m','Container capacity':'1,930 TEU','FO capacity':'1,391.24 m³','FW capacity':'206.57 m³','Main engine':'10,380 kW','Propeller shaft':'1 × 568 mm','Shipbuilder':'CSSC Huangpu Wenchong Shipbuilding Co., Ltd.','Build date':'09 Jun 2023'},
  researchBoundary:'No public official hydrostatic table, KN/cross-curves, tank calibration book, lightship KG/LCG or approved loading-condition booklet was located. ClassNK publishes summer draught 10.014 m but not separate forward/aft draughts or operating trim. Hydrostatics, KN and FWD/AFT/trim loading targets therefore remain explicitly AMCOL-calibrated/derived.',
  modelNote:'Principal/class particulars and summer draught are source-backed. Lightship mass/KG and hydrostatic/KN outputs remain teaching-model values until an approved NATTHA BHUM stability booklet or loading-computer export is supplied.'
 },
 stenaestrid:{
  companyName:'Stena Line',vesselName:'Stena Estrid',vesselTypeLabel:'Ro-Pax Ferry',hullType:'roro',
  length:215.0,beam:28.0,depth:15.0,depthVerified:false,
  source:'Stena Line · Stena Estrid vessel page',
  verified:'Length 215 m · Width 28 m',
  extra:'The official Stena Line page does not publish moulded depth.',
  modelNote:'Depth 15.0 m, lightship mass and KG are teaching-model values. Do not treat the model depth as an official Stena Estrid particular.'
 },
 phoenixjamnagar:{
  companyName:'MOL Group / Phoenix Tankers',vesselName:'PHOENIX JAMNAGAR',vesselTypeLabel:'VLCC / Crude Oil Tanker',hullType:'tanker',
  length:339.50,beam:60.00,depth:28.50,depthVerified:true,referenceDraft:21.085,
  source:'Japan Marine United / ClassNK · PHOENIX JAMNAGAR',
  verified:'LOA 339.50 m · Breadth 60.00 m · Moulded depth 28.50 m',
  extra:'Published summer/max draft 21.085 m and deadweight 311,798 t.',
  modelNote:'DWT is not lightship. Lightship mass and KG remain teaching-model values.'
 },
 bowolympus:{
  companyName:'Odfjell',vesselName:'Bow Olympus',vesselTypeLabel:'Chemical Tanker',hullType:'chemical',
  length:182.84,beam:32.19,depth:19.80,depthVerified:true,referenceDraft:13.2,
  source:'Odfjell Bow Olympus page + CSSC Hudong 49-class particulars',
  verified:'Bow Olympus LOA 182.84 m · Beam 32.19 m; Hudong 49-class moulded depth 19.80 m',
  extra:'Odfjell publishes Light Ship Weight 14,527 t and summer draft 13.2 m.',
  actualLightshipMass:14527,
  modelNote:'The 14,527 t lightship value is loaded from Odfjell. KG remains a teaching-model value unless replaced from approved stability information.'
 },
 lngdubhe:{
  companyName:'MOL / China COSCO Shipping',vesselName:'LNG DUBHE',vesselTypeLabel:'LNG Carrier',hullType:'lng',
  length:295.0,beam:45.0,depth:26.25,depthVerified:true,referenceDraft:11.50,
  source:'MOL LNG DUBHE release + CSSC Hudong Yamal 174,000 m³ series',
  verified:'Length 295.0 m · Breadth 45.0 m · Series moulded depth 26.25 m',
  extra:'MOL publishes draft 11.50 m and LNG capacity 174,000 m³. CSSC publishes 26.25 m moulded depth for the same Yamal 174,000 m³ Hudong series.',
  modelNote:'Lightship mass and KG remain teaching-model values.'
 },
 maerskventura:{
  companyName:'Maersk Supply Service',vesselName:'Maersk Ventura',vesselTypeLabel:'Offshore Support Vessel',hullType:'osv',
  length:89.1,beam:18.8,depth:7.6,depthVerified:true,referenceDraft:6.2,
  source:'Maersk Supply Service · Maersk Ventura vessel specification',
  verified:'LOA 89.1 m · Beam 18.8 m · Depth 7.6 m',
  extra:'Published scantling draft 6.2 m and deadweight 4,217 t.',
  modelNote:'DWT is not lightship. Lightship mass and KG remain teaching-model values.'
 },
 cd18054:{
  companyName:'Crowley',vesselName:'CD-18054',vesselTypeLabel:'Deck Cargo Barge',hullType:'box',
  length:54.9,beam:16.5,depth:3.8,depthVerified:true,referenceDraft:3.1,
  source:'Crowley Engineering Services · CD-18054 spec sheet',
  verified:'Length 54.9 m · Breadth 16.5 m · Depth 3.8 m',
  extra:'Published draft 3.1 m and ABS A1 Barge class.',
  modelNote:'Lightship mass and KG remain teaching-model values.'
 }
};


/*
 TEXTBOOK HYDROSTATIC / STABILITY DATA PACKS
 Source: Barrass & Derrett, Ship Stability for Masters and Mates, 6th ed., Ch. 17.
 These are published textbook reference data for the named/imaginary example vessels.
 They are deliberately kept separate from the modern public-dimensions presets above.
*/
const hydrostaticDataPacks={
 great_fortune_workbook:{
  label:'M.V. GREAT FORTUNE · workbook hydrostatics + KN cross-curves',kind:'uploadedBundle',badge:'WORKBOOK SOURCE',
  source:'User-supplied MV. GREAT FORTUNE loading-program workbook · filename revision 16 Mar 2026',sourceDensity:1.025,
  metadata:{name:'M.V. GREAT FORTUNE',company:'Company not stated in workbook',length:177.00,beam:29.10,depth:14.50,density:1.025},
  note:'Workbook-derived source pack. Hydrostatic fields used directly: draft, displacement, TPC, MCT 1 cm, KMT, LCB and LCF. The workbook does not provide KB/KML in the integrated table; KB remains a procedural visual fallback and longitudinal GM is derived from source MCTC. 853 monotonic hydro rows are used operationally from 873 workbook rows; 20 non-monotonic spreadsheet rows are quarantined. KN uses source ordinates at 115 displacement levels with an explicit 0°=0 boundary; five isolated transcription anomalies are preserved in the quality note but excluded from operational interpolation. Item LCG signs are converted from workbook +AFT/−FWD to simulator +FWD/−AFT. Workbook hydrostatic LCB is retained +FWD; workbook LCF is +AFT in its trim-distribution equations and is therefore sign-converted to simulator +FWD.',
  quality:{hydroRaw:873,hydroOperational:853,hydroExcluded:20,knDisplacementLevels:115,knExcluded:GREAT_FORTUNE_WORKBOOK_DATA.knExcluded},
  rows:GREAT_FORTUNE_WORKBOOK_HYDRO_ROWS.map(r=>({...r,lcf:Number.isFinite(r.lcf)?-r.lcf:r.lcf})),knRows:GREAT_FORTUNE_WORKBOOK_KN_ROWS
 },
 geometry:{
  label:'Simulator geometry model',kind:'geometry',badge:'MODEL',
  note:'Procedural 2D/3D teaching geometry. No vessel-specific approved hydrostatic table is applied.'
 },
 nyk_green_fortune_hydro:{
  label:'GREEN FORTUNE · 37,000 DWT Open Hatch Bulk Carrier',kind:'uploadedBundle',badge:'SOURCE HYDRO',
  source:'User-supplied GHS 6.40 Extreme Hydrostatics · 25 Jun 1997 · 37,000 DWT OPEN HATCH BULK CARRIER',
  sourceDensity:1.025,
  metadata:{name:'GREEN FORTUNE',company:'NYK Line (user-supplied attribution)',length:177.00,beam:29.10,depth:14.50,density:1.025},
  note:'Source-backed upright hydrostatics. The original printout is tabulated every 0.05 m; this first simulator integration digitises high-confidence 0.50 m anchor rows from 1.50 to 12.50 m and interpolates only inside that range. f/a longitudinal values are converted to +Forward / −Aft. No KN/cross-curves are present in the supplied pages, so large-angle GZ remains the procedural hull model.',
  rows:[
   {draft:1.50,disp:5397.44,lcb:6.730,kb:0.766,tpc:38.42,lcf:6.542,mctc:346.74,kml:1158.54,kmt:41.808},
   {draft:2.00,disp:7244.49,lcb:6.673,kb:1.027,tpc:39.45,lcf:6.486,mctc:364.97,kml:891.71,kmt:32.757},
   {draft:2.50,disp:9235.82,lcb:6.627,kb:1.288,tpc:40.22,lcf:6.481,mctc:381.40,kml:718.33,kmt:26.600},
   {draft:3.00,disp:11263.33,lcb:6.606,kb:1.549,tpc:40.91,lcf:6.642,mctc:400.07,kml:617.48,kmt:22.919},
   {draft:3.50,disp:13328.34,lcb:6.630,kb:1.811,tpc:41.61,lcf:6.784,mctc:415.07,kml:551.21,kmt:20.583},
   {draft:4.00,disp:15420.66,lcb:6.641,kb:2.072,tpc:42.08,lcf:6.542,mctc:426.53,kml:489.58,kmt:18.625},
   {draft:4.50,disp:17536.33,lcb:6.627,kb:2.333,tpc:42.54,lcf:6.400,mctc:438.34,kml:442.43,kmt:17.028},
   {draft:5.00,disp:19674.94,lcb:6.583,kb:2.595,tpc:43.00,lcf:6.061,mctc:450.79,kml:405.54,kmt:16.029},
   {draft:5.50,disp:21836.43,lcb:6.510,kb:2.856,tpc:43.46,lcf:5.623,mctc:464.05,kml:376.15,kmt:15.153},
   {draft:6.00,disp:24021.30,lcb:6.404,kb:3.118,tpc:43.93,lcf:5.090,mctc:478.45,kml:352.54,kmt:14.468},
   {draft:6.50,disp:26230.25,lcb:6.267,kb:3.381,tpc:44.47,lcf:4.408,mctc:495.35,kml:331.45,kmt:13.834},
   {draft:7.00,disp:28463.60,lcb:6.100,kb:3.644,tpc:44.96,lcf:3.733,mctc:511.35,kml:315.49,kmt:13.467},
   {draft:7.50,disp:30721.32,lcb:5.904,kb:3.908,tpc:45.45,lcf:3.003,mctc:527.87,kml:301.90,kmt:13.143},
   {draft:8.00,disp:33003.68,lcb:5.682,kb:4.173,tpc:45.90,lcf:2.207,mctc:545.28,kml:290.42,kmt:12.892},
   {draft:8.50,disp:35311.09,lcb:5.433,kb:4.439,tpc:46.40,lcf:1.444,mctc:561.34,kml:281.38,kmt:12.718},
   {draft:9.00,disp:37643.09,lcb:5.159,kb:4.705,tpc:46.88,lcf:0.583,mctc:578.86,kml:272.18,kmt:12.575},
   {draft:9.50,disp:39998.86,lcb:4.864,kb:4.972,tpc:47.35,lcf:-0.300,mctc:596.06,kml:263.77,kmt:12.476},
   {draft:10.00,disp:42377.68,lcb:4.549,kb:5.239,tpc:47.80,lcf:-1.224,mctc:612.80,kml:255.95,kmt:12.415},
   {draft:10.50,disp:44777.86,lcb:4.214,kb:5.507,tpc:48.19,lcf:-2.153,mctc:626.95,kml:247.82,kmt:12.385},
   {draft:11.00,disp:47196.94,lcb:3.868,kb:5.775,tpc:48.58,lcf:-2.890,mctc:641.28,kml:240.49,kmt:12.390},
   {draft:11.50,disp:49636.28,lcb:3.526,kb:6.044,tpc:48.97,lcf:-3.343,mctc:656.67,kml:234.16,kmt:12.413},
   {draft:12.00,disp:52094.92,lcb:3.194,kb:6.312,tpc:49.35,lcf:-3.700,mctc:671.82,kml:228.26,kmt:12.462},
   {draft:12.50,disp:54571.60,lcb:2.877,kb:6.581,tpc:49.69,lcf:-3.926,mctc:686.01,kml:222.50,kmt:12.521}
  ],knRows:[]
 },
 barrass_general_1355:{
  label:'Barrass 135.5 m LBP General Cargo',kind:'hydroTable',badge:'BOOK HYDRO',
  source:'Barrass & Derrett · Ch. 17 · Fig. 17.9 hydrostatic values',
  note:'Tabulated salt-water hydrostatics for a 135.5 m LBP general cargo ship, breadth moulded 18.3 m. Large-angle GZ remains the simulator geometry model because this table does not provide KN ordinates.',
  length:135.5,beam:18.3,
  rows:[
   {draft:2.5,tpc:17.69,kb:1.35,disp:3785,kml:449.0,mctc:123.0,kmt:10.75,lcf:+0.85,lcb:+1.30},
   {draft:3.0,tpc:18.12,kb:1.61,disp:4674,kml:382.3,mctc:129.1,kmt:9.56,lcf:+0.83,lcb:+1.30},
   {draft:4.0,tpc:18.76,kb:2.15,disp:6486,kml:296.0,mctc:138.3,kmt:8.28,lcf:+0.70,lcb:+1.25},
   {draft:5.0,tpc:19.27,kb:2.68,disp:8361,kml:243.2,mctc:145.9,kmt:7.70,lcf:+0.42,lcb:+1.05},
   {draft:6.0,tpc:19.70,kb:3.21,disp:10293,kml:207.4,mctc:152.5,kmt:7.46,lcf:+0.05,lcb:+0.80},
   {draft:7.0,tpc:20.06,kb:3.74,disp:12258,kml:181.5,mctc:158.1,kmt:7.44,lcf:-0.50,lcb:+0.45},
   {draft:8.0,tpc:20.36,kb:4.27,disp:14253,kml:161.8,mctc:162.9,kmt:7.54,lcf:-1.20,lcb:0.00},
   {draft:9.0,tpc:20.64,kb:4.80,disp:16276,kml:146.5,mctc:167.4,kmt:7.71,lcf:-2.10,lcb:-0.45}
  ]
 },
 barrass_tanker_35000:{
  label:"M.V. 'Tanker' · 35,000 t",kind:'gzReference',badge:'BOOK GZ',
  source:'Barrass & Derrett · Ch. 17 · Stability Cross Curves, example at Δ 35,000 t and assumed KG 9.0 m',
  referenceDisp:35000,assumedKG:9.0,
  note:'Primary GZ curve comes from the textbook cross-curve ordinates. If KG changes, the simulator applies the textbook correction ΔGZ = −ΔKG·sinθ. Displacement validity remains 35,000 t.',
  gz:[{a:0,v:0},{a:15,v:.86},{a:30,v:2.07},{a:45,v:2.45},{a:60,v:1.85},{a:75,v:.76},{a:90,v:.50}]
 },
 barrass_cargo_40000:{
  label:"M.V. 'Cargo-Carrier' · 40,000 t",kind:'knReference',badge:'BOOK KN',
  source:'Barrass & Derrett · Ch. 17 · KN Cross Curves, example at Δ 40,000 t',
  referenceDisp:40000,
  note:'Primary GZ is calculated directly from textbook KN ordinates using GZ = KN − KG·sinθ. Displacement validity remains 40,000 t.',
  kn:[{a:0,v:0},{a:5,v:.90},{a:10,v:1.92},{a:15,v:3.11},{a:20,v:4.25},{a:30,v:6.30},{a:45,v:8.44},{a:60,v:9.39},{a:75,v:9.29},{a:90,v:8.50}]
 }
 };

(AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).forEach(v=>{
 const pp=v.principalParticulars||{},key=amcolTrainingHydroKey(v.id),realCal=!!v.realSourceCalibrated;
 hydrostaticDataPacks[key]={label:realCal?`${v.companyName} · ${v.name} · AMCOL calibrated hydrostatics + KN`:`${v.name} · AMCOL training hydrostatics + KN`,kind:'uploadedBundle',badge:realCal?'SOURCE-ANCHORED CALIBRATED':'AMCOL TRAINING',source:realCal?`${v.sourceAnchor||v.companyName} · AMCOL derived hydrostatic/stability reconstruction`:'AMCOL TRAINING VESSELS Comprehensive Data Pack v1.0 · synthetic/derived educational model',sourceDensity:+v.sourceDensity||1.025,
  metadata:{name:v.name,company:realCal?(v.companyName||'Source company'):'Asian Maritime Technological College (AMCOL)',length:+pp.LBP||0,beam:+pp.beam||0,depth:+pp.depth||0,density:+v.sourceDensity||1.025,dataConfidence:realCal?'SOURCE-ANCHORED / AMCOL CALIBRATED DERIVED MODEL':'AMCOL TRAINING MODEL'},
  note:`${v.calibrationBasis||''} ${v.statutoryDisclaimer||''}`.trim(),rows:deepClonePlain(v.hydrostatics||[]),knRows:(v.knCrossCurves||[]).map(r=>({disp:+r.disp,angle:+r.angle,kn:+r.kn,side:r.side||'both',draftRef:+r.draftRef,tcb:+r.tcb,vcb:+r.vcb})),
  downfloodPort:(v.downflooding?.port!==null&&v.downflooding?.port!==undefined&&Number.isFinite(Number(v.downflooding.port)))?Number(v.downflooding.port):null,downfloodStarboard:(v.downflooding?.starboard!==null&&v.downflooding?.starboard!==undefined&&Number.isFinite(Number(v.downflooding.starboard)))?Number(v.downflooding.starboard):null,trainingVesselId:v.id};
});

/*
 PHASE 16 · USER-UPLOADED VESSEL HYDROSTATIC / KN DATA
 Supported bundle formats:
 1) Hydrostatic CSV: draft, displacement, KB, KMT, optional KML/TPC/MCTC/LCF/LCB/density/L/B/D.
 2) KN CSV: displacement, angle, KN, optional side (port/starboard), density.
 3) JSON bundle containing metadata, hydrostatics[] and kn[].
 Hydrostatic values are interpolated in displacement after correcting the query displacement
 to the source density. KN curves are interpolated first in angle and then in displacement.
 No multi-curve displacement extrapolation is performed.
*/
const UPLOADED_HYDRO_STORAGE_KEY='amcol_uploaded_hydro_bundle_v1';

function hydroNum(v){
 if(v===null||v===undefined||v==='')return NaN;
 const n=Number(String(v).replace(/,/g,'').trim());return Number.isFinite(n)?n:NaN;
}
function hydroHeaderKey(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');}
function csvParse(text){
 const rows=[];let row=[],field='',q=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(q){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')q=false;else field+=ch;}
  else if(ch==='"')q=true;
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];field='';}
  else if(ch!=='\r')field+=ch;
 }
 row.push(field);if(row.some(x=>String(x).trim()!==''))rows.push(row);
 if(rows.length<2)return [];
 const headers=rows[0].map(hydroHeaderKey);
 return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])));
}
function valFrom(rec,names){for(const n of names){const k=hydroHeaderKey(n);if(rec[k]!==undefined&&rec[k]!=='')return rec[k];}return undefined;}
function nFrom(rec,names){return hydroNum(valFrom(rec,names));}
function sFrom(rec,names){const v=valFrom(rec,names);return v===undefined?'':String(v).trim();}
function normaliseHydroRow(rec){
 return {
  draft:nFrom(rec,['draft','draught','meandraft']),
  disp:nFrom(rec,['displacement','disp','delta','displ']),
  kb:nFrom(rec,['kb']),
  kmt:nFrom(rec,['kmt','kmtransverse','transversekm','kmtm']),
  kml:nFrom(rec,['kml','kmlongitudinal','longitudinalkm']),
  tpc:nFrom(rec,['tpc','tonnespercentimetre','tonspercentimeter']),
  mctc:nFrom(rec,['mctc','mct1cm','mctcm','momenttochangetrim1cm']),
  lcf:nFrom(rec,['lcf','longitudinalcentreofflotation']),
  lcb:nFrom(rec,['lcb','longitudinalcentreofbuoyancy'])
 };
}
function normaliseKNRow(rec){
 let side=sFrom(rec,['side','heelingside']).toLowerCase();
 if(side.startsWith('p'))side='port';else if(side.startsWith('s'))side='starboard';else side='both';
 return {disp:nFrom(rec,['displacement','disp','delta','displ']),angle:Math.abs(nFrom(rec,['angle','heel','heelangle','theta'])),kn:nFrom(rec,['kn','crosscurve','crosscurvekn']),side};
}
function inferMetadataFromRecords(records,meta={}){
 if(!records?.length)return meta;const r=records[0];
 const fields={
  name:sFrom(r,['vesselname','vessel','shipname','ship']),company:sFrom(r,['company','operator']),
  length:nFrom(r,['length','loa','lbp','lengthm']),beam:nFrom(r,['beam','breadth','bmoulded']),depth:nFrom(r,['depth','mouldeddepth','dmoulded']),
  density:nFrom(r,['density','rho','waterdensity','sourcedensity']),downfloodPort:nFrom(r,['downfloodport','portdownflood','dfport']),downfloodStarboard:nFrom(r,['downfloodstarboard','starboarddownflood','dfstarboard'])
 };
 Object.entries(fields).forEach(([k,v])=>{if((typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&v))meta[k]=v;});return meta;
}
function cleanUploadedBundle(bundle){
 bundle=bundle||{};bundle.metadata=bundle.metadata||{};
 bundle.sourceDensity=Number.isFinite(hydroNum(bundle.sourceDensity))?hydroNum(bundle.sourceDensity):(Number.isFinite(hydroNum(bundle.density))?hydroNum(bundle.density):(Number.isFinite(hydroNum(bundle.metadata.density))?hydroNum(bundle.metadata.density):1.025));
 bundle.rows=(bundle.rows||bundle.hydrostatics||bundle.hydrostatic||[]).map(r=>('disp' in r&&'kmt' in r)?{...r}:normaliseHydroRow(Object.fromEntries(Object.entries(r).map(([k,v])=>[hydroHeaderKey(k),v])))).filter(r=>[r.draft,r.disp,r.kb,r.kmt].every(Number.isFinite)).sort((a,b)=>a.disp-b.disp);
 bundle.knRows=(bundle.knRows||bundle.kn||bundle.crossCurves||bundle.crosscurves||[]).map(r=>('disp' in r&&'angle' in r&&'kn' in r)?{disp:+r.disp,angle:Math.abs(+r.angle),kn:+r.kn,side:(r.side||'both').toLowerCase()}:normaliseKNRow(Object.fromEntries(Object.entries(r).map(([k,v])=>[hydroHeaderKey(k),v])))).filter(r=>[r.disp,r.angle,r.kn].every(Number.isFinite)&&r.angle>=0&&r.angle<=180).sort((a,b)=>a.disp-b.disp||a.angle-b.angle);
 const df=bundle.downflooding||{};
 bundle.openings=(bundle.openings||bundle.downfloodingOpenings||[]).map((o,i)=>({name:String(o.name||o.label||`Opening ${i+1}`),side:String(o.side||'both').toLowerCase(),x:Number(o.x??o.tcg),y:Number(o.y??o.vcg??o.height),lcg:Number(o.lcg??o.z??0),watertight:!!o.watertight,weathertight:!!o.weathertight})).filter(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)&&Number.isFinite(o.lcg));
 bundle.downfloodPort=Number.isFinite(hydroNum(bundle.downfloodPort))?hydroNum(bundle.downfloodPort):(Number.isFinite(hydroNum(df.port))?hydroNum(df.port):(Number.isFinite(hydroNum(bundle.metadata.downfloodPort))?hydroNum(bundle.metadata.downfloodPort):null));
 bundle.downfloodStarboard=Number.isFinite(hydroNum(bundle.downfloodStarboard))?hydroNum(bundle.downfloodStarboard):(Number.isFinite(hydroNum(df.starboard))?hydroNum(df.starboard):(Number.isFinite(hydroNum(bundle.metadata.downfloodStarboard))?hydroNum(bundle.metadata.downfloodStarboard):null));
 return bundle;
}
function uploadedPackFromBundle(bundle){
 const b=cleanUploadedBundle(bundle),m=b.metadata||{};
 return {label:m.name||b.label||'Uploaded vessel stability data',kind:'uploadedBundle',badge:'UPLOADED',source:b.source||'User-uploaded vessel hydrostatic / stability data',note:'Uploaded vessel-specific data are used as the primary calculation source wherever the required table is available. Generic geometry remains as a visual/fallback model.',sourceDensity:b.sourceDensity||1.025,rows:b.rows||[],knRows:b.knRows||[],openings:b.openings||[],metadata:m,downfloodPort:b.downfloodPort,downfloodStarboard:b.downfloodStarboard};
}
function registerUploadedHydroBundle(bundle,{persist=true,activate=true}={}){
 const p=uploadedPackFromBundle(bundle);
 if(!p.rows.length&&!p.knRows.length)throw new Error('No valid hydrostatic or KN rows were found.');
 hydrostaticDataPacks.uploaded=p;
 const sel=document.getElementById('hydroDataPackSelect');if(sel&&!sel.querySelector('option[value="uploaded"]')){const o=document.createElement('option');o.value='uploaded';o.textContent='Uploaded vessel data · hydrostatics / KN';sel.appendChild(o);}
 if(persist){try{localStorage.setItem(UPLOADED_HYDRO_STORAGE_KEY,JSON.stringify({label:p.label,source:p.source,sourceDensity:p.sourceDensity,metadata:p.metadata,rows:p.rows,knRows:p.knRows,openings:p.openings||[],downfloodPort:p.downfloodPort,downfloodStarboard:p.downfloodStarboard}));}catch(e){}}
 const applyDims=document.getElementById('applyUploadedDimensions')?.checked!==false,m=p.metadata||{};
 if(applyDims){if(Number.isFinite(+m.length)&&+m.length>0)state.length=+m.length;if(Number.isFinite(+m.beam)&&+m.beam>0)state.beam=+m.beam;if(Number.isFinite(+m.depth)&&+m.depth>0)state.depth=+m.depth;if(m.name)state.vesselName=m.name;if(m.company)state.companyName=m.company;}
 updateUploadedHydroStatus();if(activate){state.hydroDataKey='uploaded';syncFormFromState();loadHydrostaticDataPack('uploaded');}
 return p;
}
function restoreUploadedHydroBundle(){
 try{const raw=localStorage.getItem(UPLOADED_HYDRO_STORAGE_KEY);if(raw)registerUploadedHydroBundle(JSON.parse(raw),{persist:false,activate:false});}catch(e){}
 updateUploadedHydroStatus();
}
function clearUploadedHydroData(){
 try{localStorage.removeItem(UPLOADED_HYDRO_STORAGE_KEY);}catch(e){}
 delete hydrostaticDataPacks.uploaded;const sel=document.getElementById('hydroDataPackSelect');sel?.querySelector('option[value="uploaded"]')?.remove();if(state.hydroDataKey==='uploaded')state.hydroDataKey='geometry';if(sel)sel.value=state.hydroDataKey;updateUploadedHydroStatus();updateHydroDataPackInfo();calculateAll();
}
function updateUploadedHydroStatus(message='',isError=false){
 const el=document.getElementById('uploadedHydroStatus');if(!el)return;const p=hydrostaticDataPacks.uploaded;
 if(!p){el.className='text-[9px] text-slate-400 bg-slate-900/70 border border-slate-800 rounded p-2 leading-relaxed';el.innerHTML=message?escapeHtml(message):'No uploaded vessel data. Hydrostatic CSV should contain at least <b>draft, displacement, KB and KMT</b>. For realistic large-angle GZ, also upload <b>displacement, angle and KN</b> cross-curve data.';return;}
 const dispLevels=[...new Set(p.knRows.map(r=>r.disp))].sort((a,b)=>a-b),maxAngle=p.knRows.length?Math.max(...p.knRows.map(r=>r.angle)):0,openingCount=(p.openings||[]).length;
 el.className=`text-[9px] ${isError?'text-rose-200 border-rose-800/50':'text-emerald-100 border-emerald-800/40'} bg-slate-900/70 border rounded p-2 leading-relaxed`;
 el.innerHTML=`<div class="font-bold ${isError?'text-rose-300':'text-emerald-300'}">${message?escapeHtml(message):'Uploaded data ready'}</div><div>Hydrostatic rows: <b>${p.rows.length}</b> · KN rows: <b>${p.knRows.length}</b> · KN displacement levels: <b>${dispLevels.length}</b>${maxAngle?` · max heel <b>${maxAngle.toFixed(0)}°</b>`:''} · opening coordinates: <b>${openingCount}</b></div><div>Source density: <b>${p.sourceDensity.toFixed(3)} t/m³</b>${p.metadata?.name?` · Vessel: <b>${escapeHtml(p.metadata.name)}</b>`:''}</div><div class="text-slate-500 mt-1">${p.rows.length?'Upright hydrostatics available.':'No upright hydrostatic table.'} ${p.knRows.length?'Large-angle GZ will use uploaded KN data when within its valid range.':'Large-angle GZ still uses the geometry model.'}</div>`;
}
async function importHydrostaticFiles(){
 const input=document.getElementById('hydroUploadInput'),files=[...(input?.files||[])];if(!files.length){updateUploadedHydroStatus('Choose one or more CSV/JSON files first.',true);return;}
 try{
  const bundle={label:'Uploaded vessel stability data',source:'User-uploaded stability booklet / hydrostatic data',metadata:{},rows:[],knRows:[],openings:[],sourceDensity:1.025};
  for(const file of files){
   const text=await file.text();
   if(file.name.toLowerCase().endsWith('.json')){
    const obj=JSON.parse(text),src=Array.isArray(obj)?{rows:obj}:obj;
    bundle.metadata={...bundle.metadata,...(src.metadata||{})};if(src.name&&!bundle.metadata.name)bundle.metadata.name=src.name;if(src.company&&!bundle.metadata.company)bundle.metadata.company=src.company;
    if(Number.isFinite(hydroNum(src.sourceDensity??src.density)))bundle.sourceDensity=hydroNum(src.sourceDensity??src.density);
    bundle.rows.push(...(src.hydrostatics||src.hydrostatic||src.rows||[]));bundle.knRows.push(...(src.kn||src.knRows||src.crossCurves||src.crosscurves||[]));bundle.openings.push(...(src.openings||src.downfloodingOpenings||[]));
    const df=src.downflooding||{};if(Number.isFinite(hydroNum(df.port)))bundle.downfloodPort=hydroNum(df.port);if(Number.isFinite(hydroNum(df.starboard)))bundle.downfloodStarboard=hydroNum(df.starboard);
   }else{
    const records=csvParse(text);if(!records.length)continue;inferMetadataFromRecords(records,bundle.metadata);
    const density=nFrom(records[0],['density','rho','waterdensity','sourcedensity']);if(Number.isFinite(density))bundle.sourceDensity=density;
    const hasKN=Number.isFinite(nFrom(records[0],['kn','crosscurve','crosscurvekn']));
    const hasHyd=Number.isFinite(nFrom(records[0],['draft','draught','meandraft']))&&Number.isFinite(nFrom(records[0],['kmt','kmtransverse','transversekm']));
    if(hasKN)bundle.knRows.push(...records.map(normaliseKNRow));
    if(hasHyd)bundle.rows.push(...records.map(normaliseHydroRow));
    const dp=nFrom(records[0],['downfloodport','portdownflood','dfport']),ds=nFrom(records[0],['downfloodstarboard','starboarddownflood','dfstarboard']);if(Number.isFinite(dp))bundle.downfloodPort=dp;if(Number.isFinite(ds))bundle.downfloodStarboard=ds;
   }
  }
  registerUploadedHydroBundle(bundle,{persist:true,activate:true});updateUploadedHydroStatus('Import successful — uploaded vessel data are active.');
 }catch(err){console.error(err);updateUploadedHydroStatus(`Import failed: ${err.message||err}`,true);}
}
function sourceEquivalentDisplacement(p=hydroPack()){
 return AMCOLPhysics.hydro.sourceEquivalentDisplacement(state.dispMass,state.density,p.sourceDensity||1.025);
}
function uploadedKNInterpolation(angleMagnitude,side='starboard'){
 const p=hydroPack();if(p.kind!=='uploadedBundle'||!p.knRows?.length)return {valid:false,reason:'no uploaded KN data'};
 return AMCOLPhysics.kn.interpolateKNRows(p.knRows,sourceEquivalentDisplacement(p),angleMagnitude,side);
}
function uploadedKNForSideAt(angleMagnitude,side='starboard'){
 const r=uploadedKNInterpolation(angleMagnitude,side);state.knInterpolationStatus=r;return r.valid?r.kn:NaN;
}
function uploadedOperationalGZAt(angle){
 const p=hydroPack();if(p.kind!=='uploadedBundle'||!p.knRows?.length||state.damage)return NaN;
 const side=angle<0?'port':'starboard',kn=uploadedKNForSideAt(Math.abs(angle),side);if(!Number.isFinite(kn))return NaN;
 const effG=effectiveCGAtHeel(angle);
 // Signed lever: 2D KN(Δ,heel), vertical CG term and actual transverse CG term.
 return AMCOLPhysics.gz.fromKN(angle,kn,effG.kg,effG.tcg);
}
function hydroCSVTemplate(){return `vessel_name,company,length,beam,depth,density,draft,displacement,KB,KMT,KML,TPC,MCTC,LCF,LCB\nMV Training Vessel,Company,135.5,18.3,10.0,1.025,2.5,3785,1.35,10.75,449.0,17.69,123.0,0.85,1.30\nMV Training Vessel,Company,135.5,18.3,10.0,1.025,3.0,4674,1.61,9.56,382.3,18.12,129.1,0.83,1.30\n`}
function knCSVTemplate(){return `vessel_name,density,displacement,angle,KN,side\nMV Training Vessel,1.025,10000,0,0.000,both\nMV Training Vessel,1.025,10000,10,1.100,both\nMV Training Vessel,1.025,10000,20,2.200,both\nMV Training Vessel,1.025,12000,0,0.000,both\nMV Training Vessel,1.025,12000,10,1.180,both\nMV Training Vessel,1.025,12000,20,2.340,both\n`}
function downloadText(name,text,type='text/plain'){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
function downloadHydroCSVTemplate(){downloadText('AMCOL_hydrostatic_table_template.csv',hydroCSVTemplate(),'text/csv');}
function downloadKNCsvTemplate(){downloadText('AMCOL_KN_cross_curves_template.csv',knCSVTemplate(),'text/csv');}
function downloadHydroJSONTemplate(){
 const obj={metadata:{name:'MV Training Vessel',company:'Company',length:135.5,beam:18.3,depth:10.0,density:1.025},sourceDensity:1.025,downflooding:{port:55,starboard:55},openings:[{name:'Starboard engine-room ventilator',side:'starboard',x:6.5,y:11.2,lcg:-42.0,watertight:false},{name:'Port engine-room ventilator',side:'port',x:-6.5,y:11.2,lcg:-42.0,watertight:false}],hydrostatics:[{draft:2.5,disp:3785,kb:1.35,kmt:10.75,kml:449.0,tpc:17.69,mctc:123.0,lcf:.85,lcb:1.30},{draft:3.0,disp:4674,kb:1.61,kmt:9.56,kml:382.3,tpc:18.12,mctc:129.1,lcf:.83,lcb:1.30}],kn:[{disp:10000,angle:0,kn:0,side:'both'},{disp:10000,angle:10,kn:1.10,side:'both'},{disp:10000,angle:20,kn:2.20,side:'both'},{disp:12000,angle:0,kn:0,side:'both'},{disp:12000,angle:10,kn:1.18,side:'both'},{disp:12000,angle:20,kn:2.34,side:'both'}]};downloadText('AMCOL_hydrostatic_KN_bundle_template.json',JSON.stringify(obj,null,2),'application/json');
}

function lerpRows(rows,key,x){return AMCOLPhysics.hydro.interpolateRows(rows,key,x);}
function interpolateAngleTable(points,angle){return AMCOLPhysics.hydro.interpolateAngleTable(points,angle);}
function hydroPack(){return hydrostaticDataPacks[state.hydroDataKey]||hydrostaticDataPacks.geometry;}
function hydroTableAtCurrentDisplacement(){
 const p=hydroPack();if(!(p.kind==='hydroTable'||p.kind==='uploadedBundle')||!p.rows?.length)return null;
 const q=p.kind==='uploadedBundle'?sourceEquivalentDisplacement(p):state.dispMass;
 const key=`${state.hydroDataKey}|${Number(q).toFixed(5)}|${Number(state.density).toFixed(6)}`;
 if(hydroTableAtCurrentDisplacement._key===key)return hydroTableAtCurrentDisplacement._value;
 const value=lerpRows(p.rows,'disp',q);hydroTableAtCurrentDisplacement._key=key;hydroTableAtCurrentDisplacement._value=value;return value;
}
function textbookReferenceGZAt(angle){
 const p=hydroPack(),phi=(Number(angle)||0)*Math.PI/180,rad=Math.abs(phi),sign=angle<0?-1:angle>0?1:0,effG=effectiveCGAtHeel(angle);
 // Single-displacement textbook curves are authority-limited: no silent displacement extrapolation.
 if(Number.isFinite(Number(p.referenceDisp))&&p.referenceDisp>0){const err=Math.abs(state.dispMass-p.referenceDisp)/p.referenceDisp;if(err>.02)return NaN;}
 if(p.kind==='gzReference'){
   const base=interpolateAngleTable(p.gz,angle);if(!Number.isFinite(base))return NaN;
   return AMCOLPhysics.gz.adjustReferenceGZ(angle,base,p.assumedKG,effG.kg,effG.tcg);
 }
 if(p.kind==='knReference'){
   const kn=Math.abs(interpolateAngleTable(p.kn,Math.abs(angle)));if(!Number.isFinite(kn))return NaN;
   return sign*kn-effG.kg*Math.sin(phi)-effG.tcg*Math.cos(phi);
 }
 return NaN;
}
function operationalGZAt(angle){
 const p=hydroPack();
 if(p.kind==='gzReference'||p.kind==='knReference'){const g=textbookReferenceGZAt(angle);if(Number.isFinite(g))return g;}
 if(p.kind==='uploadedBundle'&&p.knRows?.length){const g=uploadedOperationalGZAt(angle);if(Number.isFinite(g))return g;}
 // Source data outside its published envelope falls back visibly to the procedural geometry model; it is never extrapolated.
 const h=hydroAtAngle(angle);return h.invalid?NaN:h.gz;
}

// Side-normalised presentation GZ. Keep operationalGZAt() algebraically signed for physics.
function restoringGZAt(angle){return AMCOLPhysics.gz.restoringSigned(angle,operationalGZAt(angle));}
function stabilitySenseAt(angle){
 const gz=restoringGZAt(angle);
 if(!Number.isFinite(gz))return 'N/A';
 if(Math.abs(angle)<0.05||Math.abs(gz)<1e-5)return 'NEUTRAL';
 return gz>0?'RIGHTING':'OVERTURNING';
}
function sideCurvePoints(side='starboard'){
 const port=side==='port';
 return curveCache.filter(p=>port?p.angle<=0:p.angle>=0)
   .map(p=>({angle:Math.abs(p.angle),gz:port?-p.gz:p.gz}))
   .filter(p=>p.angle<=90&&Number.isFinite(p.gz)).sort((a,b)=>a.angle-b.angle);
}
function sideCurveGZAt(angleMagnitude,side='starboard'){
 const x=Math.max(0,Math.abs(Number(angleMagnitude)||0)),pts=sideCurvePoints(side);
 if(!pts.length)return NaN;
 if(x<=pts[0].angle)return pts[0].gz;
 if(x>=pts[pts.length-1].angle)return pts[pts.length-1].gz;
 for(let i=1;i<pts.length;i++)if(pts[i].angle>=x){const a=pts[i-1],b=pts[i],t=(x-a.angle)/(b.angle-a.angle||1);return a.gz+t*(b.gz-a.gz);}
 return NaN;
}
function loadHydrostaticDataPack(key){
 cancelStabilityTestRuntime();
 if(!hydrostaticDataPacks[key])key='geometry';const requested=hydrostaticDataPacks[key];if(requested?.trainingVesselId&&state.amcolTrainingVesselId!==requested.trainingVesselId){loadAMCOLTrainingVessel(requested.trainingVesselId);return;}state.hydroDataKey=key;
 if(key!=='great_fortune_workbook'&&state.sourceConditionKey==='great_fortune_workbook')state.sourceConditionKey=null;
 const sel=document.getElementById('hydroDataPackSelect');if(sel)sel.value=key;
 const p=hydroPack();
 if(p.kind==='hydroTable'){
   state.hullType='general';state.length=p.length;state.beam=p.beam;
   const ht=document.getElementById('inputHullType'),le=document.getElementById('inputLength'),be=document.getElementById('inputBeam');if(ht)ht.value='general';if(le)le.value=p.length;if(be)be.value=p.beam;
 }
 if(p.kind==='uploadedBundle'&&document.getElementById('applyUploadedDimensions')?.checked!==false){const m=p.metadata||{};if(Number.isFinite(+m.length)&&+m.length>0)state.length=+m.length;if(Number.isFinite(+m.beam)&&+m.beam>0)state.beam=+m.beam;if(Number.isFinite(+m.depth)&&+m.depth>0)state.depth=+m.depth;if(m.name)state.vesselName=m.name;if(m.company)state.companyName=m.company;syncFormFromState();}
 updateHydroDataPackInfo();calculateAll();
}
function sourceFieldFmt(v,d=2,fallback='—'){
 const n=Number(v);return Number.isFinite(n)?n.toFixed(d):fallback;
}
function updateHydroDataPackInfo(){
 const box=document.getElementById('hydroDataPackInfo');if(!box)return;const p=hydroPack();
 let validity='';
 if(p.referenceDisp){const err=100*(state.dispMass-p.referenceDisp)/p.referenceDisp;validity=`<div class="mt-1 ${Math.abs(err)<=2?'text-emerald-300':'text-amber-300'}"><b>Displacement check:</b> current Δ ${state.dispMass.toFixed(0)} t · reference ${p.referenceDisp.toFixed(0)} t · ${err>=0?'+':''}${err.toFixed(1)}%.</div>`;}
 if(p.kind==='hydroTable'||p.kind==='uploadedBundle'){
   const r=hydroTableAtCurrentDisplacement(),eqDisp=p.kind==='uploadedBundle'?sourceEquivalentDisplacement(p):state.dispMass;
   if(p.rows?.length)validity=r?`<div class="mt-1 text-emerald-300"><b>Hydrostatic interpolation:</b> source-equivalent Δ ${sourceFieldFmt(eqDisp,0)} t · draft ${sourceFieldFmt(r.draft,2)} m · KB ${Number.isFinite(Number(r.kb))?sourceFieldFmt(r.kb,2)+' m':'not tabulated'} · KMT ${Number.isFinite(Number(r.kmt))?sourceFieldFmt(r.kmt,2)+' m':'not tabulated'}${Number.isFinite(Number(r.tpc))?` · TPC ${sourceFieldFmt(r.tpc,2)} t/cm`:''}.</div>`:`<div class="mt-1 text-amber-300"><b>Current source-equivalent displacement is outside the uploaded hydrostatic table range.</b></div>`;
   if(p.kind==='uploadedBundle'&&p.knRows?.length){const lev=[...new Set(p.knRows.map(x=>x.disp))].sort((a,b)=>a-b),q=sourceEquivalentDisplacement(p),knOk=lev.length===1||q>=lev[0]&&q<=lev[lev.length-1];validity+=`<div class="mt-1 ${knOk?'text-emerald-300':'text-amber-300'}"><b>KN cross-curves:</b> ${lev.length} displacement level(s) · ${knOk?'current displacement covered':'current displacement outside KN range; GZ falls back to geometry'}${state.damage?' · damage active, so intact uploaded KN is paused':''}.</div>`;if(p.quality)validity+=`<div class="mt-1 text-slate-500"><b>Workbook QA:</b> ${p.quality.hydroOperational}/${p.quality.hydroRaw} hydro rows used · ${p.quality.hydroExcluded} non-monotonic rows quarantined · ${p.quality.knExcluded?.length||0} isolated KN anomalies excluded from interpolation but not silently corrected.</div>`;}
 }
 box.className='text-[9px] text-slate-300 bg-slate-900/70 border border-amber-900/50 rounded p-2 leading-relaxed';
 box.innerHTML=`<div class="flex justify-between gap-2"><b class="text-amber-300">${p.label}</b><span class="text-[8px] text-cyan-300">${p.badge}</span></div><div class="mt-1">${p.note}</div>${validity}${p.source?`<div class="mt-1 text-slate-500"><b>Source:</b> ${p.source}</div>`:''}`;
}
(AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).forEach(v=>{
 const pp=v.principalParticulars||{},key=amcolTrainingHydroKey(v.id);
 if(v.realSourceCalibrated&&v.referencePresetKey&&referenceVesselPresets[v.referencePresetKey]){
  const r=referenceVesselPresets[v.referencePresetKey];
  Object.assign(r,{hydroDataKey:key,amcolTrainingId:v.id,dataCompleteness:'OFFICIAL PARTICULARS + AMCOL CALIBRATED HYDRO + KN + TANKS',referenceDraft:+pp.designDraft||r.referenceDraft,
   researchBoundary:`Published/company/class particulars remain source-backed. The integrated ${v.hydrostatics?.length||0}-row hydrostatic table, ${v.knCrossCurves?.length||0} KN ordinates, derived lightship, representative tank geometry/calibration, loading conditions and SF/BM envelopes are AMCOL calibrated educational reconstructions, not the vessel’s approved stability booklet.`,
   modelNote:v.statutoryDisclaimer||'AMCOL calibrated training reconstruction — not class-approved.',
   calibratedDataNote:v.calibrationBasis||''});
  return;
 }
 referenceVesselPresets[key]={
  companyName:'Asian Maritime Technological College (AMCOL)',vesselName:v.name,hullType:v.family,
  length:+pp.LBP||+pp.length||100,beam:+pp.beam||20,depth:+pp.depth||10,depthVerified:true,identityVerified:true,referenceDraft:+pp.designDraft||0,
  hydroDataKey:key,amcolTrainingId:v.id,
  source:'AMCOL TRAINING VESSELS Comprehensive Data Pack v1.0 · 15 Aug 2026',
  verified:`AMCOL training dataset · ${v.hydrostatics?.length||0} hydrostatic rows · ${v.knCrossCurves?.length||0} KN ordinates · ${v.cargoSpaces?.length||0} cargo spaces · ${v.ballastTanks?.length||0} ballast tanks`,
  extra:`${v.typeLabel||'Training vessel'} · design draft ${(+pp.designDraft||0).toFixed(2)} m · training DWT ${(Number(pp.trainingDWT)||0).toLocaleString()} t.`,
  modelNote:v.statutoryDisclaimer||'AMCOL TRAINING MODEL — educational data only.'
 };
});

const AMCOL_USER_VESSEL_STORAGE_KEY='amcol_user_vessel_packages_v1';
let amcolUserImportedVesselIds=[];
function validateImportedVesselPackage(obj){
 const v=obj?.vessel||obj;if(!v||typeof v!=='object')return {valid:false,errors:['Missing vessel object.']};const errors=[],families=new Set(['container','bulk','general','roro','ferry','tanker','chemical','lng','osv','box']);
 const pp=v.principalParticulars||{},num=(x)=>Number.isFinite(Number(x));if(!v.name)errors.push('vessel.name is required.');if(!families.has(String(v.family||'')))errors.push('vessel.family must be a supported hull family.');if(!num(pp.LBP)||Number(pp.LBP)<=0)errors.push('principalParticulars.LBP must be positive.');if(!num(pp.beam)||Number(pp.beam)<=0)errors.push('principalParticulars.beam must be positive.');if(!num(pp.depth)||Number(pp.depth)<=0)errors.push('principalParticulars.depth must be positive.');if(!num(pp.lightshipMass)||Number(pp.lightshipMass)<=0)errors.push('principalParticulars.lightshipMass must be positive.');if(!num(pp.lightshipKG)||Number(pp.lightshipKG)<0)errors.push('principalParticulars.lightshipKG must be supplied.');
 const h=Array.isArray(v.hydrostatics)?v.hydrostatics:[];if(h.length<2)errors.push('At least two hydrostatic rows are required.');else{const hs=h.slice().sort((a,b)=>Number(a.draft)-Number(b.draft));for(let i=0;i<hs.length;i++){if(!num(hs[i].draft)||!num(hs[i].disp)||!num(hs[i].kmt))errors.push(`Hydro row ${i+1} requires draft, disp and kmt.`);if(i&&(!(Number(hs[i].draft)>Number(hs[i-1].draft))||!(Number(hs[i].disp)>Number(hs[i-1].disp))))errors.push('Hydrostatic draft and displacement must increase monotonically.');}}
 const kn=Array.isArray(v.knCrossCurves)?v.knCrossCurves:[];for(const [i,r] of kn.entries())if(!num(r.disp)||!num(r.angle)||!num(r.kn))errors.push(`KN row ${i+1} requires disp, angle and kn.`);
 return {valid:errors.length===0,errors,vessel:v};
}
function registerImportedVesselPackage(raw,{persist=true,load=false}={}){
 const q=validateImportedVesselPackage(raw);if(!q.valid)throw new Error(q.errors.join(' '));const src=deepClonePlain(q.vessel),base=String(src.id||src.name).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'VESSEL',id=base.startsWith('USER-')?base:`USER-${base}`;
 const existing=AMCOL_TRAINING_VESSELS_BY_ID[id];if(existing){const idx=AMCOL_TRAINING_VESSELS_MASTER.vessels.indexOf(existing);if(idx>=0)AMCOL_TRAINING_VESSELS_MASTER.vessels.splice(idx,1);}
 const v={...src,id,userImported:true,realSourceCalibrated:false,companyName:src.companyName||src.company||'User / Instructor',typeLabel:src.typeLabel||`${src.family} vessel`,sourceDensity:Number(src.sourceDensity)||1.025,statutoryDisclaimer:src.statutoryDisclaimer||'USER-IMPORTED VESSEL PACKAGE — data authority/source approval must be verified by the instructor. Not automatically class-approved or suitable for operational loading decisions.'};
 v.hydrostatics=(v.hydrostatics||[]).slice().sort((a,b)=>Number(a.draft)-Number(b.draft));v.knCrossCurves=(v.knCrossCurves||[]).slice();v.ballastTanks=v.ballastTanks||[];v.tankCalibration=v.tankCalibration||[];v.cargoSpaces=v.cargoSpaces||[];v.defaultCargoItems=v.defaultCargoItems||[];v.stationEnvelope=v.stationEnvelope||[];v.structuralLimits=v.structuralLimits||[];v.loadingConditions=v.loadingConditions||[];
 AMCOL_TRAINING_VESSELS_MASTER.vessels.push(v);AMCOL_TRAINING_VESSELS_BY_ID[id]=v;if(!amcolUserImportedVesselIds.includes(id))amcolUserImportedVesselIds.push(id);
 const pp=v.principalParticulars||{},key=amcolTrainingHydroKey(id);hydrostaticDataPacks[key]={label:`${v.companyName} · ${v.name} · user-imported hydrostatics${v.knCrossCurves.length?' + KN':''}`,kind:'uploadedBundle',badge:'USER IMPORTED',source:v.sourceAnchor||v.source||'Instructor/user vessel package',sourceDensity:v.sourceDensity,metadata:{name:v.name,company:v.companyName,length:+pp.LBP||0,beam:+pp.beam||0,depth:+pp.depth||0,density:v.sourceDensity,dataConfidence:'USER IMPORTED · VERIFY SOURCE'},note:v.statutoryDisclaimer,rows:deepClonePlain(v.hydrostatics),knRows:v.knCrossCurves.map(r=>({disp:+r.disp,angle:+r.angle,kn:+r.kn,side:r.side||'both',draftRef:+r.draftRef,tcb:+r.tcb,vcb:+r.vcb})),trainingVesselId:id};
 const refKey=`user_${id.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`;referenceVesselPresets[refKey]={companyName:v.companyName,vesselName:v.name,vesselTypeLabel:v.typeLabel,hullType:v.family,length:+pp.LBP||100,beam:+pp.beam||20,depth:+pp.depth||10,depthVerified:true,identityVerified:false,referenceDraft:Number.isFinite(+pp.designDraft)?+pp.designDraft:null,hydroDataKey:key,amcolTrainingId:id,dataCompleteness:'USER IMPORTED VESSEL PACKAGE',source:v.sourceAnchor||v.source||'User/instructor import',verified:'Not automatically verified by AMCOL',extra:'Imported complete/partial vessel dataset.',modelNote:v.statutoryDisclaimer};v.referencePresetKey=refKey;
 if(persist){try{const packs=amcolUserImportedVesselIds.map(x=>AMCOL_TRAINING_VESSELS_BY_ID[x]).filter(Boolean).slice(-3);localStorage.setItem(AMCOL_USER_VESSEL_STORAGE_KEY,JSON.stringify(packs));}catch(e){console.warn('Imported vessel persistence unavailable',e);}}
 populateReferenceVesselSelect();populateAMCOLTrainingHydroOptions(true);if(load)loadAMCOLTrainingVessel(id);return v;
}
function loadPersistedImportedVessels(){try{const packs=JSON.parse(localStorage.getItem(AMCOL_USER_VESSEL_STORAGE_KEY)||'[]');if(Array.isArray(packs))packs.forEach(v=>{try{registerImportedVesselPackage(v,{persist:false,load:false});}catch(e){console.warn('Skipped invalid saved vessel package',e.message);}});}catch(e){console.warn('Saved vessel packages unavailable',e);}}
async function importVesselPackage(files){const file=files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());const v=registerImportedVesselPackage(obj,{persist:true,load:true});showCleanFeedback(`Imported vessel package: ${v.companyName} · ${v.name}. User-source authority retained.`);}catch(e){alert('Vessel package import failed: '+e.message);}}
function downloadVesselPackageTemplate(){const example={format:'AMCOL_VESSEL_PACKAGE',schemaVersion:1,vessel:{id:'MY-VESSEL',companyName:'Company',name:'Training Vessel',family:'bulk',typeLabel:'Bulk Carrier',source:'Instructor supplied data',sourceDensity:1.025,principalParticulars:{LBP:150,beam:25,depth:14,designDraft:9,lightshipMass:9000,lightshipKG:8,lightshipLCG:0},hydrostatics:[{draft:4,disp:13000,kmt:14,tpc:30,mctc:250,lcb:0,lcf:0},{draft:9,disp:30000,kmt:12,tpc:38,mctc:360,lcb:0,lcf:0}],knCrossCurves:[],cargoSpaces:[],ballastTanks:[],tankCalibration:[],stationEnvelope:[],structuralLimits:[],loadingConditions:[],defaultCargoItems:[],statutoryDisclaimer:'User-imported data — verify source/approval status.'}};downloadText('AMCOL_Vessel_Package_Template.json',JSON.stringify(example,null,2),'application/json');}
function exportActiveVesselPackage(){const v=activeAMCOLTrainingVessel();if(!v)return alert('Load an AMCOL/calibrated/imported vessel data pack first.');downloadText(`${String(v.name||'Vessel').replace(/[^a-z0-9_-]+/gi,'_')}_AMCOL_Vessel_Package.json`,JSON.stringify({format:'AMCOL_VESSEL_PACKAGE',schemaVersion:1,exported:new Date().toISOString(),vessel:v},null,2),'application/json');}

function amcolTrainingCargoPhysics(v,sp,item){
 const family=v?.family||'general',type=String(sp?.type||'').toLowerCase();
 if(family==='bulk')return 'grain';
 if(family==='container')return 'container';
 if(family==='tanker'||family==='chemical')return 'liquid';
 if(family==='lng')return 'gas';
 if(family==='osv')return type.includes('tank')?'bulk':'discrete';
 if(family==='box')return type.includes('hopper')||type.includes('hold')?'bulk':'discrete';
 return 'discrete';
}
function amcolTrainingConsumablesItem(v,condition,baseCargo,baseBallast){
 const pp=v.principalParticulars||{},m=Math.max(0,Number(condition?.consumablesMass)||0);if(m<=0)return null;
 const disp=Math.max(.001,Number(condition.displacement)||0),targetVM=(Number(condition.solidKG)||0)*disp,targetLM=(Number(condition.LCG)||0)*disp;
 const lvm=(+pp.lightshipMass||0)*(+pp.lightshipKG||0),llm=(+pp.lightshipMass||0)*(+pp.lightshipLCG||0);
 const cvm=baseCargo.reduce((s,x)=>s+(+x.mass||0)*(+x.vcg||0),0),clm=baseCargo.reduce((s,x)=>s+(+x.mass||0)*(+x.lcg||0),0);
 const bvm=baseBallast.reduce((s,x)=>s+(+x.sourceMass||0)*(+x.sourceVCG||0),0),blm=baseBallast.reduce((s,x)=>s+(+x.sourceMass||0)*(+x.lcg||0),0);
 const vcg=(targetVM-lvm-cvm-bvm)/m,lcg=(targetLM-llm-clm-blm)/m;
 return {id:`amcol_consumables_${v.id}`,name:'Consumables / stores · AMCOL training balance item',cargoKey:'manual',physicsClass:'discrete',quantity:1,unitMass:m,density:0,fill:100,spaceId:'',autoMass:false,autoVCG:false,mass:m,vcg:Number.isFinite(vcg)?vcg:(+pp.depth||10)*.35,tcg:0,lcg:Number.isFinite(lcg)?lcg:-(+pp.LBP||100)*.08,moisture:0,tml:0,grainMoment:0,fsmFactor:0,tier:1,source:'AMCOL TRAINING MODEL · condition consumables',sourceLocked:true,sourceFSM:0};
}
function amcolTrainingBallastPlan(v,condition){
 const raw=(v.ballastTanks||[]).map(t=>{
  const cap=Math.max(0,Number(t.capacityTonnes ?? t.capacity)||0),fill=Math.max(0,Math.min(100,Number(t.fill)||0)),mass=cap*fill/100;
  const f=fill/100,bottom=Math.max(0,+t.bottom||0),height=Math.max(.05,+t.height||.05),vcg=bottom+f*height/2;
  const factor=Math.max(0,Math.min(1,Number(t.fsmShapeFactor ?? t.fsmFactor ?? 1))),rawFSM=(f>.001&&f<.98)?Math.max(.1,+t.density||1.025)*Math.max(.1,+t.length||.1)*Math.pow(Math.max(.1,+t.breadth||.1),3)/12*factor:0;
  return {...t,capacity:cap,autoCapacity:false,fsmFactor:factor,source:'AMCOL TRAINING MODEL',sourceLocked:true,sourceMass:mass,sourceVCG:vcg,_rawTrainingFSM:rawFSM};
 });
 const targetFSM=Math.max(0,(Number(condition?.FSC)||0)*(Number(condition?.displacement)||0)),rawSum=raw.reduce((s,t)=>s+(t._rawTrainingFSM||0),0),scale=rawSum>0?targetFSM/rawSum:0;
 raw.forEach(t=>{t.sourceFSM=(t._rawTrainingFSM||0)*scale;delete t._rawTrainingFSM;});return raw;
}
function amcolTrainingCargoItems(v,condition){
 const spaces=new Map((v.cargoSpaces||[]).map(sp=>[String(sp.id),sp]));
 return (v.defaultCargoItems||[]).map((x,i)=>{
  const sp=spaces.get(String(x.spaceId))||{},cap=Math.max(0,Number(sp.capacityVolume)||0),rho=Math.max(0,Number(x.density)||0),mass=Math.max(0,Number(x.mass)||0),fill=cap>0&&rho>0?Math.max(0,Math.min(100,100*mass/(rho*cap))):100;
  const cls=amcolTrainingCargoPhysics(v,sp,x);
  return {id:`amcol_${v.id}_cargo_${i}`,name:x.name||sp.name||`Training cargo ${i+1}`,cargoKey:'manual',physicsClass:cls,quantity:1,unitMass:mass,density:rho,fill,spaceId:x.spaceId||'',autoMass:false,autoVCG:false,volume:cap,mass,vcg:+x.vcg||+sp.vcg||0,tcg:+x.tcg||+sp.tcg||0,lcg:+x.lcg||+sp.lcg||0,moisture:0,tml:0,grainMoment:0,fsmFactor:.85,tier:1,source:'AMCOL TRAINING MODEL · Loaded Departure',sourceLocked:true,sourceFSM:0,preloadedSpaceSlot:true};
 });
}

function populateAMCOLTrainingHydroOptions(force=false){const sel=document.getElementById('hydroDataPackSelect');if(!sel)return;if(force)sel.querySelectorAll('optgroup[data-amcol-training],optgroup[data-real-calibrated],optgroup[data-user-imported]').forEach(x=>x.remove());else if(sel.querySelector('optgroup[data-amcol-training]'))return;const real=document.createElement('optgroup');real.label='REAL VESSELS · SOURCE-ANCHORED AMCOL CALIBRATED HYDRO + KN';real.dataset.realCalibrated='1';const g=document.createElement('optgroup');g.label='AMCOL TRAINING VESSELS · hydrostatics + KN';g.dataset.amcolTraining='1';const user=document.createElement('optgroup');user.label='USER-IMPORTED VESSELS · VERIFY SOURCE';user.dataset.userImported='1';(AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).forEach(v=>{const o=document.createElement('option');o.value=amcolTrainingHydroKey(v.id);o.textContent=v.userImported?`${v.companyName||'User'} · ${v.name} · USER IMPORTED`:v.realSourceCalibrated?`${v.companyName} · ${v.name} · CALIBRATED hydro + KN`:`${v.name} · AMCOL TRAINING hydro + KN`;if(v.userImported)user.appendChild(o);else if(v.realSourceCalibrated)real.appendChild(o);else g.appendChild(o);});if(real.children.length)sel.appendChild(real);if(user.children.length)sel.appendChild(user);sel.appendChild(g);}
function loadAMCOLTrainingVessel(id){
 const v=AMCOL_TRAINING_VESSELS_BY_ID[id];if(!v)return false;const pp=v.principalParticulars||{},condition=(v.loadingConditions||[])[0]||{},userImp=!!v.userImported;
 prepareReferenceVesselLoad();cancelStabilityTestRuntime();vesselVisualTransaction=true;
 try{
  resetCore();
  state.amcolTrainingVesselId=v.id;state.companyName=userImp?(v.companyName||'User / Instructor'):v.realSourceCalibrated?(v.companyName||'Source company'):'Asian Maritime Technological College (AMCOL)';state.vesselName=v.name;state.hullType=v.family;
  state.length=+pp.LBP||100;state.beam=+pp.beam||20;state.depth=+pp.depth||10;state.density=+v.sourceDensity||+pp.waterDensity||1.025;state.visualReferenceDraft=Number.isFinite(+pp.designDraft)?+pp.designDraft:null;state.visualReferenceDraftSource=userImp?'User-imported vessel package':v.realSourceCalibrated?'Published summer draught anchor · AMCOL calibrated model':'AMCOL training design draft';
  state.lightshipMass=+pp.lightshipMass||1;state.lightshipKG=+pp.lightshipKG||state.depth*.45;state.lightshipTCG=0;state.lightshipLCG=+pp.lightshipLCG||0;state.krRatio=vesselPresets[v.family]?.krRatio||.35;
  state.waterDepth=Math.max(state.depth+5,(+pp.designDraft||state.depth*.6)+Math.max(5,+v.operationalLimits?.minUKC||1));
  state.hydroDataKey=amcolTrainingHydroKey(v.id);state.sourceConditionKey=`amcol_training:${v.id}`;state.fse=true;
  window.AMCOL_CUSTOM_HULL_FORM={enabled:true,trainingModel:true,label:userImp?`${v.name} · user-imported station envelope`:v.realSourceCalibrated?`${v.name} · source-anchored AMCOL calibrated station envelope`:`${v.name} · AMCOL training station envelope`,vesselName:v.name,hullType:v.family,stations:(v.stationEnvelope||[]).map(s=>({xNorm:(+s.xNorm||0)*2,beamFactor:+s.beamFactor,bottomFactor:+s.bottomFactor,sheerRatio:+s.sheerRatio||0,keelRiseRatio:+s.keelRiseRatio||0}))};
  window.AMCOL_ACTIVE_TANK_CALIBRATION=deepClonePlain(v.tankCalibration||[]);window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=deepClonePlain(v.structuralLimits||[]);window.AMCOL_ACTIVE_TRAINING_CONDITIONS=deepClonePlain(v.loadingConditions||[]);
  ballastTanks=amcolTrainingBallastPlan(v,condition);state.ballastPlanEnabled=true;state.ballastPlanSource=userImp?'vessel':'training';state.ballastPlanLabel=userImp?`${v.companyName||'User'} · ${v.name} · USER IMPORTED ballast plan · ${ballastTanks.length} tanks`:v.realSourceCalibrated?`${v.companyName} · ${v.name} · AMCOL calibrated representative ballast plan · ${ballastTanks.length} tanks`:`${v.name} · AMCOL TRAINING MODEL ballast plan · ${ballastTanks.length} tanks`;
  cargoItems=amcolTrainingCargoItems(v,condition);const cons=amcolTrainingConsumablesItem(v,condition,cargoItems,ballastTanks);if(cons)cargoItems.push(cons);
  const ol=v.operationalLimits||{};operationalLimits={enabled:true,source:userImp?'user-imported':v.realSourceCalibrated?'real-vessel-amcol-calibrated':'amcol-training',label:userImp?'USER IMPORTED LIMITS · verify approval status':v.realSourceCalibrated?'AMCOL CALIBRATED TRAINING LIMITS · not statutory':'AMCOL TRAINING LIMITS · not statutory',minForwardDraft:Number.isFinite(+ol.minForwardDraft)?+ol.minForwardDraft:null,minAftDraft:Number.isFinite(+ol.minAftDraft)?+ol.minAftDraft:null,maxDraft:Number.isFinite(+ol.maxDraft)?+ol.maxDraft:null,minUKC:Number.isFinite(+ol.minUKC)?+ol.minUKC:null,maxList:Number.isFinite(+ol.maxList)?+ol.maxList:null,maxTrim:Number.isFinite(+ol.maxTrim)?+ol.maxTrim:null,airDraft:Number.isFinite(+ol.airDraft)?+ol.airDraft:null};
  bumpSpaceLayoutRevision('amcol-training-vessel-load');syncFormFromState();populateCargoLibraryUI();renderCargoTable();renderBallastPlan();renderSpaceFillMonitor();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});updateHydroDataPackInfo();renderOperationalLimitsCard();renderDataCompleteness();renderHullEnvelopeStatus();renderAMCOLTrainingDataPanel();showSelectedReferenceVesselInfo();renderUnifiedMissionPanel();updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('amcol-training-vessel-load');showCleanFeedback(userImp?`${v.companyName||'User'} · ${v.name}: user-imported vessel package loaded; source/approval status remains instructor responsibility.`:v.realSourceCalibrated?`${v.companyName} · ${v.name}: source-anchored AMCOL calibrated hydrostatics, KN, cargo and ballast training data loaded.`:`${v.name}: complete AMCOL training hydrostatics, KN, cargo and ballast data loaded.`);return true;
}

function teachingModelForReference(ref){
 const base=vesselPresets[ref.hullType]||vesselPresets.general;
 // Scale the generic teaching lightship by a conservative geometric factor,
 // but do not present it as published actual data.
 const volRef=Math.max(1,ref.length*ref.beam*ref.depth);
 const volBase=Math.max(1,base.length*base.beam*base.depth);
 const scale=Math.pow(volRef/volBase,0.72);
 return {
  lightshipMass:ref.actualLightshipMass||Math.max(100,base.lightshipMass*scale),
  lightshipKG:base.lightshipKG*(ref.depth/base.depth),
  krRatio:base.krRatio
 };
}
function populateReferenceVesselSelect(){
 const sel=document.getElementById('referenceVesselSelect');if(!sel)return;
 sel.innerHTML='<option value="">Choose a reference or AMCOL training vessel...</option>';
 const real=document.createElement('optgroup');real.label='REAL VESSELS · SOURCE PARTICULARS + AMCOL CALIBRATED COMPLETE DATA';
 Object.entries(referenceVesselPresets).filter(([,r])=>r.amcolTrainingId&&AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId]?.realSourceCalibrated).forEach(([key,r])=>{const v=AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId],pp=v?.principalParticulars||{};const o=document.createElement('option');o.value=key;o.textContent=`${r.companyName} · ${r.vesselName} · ${r.vesselTypeLabel||v?.typeLabel||r.hullType} — LBP ${(+pp.LBP||0).toFixed(2)} × B ${(+pp.beam||0).toFixed(2)} × D ${(+pp.depth||0).toFixed(2)} m · CALIBRATED HYDRO + KN + TANKS`;real.appendChild(o);});if(real.children.length)sel.appendChild(real);
 const user=document.createElement('optgroup');user.label='USER / INSTRUCTOR IMPORTED VESSELS · VERIFY SOURCE';
 Object.entries(referenceVesselPresets).filter(([,r])=>r.amcolTrainingId&&AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId]?.userImported).forEach(([key,r])=>{const v=AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId],pp=v?.principalParticulars||{};const o=document.createElement('option');o.value=key;o.textContent=`${v?.companyName||'User'} · ${r.vesselName} · ${v?.typeLabel||r.hullType} — LBP ${(+pp.LBP||+r.length).toFixed(1)} × B ${(+pp.beam||+r.beam).toFixed(1)} × D ${(+pp.depth||+r.depth).toFixed(1)} m · USER IMPORTED`;user.appendChild(o);});if(user.children.length)sel.appendChild(user);
 const train=document.createElement('optgroup');train.label='AMCOL TRAINING VESSELS · complete educational datasets';
 Object.entries(referenceVesselPresets).filter(([,r])=>r.amcolTrainingId&&!AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId]?.realSourceCalibrated&&!AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId]?.userImported).forEach(([key,r])=>{const v=AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId],pp=v?.principalParticulars||{};const o=document.createElement('option');o.value=key;o.textContent=`${r.vesselName} · ${v?.typeLabel||r.hullType} — L ${(+r.length).toFixed(1)} × B ${(+r.beam).toFixed(1)} × D ${(+r.depth).toFixed(1)} m · HYDRO + KN + TANKS`;train.appendChild(o);});
 sel.appendChild(train);
 const refs=document.createElement('optgroup');refs.label='REFERENCE / SOURCE VESSELS';
 Object.entries(referenceVesselPresets).filter(([,r])=>!r.amcolTrainingId).forEach(([key,r])=>{const o=document.createElement('option');o.value=key;const dims=r.depthVerified?`${r.length.toFixed(2)} × ${r.beam.toFixed(2)} × ${r.depth.toFixed(2)} m`:`L ${r.length.toFixed(1)} × B ${r.beam.toFixed(1)} m · D modelled`;const type=r.vesselTypeLabel||vesselPresets[r.hullType]?.label||r.hullType;o.textContent=`${r.companyName} · ${r.vesselName} · ${type} — ${dims}`;refs.appendChild(o);});
 sel.appendChild(refs);sel.addEventListener('change',showSelectedReferenceVesselInfo);
}
function showSelectedReferenceVesselInfo(){
 const key=document.getElementById('referenceVesselSelect')?.value,box=document.getElementById('referencePresetInfo');if(!box)return;
 if(!key||!referenceVesselPresets[key]){box.className='text-[9px] text-slate-400 bg-slate-900/70 border border-slate-800 rounded p-2 leading-relaxed';box.textContent='Select a reference vessel or an AMCOL Training Vessel to inspect its data basis.';return;}
 const r=referenceVesselPresets[key];
 if(r.amcolTrainingId){const v=AMCOL_TRAINING_VESSELS_BY_ID[r.amcolTrainingId],pp=v?.principalParticulars||{},conds=v?.loadingConditions||[],realCal=!!v?.realSourceCalibrated,userImp=!!v?.userImported;if(userImp){box.className='text-[9px] text-slate-300 bg-slate-900/70 border border-sky-700/50 rounded p-2 leading-relaxed';box.innerHTML=`<div class="flex justify-between gap-2 mb-1"><b class="text-sky-300">${escapeHtml(v.companyName||'User / Instructor')} · ${escapeHtml(v.name)}</b><span class="text-sky-300 font-bold">USER IMPORTED · VERIFY SOURCE</span></div><div><b>${escapeHtml(v.typeLabel||r.hullType)}</b> · LBP ${(+pp.LBP||0).toFixed(2)} m · B ${(+pp.beam||0).toFixed(2)} m · D ${(+pp.depth||0).toFixed(2)} m</div><div class="mt-1 text-sky-200"><b>Integrated:</b> ${v.hydrostatics?.length||0} hydro rows · ${v.knCrossCurves?.length||0} KN ordinates · ${v.cargoSpaces?.length||0} cargo spaces · ${v.ballastTanks?.length||0} ballast tanks · ${v.tankCalibration?.length||0} tank-calibration rows.</div><div class="mt-1 text-amber-200"><b>Authority:</b> AMCOL preserves these values as USER IMPORTED. The instructor is responsible for verifying source, revision and approval status.</div><button onclick="loadAMCOLTrainingVessel('${v.id}')" class="mt-2 w-full py-1.5 rounded bg-sky-500/15 border-sky-500/30 text-sky-200 border font-bold"><i class="fa-solid fa-ship mr-1"></i>Load imported vessel</button>`;return;}box.className=`text-[9px] text-slate-300 bg-slate-900/70 border ${realCal?'border-cyan-700/50':'border-violet-700/50'} rounded p-2 leading-relaxed`;box.innerHTML=`<div class="flex justify-between gap-2 mb-1"><b class="${realCal?'text-cyan-300':'text-violet-300'}">${realCal?`${escapeHtml(v.companyName)} · `:''}${escapeHtml(v.name)}</b><span class="${realCal?'text-cyan-300':'text-violet-300'} font-bold">${realCal?'SOURCE-ANCHORED · AMCOL CALIBRATED':'AMCOL TRAINING MODEL'}</span></div><div><b>${escapeHtml(v.typeLabel||r.hullType)}</b> · ${Number.isFinite(+pp.LOA)?`LOA ${(+pp.LOA).toFixed(2)} m · `:''}LBP ${(+pp.LBP||0).toFixed(2)} m · B ${(+pp.beam||0).toFixed(2)} m · D ${(+pp.depth||0).toFixed(2)} m · summer/design draft ${(+pp.designDraft||0).toFixed(3)} m</div><div class="mt-1 ${realCal?'text-emerald-200':'text-cyan-200'}"><b>Integrated:</b> ${v.hydrostatics?.length||0} hydro rows · ${v.knCrossCurves?.length||0} KN ordinates · ${v.cargoSpaces?.length||0} cargo spaces · ${v.ballastTanks?.length||0} ballast tanks · ${v.tankCalibration?.length||0} tank-calibration rows · ${v.structuralLimits?.length||0} SF/BM limit rows.</div>${realCal?`<div class="mt-1 text-cyan-200"><b>Source anchors:</b> published DWT ${(Number(pp.trainingDWT)||0).toLocaleString()} t · GT ${(Number(pp.publishedGT)||0).toLocaleString()} · ${Number(pp.publishedTEU)||0} TEU · summer freeboard ${(+pp.publishedSummerFreeboard||0).toFixed(3)} m.</div><div class="mt-1 text-amber-200"><b>Derived:</b> design Δ ${(Number(pp.designDisplacement)||0).toLocaleString(undefined,{maximumFractionDigits:0})} t · lightship ${(Number(pp.lightshipMass)||0).toLocaleString(undefined,{maximumFractionDigits:0})} t · hydro/KN/tank geometry and training loading conditions.</div>`:''}<div class="mt-1"><b>Training conditions:</b> ${conds.map(c=>escapeHtml(c.name)).join(' · ')}</div><div class="mt-1 text-amber-200"><b>Boundary:</b> ${escapeHtml(v.statutoryDisclaimer||'Synthetic/derived educational data only.')}</div><button onclick="loadAMCOLTrainingVessel('${v.id}')" class="mt-2 w-full py-1.5 rounded ${realCal?'bg-cyan-500/15 border-cyan-500/30 text-cyan-200':'bg-violet-500/15 border-violet-500/30 text-violet-200'} border font-bold"><i class="fa-solid fa-ship mr-1"></i>Load ${realCal?`${escapeHtml(v.companyName)} · `:''}${escapeHtml(v.name)} · Loaded Departure</button>`;return;}
 const depthBadge=r.dataCompleteness?`<span class="text-emerald-300 font-bold">${escapeHtml(r.dataCompleteness)}</span>`:(r.loadingProgramKey==='great_fortune_workbook'?'<span class="text-emerald-300 font-bold">WORKBOOK CONDITION · HYDRO + KN</span>':r.identityVerified===false?'<span class="text-amber-300 font-bold">USER-SUPPLIED ID · SOURCE HYDRO</span>':(r.depthVerified?'<span class="text-emerald-300 font-bold">L/B/D VERIFIED</span>':'<span class="text-amber-300 font-bold">PARTIAL DIMENSIONS — D MODELLED</span>'));
 const type=r.vesselTypeLabel||vesselPresets[r.hullType]?.label||r.hullType;
 const facts=r.officialFacts?`<div class="mt-2 grid grid-cols-2 gap-1">${Object.entries(r.officialFacts).map(([k,v])=>`<div class="rounded bg-slate-950/75 border border-slate-800 px-1.5 py-1"><span class="text-slate-500">${escapeHtml(k)}</span><br><b class="text-slate-200">${escapeHtml(v)}</b></div>`).join('')}</div>`:'';
 box.className='text-[9px] text-slate-300 bg-slate-900/70 border border-cyan-900/50 rounded p-2 leading-relaxed';box.innerHTML=`<div class="flex justify-between gap-2 mb-1"><b class="text-cyan-300">${escapeHtml(r.companyName)} · ${escapeHtml(r.vesselName)} · ${escapeHtml(type)}</b>${depthBadge}</div><div><b>Verified:</b> ${escapeHtml(r.verified)}</div><div class="mt-1">${escapeHtml(r.extra)}</div>${facts}${r.researchBoundary?`<div class="mt-2 rounded border border-amber-500/25 bg-amber-500/5 p-1.5 text-amber-200"><b>Public-data boundary:</b> ${escapeHtml(r.researchBoundary)}</div>`:''}<div class="mt-1 text-amber-200"><b>Physics data note:</b> ${escapeHtml(r.modelNote)}</div><div class="mt-1 text-slate-500"><b>${r.loadingProgramKey?'Source workbook':r.identityVerified===false?'Source / attribution':'Official / class source'}:</b> ${escapeHtml(r.source)}</div>${r.hydroDataKey?`<div class="mt-1 text-cyan-200"><b>Hydrostatic source:</b> ${escapeHtml(hydrostaticDataPacks[r.hydroDataKey]?.label||r.hydroDataKey)}</div>`:''}`;
}
function loadSelectedReferenceVessel(){
 const key=document.getElementById('referenceVesselSelect')?.value;
 const r=referenceVesselPresets[key];if(!r)return;
 if(r.amcolTrainingId){loadAMCOLTrainingVessel(r.amcolTrainingId);return;}
 clearAMCOLTrainingContext();
 if(r.loadingProgramKey==='great_fortune_workbook'){loadGreatFortuneWorkbookCondition();return;}
 prepareReferenceVesselLoad();vesselVisualTransaction=true;
 try{
   state.hydroDataKey='geometry';
   const model=teachingModelForReference(r);
   state.companyName=r.companyName;state.vesselName=r.vesselName;state.hullType=r.hullType;
   state.length=r.length;state.beam=r.beam;state.depth=r.depth;
   state.lightshipMass=model.lightshipMass;state.lightshipKG=model.lightshipKG;state.lightshipTCG=0;state.lightshipLCG=0;state.krRatio=model.krRatio;
   state.waterDepth=Math.max(state.waterDepth,state.depth+8);
   cargoItems=[];
   resetCore();
   state.companyName=r.companyName;state.vesselName=r.vesselName;state.hullType=r.hullType;
   state.length=r.length;state.beam=r.beam;state.depth=r.depth;
   state.lightshipMass=model.lightshipMass;state.lightshipKG=model.lightshipKG;state.lightshipTCG=0;state.lightshipLCG=0;state.krRatio=model.krRatio;
   state.visualReferenceDraft=Number.isFinite(+r.referenceDraft)?+r.referenceDraft:null;state.visualReferenceDraftSource=Number.isFinite(+r.referenceDraft)?'published reference draft':'calculated teaching condition';
   state.waterDepth=Math.max(15,state.depth+8);
   state.hydroDataKey=(r.hydroDataKey&&hydrostaticDataPacks[r.hydroDataKey])?r.hydroDataKey:'geometry';
   const hydroSel=document.getElementById('hydroDataPackSelect');if(hydroSel)hydroSel.value=state.hydroDataKey;
   initialiseEmptyVesselContainers({render:false,revision:false});bumpSpaceLayoutRevision('reference-vessel-load');
   syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});updateHydroDataPackInfo();
   showSelectedReferenceVesselInfo();renderUnifiedMissionPanel();updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('reference-vessel-load');
}

const vesselPresets={
 general:{label:'General cargo ship',length:110,beam:18,depth:10.5,lightshipMass:5200,lightshipKG:5.6,krRatio:.35},
 bulk:{label:'Bulk carrier',length:180,beam:30,depth:16,lightshipMass:12500,lightshipKG:7.2,krRatio:.35},
 container:{label:'Container ship',length:200,beam:32,depth:18,lightshipMass:15500,lightshipKG:9.0,krRatio:.36},
 roro:{label:'Ro-Ro / Ro-Pax',length:170,beam:27,depth:15,lightshipMass:13500,lightshipKG:9.2,krRatio:.38},
 tanker:{label:'Oil tanker',length:190,beam:32,depth:18,lightshipMass:15000,lightshipKG:8.0,krRatio:.35},
 chemical:{label:'Chemical / product tanker',length:145,beam:23,depth:13.5,lightshipMass:8500,lightshipKG:6.8,krRatio:.35},
 lng:{label:'LNG / LPG carrier',length:285,beam:43,depth:26,lightshipMass:30000,lightshipKG:14.0,krRatio:.37},
 osv:{label:'Offshore supply vessel',length:78,beam:18,depth:8,lightshipMass:3400,lightshipKG:4.6,krRatio:.40},
 box:{label:'Box barge',length:80,beam:20,depth:5.5,lightshipMass:2400,lightshipKG:2.6,krRatio:.34}
};

function bumpSpaceLayoutRevision(reason='layout-change'){
 state.spaceLayoutRevision=(Number(state.spaceLayoutRevision)||0)+1;
 state.spaceLayoutFamily=cargoFamilyKey?cargoFamilyKey():state.hullType;
 state.spaceLayoutLabel=vesselPresets[state.hullType]?.label||state.hullType||'Vessel';
 state.spaceLayoutReason=reason;
 if(typeof renderCargoArrangementSchematic==='function')renderCargoArrangementSchematic._sig='';
}
function current3DRuntimePayload(){
 const family=cargoFamilyKey(),cargoSpaces=cargoSpacesWithFill(),ballast=visualBallastTanks(),engine=engineRoomArrangement();
 const cargoIds=cargoSpaces.map(x=>String(x.id||x.name||'')).join(',');
 const tankIds=ballast.map(x=>String(x.id||x.name||'')).join(',');
 const revision=Number(state.spaceLayoutRevision)||0;
 return {
   dynTime,dynamicsRunning,
   cargoItems:cargoItems.map(x=>({...x})),
   ballastTanks:ballast.map(x=>({...x})),
   ballastPlanEnabled:state.ballastPlanEnabled,
   engineRoom:engine?{...engine}:null,
   cargoSpaces:cargoSpaces.map(x=>({...x})),
   spaceLayoutRevision:revision,
   spaceLayoutFamily:family,
   spaceLayoutKey:`${family}|${state.vesselName||'family-template'}|${Number(state.length).toFixed(2)}|${Number(state.beam).toFixed(2)}|${Number(state.depth).toFixed(2)}|R${revision}|C:${cargoIds}|B:${tankIds}`
 };
}
function current3DStateSnapshot(){
 // State is copied before crossing into the module so a later vessel selection cannot mutate an in-flight visual load.
 return {...state,upright:state.upright?{...state.upright}:state.upright,hydro:state.hydro?{...state.hydro}:state.hydro};
}
function report3DVisualError(err,reason='3D sync'){
 const msg=String(err?.message||err||'Unknown 3D error'),now=Date.now();
 if(msg!==last3DVisualError||now-last3DVisualErrorAt>2500){console.error(`AMCOL ${reason}:`,err);last3DVisualError=msg;last3DVisualErrorAt=now;}
 const status=document.getElementById('threeDLoading');
 if(displayMode==='3d'&&status){status.classList.remove('hidden');status.innerHTML='<div class="three-d-control rounded-xl px-4 py-3 text-center"><div class="text-amber-300 font-black text-xs">3D VISUAL RECOVERY</div><div class="text-[9px] text-slate-400 mt-1">The vessel physics remains active. Re-enter 3D or use 2D while the visual scene reloads.</div></div>';}
}
function safeSync3D({hard=false,reason='state-update'}={}){
 const stateSnap=current3DStateSnapshot(),runtime=current3DRuntimePayload();
 window.__AMCOL_PENDING_VISUAL__={state:stateSnap,runtime,reason,revision:renderLifecycleRevision};
 if(!window.AMCOL3D?.ready)return false;
 try{
   const result=hard&&window.AMCOL3D?.hardLoadVesselSnapshot
     ? window.AMCOL3D.hardLoadVesselSnapshot(stateSnap,runtime)
     : window.AMCOL3D?.syncFromSimulator?.(stateSnap,runtime);
   return result!==false;
 }catch(err){report3DVisualError(err,reason);return false;}
}
function safeSync3DPose(reason='physics-pose'){
 if(!window.AMCOL3D?.ready)return false;const stateSnap=current3DStateSnapshot();
 try{if(window.AMCOL3D?.syncPoseFromSimulator)return window.AMCOL3D.syncPoseFromSimulator(stateSnap)!==false;return safeSync3D({hard:false,reason});}catch(err){report3DVisualError(err,reason);return false;}
}
function schedule2DVisualPaint(reason='state-update',attempt=0){
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(displayMode!=='2d'||!canvas||!ctx)return;
   const p=canvas.parentElement,w=p?.clientWidth||p?.getBoundingClientRect?.().width||0,h=p?.clientHeight||p?.getBoundingClientRect?.().height||0;
   if((w<8||h<8)&&attempt<8){setTimeout(()=>schedule2DVisualPaint(reason,attempt+1),40);return;}
   try{resizeCanvas();render();}catch(err){console.error(`AMCOL 2D paint (${reason}) error:`,err);}
 }));
}
function commitVesselVisualRefresh(reason='vessel-change'){
 renderLifecycleRevision++;
 pendingHard3DReload=true;
 // 2D must be correct even when Three.js/CDN/WebGL is unavailable.
 schedule2DVisualPaint(reason);
 if(displayMode==='3d'){
   const ok=safeSync3D({hard:true,reason});
   if(ok)pendingHard3DReload=false;
   try{window.AMCOL3D?.resize?.();}catch(err){report3DVisualError(err,reason);}
 }
 try{window.dispatchEvent(new CustomEvent('amcol:vessel-visual-commit',{detail:{reason,revision:renderLifecycleRevision,hullType:state.hullType}}));}catch(e){}
}
function forceInternalArrangement3DRefresh(){
 // Backwards-compatible entry point used by a few older workflows. A vessel-space change is now a full atomic visual commit.
 commitVesselVisualRefresh('internal-arrangement-refresh');
}
window.AMCOL_GET_RENDER_SNAPSHOT=()=>({state:current3DStateSnapshot(),runtime:current3DRuntimePayload(),revision:renderLifecycleRevision});
function applyVesselFamilyTemplate(next,{announce=true}={}){
 clearAMCOLTrainingContext();
 const p=vesselPresets[next]||vesselPresets.general;
 cancelStabilityTestRuntime();
 vesselVisualTransaction=true;
 try{
   state.hullType=next in vesselPresets?next:'general';
   state.companyName='';state.vesselName='';state.sourceConditionKey=null;state.hydroDataKey='geometry';state.hydroDataReference=null;
   state.length=p.length;state.beam=p.beam;state.depth=p.depth;state.lightshipMass=p.lightshipMass;state.lightshipKG=p.lightshipKG;state.lightshipTCG=0;state.lightshipLCG=0;state.krRatio=p.krRatio;
   state.waterDepth=Math.max(state.depth+5,15);
   initialiseEmptyVesselContainers({render:false,revision:false});
   bumpSpaceLayoutRevision('vessel-family-selection');
   syncFormFromState();renderCargoTable();renderBallastPlan();populateCargoLibraryUI();renderSpaceFillMonitor();
   calculateAll();findAndSetEquilibrium();calculateAll({curve:false});
   updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('vessel-family-selection');
 if(announce&&typeof showCleanFeedback==='function')showCleanFeedback(`${p.label}: hull and family-specific internal arrangement loaded.`);
}

function applyCurrentVesselPreset(){
 clearAMCOLTrainingContext();
 const p=vesselPresets[state.hullType]||vesselPresets.general;
 vesselVisualTransaction=true;
 try{
   state.sourceConditionKey=null;state.hydroDataKey='geometry';state.hydroDataReference=null;
   state.length=p.length;state.beam=p.beam;state.depth=p.depth;
   state.lightshipMass=p.lightshipMass;state.lightshipKG=p.lightshipKG;state.lightshipTCG=0;state.lightshipLCG=0;
   state.krRatio=p.krRatio;state.waterDepth=Math.max(state.depth+5,state.waterDepth);
   initialiseEmptyVesselContainers({render:false,revision:false});bumpSpaceLayoutRevision('apply-family-preset');
   syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});
   updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('apply-family-preset');
}
function getSavedVesselProfiles(){
 try{return JSON.parse(localStorage.getItem('amcol_vessel_profiles_v1')||'{}')}catch(e){return {}}
}
function refreshSavedVesselProfiles(){
 const sel=document.getElementById('savedVesselProfiles');if(!sel)return;
 const data=getSavedVesselProfiles(),cur=sel.value;
 sel.innerHTML='<option value="">No saved profile selected</option>';
 Object.entries(data).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,p])=>{
  const o=document.createElement('option');o.value=k;o.textContent=`${p.companyName||'Company'} · ${p.vesselName||k}`;sel.appendChild(o);
 });
 if(data[cur])sel.value=cur;
}
function saveCurrentVesselProfile(){
 const company=(document.getElementById('inputCompanyName')?.value||'').trim();
 const vessel=(document.getElementById('inputVesselName')?.value||'').trim();
 if(!vessel){alert('Enter a vessel name before saving the profile.');return;}
 state.companyName=company;state.vesselName=vessel;
 const data=getSavedVesselProfiles(),key=`${company||'Company'}::${vessel}`;
 data[key]={companyName:company,vesselName:vessel,hullType:state.hullType,length:state.length,beam:state.beam,depth:state.depth,waterDepth:state.waterDepth,density:state.density,lightshipMass:state.lightshipMass,lightshipKG:state.lightshipKG,lightshipTCG:state.lightshipTCG,lightshipLCG:state.lightshipLCG,krRatio:state.krRatio};
 try{localStorage.setItem('amcol_vessel_profiles_v1',JSON.stringify(data));refreshSavedVesselProfiles();document.getElementById('savedVesselProfiles').value=key;}catch(e){alert('This browser could not save the vessel profile locally.');}
}
function loadSelectedVesselProfile(){
 clearAMCOLTrainingContext();
 const key=document.getElementById('savedVesselProfiles')?.value;if(!key)return;
 const p=getSavedVesselProfiles()[key];if(!p)return;
 cancelStabilityTestRuntime();vesselVisualTransaction=true;
 try{
   Object.assign(state,p);state.sourceConditionKey=null;state.hydroDataKey='geometry';state.hydroDataReference=null;
   initialiseEmptyVesselContainers({render:false,revision:false});bumpSpaceLayoutRevision('saved-vessel-profile');
   syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});
   updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('saved-vessel-profile');
}
function deleteSelectedVesselProfile(){
 const sel=document.getElementById('savedVesselProfiles'),key=sel?.value;if(!key)return;
 const data=getSavedVesselProfiles();delete data[key];
 try{localStorage.setItem('amcol_vessel_profiles_v1',JSON.stringify(data));refreshSavedVesselProfiles();}catch(e){}
}

const stabilityMissions=[
 {
  key:'mission_highkg',
  title:'Top-heavy cargo condition',
  diagnosis:'highkg',
  brief:'After cargo operations, several heavy units have been placed high on deck. The vessel is upright, but the initial stability margin is dangerously small. Diagnose the problem and restore a safe condition.',
  allowed:'You may change the VCG or mass of “Upper deck cargo”. Do not alter lightship data, hull dimensions or water density.',
  target:'Corrected GM ≥ 0.50 m, equilibrium within ±1°, no deck-edge immersion at equilibrium and all IMO teaching-audit checks must pass.',
  hints:[
   'Look at KG and corrected GM. An upright ship can still have inadequate stability.',
   'A vertical movement of weight changes KG without creating a transverse list.',
   'Lower the VCG of the upper deck cargo, or reduce its mass, until GM and the GZ-based audit recover.'
  ],
  apply(){
   resetCore();state.hullType='container';state.length=112;state.beam=20.5;state.depth=12;state.lightshipMass=6300;state.lightshipKG=6.45;
   cargoItems=[{id:201,name:'Lower cargo',mass:2200,vcg:4.1,tcg:0},{id:202,name:'Upper deck cargo',mass:1750,vcg:12.2,tcg:0}];
  },
  check(){
   const imo=evaluateIMO(),eq=hydroAtAngle(state.equilibrium);
   return state.gm>=.50&&Math.abs(state.equilibrium)<=1&&eq&&!eq.invalid&&!eq.deckEdgeImmersed&&imo.every(c=>c.pass);
  }
 },
 {
  key:'mission_list',
  title:'Persistent port list',
  diagnosis:'transverse',
  brief:'The vessel develops a steady port list after a cargo shift. Initial GM remains positive. Correct the transverse imbalance without unnecessarily changing vertical stability.',
  allowed:'Use the Port / Centre / Starboard selector and distance for “Transfer ballast”. Do not delete the shifted cargo.',
  target:'Equilibrium within ±1.0°, corrected GM ≥ 0.30 m and deck edge clear of the water.',
  hints:[
   'A steady list with positive GM points to a transverse moment rather than an angle of loll.',
   'Compare the sign of the shifted cargo TCG with the ballast TCG.',
   'Move the ballast to the opposite side until the total transverse moment is nearly zero.'
  ],
  apply(){
   resetCore();state.hullType='general';state.length=90;state.beam=18;state.depth=11;state.lightshipMass=5000;state.lightshipKG=5.55;
   cargoItems=[{id:211,name:'Shifted cargo',mass:520,vcg:5.0,tcg:-5.2},{id:212,name:'General cargo',mass:1500,vcg:4.0,tcg:0},{id:213,name:'Transfer ballast',mass:500,vcg:2.0,tcg:0}];
  },
  check(){
   const eq=hydroAtAngle(state.equilibrium);
   return Math.abs(state.equilibrium)<=1&&state.gm>=.30&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;
  }
 },
 {
  key:'mission_fse',
  title:'Slack-tank stability loss',
  diagnosis:'fse',
  brief:'During liquid transfer, several tanks are simultaneously slack. The ship has lost a large part of its effective GM even though the solid KG is not unusually high.',
  allowed:'Free Surface must remain enabled. You may change the number of slack tanks and tank fill condition. Do not change hull dimensions or lightship KG.',
  target:'FSE remains enabled, corrected GM ≥ 0.55 m and all IMO teaching-audit checks pass.',
  hints:[
   'Compare KGsolid with KGcorr. The difference is the free-surface correction.',
   'The free surface disappears in this ideal model when a tank is completely full or completely empty.',
   'Sequence the transfer so fewer tanks are slack at the same time.'
  ],
  apply(){
   resetCore();state.hullType='general';state.length=124;state.beam=23;state.depth=13.5;state.lightshipMass=7200;state.lightshipKG=6.2;
   cargoItems=[{id:221,name:'Liquid cargo remaining',mass:4500,vcg:5.2,tcg:0},{id:222,name:'Ballast low',mass:700,vcg:2.0,tcg:0}];
   state.fse=true;state.tankCount=7;state.tankLength=24;state.tankBreadth=7.4;state.tankDensity=.90;state.tankFill=50;
  },
  check(){
   const imo=evaluateIMO();
   return state.fse&&state.gm>=.55&&imo.every(c=>c.pass);
  }
 },
 {
  key:'mission_crane',
  title:'Heavy-lift operation',
  diagnosis:'crane',
  brief:'A project cargo is suspended from the crane and slewed too far to starboard. The hook height also raises the combined KG. Find a safe operating condition without removing the lift.',
  allowed:'Keep the crane enabled and lift mass unchanged. You may change crane outreach and hook height.',
  target:'Crane ON, outreach ≥2.0 m, |equilibrium list| ≤4.0°, corrected GM ≥0.30 m and no deck-edge immersion.',
  hints:[
   'A suspended load acts at the hook, not at its original deck position.',
   'Outreach mainly affects transverse moment; hook height mainly affects KG.',
   'Bring the load closer to the centreline and/or lower the hook while keeping the lift suspended.'
  ],
  apply(){
   resetCore();state.hullType='general';state.length=94;state.beam=19;state.depth=11.5;state.lightshipMass=5200;state.lightshipKG=5.7;
   cargoItems=[{id:231,name:'Fixed project cargo',mass:1200,vcg:4.1,tcg:0}];
   state.crane=true;state.craneMass=120;state.craneHeight=18;state.craneOutreach=8;state.craneSide=1;
  },
  check(){
   const eq=hydroAtAngle(state.equilibrium);
   return state.crane&&state.craneMass===120&&state.craneOutreach>=2&&Math.abs(state.equilibrium)<=4&&state.gm>=.30&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;
  }
 },
 {
  key:'mission_combined',
  title:'Combined stability emergency',
  diagnosis:'combined',
  brief:'The vessel has more than one problem after hurried cargo and ballast operations: high deck cargo, a transverse imbalance and multiple slack tanks. No single correction will be enough.',
  allowed:'You may change “High cargo” VCG, choose the side/distance of “Corrective ballast” and change slack-tank count/fill. Do not change the hull or lightship particulars.',
  target:'|equilibrium list| ≤1.5°, corrected GM ≥0.50 m, FSE controlled and all IMO teaching-audit checks pass.',
  hints:[
   'Do not look for one cause. Compare TCG, KGsolid, FSC and corrected GM.',
   'Correct the transverse moment separately from the vertical/free-surface problems.',
   'A complete solution normally needs ballast TCG correction, lower high cargo and fewer simultaneous slack tanks.'
  ],
  apply(){
   resetCore();state.hullType='container';state.length=116;state.beam=21;state.depth=12.5;state.lightshipMass=6500;state.lightshipKG=6.25;
   cargoItems=[
    {id:241,name:'Base cargo',mass:2100,vcg:4.2,tcg:0},
    {id:242,name:'High cargo',mass:1450,vcg:11.8,tcg:-1.2},
    {id:243,name:'Corrective ballast',mass:600,vcg:2.0,tcg:0}
   ];
   state.fse=true;state.tankCount=5;state.tankLength=20;state.tankBreadth=6.8;state.tankDensity=1.025;state.tankFill=50;
  },
  check(){
   const imo=evaluateIMO(),eq=hydroAtAngle(state.equilibrium);
   return Math.abs(state.equilibrium)<=1.5&&state.gm>=.50&&state.fse&&state.fsc<=.25&&eq&&!eq.invalid&&!eq.deckEdgeImmersed&&imo.every(c=>c.pass);
  }
 }
];

const scenarios={
 baseline:{title:'Baseline general cargo vessel',brief:'A balanced general cargo condition with moderate positive GM. Use it to explore K, B, G, M, GZ and the effect of manually heeling the ship.',tasks:['Record Δ, equivalent draft, KG, KM and corrected GM.','Heel the vessel to 10°, 20° and 30° and compare GZ.','Find the static equilibrium angle and explain why it is close to upright.'],apply(){resetCore();state.hullType='general';state.length=80;state.beam=16;state.depth=10;state.lightshipMass=4200;state.lightshipKG=6.80;cargoItems=[{id:1,name:'Hold cargo',mass:800,vcg:4.0,tcg:0},{id:2,name:'Deck stores',mass:300,vcg:8.5,tcg:0}];}},
 stiff:{title:'Stiff ore / low cargo condition',brief:'Heavy cargo is concentrated low in the vessel. The centre of gravity falls and initial GM becomes relatively large, producing a shorter natural roll period.',tasks:['Compare GM with the baseline condition.','Calculate and record the natural roll period.','Start free roll from 12° and observe the faster restoring motion.'],apply(){resetCore();state.hullType='bulk';state.length=95;state.beam=18;state.depth=11;state.lightshipMass=4300;state.lightshipKG=5.5;cargoItems=[{id:11,name:'Dense ore low',mass:2300,vcg:1.8,tcg:0},{id:12,name:'Bunkers',mass:500,vcg:2.5,tcg:0}];}},
 tender:{title:'Tender container vessel · heavy cargo high',brief:'Upper-tier container weight raises KG and reduces GM. The ship may remain initially stable but will have a smaller stability margin and a longer natural roll period.',tasks:['Compare corrected GM with the baseline.','Move the high cargo VCG down and observe the improvement.','Check the IMO teaching audit before and after the change.'],apply(){resetCore();state.hullType='container';state.length=110;state.beam=18;state.depth=12;state.lightshipMass=6200;state.lightshipKG=8.0;cargoItems=[{id:21,name:'Lower containers',mass:1800,vcg:4.0,tcg:0},{id:22,name:'Upper-tier containers',mass:1800,vcg:11.5,tcg:0}];}},
 ferry:{title:'Ferry passengers shift to port',brief:'A group of passengers moves to port. This creates a transverse centre-of-gravity offset and a static list until the righting arm balances the transverse weight moment.',tasks:['Find the static equilibrium list angle.','Change passenger TCG from -6 m to -3 m and compare the list.','Explain the difference between list and externally forced heel.'],apply(){resetCore();state.hullType='roro';state.length=95;state.beam=19;state.depth=11;state.lightshipMass=6000;state.lightshipKG=6.5;cargoItems=[{id:31,name:'Vehicles',mass:1600,vcg:4.2,tcg:0},{id:32,name:'Passengers to port',mass:180,vcg:9.0,tcg:-8.0}];}},
 tanker:{title:'Tanker discharge · multiple slack tanks',brief:'During cargo transfer, several tanks become slack. The free-surface correction produces a virtual rise of G and reduces corrected GM.',tasks:['Record the uncorrected and corrected GM.','Change tank count from 4 to 1 and compare FSC.','Set tank fill to 100% and explain why the ideal rectangular free-surface correction disappears.'],apply(){resetCore();state.hullType='tanker';state.length=120;state.beam=20;state.depth=13;state.lightshipMass=7000;state.lightshipKG=6.1;cargoItems=[{id:41,name:'Remaining cargo',mass:4500,vcg:5.0,tcg:0},{id:42,name:'Ballast',mass:800,vcg:2.2,tcg:0}];state.fse=true;state.tankCount=6;state.tankLength=25;state.tankBreadth=10;state.tankDensity=0.90;state.tankFill=50;}},
 crane:{title:'Heavy lift slewed outboard',brief:'A suspended load acts at the hook. Raising the hook raises the combined KG; slewing outboard also shifts TCG and creates a list/heeling condition.',tasks:['Find equilibrium with the load over the centreline.','Move the outreach to 6 m starboard and find the new equilibrium.','Increase hook height and explain the change in GM.'],apply(){resetCore();state.hullType='general';state.length=85;state.beam=18;state.depth=11;state.lightshipMass=4700;state.lightshipKG=5.8;cargoItems=[{id:51,name:'General cargo',mass:1200,vcg:4.0,tcg:0}];state.crane=true;state.craneMass=80;state.craneHeight=16;state.craneOutreach=5;state.craneSide=1;}},
 beamsea:{title:'Beam sea rolling · wave encounter',brief:'A container-type vessel meets a beam sea. Use the animated waves and Forced/Synchronous Roll mode to compare natural roll with the encounter period and observe larger responses when the timing is closer to resonance.',tasks:['Enable dynamics and observe the roll trace in a beam sea.','Change wave heading from beam to quartering and compare the response.','Reduce upper-tier cargo or lower KG and explain the effect on the motion.'],apply(){resetCore();state.hullType='container';state.length=115;state.beam=21;state.depth=12;state.lightshipMass=6400;state.lightshipKG=6.4;cargoItems=[{id:56,name:'Lower containers',mass:2200,vcg:4.6,tcg:0},{id:57,name:'Upper-tier containers',mass:1300,vcg:10.8,tcg:0}];state.waveEnabled=true;state.rollMode='forced';state.shipSpeedKts=12;state.waveHeight=2.4;state.waveLength=75;state.waveSpeed=8.824;state.wavePeriod=8.5;state.waveHeading='beam';state.waveGain=1.05;}},
 loll:{title:'Negative GM · angle of loll',brief:'The centre of gravity is raised until initial GM is negative. Upright becomes unstable. The nonlinear hull geometry may provide a non-zero equilibrium angle of loll where GZ returns to zero with a positive slope.',tasks:['Use Find equilibrium and identify the non-zero angle of loll.','Do not correct this case by merely shifting weight transversely. Lower KG instead.','Reduce upper-deck cargo VCG until GM becomes positive.'],apply(){resetCore();state.hullType='general';state.length=80;state.beam=16;state.depth=10;state.lightshipMass=4200;state.lightshipKG=7.0;cargoItems=[{id:61,name:'High deck cargo',mass:1500,vcg:8.95,tcg:0},{id:62,name:'Stores',mass:300,vcg:8.0,tcg:0}];}},
 damage:{title:'Starboard side compartment flooding',brief:'A side-damage case demonstrating two teaching methods. Added-weight flooding increases displacement and shifts G. Lost-buoyancy mode removes a damaged compartment contribution from buoyancy and shifts B.',tasks:['Compare added-weight and lost-buoyancy results.','Record equilibrium list, draft and residual GM.','Explain why the result must not be used to invent a counter-flooding action.'],apply(){resetCore();state.hullType='general';state.length=90;state.beam=18;state.depth=11;state.lightshipMass=5000;state.lightshipKG=5.7;cargoItems=[{id:71,name:'Cargo',mass:1600,vcg:4.0,tcg:0}];state.damage=true;state.damageMode='lost';state.damageSide=1;state.damageWidth=24;state.damageHeight=60;state.damagePerm=.95;}},
 ukc:{title:'Restricted under-keel clearance',brief:'The vessel is in restricted water depth. This simulator checks geometric UKC and grounding risk only; speed-dependent squat is deliberately not fabricated.',tasks:['Record the equivalent draft and UKC.','Increase cargo until UKC falls below 0.5 m.','Explain why a real transit also needs a separate squat allowance and company/port UKC criteria.'],apply(){resetCore();state.hullType='general';state.length=85;state.beam=17;state.depth=10.5;state.waterDepth=6.0;state.lightshipMass=4500;state.lightshipKG=5.6;cargoItems=[{id:81,name:'Cargo',mass:1800,vcg:4.0,tcg:0}];}},
 freshwater:{title:'Seawater → freshwater transition',brief:'For the same displacement, lower water density requires more displaced volume and therefore a deeper draft. The simulator re-solves the hull geometry rather than only applying an allowance formula.',tasks:['Record draft and TPC in seawater.','Change density to 1.000 t/m³ and compare the new draft.','Compare the exact draft change with the displayed standard FWA approximation.'],apply(){resetCore();state.hullType='box';state.length=80;state.beam=15;state.depth=6;state.lightshipMass=3400;state.lightshipKG=3.2;cargoItems=[{id:91,name:'Cargo',mass:905,vcg:2.4,tcg:0}];state.density=1.025;}},
 ballastfix:{
  title:'Challenge · correct a port list',
  brief:'Cargo has shifted to port and the vessel has a persistent list. Re-position the movable ballast item transversely to bring the vessel nearly upright without sacrificing minimum initial stability.',
  goal:'Bring the static equilibrium angle to within ±1.0° while keeping corrected GM ≥ 0.30 m. You may edit the Ballast transfer TCG but should not delete the shifted cargo.',
  tasks:['Press Find equilibrium and record the initial port list.','Edit the ballast TCG to oppose the cargo moment.','Keep checking equilibrium and GM until both target limits are satisfied.'],
  check(){const pass=Math.abs(state.equilibrium)<=1.0&&state.gm>=0.30;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m. Target: |list| ≤ 1.0° and GM ≥ 0.30 m.`};},
  apply(){resetCore();state.hullType='general';state.length=88;state.beam=18;state.depth=11;state.lightshipMass=4800;state.lightshipKG=5.6;cargoItems=[{id:101,name:'Shifted cargo to port',mass:420,vcg:5.2,tcg:-5.0},{id:102,name:'General cargo',mass:1300,vcg:4.0,tcg:0},{id:103,name:'Ballast transfer',mass:450,vcg:2.0,tcg:0}];}
 },
 slackrecover:{
  title:'Challenge · recover stability with slack tanks',
  brief:'A tanker transfer stage has too many slack tanks and a reduced corrected GM. Improve the condition by changing the number/fill state of slack tanks without simply disabling the free-surface model.',
  goal:'Keep Free Surface enabled, reduce FSC to ≤0.05 m and keep corrected GM ≥0.50 m by sequencing tanks rather than disabling FSE.',
  tasks:['Record FSM, FSC and corrected GM.','Reduce the number of simultaneous slack tanks or make tanks full/empty in sequence.','Check that Free Surface remains enabled when you submit.'],
  check(){const pass=state.fse&&state.fsc<=.05&&state.gm>=.50;return {pass,message:`FSE ${state.fse?'ON':'OFF'} · FSC ${state.fsc.toFixed(3)} m · GM ${state.gm.toFixed(3)} m. Target FSC ≤0.05 m.`};},
  apply(){resetCore();state.hullType='general';state.length=125;state.beam=23;state.depth=13.5;state.lightshipMass=7200;state.lightshipKG=6.4;cargoItems=[{id:111,name:'Remaining liquid cargo',mass:4200,vcg:5.4,tcg:0},{id:112,name:'Low ballast',mass:700,vcg:2.0,tcg:0}];state.fse=true;state.tankCount=6;state.tankLength=24;state.tankBreadth=7.2;state.tankDensity=.90;state.tankFill=50;}
 },
 deckcargolimit:{
  title:'Challenge · high deck cargo stability',
  brief:'A container loading proposal has placed too much weight high. Adjust the upper-tier cargo VCG or mass until the vessel recovers an acceptable teaching margin.',
  goal:'Reconfigure the upper-tier proposal to VCG ≤8.0 m and mass ≤1,200 t while keeping corrected GM ≥0.50 m and the IMO teaching audit passing.',
  tasks:['Check the initial GM and IMO panel.','Lower the upper-tier VCG or reduce the proposed upper-tier mass.','Stop when GM and all teaching-audit checks pass.'],
  check(){const imo=evaluateIMO(),it=itemByName('Upper-tier proposal');const pass=!!it&&it.vcg<=8&&it.mass<=1200&&state.gm>=.50&&imo.every(x=>x.pass);return {pass,message:`Upper-tier ${it?it.mass.toFixed(0):'—'} t @ VCG ${it?it.vcg.toFixed(1):'—'} m · GM ${state.gm.toFixed(3)} m · IMO ${imo.every(x=>x.pass)?'PASS':'NOT YET'}.`};},
  apply(){resetCore();state.hullType='container';state.length=118;state.beam=21;state.depth=12.5;state.lightshipMass=6500;state.lightshipKG=6.5;cargoItems=[{id:121,name:'Lower containers',mass:2300,vcg:4.1,tcg:0},{id:122,name:'Upper-tier proposal',mass:1700,vcg:12.4,tcg:0}];}
 },
 heavyoutreach:{
  title:'Challenge · heavy-lift safe outreach',
  brief:'A suspended project cargo load is being slewed to starboard. Determine an outreach that keeps both the static list and the remaining GM within the exercise limits.',
  goal:'Keep the crane enabled with outreach 2–4 m, |equilibrium list| ≤1.0° and corrected GM ≥0.30 m.',
  tasks:['Start with the given hook height and load.','Change outreach and use Find equilibrium after each change.','Find the largest outreach you can while remaining inside both limits.'],
  check(){const pass=state.crane&&state.craneOutreach>=2&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=1&&state.gm>=.30;return {pass,message:`Outreach ${state.craneOutreach.toFixed(1)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m. Target outreach 2–4 m and |list| ≤1.0°.`};},
  apply(){resetCore();state.hullType='general';state.length=92;state.beam=19;state.depth=11.5;state.lightshipMass=5100;state.lightshipKG=5.7;cargoItems=[{id:131,name:'Fixed project cargo',mass:1100,vcg:4.0,tcg:0}];state.crane=true;state.craneMass=110;state.craneHeight=17;state.craneOutreach=7;state.craneSide=1;}
 },
 waveavoid:{
  title:'Challenge · avoid roll resonance',
  brief:'The regular-wave period is initially close to the vessel natural roll period. Change wavelength, celerity or loading so the forcing period moves away from the natural roll period.',
  goal:'Keep waves enabled and make the regular-wave period differ from the natural roll period by at least 25%. The starting condition is intentionally near resonance.',
  tasks:['Record the natural roll period and encounter period.','Change λ, c, ship speed or heading and observe the encounter period.','Use Forced / Synchronous Roll to compare the motion before and after your adjustment.'],
  check(){const Tr=state.naturalPeriod,Te=calculateEncounterPeriod();const sep=Tr&&Number.isFinite(Te)?Math.abs(Te-Tr)/Tr:0;const pass=state.waveEnabled&&Tr&&Number.isFinite(Te)&&sep>=.25;return {pass,message:`Natural roll ${Tr?Tr.toFixed(2):'N/A'} s · encounter period ${Number.isFinite(Te)?Te.toFixed(2):'N/A'} s · separation ${(sep*100).toFixed(1)}%. Target: ≥25%.`};},
  apply(){resetCore();state.hullType='container';state.length=112;state.beam=21;state.depth=12;state.lightshipMass=6300;state.lightshipKG=6.1;cargoItems=[{id:141,name:'Containers low',mass:2000,vcg:4.3,tcg:0},{id:142,name:'Containers high',mass:900,vcg:9.8,tcg:0}];state.waveEnabled=true;state.rollMode='forced';state.waveHeading='beam';state.waveHeight=2.2;state.waveLength=54.4;state.waveSpeed=8.5;state.wavePeriod=6.4;state.waveGain=1;}
 },
 ukcloadchallenge:{
  title:'Challenge · load to a safe UKC window',
  brief:'A vessel is loading in restricted water. Adjust the cargo mass so the final geometric UKC is close to 1.0 m while retaining positive minimum initial stability.',
  goal:'Achieve UKC between 0.80 m and 1.20 m and corrected GM ≥ 0.15 m. This is a geometric exercise only; squat is not included.',
  tasks:['Record starting draft and UKC.','Adjust the Loading cargo mass.','Keep the final GM above the exercise minimum.'],
  check(){const pass=state.ukc>=.8&&state.ukc<=1.2&&state.gm>=.15;return {pass,message:`UKC ${state.ukc.toFixed(2)} m · GM ${state.gm.toFixed(3)} m. Target: 0.80–1.20 m UKC and GM ≥0.15 m.`};},
  apply(){resetCore();state.hullType='general';state.length=82;state.beam=17;state.depth=10;state.waterDepth=6.3;state.lightshipMass=4300;state.lightshipKG=5.3;cargoItems=[{id:151,name:'Loading cargo',mass:1300,vcg:4.0,tcg:0}];}
 },
 freshwaterchallenge:{
  title:'Challenge · freshwater arrival',
  brief:'The vessel enters freshwater at the same displacement and sinks deeper. Adjust the cargo condition if necessary so the final freshwater UKC stays above the exercise minimum.',
  goal:'Set water density to freshwater (1.000 t/m³) and keep UKC ≥ 1.50 m and corrected GM ≥ 0.15 m.',
  tasks:['Record the seawater draft before changing density.','Change density to 1.000 t/m³.','If UKC is inadequate, reduce the movable cargo mass and re-check.'],
  check(){const pass=state.density<=1.001&&state.ukc>=1.5&&state.gm>=.15;return {pass,message:`ρ ${state.density.toFixed(3)} t/m³ · UKC ${state.ukc.toFixed(2)} m · GM ${state.gm.toFixed(3)} m. Target: freshwater, UKC ≥1.50 m, GM ≥0.15 m.`};},
  apply(){resetCore();state.hullType='box';state.length=78;state.beam=15;state.depth=6.2;state.waterDepth=5.5;state.lightshipMass=3300;state.lightshipKG=3.15;cargoItems=[{id:161,name:'Movable cargo',mass:1200,vcg:2.6,tcg:0}];state.density=1.025;}
 },
 galecontainer:{
  title:'Weather challenge · container ship in gale crosswind',
  brief:'A container ship is exposed to a strong beam wind. Test the environmental equilibrium, then improve the condition by lowering high cargo or reducing wind exposure/heading in the teaching model.',
  goal:'Keep wind enabled at 37 kn, reduce environmental heeling arm to ≤0.020 m, keep |equilibrium| ≤2°, GM ≥0.50 m and deck edge clear.',
  tasks:['Load the condition and press TEST STABILITY.','Observe the cyan environmental heeling-arm line on the GZ chart.','Lower the upper-tier cargo VCG or change to a less severe wind direction and test again.'],
  check(){const eq=hydroAtAngle(state.equilibrium);const pass=state.windEnabled&&state.windSpeedKts>=36&&Math.abs(state.environmentHeelingArm)<=.020&&Math.abs(state.equilibrium)<=2&&state.gm>=.50&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;return {pass,message:`Wind ${state.windSpeedKts.toFixed(0)} kn · env arm ${state.environmentHeelingArm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='container';state.length=200;state.beam=32;state.depth=18;state.lightshipMass=15500;state.lightshipKG=9.0;cargoItems=[{id:171,name:'Lower containers',mass:7000,vcg:6.0,tcg:0},{id:172,name:'Upper-tier containers',mass:3500,vcg:15.0,tcg:0}];state.weatherPreset='gale';state.windEnabled=true;state.windSpeedKts=37;state.gustFactor=1.20;state.windDirection='port_to_starboard';state.rainIntensity=.30;state.visibilityNm=5;}
 },
 squallroro:{
  title:'Weather challenge · Ro-Ro in heavy squall',
  brief:'A high-sided Ro-Ro/Ro-Pax encounters a heavy squall. The gust multiplier increases the effective wind pressure while rain reduces visibility.',
  goal:'Keep squall wind enabled, reduce environmental heeling arm to ≤0.030 m, keep |equilibrium| ≤2° and GM ≥0.50 m.',
  tasks:['Run TEST STABILITY in the initial squall.','Compare mean wind with gust multiplier and wind-heeling moment.','Lower movable deck load or change heading away from beam wind, then retest.'],
  check(){const pass=state.windEnabled&&state.gustFactor>=1.3&&Math.abs(state.environmentHeelingArm)<=.0010&&Math.abs(state.equilibrium)<=2&&state.gm>=.50;return {pass,message:`Squall ${state.windSpeedKts.toFixed(0)} kn × ${state.gustFactor.toFixed(2)} · env arm ${state.environmentHeelingArm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='roro';state.length=170;state.beam=27;state.depth=15;state.lightshipMass=13500;state.lightshipKG=9.2;cargoItems=[{id:181,name:'Vehicle deck load',mass:5000,vcg:8.5,tcg:0},{id:182,name:'Upper deck load',mass:1300,vcg:13.3,tcg:0}];state.weatherPreset='squall';state.windEnabled=true;state.windSpeedKts=42;state.gustFactor=1.40;state.windDirection='starboard_to_port';state.rainIntensity=.85;state.visibilityNm=2;}
 },
 currenttanker:{
  title:'Ocean challenge · tanker in transverse current',
  brief:'A tanker is treated as stationary/moored while a strong transverse current acts on the underwater lateral area. Explore how the current-induced moment shifts the equilibrium.',
  goal:'Keep current enabled at ≥2.0 kn, reduce environmental heeling arm to ≤0.002 m, keep |equilibrium| ≤2° and GM ≥0.30 m.',
  tasks:['Run TEST STABILITY with the initial transverse current.','Compare current force direction with the resulting heel.','Adjust ballast distribution or current-relative heading and retest.'],
  check(){const pass=state.currentEnabled&&state.currentSpeedKts>=2&&Math.abs(state.environmentHeelingArm)<=.002&&Math.abs(state.equilibrium)<=2&&state.gm>=.30;return {pass,message:`Current ${state.currentSpeedKts.toFixed(1)} kn · env arm ${state.environmentHeelingArm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='tanker';state.length=190;state.beam=32;state.depth=18;state.lightshipMass=15000;state.lightshipKG=8.0;cargoItems=[{id:191,name:'Remaining cargo',mass:18000,vcg:7.5,tcg:0},{id:192,name:'Ballast',mass:4500,vcg:2.5,tcg:0}];state.currentEnabled=true;state.currentSpeedKts=2.4;state.currentDirection='port_to_starboard';state.oceanPreset='standard';}
 }
};


// ------------------------------------------------------------------
// Expanded Student Challenge Bank
// 25 auto-check challenge scenarios total.
// ------------------------------------------------------------------
Object.assign(scenarios,{
 cargo_stbd_shift:{
  title:'Challenge 05 · Correct a starboard cargo shift',
  brief:'A machinery unit has shifted to starboard during heavy rolling. Use the corrective ballast to remove the list without deleting the shifted load.',
  goal:'Bring |equilibrium list| to ≤1.0° and keep corrected GM ≥0.30 m.',
  tasks:['Run TEST STABILITY and identify the direction of list.','Move only the Corrective ballast using Side + Distance.','Retest until the target is achieved.'],
  check(){const pass=Math.abs(state.equilibrium)<=1&&state.gm>=.30;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=90;state.beam=18;state.depth=11;state.lightshipMass=5000;state.lightshipKG=5.4;cargoItems=[{id:301,name:'Fixed cargo',mass:1300,vcg:4.0,tcg:0},{id:302,name:'Shifted machinery',mass:450,vcg:5.0,tcg:5.0},{id:303,name:'Corrective ballast',mass:500,vcg:2.0,tcg:0}];}
 },
 passenger_roro:{
  title:'Challenge 06 · Ro-Ro passenger crowd shift',
  brief:'Passengers have moved to the starboard side of a Ro-Ro/Ro-Pax vessel. Correct the list using ballast while keeping the passenger group in place.',
  goal:'Achieve |equilibrium list| ≤0.50° and corrected GM ≥0.50 m.',
  tasks:['Observe the list created by the passenger group.','Place Transfer ballast on the opposite side.','Find equilibrium and TEST STABILITY.'],
  check(){const pass=Math.abs(state.equilibrium)<=.50&&state.gm>=.50;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m · target |list| ≤0.50°.`};},
  apply(){resetCore();state.hullType='roro';state.length=170;state.beam=27;state.depth=15;state.lightshipMass=13500;state.lightshipKG=9.0;cargoItems=[{id:311,name:'Vehicle deck load',mass:5000,vcg:8.0,tcg:0},{id:312,name:'Passenger crowd',mass:350,vcg:12.5,tcg:6.0},{id:313,name:'Transfer ballast',mass:600,vcg:2.0,tcg:0}];}
 },
 ballast_highkg:{
  title:'Challenge 07 · Recover GM with low ballast',
  brief:'A ballast condition has left too much weight high in the vessel. Correct the vertical distribution without changing the hull.',
  goal:'Transfer Corrective ballast to VCG ≤3.0 m, keep |list| ≤1° and GM ≥2.5 m for this teaching vessel.',
  tasks:['Compare KG and GM before correction.','Lower the VCG of Corrective ballast to represent transferring ballast into a lower tank.','Retest the condition.'],
  check(){const it=itemByName('Corrective ballast');const pass=!!it&&it.vcg<=3&&state.gm>=2.5&&Math.abs(state.equilibrium)<=1;return {pass,message:`Corrective ballast VCG ${it?it.vcg.toFixed(2):'—'} m · KGcorr ${state.kgCorr.toFixed(3)} m · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=100;state.beam=20;state.depth=12;state.lightshipMass=6000;state.lightshipKG=6.5;cargoItems=[{id:321,name:'High deck cargo',mass:1800,vcg:11.0,tcg:0},{id:322,name:'Corrective ballast',mass:1200,vcg:8.0,tcg:0}];}
 },
 bulk_ore_asym:{
  title:'Challenge 08 · Bulk carrier asymmetric ore load',
  brief:'A dense ore parcel is concentrated on the port side. Use low ballast on the opposite side to reduce the transverse moment.',
  goal:'Achieve |equilibrium list| ≤1.5° and corrected GM ≥0.50 m.',
  tasks:['Identify the port transverse moment.','Move Corrective ballast to starboard and choose a suitable distance.','TEST STABILITY after each adjustment.'],
  check(){const pass=Math.abs(state.equilibrium)<=1.5&&state.gm>=.50;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='bulk';state.length=180;state.beam=30;state.depth=16;state.lightshipMass=12500;state.lightshipKG=7.2;cargoItems=[{id:331,name:'Ore parcel port',mass:8000,vcg:4.0,tcg:-4.0},{id:332,name:'Centre ore',mass:8000,vcg:4.0,tcg:0},{id:333,name:'Corrective ballast',mass:2500,vcg:2.0,tcg:0}];}
 },
 barge_deckload:{
  title:'Challenge 09 · Barge deck-load correction',
  brief:'A heavy deck unit is both high and off-centre on a deck cargo barge. Correct its position to improve list and GM.',
  goal:'Achieve |equilibrium list| ≤2.0°, corrected GM ≥0.30 m and keep the deck edge clear.',
  tasks:['Move the Deck unit toward centreline.','Lower its VCG to represent placing it directly on deck rather than on supports.','TEST STABILITY.'],
  check(){const eq=hydroAtAngle(state.equilibrium);const pass=state.equilibriumValid&&Math.abs(state.equilibrium)<=2&&state.gm>=.30&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m · UKC ${state.ukc.toFixed(2)} m · equilibrium root ${state.equilibriumValid?'VALID':'NOT FOUND'}.`};},
  apply(){resetCore();state.hullType='box';state.length=54.9;state.beam=16.5;state.depth=3.8;state.lightshipMass=2400;state.lightshipKG=2.0;state.waterDepth=8;cargoItems=[{id:341,name:'Deck unit',mass:800,vcg:4.0,tcg:5.5},{id:342,name:'Deck stores',mass:250,vcg:3.0,tcg:0}];}
 },
 osv_deck_cargo:{
  title:'Challenge 10 · OSV deck cargo and current',
  brief:'An offshore supply vessel carries an off-centre deck load while a transverse current is acting. Correct the cargo condition while keeping the current active.',
  goal:'Current remains ON at ≥1.5 kn, |environmental equilibrium| ≤4° and corrected GM ≥0.30 m.',
  tasks:['Observe both cargo and current effects.','Move Deck cargo toward centre and reduce its VCG if required.','Retest with current still active.'],
  check(){const pass=state.currentEnabled&&state.currentSpeedKts>=1.5&&Math.abs(state.equilibrium)<=4&&state.gm>=.30;return {pass,message:`Current ${state.currentSpeedKts.toFixed(1)} kn · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='osv';state.length=89.1;state.beam=18.8;state.depth=7.6;state.lightshipMass=3400;state.lightshipKG=4.6;cargoItems=[{id:351,name:'Deck cargo',mass:700,vcg:6.5,tcg:-4.0},{id:352,name:'Low ballast',mass:500,vcg:1.6,tcg:0}];state.currentEnabled=true;state.currentSpeedKts=1.8;state.currentDirection='starboard_to_port';}
 },
 density_ballast:{
  title:'Challenge 11 · Brackish-water UKC correction',
  brief:'The vessel enters lower-density brackish water in a restricted channel. Reduce movable cargo enough to maintain the required UKC.',
  goal:'Water density ≤1.010 t/m³, UKC ≥1.20 m and corrected GM ≥0.20 m.',
  tasks:['Record draft in seawater.','Set brackish water density and observe increased draft.','Reduce Movable cargo mass until UKC is safe.'],
  check(){const pass=state.density<=1.0105&&state.ukc>=1.2&&state.gm>=.20;return {pass,message:`ρ ${state.density.toFixed(3)} · draft ${state.eqDraft.toFixed(2)} m · UKC ${state.ukc.toFixed(2)} m · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=80;state.beam=16;state.depth=10;state.waterDepth=6.1;state.lightshipMass=4200;state.lightshipKG=5.5;cargoItems=[{id:361,name:'Movable cargo',mass:1400,vcg:4.0,tcg:0}];state.density=1.010;state.oceanPreset='brackish';}
 },
 crane_port:{
  title:'Challenge 14 · Port-side crane lift',
  brief:'A heavy suspended load is high and far out on the port side. Keep the lift suspended but find a safer hook height and outreach.',
  goal:'Crane remains ON on PORT, outreach 2–4 m, |equilibrium list| ≤4° and corrected GM ≥0.30 m.',
  tasks:['Keep crane load unchanged.','Reduce outreach and hook height.','Find equilibrium and TEST STABILITY.'],
  check(){const pass=state.crane&&state.craneSide===-1&&state.craneOutreach>=2&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=4&&state.gm>=.30;return {pass,message:`Port outreach ${state.craneOutreach.toFixed(1)} m · hook ${state.craneHeight.toFixed(1)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=95;state.beam=19;state.depth=11.5;state.lightshipMass=5200;state.lightshipKG=5.7;cargoItems=[{id:371,name:'Fixed project cargo',mass:1200,vcg:4.1,tcg:0}];state.crane=true;state.craneMass=140;state.craneHeight=18;state.craneOutreach=8;state.craneSide=-1;}
 },
 crane_weather:{
  title:'Challenge 15 · Crane lift with crosswind',
  brief:'A suspended project load is slewed to starboard while a crosswind acts in the same general direction. Correct the operation without cancelling the wind.',
  goal:'Keep wind ≥25 kn and crane ON. Slew crane to Centre/Port, reduce outreach to ≤4 m, keep |environmental equilibrium| ≤2° and GM ≥0.35 m.',
  tasks:['Compare crane transverse moment with wind heeling moment.','Move the crane through centre or to the opposite side and lower hook height.','Keep the wind enabled and TEST STABILITY.'],
  check(){const pass=state.windEnabled&&state.windSpeedKts>=25&&state.crane&&state.craneSide<=0&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=2&&state.gm>=.35;return {pass,message:`Wind ${state.windSpeedKts.toFixed(0)} kn · crane ${state.craneSide===1?'STBD':state.craneSide===-1?'PORT':'CENTRE'} ${state.craneOutreach.toFixed(1)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=100;state.beam=20;state.depth=12;state.lightshipMass=6000;state.lightshipKG=6.0;cargoItems=[{id:381,name:'Low cargo',mass:2000,vcg:4.0,tcg:0}];state.crane=true;state.craneMass=120;state.craneHeight=16;state.craneOutreach=6;state.craneSide=1;state.weatherPreset='strong';state.windEnabled=true;state.windSpeedKts=25;state.gustFactor=1.12;state.windDirection='port_to_starboard';}
 },
 tanker_fse_current:{
  title:'Challenge 16 · Tanker free surface + current',
  brief:'A tanker has several slack tanks while a transverse current is acting. Solve both the free-surface loss and the environmental list.',
  goal:'Keep FSE and current ON, current ≥2.0 kn, reduce FSC to ≤0.05 m, keep |environmental equilibrium| ≤2° and GM ≥0.40 m.',
  tasks:['Reduce simultaneous slack tanks or complete tank filling.','Use Corrective ballast if current still creates excessive equilibrium heel.','TEST STABILITY with current and FSE still enabled.'],
  check(){const pass=state.fse&&state.currentEnabled&&state.currentSpeedKts>=2&&state.fsc<=.05&&state.gm>=.40&&Math.abs(state.equilibrium)<=2;return {pass,message:`FSC ${state.fsc.toFixed(3)} m · current ${state.currentSpeedKts.toFixed(1)} kn · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='tanker';state.length=190;state.beam=32;state.depth=18;state.lightshipMass=15000;state.lightshipKG=8.0;cargoItems=[{id:391,name:'Remaining cargo',mass:18000,vcg:7.5,tcg:0},{id:392,name:'Corrective ballast',mass:4500,vcg:2.5,tcg:0}];state.fse=true;state.tankCount=6;state.tankLength=24;state.tankBreadth=8;state.tankDensity=.90;state.tankFill=50;state.currentEnabled=true;state.currentSpeedKts=2.2;state.currentDirection='port_to_starboard';}
 },
 lng_ballast:{
  title:'Challenge 17 · LNG carrier ballast list',
  brief:'A low ballast parcel has been placed off-centre during cargo operations. Return the vessel near upright while maintaining good initial stability.',
  goal:'Achieve |equilibrium list| ≤1° and corrected GM ≥0.40 m.',
  tasks:['Identify the ballast TCG causing the list.','Move Transfer ballast to centreline or balance it appropriately.','TEST STABILITY.'],
  check(){const pass=Math.abs(state.equilibrium)<=1&&state.gm>=.40;return {pass,message:`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='lng';state.length=295;state.beam=45;state.depth=26.25;state.lightshipMass=30000;state.lightshipKG=14.0;cargoItems=[{id:401,name:'LNG cargo equivalent',mass:50000,vcg:12.0,tcg:0},{id:402,name:'Transfer ballast',mass:6000,vcg:4.0,tcg:-6.0}];}
 },
 container_wind_wave:{
  title:'Challenge 22 · Container ship wind + waves',
  brief:'A container ship carries high upper-tier cargo while exposed to crosswind and beam waves. Correct the loading and environmental exposure.',
  goal:'Keep wind and waves ON, reduce environmental arm to ≤0.020 m, use a non-beam wave heading, keep GM ≥0.50 m and wave period ≥20% away from natural roll.',
  tasks:['Lower upper-tier cargo VCG.','Change wind/wave heading or wave kinematics to avoid excessive response.','Run the animated TEST STABILITY.'],
  check(){const Te=calculateEncounterPeriod(),sep=state.naturalPeriod&&Number.isFinite(Te)?Math.abs(Te-state.naturalPeriod)/state.naturalPeriod:0;const pass=state.windEnabled&&state.waveEnabled&&state.waveHeading!=='beam'&&Math.abs(state.environmentHeelingArm)<=.020&&state.gm>=.50&&Math.abs(state.equilibrium)<=2&&sep>=.20;return {pass,message:`GM ${state.gm.toFixed(3)} m · env arm ${state.environmentHeelingArm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · wave ${state.waveHeading} · encounter separation ${(sep*100).toFixed(0)}%.`};},
  apply(){resetCore();state.hullType='container';state.length=200;state.beam=32;state.depth=18;state.lightshipMass=15500;state.lightshipKG=9.0;cargoItems=[{id:411,name:'Lower containers',mass:7000,vcg:6.0,tcg:0},{id:412,name:'Upper-tier containers',mass:4000,vcg:15.5,tcg:0}];state.waveEnabled=true;state.rollMode='forced';state.waveHeight=3;state.waveLength=90;state.waveSpeed=9;state.wavePeriod=10;state.waveHeading='beam';state.weatherPreset='gale';state.windEnabled=true;state.windSpeedKts=35;state.gustFactor=1.18;state.windDirection='port_to_starboard';}
 },
 roro_vehicle_shift:{
  title:'Challenge 23 · Ro-Ro vehicle shift + squall',
  brief:'Vehicles have shifted to starboard at the same time as a severe squall. Correct the cargo distribution while keeping the squall active.',
  goal:'Keep squall wind ≥40 kn, reduce environmental arm to ≤0.030 m, keep |equilibrium| ≤1.5° and GM ≥0.50 m.',
  tasks:['Move Shifted vehicles closer to centreline.','Lower their VCG if the load can be resecured on the vehicle deck.','Retest under the active squall.'],
  check(){const pass=state.windEnabled&&state.windSpeedKts>=40&&Math.abs(state.environmentHeelingArm)<=.030&&Math.abs(state.equilibrium)<=1.5&&state.gm>=.50;return {pass,message:`Wind ${state.windSpeedKts.toFixed(0)} kn · env arm ${state.environmentHeelingArm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='roro';state.length=170;state.beam=27;state.depth=15;state.lightshipMass=13500;state.lightshipKG=9.0;cargoItems=[{id:421,name:'Base vehicle load',mass:4000,vcg:8.0,tcg:0},{id:422,name:'Shifted vehicles',mass:1800,vcg:10.0,tcg:5.0},{id:423,name:'Low ballast',mass:1200,vcg:2.0,tcg:0}];state.weatherPreset='squall';state.windEnabled=true;state.windSpeedKts=42;state.gustFactor=1.4;state.windDirection='starboard_to_port';state.rainIntensity=.85;state.visibilityNm=2;}
 },
 damage_counterballast:{
  title:'Challenge 24 · Flooding list correction',
  brief:'Added floodwater on starboard creates an emergency transverse moment. Use low corrective ballast on port while keeping the damage active.',
  goal:'Damage remains ON, |equilibrium list| ≤3°, corrected GM ≥0.30 m and deck edge remains clear.',
  tasks:['Observe the effect of added floodwater.','Move Emergency ballast to PORT and choose an appropriate distance.','Keep damage active and TEST STABILITY.'],
  check(){const eq=hydroAtAngle(state.equilibrium);const pass=state.damage&&Math.abs(state.equilibrium)<=3&&state.gm>=.30&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;return {pass,message:`Damage ON · equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m.`};},
  apply(){resetCore();state.hullType='general';state.length=90;state.beam=18;state.depth=11;state.lightshipMass=5000;state.lightshipKG=5.5;cargoItems=[{id:431,name:'Fixed cargo',mass:1500,vcg:4.0,tcg:0},{id:432,name:'Emergency ballast',mass:700,vcg:2.0,tcg:0}];state.damage=true;state.damageMode='added';state.dmgMass=700;state.dmgVCG=3.0;state.dmgTCG=6.0;}
 },
 lollrecovery:{
  title:'Challenge 25 · Recover from negative GM / angle of loll',
  brief:'High cargo has raised G enough to produce negative initial GM. Do not try to correct the angle by transverse ballast alone — first recover positive GM.',
  goal:'Corrected GM ≥0.30 m, |equilibrium list| ≤1° and all IMO teaching-audit checks pass.',
  tasks:['Confirm that initial GM is negative or dangerously small.','Lower the VCG or reduce the mass of High cargo.','Only after recovering positive GM, TEST STABILITY.'],
  check(){const imo=evaluateIMO();const pass=state.gm>=.30&&Math.abs(state.equilibrium)<=1&&imo.every(c=>c.pass);return {pass,message:`KGcorr ${state.kgCorr.toFixed(3)} m · GM ${state.gm.toFixed(3)} m · equilibrium ${state.equilibrium.toFixed(2)}° · IMO ${imo.every(c=>c.pass)?'PASS':'FAIL'}.`};},
  apply(){resetCore();state.hullType='general';state.length=80;state.beam=16;state.depth=10;state.lightshipMass=4200;state.lightshipKG=7.0;cargoItems=[{id:441,name:'Lower cargo',mass:300,vcg:8.0,tcg:0},{id:442,name:'High cargo',mass:1500,vcg:8.95,tcg:0}];}
 }
});



function itemByName(name){return cargoItems.find(x=>x.name===name);}
function setItemTCG(name,tcg){const it=itemByName(name);if(it)it.tcg=tcg;}
function setItemVCG(name,vcg){const it=itemByName(name);if(it)it.vcg=vcg;}
function setItemMass(name,mass){const it=itemByName(name);if(it)it.mass=mass;}
function refreshAfterReferenceSolution(){syncFormFromState();renderCargoTable();calculateAll();updateGlobalStabilityBadge(false,false);hideGlobalTestToast();}

const scenarioReferenceSolutions={
 ballastfix:{
  text:'Move <b>Ballast transfer</b> to <b>Starboard 4.7 m</b>. Its transverse moment approximately balances the 420 t cargo shifted 5 m to port.',
  apply(){setItemTCG('Ballast transfer',4.67);}
 },
 deckcargolimit:{
  text:'Lower the <b>Upper-tier proposal</b> significantly. One valid teaching correction is <b>VCG 6.0 m</b> and <b>mass 800 t</b>.',
  apply(){setItemVCG('Upper-tier proposal',6);setItemMass('Upper-tier proposal',800);}
 },
 ukcloadchallenge:{
  text:'Reduce <b>Loading cargo</b> until UKC enters the 0.80–1.20 m target band. The reference solver automatically searches for a passing cargo mass.',
  apply(){const it=itemByName('Loading cargo');if(!it)return;for(let m=0;m<=6000;m+=25){it.mass=m;calculateAll();if(!state.hydro?.invalid&&state.ukc>=.8&&state.ukc<=1.2&&state.gm>=.15)break;}}
 },
 freshwaterchallenge:{
  text:'Set water density to <b>1.000 t/m³</b>. If required, reduce <b>Movable cargo</b> until UKC is at least 1.50 m.',
  apply(){state.density=1.000;state.oceanPreset='fresh';const it=itemByName('Movable cargo');if(it){for(let m=it.mass;m>=0;m-=25){it.mass=m;calculateAll();if(state.ukc>=1.5&&state.gm>=.15)break;}}}
 },
 cargo_stbd_shift:{
  text:'Move <b>Corrective ballast</b> to <b>Port 4.5 m</b>. This balances the 450 t machinery shifted 5 m to starboard.',
  apply(){setItemTCG('Corrective ballast',-4.5);}
 },
 passenger_roro:{
  text:'Move <b>Transfer ballast</b> to <b>Port 3.5 m</b> to oppose the starboard passenger moment.',
  apply(){setItemTCG('Transfer ballast',-3.5);}
 },
 ballast_highkg:{
  text:'Transfer <b>Corrective ballast</b> down to a low tank. Use <b>VCG 1.5 m</b> as the reference correction.',
  apply(){setItemVCG('Corrective ballast',1.5);}
 },
 bulk_ore_asym:{
  text:'Move <b>Corrective ballast</b> to approximately <b>Starboard 12.8 m</b> to counter the port ore moment.',
  apply(){setItemTCG('Corrective ballast',12.8);}
 },
 barge_deckload:{
  text:'Move the <b>Deck unit</b> to <b>Centre</b> and lower its VCG to about <b>3.0 m</b>.',
  apply(){setItemTCG('Deck unit',0);setItemVCG('Deck unit',3.0);}
 },
 osv_deck_cargo:{
  text:'Move <b>Deck cargo</b> to <b>Centre</b>, lower VCG to <b>5.0 m</b> and change current-relative heading to <b>Head current</b> while keeping the current ON.',
  apply(){setItemTCG('Deck cargo',0);setItemVCG('Deck cargo',5);state.currentDirection='head';}
 },
 density_ballast:{
  text:'Keep brackish density at <b>1.010 t/m³</b>. Reduce <b>Movable cargo</b> until UKC ≥1.20 m. The reference solver searches the cargo mass automatically.',
  apply(){state.density=1.010;state.oceanPreset='brackish';const it=itemByName('Movable cargo');if(it){for(let m=it.mass;m>=0;m-=25){it.mass=m;calculateAll();if(state.ukc>=1.2&&state.gm>=.20)break;}}}
 },
 slackrecover:{
  text:'Keep Free Surface enabled, reduce simultaneous slack tanks to <b>1</b> and complete the tank to <b>100% full</b> in this ideal rectangular-tank model.',
  apply(){state.fse=true;state.tankCount=1;state.tankFill=100;}
 },
 heavyoutreach:{
  text:'Keep the load suspended. Reduce crane outreach to <b>3.0 m</b> and hook height to about <b>12 m</b>.',
  apply(){state.crane=true;state.craneOutreach=3;state.craneHeight=12;}
 },
 crane_port:{
  text:'Keep the crane on <b>PORT</b>. Reduce outreach to <b>3.0 m</b> and hook height to <b>12 m</b>.',
  apply(){state.crane=true;state.craneSide=-1;state.craneOutreach=3;state.craneHeight=12;}
 },
 crane_weather:{
  text:'Keep wind and crane enabled. Slew the suspended load to <b>PORT 3.0 m</b>, lower hook height to <b>11 m</b> and keep the 25 kn wind active.',
  apply(){state.crane=true;state.craneSide=-1;state.craneOutreach=3;state.craneHeight=11;state.windEnabled=true;state.windSpeedKts=25;}
 },
 tanker_fse_current:{
  text:'Keep FSE and current ON. Reduce simultaneous slack tanks to <b>1</b>, make it <b>100% full</b> and turn the current-relative heading to <b>Head current</b>.',
  apply(){state.fse=true;state.tankCount=1;state.tankFill=100;state.currentEnabled=true;state.currentDirection='head';}
 },
 lng_ballast:{
  text:'Move <b>Transfer ballast</b> back to the <b>Centreline</b>. This removes the ballast transverse moment while keeping the low VCG benefit.',
  apply(){setItemTCG('Transfer ballast',0);}
 },
 waveavoid:{
  text:'Keep waves ON but move away from resonance. Set <b>λ = 36 m</b> and <b>c = 12 m/s</b>, giving a regular-wave period of about <b>3 s</b>.',
  apply(){state.waveEnabled=true;state.rollMode='forced';state.waveLength=36;state.waveSpeed=12;state.wavePeriod=3;}
 },
 galecontainer:{
  text:'Keep the 37 kn wind enabled. Lower <b>Upper-tier containers</b> VCG to <b>9 m</b> and change wind direction to <b>Head wind</b>.',
  apply(){setItemVCG('Upper-tier containers',9);state.windEnabled=true;state.windSpeedKts=37;state.windDirection='head';}
 },
 squallroro:{
  text:'Keep the squall enabled. Lower <b>Upper deck load</b> VCG to <b>9 m</b> and change to <b>Head wind</b> to reduce transverse wind moment.',
  apply(){setItemVCG('Upper deck load',9);state.windEnabled=true;state.windDirection='head';}
 },
 currenttanker:{
  text:'Keep current ON at 2.4 kn and change the current-relative heading to <b>Head current</b>, eliminating transverse current heeling in this teaching model.',
  apply(){state.currentEnabled=true;state.currentSpeedKts=2.4;state.currentDirection='head';}
 },
 container_wind_wave:{
  text:'Lower <b>Upper-tier containers</b> to <b>VCG 9 m</b>, change wind to <b>Head wind</b>, change waves to <b>Quartering</b> and set λ 36 m / c 12 m/s (T ≈3 s).',
  apply(){setItemVCG('Upper-tier containers',9);state.windEnabled=true;state.windDirection='head';state.waveEnabled=true;state.rollMode='forced';state.waveHeading='quartering';state.waveLength=36;state.waveSpeed=12;state.wavePeriod=3;}
 },
 roro_vehicle_shift:{
  text:'Move <b>Shifted vehicles</b> to the <b>Centreline</b>, lower their VCG to <b>8.0 m</b> and change the squall to a <b>Head wind</b> while keeping it active.',
  apply(){setItemTCG('Shifted vehicles',0);setItemVCG('Shifted vehicles',8);state.windEnabled=true;state.windDirection='head';}
 },
 damage_counterballast:{
  text:'Keep flooding active. Move <b>Emergency ballast</b> to <b>Port 6.0 m</b> to oppose the 700 t floodwater acting 6 m to starboard.',
  apply(){state.damage=true;setItemTCG('Emergency ballast',-6);}
 },
 lollrecovery:{
  text:'First recover positive GM: lower <b>High cargo</b> to <b>VCG 6.0 m</b> and reduce it to <b>1,200 t</b>. The initial condition has negative GM and a finite angle of loll.',
  apply(){setItemVCG('High cargo',6.0);setItemMass('High cargo',1200);}
 }
};

function currentScenarioReferenceSolution(){
 const key=activeScenarioKey();
 return key?scenarioReferenceSolutions[key]:null;
}
function showReferenceSolution(){
 const panel=document.getElementById('referenceSolutionPanel'),txt=document.getElementById('referenceSolutionText'),btn=document.getElementById('applyReferenceSolutionBtn');
 const sol=currentScenarioReferenceSolution();
 if(!panel||!txt)return;
 panel.classList.remove('hidden');
 if(!sol){
  txt.innerHTML='<span class="text-slate-400">This learning scenario has no single reference correction. Complete the investigation tasks instead.</span>';
  if(btn)btn.classList.add('hidden');
  return;
 }
 if(btn)btn.classList.remove('hidden');
 txt.innerHTML=sol.text;
}
function hideReferenceSolution(){
 document.getElementById('referenceSolutionPanel')?.classList.add('hidden');
}
function applyReferenceSolution(){
 const sol=currentScenarioReferenceSolution();
 if(!sol||typeof sol.apply!=='function')return;
 sol.apply();
 refreshAfterReferenceSolution();
 const panel=document.getElementById('referenceSolutionPanel'),txt=document.getElementById('referenceSolutionText');
 if(panel)panel.classList.remove('hidden');
 if(txt){const key=activeScenarioKey(),o=challengeMeta[key]?challengeOutcome(key):null;txt.innerHTML=`${sol.text}<div class="mt-2 ${o&&o.pass?'text-emerald-300':'text-amber-300'} font-bold"><i class="fa-solid fa-${o&&o.pass?'check':'triangle-exclamation'} mr-1"></i>${o&&o.pass?'Reference settings satisfy the current challenge checks.':'Reference settings applied; run TEST STABILITY and review remaining conditions.'}</div>`;}
}



const challengeMeta={
 ballastfix:['Cargo & Ballast','Basic'],deckcargolimit:['Cargo & Ballast','Intermediate'],ukcloadchallenge:['Cargo & Ballast','Intermediate'],freshwaterchallenge:['Cargo & Ballast','Intermediate'],
 cargo_stbd_shift:['Cargo & Ballast','Basic'],passenger_roro:['Cargo & Ballast','Basic'],ballast_highkg:['Cargo & Ballast','Intermediate'],bulk_ore_asym:['Cargo & Ballast','Intermediate'],barge_deckload:['Cargo & Ballast','Intermediate'],osv_deck_cargo:['Cargo & Ballast','Advanced'],density_ballast:['Cargo & Ballast','Intermediate'],
 slackrecover:['Tanks & Lifting','Intermediate'],heavyoutreach:['Tanks & Lifting','Intermediate'],crane_port:['Tanks & Lifting','Intermediate'],crane_weather:['Tanks & Lifting','Advanced'],tanker_fse_current:['Tanks & Lifting','Advanced'],lng_ballast:['Tanks & Lifting','Basic'],
 waveavoid:['Weather & Sea','Intermediate'],galecontainer:['Weather & Sea','Advanced'],squallroro:['Weather & Sea','Advanced'],currenttanker:['Weather & Sea','Intermediate'],container_wind_wave:['Weather & Sea','Advanced'],roro_vehicle_shift:['Weather & Sea','Advanced'],
 damage_counterballast:['Damage & Emergency','Advanced'],lollrecovery:['Damage & Emergency','Advanced']
};



const challengeCorrectionRules={
 ballastfix:[['cargo','Ballast transfer',['tcg']]],deckcargolimit:[['cargo','Upper-tier proposal',['vcg','mass']]],ukcloadchallenge:[['cargo','Loading cargo',['mass']]],freshwaterchallenge:[['state',null,['density']],['cargo','Movable cargo',['mass']]],cargo_stbd_shift:[['cargo','Corrective ballast',['tcg']]],passenger_roro:[['cargo','Transfer ballast',['tcg']]],ballast_highkg:[['cargo','Corrective ballast',['vcg']]],bulk_ore_asym:[['cargo','Corrective ballast',['tcg']]],barge_deckload:[['cargo','Deck unit',['tcg','vcg']]],osv_deck_cargo:[['cargo','Deck cargo',['tcg','vcg']],['state',null,['currentDirection']]],density_ballast:[['state',null,['density']],['cargo','Movable cargo',['mass']]],slackrecover:[['state',null,['tankCount','tankFill']]],heavyoutreach:[['state',null,['craneOutreach','craneHeight']]],crane_port:[['state',null,['craneOutreach','craneHeight','craneSide']]],crane_weather:[['state',null,['craneOutreach','craneHeight','craneSide']]],tanker_fse_current:[['state',null,['tankCount','tankFill','currentDirection']]],lng_ballast:[['cargo','Transfer ballast',['tcg']]],waveavoid:[['state',null,['waveLength','waveSpeed','wavePeriod']]],galecontainer:[['cargo','Upper-tier containers',['vcg']],['state',null,['windDirection']]],squallroro:[['cargo','Upper deck load',['vcg']],['state',null,['windDirection']]],currenttanker:[['state',null,['currentDirection']]],container_wind_wave:[['cargo','Upper-tier containers',['vcg']],['state',null,['windDirection','waveHeading','waveLength','waveSpeed','wavePeriod']]],roro_vehicle_shift:[['cargo','Shifted vehicles',['tcg','vcg']],['state',null,['windDirection']]],damage_counterballast:[['cargo','Emergency ballast',['tcg']]],lollrecovery:[['cargo','High cargo',['vcg','mass']]]
};
/* AMCOL Training Fleet scenario/challenge recalibration — v2.0 */
const AMCOL_SCENARIO_FLEET_MAP={
 baseline:'AMCOL-MERIDIAN',stiff:'AMCOL-FORTUNE',tender:'AMCOL-NAVIGATOR',ferry:'AMCOL-VOYAGER',tanker:'AMCOL-OCEANSTAR',crane:'AMCOL-MERIDIAN',beamsea:'AMCOL-NAVIGATOR',loll:'AMCOL-NAVIGATOR',damage:'AMCOL-MERIDIAN',ukc:'AMCOL-MERIDIAN',freshwater:'AMCOL-ATLAS',
 ballastfix:'AMCOL-MERIDIAN',deckcargolimit:'AMCOL-NAVIGATOR',ukcloadchallenge:'AMCOL-MERIDIAN',freshwaterchallenge:'AMCOL-ATLAS',cargo_stbd_shift:'AMCOL-MERIDIAN',passenger_roro:'AMCOL-VOYAGER',ballast_highkg:'AMCOL-NAVIGATOR',bulk_ore_asym:'AMCOL-FORTUNE',barge_deckload:'AMCOL-ATLAS',osv_deck_cargo:'AMCOL-GUARDIAN',density_ballast:'AMCOL-MERIDIAN',slackrecover:'AMCOL-OCEANSTAR',heavyoutreach:'AMCOL-MERIDIAN',crane_port:'AMCOL-MERIDIAN',crane_weather:'AMCOL-GUARDIAN',tanker_fse_current:'AMCOL-OCEANSTAR',lng_ballast:'AMCOL-AURORA',waveavoid:'AMCOL-NAVIGATOR',galecontainer:'AMCOL-NAVIGATOR',squallroro:'AMCOL-VOYAGER',currenttanker:'AMCOL-CHEMSTAR',container_wind_wave:'AMCOL-NAVIGATOR',roro_vehicle_shift:'AMCOL-VOYAGER',damage_counterballast:'AMCOL-MERIDIAN',lollrecovery:'AMCOL-NAVIGATOR'
};
let AMCOL_SCENARIO_CONTEXT=null;
function amcolScenarioApplyBase(vesselId,key=''){
 const v=AMCOL_TRAINING_VESSELS_BY_ID[vesselId];if(!v)throw new Error(`AMCOL training vessel not found: ${vesselId}`);
 const pp=v.principalParticulars||{},condition=(v.loadingConditions||[])[0]||{};resetCore();
 state.amcolTrainingVesselId=v.id;state.companyName='Asian Maritime Technological College (AMCOL)';state.vesselName=v.name;state.hullType=v.family;
 state.length=+pp.LBP||100;state.beam=+pp.beam||20;state.depth=+pp.depth||10;state.density=+v.sourceDensity||+pp.waterDensity||1.025;
 state.lightshipMass=+pp.lightshipMass||1;state.lightshipKG=+pp.lightshipKG||state.depth*.45;state.lightshipTCG=0;state.lightshipLCG=+pp.lightshipLCG||0;state.krRatio=vesselPresets[v.family]?.krRatio||.35;
 state.waterDepth=Math.max(state.depth+5,(+pp.designDraft||state.depth*.6)+Math.max(5,+v.operationalLimits?.minUKC||1));
 state.hydroDataKey=amcolTrainingHydroKey(v.id);state.sourceConditionKey=`amcol_training_scenario:${v.id}:${key}`;state.fse=true;
 window.AMCOL_CUSTOM_HULL_FORM={enabled:true,trainingModel:true,label:`${v.name} · AMCOL training station envelope`,vesselName:v.name,hullType:v.family,stations:(v.stationEnvelope||[]).map(s=>({xNorm:(+s.xNorm||0)*2,beamFactor:+s.beamFactor,bottomFactor:+s.bottomFactor,sheerRatio:+s.sheerRatio||0,keelRiseRatio:+s.keelRiseRatio||0}))};
 window.AMCOL_ACTIVE_TANK_CALIBRATION=deepClonePlain(v.tankCalibration||[]);window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=deepClonePlain(v.structuralLimits||[]);window.AMCOL_ACTIVE_TRAINING_CONDITIONS=deepClonePlain(v.loadingConditions||[]);
 ballastTanks=amcolTrainingBallastPlan(v,condition);state.ballastPlanEnabled=true;state.ballastPlanSource='training';state.ballastPlanLabel=`${v.name} · AMCOL TRAINING scenario ballast plan · ${ballastTanks.length} tanks`;
 cargoItems=amcolTrainingCargoItems(v,condition);const cons=amcolTrainingConsumablesItem(v,condition,cargoItems,ballastTanks);if(cons)cargoItems.push(cons);
 const ol=v.operationalLimits||{};operationalLimits={enabled:true,source:'amcol-training',label:'AMCOL TRAINING LIMITS · not statutory',minForwardDraft:Number.isFinite(+ol.minForwardDraft)?+ol.minForwardDraft:null,minAftDraft:Number.isFinite(+ol.minAftDraft)?+ol.minAftDraft:null,maxDraft:Number.isFinite(+ol.maxDraft)?+ol.maxDraft:null,minUKC:Number.isFinite(+ol.minUKC)?+ol.minUKC:null,maxList:Number.isFinite(+ol.maxList)?+ol.maxList:null,maxTrim:Number.isFinite(+ol.maxTrim)?+ol.maxTrim:null,airDraft:Number.isFinite(+ol.airDraft)?+ol.airDraft:null};
 AMCOL_SCENARIO_CONTEXT={key,vesselId:v.id,vesselName:v.name,baseCargo:deepClonePlain(cargoItems),baseBallast:deepClonePlain(ballastTanks),condition:deepClonePlain(condition)};
 bumpSpaceLayoutRevision(`scenario-${key||'training'}-${v.family}`);return v;
}
function amcolScenarioCargoBySpace(spaceId){return cargoItems.find(x=>String(x.spaceId)===String(spaceId));}
function amcolScenarioCargoByName(name){return cargoItems.find(x=>x.name===name);}
function amcolScenarioAliasCargo(spaceId,name){const it=amcolScenarioCargoBySpace(spaceId);if(it){it.name=name;it.sourceLocked=false;it.source='AMCOL TRAINING SCENARIO';}return it;}
function amcolScenarioSplitCargo(spaceId,mass,name,{tcg=0,vcg=null,lcg=null}={}){
 const src=amcolScenarioCargoBySpace(spaceId);if(!src)return null;const take=Math.max(0,Math.min(+src.mass||0,+mass||0));src.mass=Math.max(0,(+src.mass||0)-take);src.sourceLocked=false;const it={...deepClonePlain(src),id:`scenario_${AMCOL_SCENARIO_CONTEXT?.key||'x'}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,name,mass:take,unitMass:take,quantity:1,autoMass:false,autoVCG:false,autoTCG:false,autoLCG:false,preloadedSpaceSlot:false,tcg:Number(tcg)||0,vcg:Number.isFinite(Number(vcg))?Number(vcg):Number(src.vcg)||0,lcg:Number.isFinite(Number(lcg))?Number(lcg):Number(src.lcg)||0,sourceLocked:false,source:'AMCOL TRAINING SCENARIO'};cargoItems.push(it);return it;
}
function amcolScenarioTank(id){return ballastTanks.find(t=>String(t.id)===String(id));}
function amcolScenarioSetTankFill(id,fill){const t=amcolScenarioTank(id);if(!t)return null;t.sourceLocked=false;delete t.sourceMass;delete t.sourceFSM;delete t.sourceVCG;t.fill=Math.max(0,Math.min(100,Number(fill)||0));t.source='AMCOL TRAINING SCENARIO';return t;}
function amcolScenarioRestoreTank(id){const base=AMCOL_SCENARIO_CONTEXT?.baseBallast?.find(t=>String(t.id)===String(id)),cur=amcolScenarioTank(id);if(base&&cur)Object.assign(cur,deepClonePlain(base));return cur;}
function amcolScenarioRestoreAllBallast(){if(!AMCOL_SCENARIO_CONTEXT)return;const base=new Map((AMCOL_SCENARIO_CONTEXT.baseBallast||[]).map(t=>[String(t.id),t]));ballastTanks.forEach(t=>{const b=base.get(String(t.id));if(b)Object.assign(t,deepClonePlain(b));});}
function amcolScenarioRestoreCargo(idOrName,props=['mass','vcg','tcg','lcg']){const cur=cargoItems.find(x=>String(x.id)===String(idOrName)||x.name===idOrName);if(!cur||!AMCOL_SCENARIO_CONTEXT)return cur;const base=AMCOL_SCENARIO_CONTEXT.baseCargo.find(x=>String(x.id)===String(cur.id));if(base)props.forEach(p=>cur[p]=deepClonePlain(base[p]));return cur;}
function amcolScenarioRestoreAllCargo(props=['mass','vcg','tcg','lcg']){if(!AMCOL_SCENARIO_CONTEXT)return;const base=new Map((AMCOL_SCENARIO_CONTEXT.baseCargo||[]).map(x=>[String(x.id),x]));cargoItems.forEach(x=>{const b=base.get(String(x.id));if(b)props.forEach(p=>x[p]=deepClonePlain(b[p]));});}
function amcolScenarioSetPair(portId,stbdId,portFill,stbdFill){amcolScenarioSetTankFill(portId,portFill);amcolScenarioSetTankFill(stbdId,stbdFill);}
function amcolScenarioSetSlack(ids,fill=50){ids.forEach(id=>amcolScenarioSetTankFill(id,fill));}
function amcolScenarioCalc(){calculateAll({curve:false});findAndSetEquilibrium();calculateAll({curve:false});}
function amcolScenarioTrainingVesselIs(id){return state.amcolTrainingVesselId===id&&!!activeAMCOLTrainingVessel();}
function amcolScenarioMetricMessage(extra=''){return `${state.vesselName} · Δ ${state.dispMass.toFixed(0)} t · draft ${state.eqDraft.toFixed(2)} m · GM ${state.gm.toFixed(3)} m · list ${state.equilibrium.toFixed(2)}° · FSC ${state.fsc.toFixed(3)} m${extra?` · ${extra}`:''}`;}
function amcolScenarioCompleteTankFSE(){return state.fse&&state.fsc<=Math.max(.30,(AMCOL_SCENARIO_CONTEXT?.condition?.FSC||0)*1.75);}
function amcolScenarioReferenceFinalize(){renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});}
function amcolScenarioSetWaveNearNatural(factor=1.0){amcolScenarioCalc();const tr=Math.max(3,Number(state.naturalPeriod)||9);state.waveEnabled=true;state.rollMode='forced';state.waveModel='physical';state.waveHeading='beam';state.shipSpeedKts=12;state.waveHeight=3;state.wavePeriod=tr*factor;try{applyPhysicalWaveFromPeriod(true);}catch(e){state.waveLength=1.56*state.wavePeriod*state.wavePeriod;state.waveSpeed=state.waveLength/state.wavePeriod;}}
function amcolScenarioRaiseContainerCargo(vcg){cargoItems.filter(x=>String(x.spaceId||'').startsWith('CS-BAY')).forEach(x=>{x.vcg=vcg;x.autoVCG=false;x.sourceLocked=false;});}
function amcolScenarioRenameOptions(){
 const labels={baseline:'AMCOL MERIDIAN · baseline loaded departure',stiff:'AMCOL FORTUNE · stiff low-cargo condition',tender:'AMCOL NAVIGATOR · tender high-container condition',ferry:'AMCOL VOYAGER · transverse passenger/vehicle shift',tanker:'AMCOL OCEAN STAR · slack SBT condition',crane:'AMCOL MERIDIAN · heavy-lift operation',beamsea:'AMCOL NAVIGATOR · beam-sea resonance',loll:'AMCOL NAVIGATOR · negative GM / angle of loll',damage:'AMCOL MERIDIAN · starboard flooding',ukc:'AMCOL MERIDIAN · restricted UKC',freshwater:'AMCOL ATLAS · freshwater transition'};
 const sel=document.getElementById('scenarioSelect');if(!sel)return;Object.entries(labels).forEach(([k,v])=>{const o=sel.querySelector(`option[value="${k}"]`);if(o)o.textContent=v;});
 Object.entries(AMCOL_SCENARIO_FLEET_MAP).forEach(([k,id])=>{if(!challengeMeta[k])return;const o=sel.querySelector(`option[value="${k}"]`),v=AMCOL_TRAINING_VESSELS_BY_ID[id];if(o&&v&&!o.textContent.includes(v.name))o.textContent=`${o.textContent} · ${v.name}`;});
}
function installAMCOLScenarioFleetOverrides(){
 // Learning scenarios — each starts from an embedded AMCOL Training Vessel Loaded Departure condition.
 Object.assign(scenarios.baseline,{title:'AMCOL MERIDIAN · Loaded Departure Baseline',brief:'Use AMCOL MERIDIAN’s complete training hydrostatics, KN curves, four cargo holds and 14-tank ballast plan as the baseline general-cargo condition.',tasks:['Record Loaded Departure Δ, draft, KGc, KMT, GM, TPC and UKC.','Heel to 10°, 20° and 30° and compare KN-derived GZ.','Open the cargo/ballast space monitor and relate the loaded spaces to the calculated moments.'],apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','baseline');}});
 Object.assign(scenarios.stiff,{title:'AMCOL FORTUNE · Dense Cargo Low / Stiff Ship',brief:'AMCOL FORTUNE is loaded from its 37,000-DWT training dataset, then the five bulk parcels are represented as dense low-stowed ore to demonstrate a low KG and relatively stiff response.',tasks:['Record the original AMCOL FORTUNE Loaded Departure GM target (about 3.16 m) and the scenario GM.','Compare natural roll period with the normal wheat condition.','Explain why dense cargo low in the holds increases initial stability but can produce a more severe roll environment.'],apply(){amcolScenarioApplyBase('AMCOL-FORTUNE','stiff');cargoItems.filter(x=>String(x.spaceId).startsWith('BC-H')).forEach(x=>{x.name='Dense ore low';x.density=2.2;x.vcg=5.4;x.sourceLocked=false;});}});
 Object.assign(scenarios.tender,{title:'AMCOL NAVIGATOR · High-Tier Container / Tender Condition',brief:'AMCOL NAVIGATOR uses its integrated container-ship hydrostatics and KN curves. Several container bays are raised to an upper-tier VCG to investigate reduced GM and GZ margin.',tasks:['Compare the scenario KGc/GM with NAVIGATOR Loaded Departure (GM about 2.21 m).','Lower selected bay VCGs and observe the initial-GM tangent and GZ maximum.','Review the intact-stability teaching audit before and after correction.'],apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','tender');['CS-BAY7','CS-BAY8','CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=23;x.name='Upper-tier containers';x.sourceLocked=false;}});}});
 Object.assign(scenarios.ferry,{title:'AMCOL VOYAGER · Passenger/Vehicle Transverse Shift',brief:'AMCOL VOYAGER starts from its Ro-Ro Loaded Departure data. A 250 t group is shifted across the upper vehicle deck while total carried mass is kept constant.',tasks:['Find the resulting equilibrium list.','Move the shifted group closer to the centreline and compare list.','Compare a cargo/passenger shift with correction using the actual anti-heeling tank pair.'],apply(){amcolScenarioApplyBase('AMCOL-VOYAGER','ferry');amcolScenarioSplitCargo('RR-5',250,'Passengers / vehicles shifted to port',{tcg:-10.5,vcg:13.5});}});
 Object.assign(scenarios.tanker,{title:'AMCOL OCEAN STAR · Multiple Slack SBTs',brief:'AMCOL OCEAN STAR uses its complete tanker training dataset. Four actual segregated ballast tanks are placed at 50% to demonstrate individual-tank FSM and FSC.',tasks:['Record solid KG, corrected KG and FSC with eight slack SBTs.','Complete/empty tanks in pairs while conserving ballast mass and compare FSC.','Relate the result to the actual SBT dimensions shown in Loading and 3D Internal View.'],apply(){amcolScenarioApplyBase('AMCOL-OCEANSTAR','tanker');amcolScenarioSetSlack(['SBT-1-P','SBT-1-S','SBT-2-P','SBT-2-S','SBT-3-P','SBT-3-S','SBT-4-P','SBT-4-S'],50);state.fse=true;}});
 Object.assign(scenarios.crane,{title:'AMCOL MERIDIAN · Heavy Lift Slewed Outboard',brief:'AMCOL MERIDIAN remains on its source-like training loading condition while a 180 t suspended load is introduced at the hook.',tasks:['Compare equilibrium with the hook near centreline and at 7 m starboard outreach.','Lower the hook and observe KG/GM.','Explain point-of-suspension treatment using the vessel’s actual displacement.'],apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','crane');state.crane=true;state.craneMass=180;state.craneHeight=20;state.craneOutreach=7;state.craneSide=1;state.craneLCG=-10;}});
 Object.assign(scenarios.beamsea,{title:'AMCOL NAVIGATOR · Beam-Sea Encounter',brief:'AMCOL NAVIGATOR’s real training displacement and roll characteristics are used to set a beam-wave encounter near the calculated natural roll period.',tasks:['Record natural roll period and encounter period.','Run Forced/Synchronous Roll near resonance.','Change wave heading/period and explain why response changes even though hydrostatic GM is unchanged.'],apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','beamsea');amcolScenarioSetWaveNearNatural(1.03);}});
 Object.assign(scenarios.loll,{title:'AMCOL NAVIGATOR · Negative GM / Angle of Loll',brief:'The NAVIGATOR training loading condition is made unrealistically top-heavy only for the emergency lesson by raising container VCGs until initial GM becomes negative.',tasks:['Confirm negative GM and find the non-zero equilibrium/angle of loll.','Do not attempt to remove loll only with transverse ballast.','Lower container VCGs toward the training Loaded Departure values and recover positive GM.'],apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','loll');amcolScenarioRaiseContainerCargo(24.5);}});
 Object.assign(scenarios.damage,{title:'AMCOL MERIDIAN · Starboard Compartment Flooding',brief:'AMCOL MERIDIAN’s intact hydrostatic/KN dataset is used as the pre-damage condition. A representative starboard compartment is then flooded using the simulator teaching damage model.',tasks:['Compare lost-buoyancy and added-weight methods.','Record list, draft and residual GM.','Explain why the AMCOL intact KN data are not a substitute for an approved damage-stability calculation.'],apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','damage');state.damage=true;state.damageMode='lost';state.damageSide=1;state.damageWidth=10;state.damageHeight=25;state.damagePerm=.95;}});
 Object.assign(scenarios.ukc,{title:'AMCOL MERIDIAN · Restricted UKC',brief:'AMCOL MERIDIAN is placed in restricted water using its Loaded Departure draft and AMCOL training minimum-UKC limit.',tasks:['Record mean/FWD/AFT drafts and UKC.','Increase cargo in a selected hold and observe geometric UKC.','Compare the result with the vessel’s AMCOL training minimum UKC; explain why squat still requires a separate calculation.'],apply(){const v=amcolScenarioApplyBase('AMCOL-MERIDIAN','ukc');state.waterDepth=(v.loadingConditions?.[0]?.meanDraft||9.2)+.75;}});
 Object.assign(scenarios.freshwater,{title:'AMCOL ATLAS · Seawater to Freshwater Transition',brief:'AMCOL ATLAS provides a compact barge dataset for comparing the hydrostatic draft response at ρ 1.025 and 1.000 t/m³.',tasks:['Record draft/TPC at ρ 1.025.','Change to freshwater and record the new draft at the same displacement.','Compare the numerical change with the displayed FWA approximation.'],apply(){amcolScenarioApplyBase('AMCOL-ATLAS','freshwater');state.waterDepth=5.0;state.density=1.025;}});

 // Graded challenges.
 Object.assign(scenarios.ballastfix,{title:'Challenge 01 · AMCOL MERIDIAN ballast-list correction',brief:'AMCOL MERIDIAN has the full Port WBT 1 and empty Starboard WBT 1, creating a real tank-induced port moment. Correct it using the same preloaded tank pair.',goal:'Use WBT 1 P/S to achieve |list| ≤1.0° while keeping GM ≥1.50 m and the AMCOL training UKC limit satisfied.',tasks:['Inspect WBT 1 P/S capacities and TCGs.','Transfer ballast from Port to Starboard without changing total pair mass.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&Math.abs(state.equilibrium)<=1&&state.gm>=1.5&&state.ukc>=1.0;return {pass,message:amcolScenarioMetricMessage('WBT 1 actual vessel tanks')};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','ballastfix');amcolScenarioSetPair('WBT-1-P','WBT-1-S',100,0);}});
 Object.assign(scenarios.deckcargolimit,{title:'Challenge 02 · AMCOL NAVIGATOR high-tier stability',brief:'One NAVIGATOR bay is assigned an excessive upper-tier VCG while its actual hydrostatic and KN datasets remain active.',goal:'Lower the affected bay so corrected GM ≥1.80 m, |list| ≤1° and the core intact-stability teaching audit passes.',tasks:['Identify Upper-tier proposal in the cargo table.','Lower its VCG rather than changing hull/lightship data.','Run TEST STABILITY and review GZ.'],check(){const imo=evaluateIMO(),pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.gm>=1.8&&Math.abs(state.equilibrium)<=1&&imo.filter(c=>!String(c.name).includes('Weather')).every(c=>c.pass);return {pass,message:amcolScenarioMetricMessage('NAVIGATOR KN/GZ active')};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','deckcargolimit');const x=amcolScenarioAliasCargo('CS-BAY10','Upper-tier proposal');if(x)x.vcg=31;}});
 Object.assign(scenarios.ukcloadchallenge,{title:'Challenge 03 · AMCOL MERIDIAN safe UKC loading window',brief:'MERIDIAN is loaded in restricted water. The hydrostatic table and TPC determine how much cargo must be removed to enter the target UKC band.',goal:'Achieve UKC 0.80–1.20 m, corrected GM ≥1.50 m and remain below AMCOL training maximum draft.',tasks:['Record initial UKC and the forward/aft drafts.','Reduce cargo in a longitudinally balanced way across the four holds.','Stop when UKC is inside the target window without creating excessive trim, then test stability.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&state.ukc>=.8&&state.ukc<=1.2&&state.gm>=1.5&&state.eqDraft<=9.75;return {pass,message:amcolScenarioMetricMessage(`UKC ${state.ukc.toFixed(2)} m`)};},apply(){const v=amcolScenarioApplyBase('AMCOL-MERIDIAN','ukcloadchallenge');state.waterDepth=(v.loadingConditions?.[0]?.meanDraft||9.2)+.62;}});
 Object.assign(scenarios.freshwaterchallenge,{title:'Challenge 04 · AMCOL ATLAS freshwater arrival',brief:'ATLAS enters freshwater in a restricted berth. Its barge hydrostatics require a deeper draft at unchanged displacement.',goal:'Keep density at 1.000 t/m³ and obtain UKC ≥1.00 m with positive GM.',tasks:['Change to freshwater if not already set.','Reduce Movable cargo on deck as required.','Verify UKC and draft.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-ATLAS')&&Math.abs(state.density-1)<.0005&&state.ukc>=1.0&&state.gm>0;return {pass,message:amcolScenarioMetricMessage(`ρ ${state.density.toFixed(3)}`)};},apply(){amcolScenarioApplyBase('AMCOL-ATLAS','freshwaterchallenge');amcolScenarioAliasCargo('BG-DECK','Movable cargo');state.density=1.000;state.oceanPreset='fresh';state.waterDepth=4.35;}});
 Object.assign(scenarios.cargo_stbd_shift,{title:'Challenge 05 · AMCOL MERIDIAN starboard cargo shift',brief:'A 600 t parcel is separated from Hold 2 cargo and shifted 6 m to starboard while total cargo mass is conserved.',goal:'Return |list| to ≤1.0° and maintain GM ≥1.50 m.',tasks:['Locate Shifted machinery in Hold 2.','Move the parcel back toward centreline or counter it with actual ballast.','Test stability.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&Math.abs(state.equilibrium)<=1&&state.gm>=1.5;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','cargo_stbd_shift');amcolScenarioSplitCargo('GC-H2',600,'Shifted machinery',{tcg:6});}});
 Object.assign(scenarios.passenger_roro,{title:'Challenge 06 · AMCOL VOYAGER crowd shift / anti-heeling',brief:'A 250 t upper-deck group shifts to starboard on AMCOL VOYAGER. Correct the list using its real Anti-Heeling P/S tank pair.',goal:'Keep the shifted group in place, use anti-heeling ballast to achieve |list| ≤1.0° and GM ≥2.0 m.',tasks:['Do not delete the shifted group.','Adjust Anti-Heeling P/S tank levels.','Use TEST STABILITY after the transfer.'],check(){const pax=amcolScenarioCargoByName('Passengers / vehicles shifted starboard'),pass=amcolScenarioTrainingVesselIs('AMCOL-VOYAGER')&&!!pax&&pax.tcg>=8&&Math.abs(state.equilibrium)<=1&&state.gm>=2;return {pass,message:amcolScenarioMetricMessage('VOYAGER anti-heeling tanks')};},apply(){amcolScenarioApplyBase('AMCOL-VOYAGER','passenger_roro');amcolScenarioSplitCargo('RR-5',250,'Passengers / vehicles shifted starboard',{tcg:10.5,vcg:13.5});}});
 Object.assign(scenarios.ballast_highkg,{title:'Challenge 07 · AMCOL NAVIGATOR recover GM with low ballast',brief:'Three NAVIGATOR container bays are high and the normally low double-bottom reserve tanks DB 1/4/5 are empty. Recover margin by using low ballast.',goal:'Keep the high cargo condition, achieve corrected GM ≥1.80 m and |list| ≤1° using low ballast tanks.',tasks:['Review high cargo VCG and current GM.','Fill symmetrical low DB tanks rather than creating list.','Retest and review FSC.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.gm>=1.8&&Math.abs(state.equilibrium)<=1;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','ballast_highkg');['CS-BAY8','CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=22;x.name='High-tier containers';x.sourceLocked=false;}});['DB-1-P','DB-1-S','DB-4-P','DB-4-S','DB-5-P','DB-5-S'].forEach(id=>amcolScenarioSetTankFill(id,0));}});
 Object.assign(scenarios.bulk_ore_asym,{title:'Challenge 08 · AMCOL FORTUNE asymmetric ore parcel',brief:'A 2,000 t parcel from Hold 3 is shifted 6 m to port while the total hold mass remains unchanged.',goal:'Correct the transverse distribution to |list| ≤1.0° while GM remains ≥2.0 m.',tasks:['Identify the 2,000 t Asymmetric ore parcel.','Re-centre the parcel or use actual symmetric ballast transfer.','Test stability using FORTUNE KN data.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-FORTUNE')&&Math.abs(state.equilibrium)<=1&&state.gm>=2;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-FORTUNE','bulk_ore_asym');amcolScenarioSplitCargo('BC-H3',2000,'Asymmetric ore parcel',{tcg:-6,vcg:7});}});
 Object.assign(scenarios.barge_deckload,{title:'Challenge 09 · AMCOL ATLAS deck-load correction',brief:'ATLAS has a deck unit shifted to starboard and slightly raised. Use the actual barge deck space and hydrostatics.',goal:'Achieve |list| ≤1.5°, keep the deck unit VCG ≤4.8 m and retain positive GM.',tasks:['Select Deck unit.','Move it toward centreline and keep it on the deck envelope.','Retest stability.'],check(){const x=amcolScenarioCargoByName('Deck unit'),pass=amcolScenarioTrainingVesselIs('AMCOL-ATLAS')&&x&&Math.abs(state.equilibrium)<=1.5&&x.vcg<=4.8&&state.gm>0;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-ATLAS','barge_deckload');const x=amcolScenarioAliasCargo('BG-DECK','Deck unit');if(x){x.tcg=6;x.autoTCG=false;x.vcg=5.4;}}});
 Object.assign(scenarios.osv_deck_cargo,{title:'Challenge 10 · AMCOL GUARDIAN deck cargo + current',brief:'GUARDIAN’s large aft working-deck load is shifted starboard while a 2 kn transverse current acts on the actual OSV underwater profile.',goal:'Keep current ON, achieve |list| ≤2°, GM ≥2.0 m and reduce transverse current exposure to near-zero by heading/current selection.',tasks:['Re-centre Deck cargo.','Use a non-transverse current relationship while keeping current enabled.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-GUARDIAN')&&state.currentEnabled&&Math.abs(state.equilibrium)<=2&&state.gm>=2&&Math.abs(state.environmentHeelingArm)<=.03;return {pass,message:amcolScenarioMetricMessage(`current arm ${state.environmentHeelingArm.toFixed(3)} m`)};},apply(){amcolScenarioApplyBase('AMCOL-GUARDIAN','osv_deck_cargo');const x=amcolScenarioAliasCargo('OSV-DECK','Deck cargo');if(x){x.tcg=4.5;x.autoTCG=false;x.vcg=8.5;}state.currentEnabled=true;state.currentSpeedKts=2;state.currentDirection='port_to_starboard';}});
 Object.assign(scenarios.density_ballast,{title:'Challenge 11 · AMCOL MERIDIAN brackish-water UKC',brief:'MERIDIAN enters ρ 1.010 t/m³ water with restricted depth. Use its hydrostatic table to restore the AMCOL training UKC margin.',goal:'Keep density at 1.010 t/m³, achieve UKC ≥1.20 m and GM ≥1.50 m.',tasks:['Keep brackish-water density unchanged.','Reduce cargo in a balanced longitudinal pattern so trim does not consume the UKC gain.','Verify forward/aft drafts, UKC and test stability.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&Math.abs(state.density-1.010)<.0005&&state.ukc>=1.2&&state.gm>=1.5;return {pass,message:amcolScenarioMetricMessage(`ρ ${state.density.toFixed(3)}`)};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','density_ballast');state.density=1.010;state.oceanPreset='brackish';state.waterDepth=10.35;}});
 Object.assign(scenarios.slackrecover,{title:'Challenge 12 · AMCOL OCEAN STAR slack-tank recovery',brief:'Eight actual OCEAN STAR SBTs (SBT 1–4 P/S) are simultaneously slack at 50%. Reduce FSC by sequencing the transfer into full/empty tanks without disabling FSE.',goal:'FSE must remain ON, FSC ≤0.200 m and GM ≥5.0 m.',tasks:['Inspect SBT 1–4 Port/Starboard and identify the eight slack free surfaces.','Conserve combined ballast mass while reducing the number of slack free surfaces.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-OCEANSTAR')&&state.fse&&state.fsc<=.200&&state.gm>=5;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-OCEANSTAR','slackrecover');amcolScenarioSetSlack(['SBT-1-P','SBT-1-S','SBT-2-P','SBT-2-S','SBT-3-P','SBT-3-S','SBT-4-P','SBT-4-S'],50);state.fse=true;}});
 Object.assign(scenarios.heavyoutreach,{title:'Challenge 13 · AMCOL MERIDIAN heavy-lift outreach',brief:'A 180 t lift on MERIDIAN is suspended high and 10 m to starboard.',goal:'Keep the crane ON and lift mass unchanged; reduce outreach to ≤4 m, |list| ≤2° and maintain GM ≥1.5 m.',tasks:['Do not remove the suspended load.','Reduce outreach and/or hook height.','Retest at the corrected operating position.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&state.crane&&Math.abs(state.craneMass-180)<.1&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=2&&state.gm>=1.5;return {pass,message:amcolScenarioMetricMessage(`outreach ${state.craneOutreach.toFixed(1)} m`)};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','heavyoutreach');state.crane=true;state.craneMass=180;state.craneHeight=25;state.craneOutreach=10;state.craneSide=1;state.craneLCG=-10;}});
 Object.assign(scenarios.crane_port,{title:'Challenge 14 · AMCOL MERIDIAN port-side crane lift',brief:'MERIDIAN carries a 200 t suspended project load slewed 9 m to port.',goal:'Keep crane on PORT with 200 t suspended, reduce outreach to ≤4 m, |list| ≤2° and GM ≥1.5 m.',tasks:['Keep the load suspended on Port.','Bring the hook closer to centreline and lower it if required.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&state.crane&&state.craneSide===-1&&Math.abs(state.craneMass-200)<.1&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=2&&state.gm>=1.5;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','crane_port');state.crane=true;state.craneMass=200;state.craneHeight=23;state.craneOutreach=9;state.craneSide=-1;}});
 Object.assign(scenarios.crane_weather,{title:'Challenge 15 · AMCOL GUARDIAN crane lift with crosswind',brief:'GUARDIAN performs a 50 t deck lift in 25 kn crosswind. Use crane geometry and heading/exposure without turning the wind off.',goal:'Keep wind ≥25 kn and crane ON; achieve |list| ≤2°, GM ≥2.0 m and crane outreach ≤3 m.',tasks:['Reduce suspended-load outreach/hook height.','Keep the crosswind active; heading may be changed.','Test the combined condition.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-GUARDIAN')&&state.windEnabled&&state.windSpeedKts>=25&&state.crane&&state.craneOutreach<=3&&Math.abs(state.equilibrium)<=2&&state.gm>=2;return {pass,message:amcolScenarioMetricMessage(`wind ${state.windSpeedKts.toFixed(0)} kn`)};},apply(){amcolScenarioApplyBase('AMCOL-GUARDIAN','crane_weather');state.crane=true;state.craneMass=50;state.craneHeight=18;state.craneOutreach=7;state.craneSide=1;state.windEnabled=true;state.windSpeedKts=25;state.gustFactor=1.12;state.windDirection='port_to_starboard';}});
 Object.assign(scenarios.tanker_fse_current,{title:'Challenge 16 · AMCOL OCEAN STAR FSE + transverse current',brief:'OCEAN STAR has eight slack SBTs and a 2.2 kn beam current. Correct both the tank sequencing and current exposure.',goal:'Keep FSE and current ON, FSC ≤0.200 m, GM ≥5.0 m and environmental heeling arm ≤0.001 m.',tasks:['Sequence SBT 1–4 into full/empty pairs.','Change current-relative direction away from transverse.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-OCEANSTAR')&&state.fse&&state.currentEnabled&&state.fsc<=.200&&state.gm>=5&&Math.abs(state.environmentHeelingArm)<=.001;return {pass,message:amcolScenarioMetricMessage(`env arm ${state.environmentHeelingArm.toFixed(3)} m`)};},apply(){amcolScenarioApplyBase('AMCOL-OCEANSTAR','tanker_fse_current');amcolScenarioSetSlack(['SBT-1-P','SBT-1-S','SBT-2-P','SBT-2-S','SBT-3-P','SBT-3-S','SBT-4-P','SBT-4-S'],50);state.currentEnabled=true;state.currentSpeedKts=2.2;state.currentDirection='port_to_starboard';}});
 Object.assign(scenarios.lng_ballast,{title:'Challenge 17 · AMCOL AURORA wing-ballast list',brief:'AURORA’s Wing 2 pair contains the correct combined ballast amount but it is concentrated on Port (80/0 instead of 40/40).',goal:'Use the actual Wing 2 P/S tanks to achieve |list| ≤1° while keeping GM ≥2.5 m.',tasks:['Inspect Wing 2 P/S capacities and starting fills.','Transfer water from Port to Starboard while conserving pair mass.','Retest.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-AURORA')&&Math.abs(state.equilibrium)<=1&&state.gm>=2.5;return {pass,message:amcolScenarioMetricMessage('AURORA Wing 2 pair')};},apply(){amcolScenarioApplyBase('AMCOL-AURORA','lng_ballast');amcolScenarioSetPair('WING-2-P','WING-2-S',80,0);}});
 Object.assign(scenarios.waveavoid,{title:'Challenge 18 · AMCOL NAVIGATOR avoid synchronous roll',brief:'NAVIGATOR is placed in a beam-wave encounter close to its calculated natural roll period using the current training loading condition.',goal:'Keep waves ON, move encounter period at least 25% away from natural roll and use a non-beam heading.',tasks:['Compare Tr and Te.','Change wave period/heading without disabling waves.','Run TEST STABILITY.'],check(){const te=calculateEncounterPeriod(),sep=state.naturalPeriod&&Number.isFinite(te)?Math.abs(te-state.naturalPeriod)/state.naturalPeriod:0;const pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.waveEnabled&&state.waveHeading!=='beam'&&sep>=.25;return {pass,message:amcolScenarioMetricMessage(`Tr ${state.naturalPeriod?.toFixed(2)||'—'} s · Te ${Number.isFinite(te)?te.toFixed(2):'—'} s · sep ${(sep*100).toFixed(0)}%`)};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','waveavoid');amcolScenarioSetWaveNearNatural(1.0);}});
 Object.assign(scenarios.galecontainer,{title:'Challenge 19 · AMCOL NAVIGATOR gale crosswind',brief:'NAVIGATOR carries two high-tier bay groups while exposed to 37 kn beam wind.',goal:'Keep wind ≥35 kn, achieve GM ≥1.8 m, |list| ≤2° and environmental arm ≤0.020 m.',tasks:['Lower the affected high-tier VCGs.','Change wind exposure/heading but keep gale wind ON.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.windEnabled&&state.windSpeedKts>=35&&state.gm>=1.8&&Math.abs(state.equilibrium)<=2&&Math.abs(state.environmentHeelingArm)<=.020;return {pass,message:amcolScenarioMetricMessage(`wind arm ${state.environmentHeelingArm.toFixed(3)} m`)};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','galecontainer');['CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=27;x.name='Upper-tier containers';x.sourceLocked=false;}});state.windEnabled=true;state.windSpeedKts=37;state.gustFactor=1.2;state.windDirection='port_to_starboard';}});
 Object.assign(scenarios.squallroro,{title:'Challenge 20 · AMCOL VOYAGER heavy squall',brief:'VOYAGER’s upper vehicle deck is heavily loaded during a 42 kn squall.',goal:'Keep squall wind ≥40 kn, achieve GM ≥2.0 m, |list| ≤2° and environmental arm ≤0.025 m.',tasks:['Lower the upper-deck load VCG where operationally possible.','Change wind exposure while keeping the squall active.','Retest.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-VOYAGER')&&state.windEnabled&&state.windSpeedKts>=40&&state.gm>=2&&Math.abs(state.equilibrium)<=2&&Math.abs(state.environmentHeelingArm)<=.025;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-VOYAGER','squallroro');const x=amcolScenarioAliasCargo('RR-5','Upper deck load');if(x)x.vcg=14.8;state.windEnabled=true;state.windSpeedKts=42;state.gustFactor=1.4;state.windDirection='port_to_starboard';state.rainIntensity=.85;state.visibilityNm=2;}});
 Object.assign(scenarios.currenttanker,{title:'Challenge 21 · AMCOL CHEMSTAR transverse current',brief:'AMCOL CHEMSTAR is exposed to a 2.4 kn transverse current using its chemical-tanker training draft and underwater projected area.',goal:'Keep current ≥2.0 kn ON, reduce environmental heeling arm to ≤0.001 m and |list| ≤1.5°.',tasks:['Keep current active.','Change relative current direction/ship heading away from beam current.','Retest.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-CHEMSTAR')&&state.currentEnabled&&state.currentSpeedKts>=2&&Math.abs(state.environmentHeelingArm)<=.001&&Math.abs(state.equilibrium)<=1.5;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-CHEMSTAR','currenttanker');state.currentEnabled=true;state.currentSpeedKts=2.4;state.currentDirection='port_to_starboard';}});
 Object.assign(scenarios.container_wind_wave,{title:'Challenge 22 · AMCOL NAVIGATOR wind + waves',brief:'NAVIGATOR combines high-tier cargo, 35 kn crosswind and a near-resonant beam-wave encounter.',goal:'Keep wind/waves ON, GM ≥1.8 m, environmental arm ≤0.020 m, non-beam waves and ≥25% encounter-period separation.',tasks:['Restore high-tier VCG margin.','Reduce transverse wind exposure.','Move wave encounter away from resonance and retest.'],check(){const te=calculateEncounterPeriod(),sep=state.naturalPeriod&&Number.isFinite(te)?Math.abs(te-state.naturalPeriod)/state.naturalPeriod:0;const pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.windEnabled&&state.waveEnabled&&state.gm>=1.8&&Math.abs(state.environmentHeelingArm)<=.020&&state.waveHeading!=='beam'&&sep>=.25;return {pass,message:amcolScenarioMetricMessage(`encounter sep ${(sep*100).toFixed(0)}%`)};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','container_wind_wave');['CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=27;x.name='Upper-tier containers';x.sourceLocked=false;}});state.windEnabled=true;state.windSpeedKts=35;state.gustFactor=1.18;state.windDirection='port_to_starboard';amcolScenarioSetWaveNearNatural(1.02);}});
 Object.assign(scenarios.roro_vehicle_shift,{title:'Challenge 23 · AMCOL VOYAGER vehicle shift + squall',brief:'A 1,000 t vehicle parcel shifts 5 m to starboard as a 42 kn squall develops. Total vehicle mass remains unchanged.',goal:'Keep squall ON, return shifted vehicles toward centreline, achieve |list| ≤2°, GM ≥2.0 m and environmental arm ≤0.025 m.',tasks:['Re-secure Shifted vehicles toward centreline.','Reduce transverse squall exposure without turning wind off.','Run TEST STABILITY.'],check(){const pass=amcolScenarioTrainingVesselIs('AMCOL-VOYAGER')&&state.windEnabled&&state.windSpeedKts>=40&&Math.abs(state.equilibrium)<=2&&state.gm>=2&&Math.abs(state.environmentHeelingArm)<=.025;return {pass,message:amcolScenarioMetricMessage()};},apply(){amcolScenarioApplyBase('AMCOL-VOYAGER','roro_vehicle_shift');amcolScenarioSplitCargo('RR-4',1000,'Shifted vehicles',{tcg:5,vcg:10.5});state.windEnabled=true;state.windSpeedKts=42;state.gustFactor=1.4;state.windDirection='port_to_starboard';state.rainIntensity=.85;}});
 Object.assign(scenarios.damage_counterballast,{title:'Challenge 24 · AMCOL MERIDIAN flooding counter-ballast',brief:'900 t of representative added floodwater acts on starboard. Use MERIDIAN’s actual WBT 1 pair for emergency teaching counter-ballast while damage remains active.',goal:'Keep damage ON, achieve |list| ≤3°, GM ≥1.0 m and deck edge clear.',tasks:['Observe floodwater moment.','Use Port WBT 1 to oppose the starboard floodwater moment.','Do not disable damage; retest.'],check(){const eq=hydroAtAngle(state.equilibrium),pass=amcolScenarioTrainingVesselIs('AMCOL-MERIDIAN')&&state.damage&&Math.abs(state.equilibrium)<=3&&state.gm>=1&&eq&&!eq.invalid&&!eq.deckEdgeImmersed;return {pass,message:amcolScenarioMetricMessage('damage remains active')};},apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','damage_counterballast');state.damage=true;state.damageMode='added';state.dmgMass=900;state.dmgVCG=3;state.dmgTCG=7;amcolScenarioSetPair('WBT-1-P','WBT-1-S',0,0);}});
 Object.assign(scenarios.lollrecovery,{title:'Challenge 25 · AMCOL NAVIGATOR recover negative GM',brief:'All NAVIGATOR container groups are raised to an emergency teaching VCG until initial GM becomes negative. Recover vertical stability before addressing any list.',goal:'Recover corrected GM ≥0.50 m, |list| ≤1° and positive intact GZ near upright.',tasks:['Confirm negative/small GM.','Lower container VCGs; transverse ballast alone is not the primary correction.','Run TEST STABILITY after GM is positive.'],check(){const g10=operationalGZAt(10),pass=amcolScenarioTrainingVesselIs('AMCOL-NAVIGATOR')&&state.gm>=.5&&Math.abs(state.equilibrium)<=1&&Number.isFinite(g10)&&g10>0;return {pass,message:amcolScenarioMetricMessage(`GZ10 ${Number.isFinite(g10)?g10.toFixed(3):'—'} m`)};},apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','lollrecovery');amcolScenarioRaiseContainerCargo(24.5);}});

 // Reference solutions tied to the same vessel data and actual tanks/spaces.
 Object.assign(scenarioReferenceSolutions,{
  ballastfix:{text:'Transfer WBT 1 so <b>Port 50% / Starboard 50%</b>. This conserves pair mass and removes the tank transverse moment.',apply(){amcolScenarioSetPair('WBT-1-P','WBT-1-S',50,50);}},
  deckcargolimit:{text:'Return <b>Upper-tier proposal</b> toward the NAVIGATOR Loaded Departure bay VCG of <b>18.0 m</b>.',apply(){const x=amcolScenarioCargoByName('Upper-tier proposal');if(x)x.vcg=18;}},
  ukcloadchallenge:{text:'Reduce all four MERIDIAN hold loads proportionally to about <b>90%</b> of their starting masses. Balanced unloading preserves trim while increasing UKC.',apply(){cargoItems.filter(x=>String(x.spaceId||'').startsWith('GC-H')).forEach(x=>{x.mass*=.90;x.autoMass=false;});}},
  freshwaterchallenge:{text:'Keep ρ = <b>1.000</b> and reduce <b>Movable cargo</b> until UKC reaches at least 1.00 m.',apply(){state.density=1;const x=amcolScenarioCargoByName('Movable cargo');if(x){for(let m=x.mass;m>=0;m-=25){x.mass=m;calculateAll({curve:false});if(state.ukc>=1.0)break;}}}},
  cargo_stbd_shift:{text:'Move <b>Shifted machinery</b> back to the centreline (TCG 0 m).',apply(){const x=amcolScenarioCargoByName('Shifted machinery');if(x){x.tcg=0;x.autoTCG=false;}}},
  passenger_roro:{text:'Keep the shifted group in place and use the actual <b>Anti-Heeling P/S</b> tanks. The reference solver searches a symmetric transfer that reduces list.',apply(){let best=null;for(let p=50;p<=100;p+=2){const s=100-p;amcolScenarioSetPair('ANTI-HEELING-P','ANTI-HEELING-S',p,s);calculateAll({curve:false});const q=Math.abs(state.equilibrium);if(!best||q<best.q)best={p,s,q};}if(best)amcolScenarioSetPair('ANTI-HEELING-P','ANTI-HEELING-S',best.p,best.s);}},
  ballast_highkg:{text:'Fill the low symmetrical reserve DB tanks <b>DB 1 P/S, DB 4 P/S and DB 5 P/S to 100%</b>.',apply(){['DB-1-P','DB-1-S','DB-4-P','DB-4-S','DB-5-P','DB-5-S'].forEach(id=>amcolScenarioSetTankFill(id,100));}},
  bulk_ore_asym:{text:'Re-centre the <b>Asymmetric ore parcel</b> to TCG 0 m.',apply(){const x=amcolScenarioCargoByName('Asymmetric ore parcel');if(x){x.tcg=0;x.autoTCG=false;}}},
  barge_deckload:{text:'Move <b>Deck unit</b> to TCG 0 m and restore its training deck VCG near 4.68 m.',apply(){const x=amcolScenarioCargoByName('Deck unit');if(x){x.tcg=0;x.autoTCG=false;x.vcg=4.68;}}},
  osv_deck_cargo:{text:'Re-centre <b>Deck cargo</b> and change the relative current direction to <b>Head current</b>.',apply(){const x=amcolScenarioCargoByName('Deck cargo');if(x){x.tcg=0;x.autoTCG=false;x.vcg=7.828;}state.currentDirection='head';}},
  density_ballast:{text:'Keep ρ = 1.010 and reduce all four MERIDIAN hold loads proportionally to about <b>94%</b> of their starting masses.',apply(){state.density=1.010;cargoItems.filter(x=>String(x.spaceId||'').startsWith('GC-H')).forEach(x=>{x.mass*=.94;x.autoMass=false;});}},
  slackrecover:{text:'Conserve the four-tank ballast mass by making <b>SBT 1/2 P/S = 100%</b> and <b>SBT 3/4 P/S = 0%</b>, removing four slack surfaces.',apply(){amcolScenarioSetPair('SBT-1-P','SBT-1-S',100,100);amcolScenarioSetPair('SBT-2-P','SBT-2-S',100,100);amcolScenarioSetPair('SBT-3-P','SBT-3-S',0,0);amcolScenarioSetPair('SBT-4-P','SBT-4-S',0,0);state.fse=true;}},
  heavyoutreach:{text:'Keep the 180 t lift suspended; reduce outreach to <b>3 m</b> and hook height to <b>15 m</b>.',apply(){state.crane=true;state.craneMass=180;state.craneOutreach=3;state.craneHeight=15;}},
  crane_port:{text:'Keep the 200 t lift on PORT; reduce outreach to <b>3 m</b> and hook height to <b>15 m</b>.',apply(){state.crane=true;state.craneMass=200;state.craneSide=-1;state.craneOutreach=3;state.craneHeight=15;}},
  crane_weather:{text:'Keep the 25 kn wind and 50 t lift active. Reduce outreach to <b>2 m</b>, hook to <b>12 m</b> and use <b>Head wind</b>.',apply(){state.crane=true;state.craneMass=50;state.craneOutreach=2;state.craneHeight=12;state.windEnabled=true;state.windSpeedKts=25;state.windDirection='head';}},
  tanker_fse_current:{text:'Set SBT 1/2 P/S = 100% and SBT 3/4 P/S = 0% and change relative current to <b>Head current</b>.',apply(){amcolScenarioSetPair('SBT-1-P','SBT-1-S',100,100);amcolScenarioSetPair('SBT-2-P','SBT-2-S',100,100);amcolScenarioSetPair('SBT-3-P','SBT-3-S',0,0);amcolScenarioSetPair('SBT-4-P','SBT-4-S',0,0);state.currentEnabled=true;state.currentDirection='head';state.fse=true;}},
  lng_ballast:{text:'Restore AURORA Wing 2 to its Loaded Departure balance: <b>40% Port / 40% Starboard</b>.',apply(){amcolScenarioSetPair('WING-2-P','WING-2-S',40,40);}},
  waveavoid:{text:'Keep waves ON; use a <b>quartering</b> heading and set wave period about <b>1.40 × natural roll period</b>.',apply(){state.waveEnabled=true;state.waveHeading='quartering';state.wavePeriod=Math.max(3,(state.naturalPeriod||8)*1.4);try{applyPhysicalWaveFromPeriod(true);}catch(e){}}},
  galecontainer:{text:'Restore affected NAVIGATOR bay VCGs to <b>18 m</b> and change the gale to <b>Head wind</b>.',apply(){cargoItems.filter(x=>x.name==='Upper-tier containers').forEach(x=>x.vcg=18);state.windEnabled=true;state.windDirection='head';}},
  squallroro:{text:'Restore the upper-deck load to its training VCG <b>12.9 m</b> and change the squall to <b>Head wind</b>.',apply(){const x=amcolScenarioCargoByName('Upper deck load');if(x)x.vcg=12.9;state.windEnabled=true;state.windDirection='head';}},
  currenttanker:{text:'Keep the 2.4 kn current active and select <b>Head current</b>.',apply(){state.currentEnabled=true;state.currentSpeedKts=2.4;state.currentDirection='head';}},
  container_wind_wave:{text:'Restore affected bay VCGs to 18 m, use <b>Head wind</b>, <b>quartering waves</b> and Te separated ≥25% from Tr.',apply(){cargoItems.filter(x=>x.name==='Upper-tier containers').forEach(x=>x.vcg=18);state.windEnabled=true;state.windDirection='head';state.waveEnabled=true;state.waveHeading='quartering';state.wavePeriod=Math.max(3,(state.naturalPeriod||8)*1.4);try{applyPhysicalWaveFromPeriod(true);}catch(e){}}},
  roro_vehicle_shift:{text:'Re-centre <b>Shifted vehicles</b> and change the squall to <b>Head wind</b> while keeping it active.',apply(){const x=amcolScenarioCargoByName('Shifted vehicles');if(x){x.tcg=0;x.autoTCG=false;}state.windEnabled=true;state.windDirection='head';}},
  damage_counterballast:{text:'Keep damage active. Fill <b>WBT 1 Port</b> as required to oppose the starboard floodwater moment; the reference solver searches the minimum useful fill.',apply(){state.damage=true;let best={f:0,q:Infinity};for(let f=0;f<=100;f+=2){amcolScenarioSetPair('WBT-1-P','WBT-1-S',f,0);calculateAll({curve:false});const q=Math.abs(state.equilibrium);if(q<best.q)best={f,q};}amcolScenarioSetPair('WBT-1-P','WBT-1-S',best.f,0);}},
  lollrecovery:{text:'Return NAVIGATOR container VCGs to their Loaded Departure training values (about <b>18.0 m</b>).',apply(){amcolScenarioRestoreAllCargo(['vcg']);}}
 });

 // Correction detection now follows actual cargo/tank edits rather than generic pseudo-ballast rows.
 Object.assign(challengeCorrectionRules,{
  ballastfix:[['ballastAny',null,['fill']]],deckcargolimit:[['cargoAny',null,['vcg']]],ukcloadchallenge:[['cargoAny',null,['mass']]],freshwaterchallenge:[['state',null,['density']],['cargoAny',null,['mass']]],cargo_stbd_shift:[['cargoAny',null,['tcg']]],passenger_roro:[['ballastAny',null,['fill']]],ballast_highkg:[['ballastAny',null,['fill']]],bulk_ore_asym:[['cargoAny',null,['tcg']],['ballastAny',null,['fill']]],barge_deckload:[['cargoAny',null,['tcg','vcg']]],osv_deck_cargo:[['cargoAny',null,['tcg','vcg']],['state',null,['currentDirection']]],density_ballast:[['cargoAny',null,['mass']]],slackrecover:[['ballastAny',null,['fill']]],heavyoutreach:[['state',null,['craneOutreach','craneHeight']]],crane_port:[['state',null,['craneOutreach','craneHeight']]],crane_weather:[['state',null,['craneOutreach','craneHeight','windDirection']]],tanker_fse_current:[['ballastAny',null,['fill']],['state',null,['currentDirection']]],lng_ballast:[['ballastAny',null,['fill']]],waveavoid:[['state',null,['waveHeading','wavePeriod','waveLength']]],galecontainer:[['cargoAny',null,['vcg']],['state',null,['windDirection']]],squallroro:[['cargoAny',null,['vcg']],['state',null,['windDirection']]],currenttanker:[['state',null,['currentDirection']]],container_wind_wave:[['cargoAny',null,['vcg']],['state',null,['windDirection','waveHeading','wavePeriod']]],roro_vehicle_shift:[['cargoAny',null,['tcg']],['state',null,['windDirection']]],damage_counterballast:[['ballastAny',null,['fill']]],lollrecovery:[['cargoAny',null,['vcg']]]
 });

 // Random stability missions also use the training fleet.
 const m=Object.fromEntries(stabilityMissions.map(x=>[x.key,x]));
 if(m.mission_highkg)Object.assign(m.mission_highkg,{title:'AMCOL NAVIGATOR · top-heavy cargo',brief:'AMCOL NAVIGATOR has several container groups raised above their Loaded Departure training VCG. Diagnose the vertical-stability problem and recover margin.',allowed:'Adjust container VCGs only; keep NAVIGATOR hydrostatics, KN data, ballast plan and lightship values.',target:'Corrected GM ≥1.80 m, |list| ≤1° and positive GZ near 10°.',apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','mission_highkg');['CS-BAY8','CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=29;x.name='Upper deck cargo';x.sourceLocked=false;}});},check(){return state.gm>=1.8&&Math.abs(state.equilibrium)<=1&&operationalGZAt(10)>0;}});
 if(m.mission_list)Object.assign(m.mission_list,{title:'AMCOL VOYAGER · persistent ballast list',brief:'AMCOL VOYAGER’s anti-heeling tank water is concentrated on Port, producing a steady list with positive GM.',allowed:'Use the actual Anti-Heeling P/S tank fills. Do not change hull, lightship or delete cargo.',target:'|list| ≤1°, GM ≥2.0 m.',apply(){amcolScenarioApplyBase('AMCOL-VOYAGER','mission_list');amcolScenarioSetPair('ANTI-HEELING-P','ANTI-HEELING-S',100,0);},check(){return Math.abs(state.equilibrium)<=1&&state.gm>=2;}});
 if(m.mission_fse)Object.assign(m.mission_fse,{title:'AMCOL OCEAN STAR · slack SBT stability loss',brief:'Four real SBTs on AMCOL OCEAN STAR are simultaneously slack.',allowed:'FSE must stay ON. Sequence SBT 2/3 P/S fills; do not alter hull/lightship.',target:'FSC ≤0.200 m and GM ≥5.0 m.',apply(){amcolScenarioApplyBase('AMCOL-OCEANSTAR','mission_fse');amcolScenarioSetSlack(['SBT-1-P','SBT-1-S','SBT-2-P','SBT-2-S','SBT-3-P','SBT-3-S','SBT-4-P','SBT-4-S'],50);state.fse=true;},check(){return state.fse&&state.fsc<=.200&&state.gm>=5;}});
 if(m.mission_crane)Object.assign(m.mission_crane,{title:'AMCOL MERIDIAN · heavy-lift operation',brief:'A 180 t project load is suspended high and outboard on AMCOL MERIDIAN.',allowed:'Keep crane ON and mass 180 t. Change only outreach/hook height.',target:'Outreach ≤4 m, |list| ≤2° and GM ≥1.5 m.',apply(){amcolScenarioApplyBase('AMCOL-MERIDIAN','mission_crane');state.crane=true;state.craneMass=180;state.craneHeight=25;state.craneOutreach=10;state.craneSide=1;},check(){return state.crane&&Math.abs(state.craneMass-180)<.1&&state.craneOutreach<=4&&Math.abs(state.equilibrium)<=2&&state.gm>=1.5;}});
 if(m.mission_combined)Object.assign(m.mission_combined,{title:'AMCOL NAVIGATOR · combined stability emergency',brief:'NAVIGATOR combines high container VCG, a Side 3 ballast imbalance and a near-resonant beam sea.',allowed:'Lower high-tier cargo, rebalance Side 3 P/S and move wave encounter away from resonance.',target:'GM ≥1.8 m, |list| ≤1.5°, wave encounter ≥25% away from Tr.',apply(){amcolScenarioApplyBase('AMCOL-NAVIGATOR','mission_combined');['CS-BAY9','CS-BAY10'].forEach(id=>{const x=amcolScenarioCargoBySpace(id);if(x){x.vcg=28;x.name='High cargo';x.sourceLocked=false;}});amcolScenarioSetPair('SIDE-3-P','SIDE-3-S',80,0);amcolScenarioSetWaveNearNatural(1.0);},check(){const te=calculateEncounterPeriod(),sep=state.naturalPeriod&&Number.isFinite(te)?Math.abs(te-state.naturalPeriod)/state.naturalPeriod:0;return state.gm>=1.8&&Math.abs(state.equilibrium)<=1.5&&sep>=.25;}});
 amcolScenarioRenameOptions();
}


function captureChallengeSnapshot(){const s={state:{},cargo:{},cargoById:{},ballast:{}};const stateKeys=new Set();Object.values(challengeCorrectionRules).flat().forEach(r=>{if(r[0]==='state')r[2].forEach(k=>stateKeys.add(k));});stateKeys.forEach(k=>s.state[k]=state[k]);cargoItems.forEach(it=>{const row={mass:it.mass,vcg:it.vcg,tcg:it.tcg,lcg:Number(it.lcg)||0};s.cargo[it.name]=row;s.cargoById[String(it.id)]=row;});ballastTanks.forEach(t=>s.ballast[String(t.id)]={fill:+t.fill||0,density:+t.density||0,lcg:+t.lcg||0,tcg:+t.tcg||0});return s;}
function valueChanged(a,b){if(typeof a==='number'||typeof b==='number')return Math.abs((Number(a)||0)-(Number(b)||0))>1e-6;return a!==b;}
function challengeCorrectionDetected(key){if(!challengeMeta[key]||!challengeBaselineSnapshot)return true;for(const [type,name,props] of (challengeCorrectionRules[key]||[])){if(type==='state'){for(const p of props)if(valueChanged(state[p],challengeBaselineSnapshot.state[p]))return true;}else if(type==='cargoAny'){for(const cur of cargoItems){const base=challengeBaselineSnapshot.cargoById?.[String(cur.id)];if(!base)continue;for(const p of props)if(valueChanged(cur[p],base[p]))return true;}}else if(type==='ballastAny'){for(const cur of ballastTanks){const base=challengeBaselineSnapshot.ballast?.[String(cur.id)];if(!base)continue;for(const p of props)if(valueChanged(cur[p],base[p]))return true;}}else if(type==='ballast'){const cur=ballastTanks.find(t=>String(t.id)===String(name)),base=challengeBaselineSnapshot.ballast?.[String(name)];if(!cur||!base)continue;for(const p of props)if(valueChanged(cur[p],base[p]))return true;}else{const cur=itemByName(name),base=challengeBaselineSnapshot.cargo[name];if(!cur||!base)continue;for(const p of props)if(valueChanged(cur[p],base[p]))return true;}}return false;}
function challengeOutcome(key){const sc=scenarios[key];if(!sc||typeof sc.check!=='function')return null;const target=sc.check(),changed=challengeCorrectionDetected(key),physical=currentGenericStabilityAssessment();return {pass:!!target.pass&&changed&&physical.pass,target,changed,physical};}
function missionCorrectionDetected(){if(!stabilityMission.active||!stabilityMission.initial)return true;const snap=stabilityMission.initial,eps=1e-6;for(const [k,v] of Object.entries(snap.state||{})){const cur=state[k];if(typeof v==='number'?Math.abs((Number(cur)||0)-v)>eps:cur!==v)return true;}const baseCargo=snap.cargo||[];if(baseCargo.length!==cargoItems.length)return true;for(const b of baseCargo){const c=cargoItems.find(x=>x.id===b.id||x.name===b.name);if(!c)return true;for(const p of ['mass','vcg','tcg','lcg'])if(Math.abs((Number(c[p])||0)-(Number(b[p])||0))>eps)return true;}const baseBallast=snap.ballast||[];if(baseBallast.length!==ballastTanks.length)return true;for(const b of baseBallast){const c=ballastTanks.find(x=>String(x.id)===String(b.id));if(!c)return true;if(Math.abs((+c.fill||0)-(+b.fill||0))>eps)return true;}return false;}

const weatherPresets={
 calm:{wind:0,gust:1.00,rain:0,visibility:20,label:'Calm / clear'},
 moderate:{wind:14,gust:1.05,rain:.05,visibility:12,label:'Moderate breeze'},
 fresh:{wind:19,gust:1.08,rain:.08,visibility:10,label:'Fresh breeze'},
 strong:{wind:25,gust:1.12,rain:.12,visibility:8,label:'Strong breeze'},
 gale:{wind:37,gust:1.20,rain:.30,visibility:5,label:'Gale'},
 squall:{wind:42,gust:1.40,rain:.85,visibility:2,label:'Heavy squall'},
 storm:{wind:52,gust:1.30,rain:.70,visibility:2.5,label:'Storm'}
};
const oceanDensityPresets={standard:1.025,tropical:1.023,dense:1.028,brackish:1.010,fresh:1.000};

function directionFactor(dir){
 if(dir==='port_to_starboard')return 1;
 if(dir==='starboard_to_port')return -1;
 if(dir==='quarter_port')return .70;
 if(dir==='quarter_starboard')return -.70;
 return 0;
}
function superstructureWindFactor(){
 return ({container:1.28,roro:1.22,ferry:1.22,lng:1.02,osv:1.00,general:.88,bulk:.78,tanker:.72,chemical:.76,box:.62})[state.hullType]||.85;
}
function updateAutoEnvironmentGeometry(){
 if(!state.eqDraft||!Number.isFinite(state.eqDraft))return;
 const freeboard=Math.max(.3,state.depth-state.eqDraft);
 if(state.autoWindage){
  state.windageArea=Math.max(10,state.length*freeboard*superstructureWindFactor());
  const extra=({container:.28,roro:.35,ferry:.35,lng:.26,osv:.25,general:.18,bulk:.12,tanker:.08,chemical:.10,box:.05})[state.hullType]||.15;
  state.windLever=Math.max(.5,.5*state.eqDraft+.5*freeboard+extra*state.depth);
 }
 if(state.autoCurrentArea){
  state.currentArea=Math.max(10,state.length*state.eqDraft*.85);
  state.currentLever=Math.max(.25,Math.abs(state.kgCorr-state.eqDraft*.5));
 }
}
function heelProjectionFactor(angleDeg=state.heel){if(state.physicsFidelity==='teaching')return 1;const c=Math.max(.2,Math.cos((Number(angleDeg)||0)*Math.PI/180));return .65+.35*c;}
function windHeelingMomentN(angleDeg=state.heel){if(!state.windEnabled||state.windSpeedKts<=0)return 0;const rhoAir=1.225,v=state.windSpeedKts*.514444*Math.max(1,state.gustFactor),proj=heelProjectionFactor(angleDeg),force=.5*rhoAir*state.windCd*(state.windageArea*proj)*v*v;return directionFactor(state.windDirection)*force*(state.windLever*proj);}
function currentTransverseVelocity(){const v=state.currentSpeedKts*.514444;if(state.physicsFidelity==='teaching'||state.currentMode!=='vector')return {v:Math.abs(v*directionFactor(state.currentDirection)),sign:Math.sign(directionFactor(state.currentDirection)||1),label:'relative preset'};const rel=((Number(state.currentSetDeg)-Number(state.shipHeadingDeg)+540)%360)-180,vt=v*Math.sin(rel*Math.PI/180);return {v:Math.abs(vt),sign:Math.sign(vt||1),label:`set ${Number(state.currentSetDeg).toFixed(0)}°T / hdg ${Number(state.shipHeadingDeg).toFixed(0)}°T`};}
function currentHeelingMomentN(angleDeg=state.heel){if(!state.currentEnabled||state.currentSpeedKts<=0)return 0;const rho=state.density*1000,flow=currentTransverseVelocity(),proj=heelProjectionFactor(angleDeg),force=.5*rho*state.currentCd*(state.currentArea*proj)*flow.v*flow.v;return flow.sign*force*(state.currentLever*proj);}
function environmentalHeelingMomentN(angleDeg=state.heel){
 updateAutoEnvironmentGeometry();
 return windHeelingMomentN(angleDeg)+currentHeelingMomentN(angleDeg);
}
function environmentalResidual(angle){
 const gz=operationalGZAt(angle);if(!Number.isFinite(gz))return NaN;
 const m=Math.max(1,state.dispMass*1000);
 return gz-environmentalHeelingMomentN(angle)/(m*G);
}
function updateEnvironmentReadout(){
 const el=document.getElementById('environmentReadout');if(!el)return;
 updateAutoEnvironmentGeometry();
 const wm=windHeelingMomentN()/1000,cm=currentHeelingMomentN()/1000,total=wm+cm;
 state.environmentMoment=total*1000;
 state.environmentHeelingArm=state.dispMass>0?(total*1000)/(state.dispMass*1000*G):0;
 const w=state.windEnabled?`${state.windSpeedKts.toFixed(0)} kn × gust ${state.gustFactor.toFixed(2)} · ${wm>=0?'+':''}${wm.toFixed(0)} kN·m`:'OFF';
 const cf=currentTransverseVelocity();const c=state.currentEnabled?`${state.currentSpeedKts.toFixed(1)} kn · ${cf.label} · transverse ${(cf.v/.514444).toFixed(2)} kn · ${cm>=0?'+':''}${cm.toFixed(0)} kN·m`:'OFF';
 el.innerHTML=`Weather ${weatherPresets[state.weatherPreset]?.label||'Custom'} · Wind ${w}<br>Current ${c} · <b>Total steady moment ${total>=0?'+':''}${total.toFixed(0)} kN·m</b> · heeling arm ${state.environmentHeelingArm>=0?'+':''}${state.environmentHeelingArm.toFixed(3)} m`;
}
function applyWeatherPreset(key){
 state.weatherPreset=key;
 if(key==='custom'){updateEnvironmentReadout();return;}
 const p=weatherPresets[key]||weatherPresets.calm;
 state.windSpeedKts=p.wind;state.gustFactor=p.gust;state.rainIntensity=p.rain;state.visibilityNm=p.visibility;
 state.windEnabled=p.wind>0;
 syncEnvironmentForm();calculateAll();
}
function applyOceanPreset(key){
 state.oceanPreset=key;
 if(key!=='custom'&&oceanDensityPresets[key])state.density=oceanDensityPresets[key];
 syncFormFromState();calculateAll();
}
function syncEnvironmentForm(){
 const map={inputWeatherPreset:'weatherPreset',inputWindSpeed:'windSpeedKts',inputGustFactor:'gustFactor',inputWindDirection:'windDirection',inputWindageArea:'windageArea',inputWindLever:'windLever',inputWindCd:'windCd',inputOceanPreset:'oceanPreset',inputCurrentSpeed:'currentSpeedKts',inputCurrentDirection:'currentDirection',inputCurrentArea:'currentArea',inputCurrentLever:'currentLever',inputCurrentCd:'currentCd',inputCurrentMode:'currentMode',inputShipHeading:'shipHeadingDeg',inputCurrentSet:'currentSetDeg',inputRainIntensity:'rainIntensity',inputVisibility:'visibilityNm'};
 Object.entries(map).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.value=state[k]});
 const we=document.getElementById('checkWindEnabled'),ce=document.getElementById('checkCurrentEnabled'),aw=document.getElementById('checkAutoWindage'),ac=document.getElementById('checkAutoCurrentArea');
 if(we)we.checked=state.windEnabled;if(ce)ce.checked=state.currentEnabled;if(aw)aw.checked=state.autoWindage;if(ac)ac.checked=state.autoCurrentArea;
 updateEnvironmentReadout();
}
function resetEnvironment(){
 state.lightshipLCG=0;state.craneLCG=0;
 state.weatherPreset='calm';state.windEnabled=false;state.windSpeedKts=0;state.gustFactor=1;state.windDirection='port_to_starboard';state.windCd=1.10;state.autoWindage=true;
 state.oceanPreset='standard';state.currentEnabled=false;state.currentSpeedKts=0;state.currentDirection='port_to_starboard';state.currentCd=1.00;state.autoCurrentArea=true;
 state.rainIntensity=0;state.visibilityNm=12;state.density=1.025;
 syncFormFromState();calculateAll();updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
}

function resetCore(){
 state.companyName='';state.vesselName='';state.visualReferenceDraft=null;state.visualReferenceDraftSource='calculated condition';state.geometryUprightDraft=0;state.visualHeelDraftDelta=0;
 state.hydroDataKey='geometry';state.hydroDataReference=null;state.sourceConditionKey=null;state.amcolTrainingVesselId=null;window.AMCOL_ACTIVE_TANK_CALIBRATION=[];window.AMCOL_ACTIVE_STRUCTURAL_LIMITS=[];window.AMCOL_ACTIVE_TRAINING_CONDITIONS=[];if(window.AMCOL_CUSTOM_HULL_FORM?.trainingModel)window.AMCOL_CUSTOM_HULL_FORM=null;
 state.fse=false;state.individualBallastFSE=false;state.ballastTankPhysics=[];state.fsmGeneric=0;state.fsmIndividual=0;state.strength=null;state.coupledValid=false;state.coupledMode='full';state.coupledHydro=null;
 state.crane=false;state.damage=false;state.damageMode='added';state.dmgLCG=0;state.damageLengthPct=20;state.damageLCG=0;state.heel=0;state.waterDepth=15;state.density=1.025;state.tankCount=1;state.tankLength=20;state.tankBreadth=8;state.tankDensity=1.025;state.tankFill=50;state.waveMoment=0;state.waveEnabled=false;state.waveHeight=1.5;state.waveLength=60;state.waveSpeed=12;state.wavePeriod=5;state.waveHeading='beam';state.waveGain=1.0;state.rollMode='free';state.shipSpeedKts=0;state.parametricVariation=.20;state.encounterPeriod=null;state.dynamicRisk=null;state.physicsFidelity='enhanced';state.waveModel='physical';state.quadraticDamping=.35;state.shipHeadingDeg=0;state.currentMode='relative';state.currentSetDeg=90;state.ballastPlanEnabled=false;state.ballastPlanSource='none';state.ballastPlanLabel='No ballast tank plan';ballastTanks=[];
 state.weatherPreset='calm';state.windEnabled=false;state.windSpeedKts=0;state.gustFactor=1;state.windDirection='port_to_starboard';state.autoWindage=true;state.windCd=1.10;state.rainIntensity=0;state.visibilityNm=12;
 state.oceanPreset='standard';state.currentEnabled=false;state.currentSpeedKts=0;state.currentDirection='port_to_starboard';state.autoCurrentArea=true;state.currentCd=1.00;
 cancelStabilityTestRuntime();dynPhi=0;dynOmega=0;dynTime=0;lastFrameTime=null;
 if(window.AMCOL_CUSTOM_HULL_FORM?.enabled&&!window.AMCOL_CUSTOM_HULL_FORM.vesselName)window.AMCOL_CUSTOM_HULL_FORM=null;
}

function makeHullPolygon(type,B,D){
 const shared=window.AMCOLPhysics?.hull?.midshipPolygon;
 if(shared)return shared(type,B,D);
 // Compatibility fallback only; normal releases load the shared hull-geometry kernel first.
 if(type==='box') return [[-B/2,0],[B/2,0],[B/2,D],[-B/2,D]];
 if(type==='roro'||type==='ferry') return [[-0.45*B,0],[0.45*B,0],[0.50*B,0.16*D],[0.50*B,D],[-0.50*B,D],[-0.50*B,0.16*D]];
 if(type==='container') return [[-0.33*B,0],[0.33*B,0],[0.46*B,0.15*D],[0.50*B,0.43*D],[0.50*B,D],[-0.50*B,D],[-0.50*B,0.43*D],[-0.46*B,0.15*D]];
 if(type==='bulk') return [[-0.31*B,0],[0.31*B,0],[0.45*B,0.13*D],[0.50*B,0.42*D],[0.48*B,D],[-0.48*B,D],[-0.50*B,0.42*D],[-0.45*B,0.13*D]];
 if(type==='tanker'||type==='chemical') return [[-0.36*B,0],[0.36*B,0],[0.48*B,0.12*D],[0.50*B,0.32*D],[0.50*B,D],[-0.50*B,D],[-0.50*B,0.32*D],[-0.48*B,0.12*D]];
 if(type==='lng') return [[-0.34*B,0],[0.34*B,0],[0.47*B,0.12*D],[0.50*B,0.36*D],[0.49*B,D],[-0.49*B,D],[-0.50*B,0.36*D],[-0.47*B,0.12*D]];
 if(type==='osv') return [[-0.26*B,0],[0.26*B,0],[0.42*B,0.18*D],[0.50*B,0.52*D],[0.48*B,D],[-0.48*B,D],[-0.50*B,0.52*D],[-0.42*B,0.18*D]];
 return [[-0.28*B,0],[0.28*B,0],[0.43*B,0.16*D],[0.50*B,0.48*D],[0.50*B,D],[-0.50*B,D],[-0.50*B,0.48*D],[-0.43*B,0.16*D]];
}
function transformPoly(poly,phi,sink){const c=Math.cos(phi),s=Math.sin(phi);return poly.map(([x,y])=>[x*c+y*s,-x*s+y*c+sink]);}
function bodyToWorld(x,y,phi,sink){const c=Math.cos(phi),s=Math.sin(phi);return [x*c+y*s,-x*s+y*c+sink];}
function clipBelowWater(poly){
 const out=[]; if(!poly.length)return out;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ina=a[1]<=0,inb=b[1]<=0;
  if(ina) out.push(a);
  if(ina!==inb){const t=(0-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),0]);}
 }
 return out;
}
function polygonAreaCentroid(poly){
 if(poly.length<3)return {area:0,cx:0,cy:0};let A=0,Cx=0,Cy=0;
 for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%poly.length],cr=x1*y2-x2*y1;A+=cr;Cx+=(x1+x2)*cr;Cy+=(y1+y2)*cr;}
 A*=0.5;if(Math.abs(A)<1e-12)return {area:0,cx:0,cy:0};return {area:Math.abs(A),cx:Cx/(6*A),cy:Cy/(6*A)};
}
function waterlineWidth(poly){
 const xs=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(Math.abs(a[1])<1e-9)xs.push(a[0]);if((a[1]<0&&b[1]>0)||(a[1]>0&&b[1]<0)){const t=-a[1]/(b[1]-a[1]);xs.push(a[0]+t*(b[0]-a[0]));}}
 return xs.length>=2?Math.max(...xs)-Math.min(...xs):0;
}
function damageRectBody(){
 const sign=state.damageSide;const B=state.beam,D=state.depth;const w=B*(state.damageWidth/100);const x2=sign*B/2;const x1=x2-sign*w;const h=D*(state.damageHeight/100);return [[x1,0],[x2,0],[x2,h],[x1,h]];
}
function damageLongitudinalFraction(){return Math.max(.02,Math.min(.80,(Number(state.damageLengthPct)||20)/100));}
function damageAppliesAtLongitudinal(longitudinal){const half=Math.max(1,state.length)*damageLongitudinalFraction()/2;return Math.abs((Number(longitudinal)||0)-(Number(state.damageLCG)||0))<=half;}
function buoyancyAt(phi,sink){
 const hull=transformPoly(makeHullPolygon(state.hullType,state.beam,state.depth),phi,sink);const sub=clipBelowWater(hull);const base=polygonAreaCentroid(sub);let area=base.area,cx=base.cx,cy=base.cy;
 let damagedSub=[];
 if(state.damage&&state.damageMode==='lost'){
  const dr=transformPoly(damageRectBody(),phi,sink);damagedSub=clipBelowWater(dr);const da=polygonAreaCentroid(damagedSub);const remove=state.damagePerm*da.area*damageLongitudinalFraction();
  if(area-remove>1e-8){cx=(area*cx-remove*da.cx)/(area-remove);cy=(area*cy-remove*da.cy)/(area-remove);area-=remove;}
 }
 return {area,cx,cy,hull,sub,damagedSub,bwl:waterlineWidth(hull)};
}
function solveSinkage(phi,targetArea){
 const D=state.depth;let lo=-3*D,hi=3*D;
 for(let i=0;i<64;i++){const mid=(lo+hi)/2;const a=buoyancyAt(phi,mid).area;if(a>targetArea)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
function hydroAtAngle(angleDeg){
 const phi=angleDeg*Math.PI/180;const target=state.dispMass/state.density/state.length;const full=polygonAreaCentroid(makeHullPolygon(state.hullType,state.beam,state.depth)).area;
 const maxEffective=buoyancyAt(phi,-3*state.depth).area;
 if(target>Math.min(full,maxEffective)*0.999)return {invalid:true,reason:'Displacement exceeds the available buoyancy capacity for this hull/damage condition.'};
 const sink=solveSinkage(phi,target);const b=buoyancyAt(phi,sink),effG=effectiveCGAtHeel(angleDeg);const [gx,gy]=bodyToWorld(effG.tcg,effG.kg,phi,sink);const gz=b.cx-gx;
 const port=bodyToWorld(-state.beam/2,state.depth,phi,sink);const stbd=bodyToWorld(state.beam/2,state.depth,phi,sink);
 return {invalid:false,phi,sink,bx:b.cx,by:b.cy,gx,gy,gz,hull:b.hull,sub:b.sub,damagedSub:b.damagedSub,bwl:b.bwl,portFreeboard:port[1],stbdFreeboard:stbd[1],deckEdgeImmersed:Math.min(port[1],stbd[1])<=0};
}

function representativeDownfloodingPoints(){
 const hp=hydroPack();if(hp.kind==='uploadedBundle'&&Array.isArray(hp.openings)&&hp.openings.length){return hp.openings.filter(o=>!o.watertight).flatMap(o=>{const side=o.side==='port'||o.side==='starboard'?o.side:null;if(side)return [{...o,side,source:'uploaded opening coordinates'}];if(Math.abs(o.x)<1e-6)return [{...o,side:'port',source:'uploaded opening coordinates'},{...o,side:'starboard',source:'uploaded opening coordinates'}];return [{...o,side:o.x<0?'port':'starboard',source:'uploaded opening coordinates'}];});}
 const B=Math.max(1,state.beam),D=Math.max(1,state.depth),type=state.hullType;
 const cfg={
  container:{x:.39,y:1.10,label:'side access / vent opening'},bulk:{x:.40,y:1.08,label:'deck ventilation opening'},general:{x:.39,y:1.07,label:'weather-deck opening'},
  roro:{x:.43,y:1.34,label:'vehicle-deck ventilation opening'},ferry:{x:.43,y:1.38,label:'vehicle/passenger ventilation opening'},
  tanker:{x:.40,y:1.16,label:'cargo-deck vent opening'},chemical:{x:.40,y:1.17,label:'cargo-deck vent opening'},lng:{x:.39,y:1.20,label:'gas-deck ventilation opening'},
  osv:{x:.38,y:1.12,label:'working-deck opening'},box:{x:.42,y:1.04,label:'deck opening'}
 }[type]||{x:.39,y:1.07,label:'weather-deck opening'};
 return [
  {name:`Port ${cfg.label}`,side:'port',x:-cfg.x*B,y:cfg.y*D,source:'representative'},
  {name:`Starboard ${cfg.label}`,side:'starboard',x:cfg.x*B,y:cfg.y*D,source:'representative'}
 ];
}
function openingWorldHeight(point,angleDeg){
 const h=hydroAtAngle(angleDeg);if(!h||h.invalid)return NaN;
 const phi=angleDeg*Math.PI/180,theta=(Number(state.trimAngle)||0)*Math.PI/180;
 return coupledWorldPoint(point.x,point.y,Number(point.lcg)||0,phi,theta,h.sink).y;
}
function representativeOpeningDownflood(side='starboard'){
 const sign=side==='port'?-1:1,points=representativeDownfloodingPoints().filter(p=>p.side===side);
 let best=null;
 points.forEach(point=>{
  let prevA=0,prev=openingWorldHeight(point,0);
  for(let mag=1;mag<=85;mag+=1){
   const a=sign*mag,v=openingWorldHeight(point,a);
   if(Number.isFinite(prev)&&Number.isFinite(v)&&prev>0&&v<=0){
    let lo=prevA,hi=mag;
    for(let i=0;i<30;i++){const mid=(lo+hi)/2,mv=openingWorldHeight(point,sign*mid);if(mv>0)lo=mid;else hi=mid;}
    const angle=(lo+hi)/2;if(!best||angle<best.angle)best={angle,name:point.name,source:point.source||'representative opening'};break;
   }
   prevA=mag;prev=v;
  }
 });
 return best;
}

const ballastFluidPresets={seawater:{label:'Seawater',density:1.025},fresh:{label:'Fresh water',density:1.000},brackish:{label:'Brackish water',density:1.010},custom:{label:'Custom liquid',density:null}};
function defaultBallastFluidKey(){return document.getElementById('defaultBallastFluid')?.value||'seawater';}
function defaultBallastFillValue(){return Math.max(0,Math.min(100,Number(document.getElementById('defaultBallastFill')?.value)||0));}
function ballastTankZoneFromLCG(lcg){const x=(Number(lcg)||0)/Math.max(1,state.length);if(x<=-.34)return'aft_peak';if(x<-.12)return'aft';if(x<.12)return'mid';if(x<.34)return'forward';return'fore_peak';}
function ballastZoneLCG(zone){const L=state.length;return ({aft_peak:-.455,aft:-.23,mid:0,forward:.23,fore_peak:.455})[zone]*L;}
function ballastTankVolume(t){return Math.max(.1,Number(t.length)||.1)*Math.max(.1,Number(t.breadth)||.1)*Math.max(.1,Number(t.height)||.1)*Math.max(.1,Math.min(1,Number.isFinite(Number(t.blockFactor))?Number(t.blockFactor):.85));}
function ballastTankFullCapacity(t){return t.autoCapacity?ballastTankVolume(t)*Math.max(.1,Number(t.density)||1.025):Math.max(0,Number(t.capacity)||0);}
function ballastTankMass(t){if(t?.sourceLocked&&Number.isFinite(Number(t.sourceMass)))return Math.max(0,Number(t.sourceMass));return ballastTankFullCapacity(t)*Math.max(0,Math.min(100,Number(t.fill)||0))/100;}
function ballastTankLiquidVCG(t){if(t?.sourceLocked&&Number.isFinite(Number(t.sourceVCG)))return Number(t.sourceVCG);const f=Math.max(0,Math.min(1,(Number(t.fill)||0)/100)),bottom=Math.max(0,Number(t.bottom)||0),h=Math.max(.05,Number(t.height)||.05);return bottom+(f*h)/2;}
function ballastTankFSM(t){if(t?.sourceLocked&&Number.isFinite(Number(t.sourceFSM)))return Math.max(0,Number(t.sourceFSM));const f=Math.max(0,Math.min(1,(Number(t.fill)||0)/100));if(f<=.001||f>=.98)return 0;const l=Math.max(.1,Number(t.length)||.1),b=Math.max(.1,Number(t.breadth)||.1),rho=Math.max(.1,Number(t.density)||1.025),factor=Math.max(0,Math.min(1,Number.isFinite(Number(t.fsmFactor))?Number(t.fsmFactor):1));return rho*l*Math.pow(b,3)/12*factor;}

// Phase 19B: finite-angle rectangular free-surface geometry for Enhanced/Vessel modes.
// The liquid surface remains earth-horizontal while the tank rotates with the ship. Source-locked
// tanks with published FSM but only representative geometry retain their published initial FSC
// instead of inventing a finite-angle centroid path.
function clipPolygonBelowLinearSurface(poly,phi,level){
 const c=Math.cos(phi),sp=Math.sin(phi),out=[];if(!poly?.length)return out;
 const H=p=>(-p[0]*sp+p[1]*c)-level;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ha=H(a),hb=H(b),ina=ha<=0,inb=hb<=0;
  if(ina)out.push(a);
  if(ina!==inb){const t=ha/(ha-hb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
 }
 return out;
}
function rectangularLiquidCentroidAtHeel({tcg=0,bottom=0,breadth=1,height=1,fill=.5},angleDeg=0){
 const b=Math.max(.02,Number(breadth)||.02),h=Math.max(.02,Number(height)||.02),f=Math.max(0,Math.min(1,Number(fill)||0)),x=Number(tcg)||0,y=Number(bottom)||0;
 const upright={x,y:y+f*h/2};
 if(f<=1e-6)return {x,y,area:0,valid:true};
 if(f>=1-1e-6)return {x,y:y+h/2,area:b*h,valid:true};
 const poly=[[x-b/2,y],[x+b/2,y],[x+b/2,y+h],[x-b/2,y+h]],target=b*h*f,phi=(Number(angleDeg)||0)*Math.PI/180;
 const projected=poly.map(p=>-p[0]*Math.sin(phi)+p[1]*Math.cos(phi));let lo=Math.min(...projected)-h-b,hi=Math.max(...projected)+h+b,sub=[];
 for(let i=0;i<52;i++){const mid=(lo+hi)/2,candidate=clipPolygonBelowLinearSurface(poly,phi,mid),a=polygonAreaCentroid(candidate).area;if(a<target)lo=mid;else hi=mid;sub=candidate;}
 sub=clipPolygonBelowLinearSurface(poly,phi,(lo+hi)/2);const cg=polygonAreaCentroid(sub);
 return cg.area>1e-9?{x:cg.cx,y:cg.cy,area:cg.area,valid:true}:{...upright,area:target,valid:false};
}
function finiteAngleLiquidCG(angleDeg=0){
 const base={tcg:state.tcg,kg:state.kgCorr,active:false,modelledFSM:0,residualFSC:state.fsc,ballastCount:0,cargoCount:0};
 if(!state.fse||state.physicsFidelity==='teaching'||state.dispMass<=0)return base;
 let tm=state.tcg*state.dispMass,vm=state.kgSolid*state.dispMass,modelledFSM=0,ballastCount=0,cargoCount=0;
 if(state.ballastPlanEnabled&&Array.isArray(ballastTanks))ballastTanks.forEach(t=>{
  const fill=Math.max(0,Math.min(1,(Number(t.fill)||0)/100)),m=ballastTankMass(t);if(m<=0||fill<=.001||fill>=.999)return;
  // Keep exact/source FSM authoritative when the transverse tank shape itself is not source-backed.
  if(t.sourceLocked&&Number.isFinite(Number(t.sourceFSM)))return;
  const cg=rectangularLiquidCentroidAtHeel({tcg:Number(t.tcg)||0,bottom:Number(t.bottom)||0,breadth:Number(t.breadth)||.1,height:Number(t.height)||.1,fill},angleDeg);if(!cg.valid)return;
  const ux=Number(t.tcg)||0,uy=ballastTankLiquidVCG(t);tm+=m*(cg.x-ux);vm+=m*(cg.y-uy);modelledFSM+=ballastTankFSM(t);ballastCount++;
 });
 cargoItems.forEach(it=>{
  ensureCargoPhysicsItem(it);if(it.physicsClass!=='liquid'||it.sourceLocked)return;const fill=Math.max(0,Math.min(1,(Number(it.fill)||0)/100));if(fill<=.001||fill>=.999)return;
  const sp=cargoSpaceById(it.spaceId),m=cargoPhysicsMass(it);if(!sp||m<=0)return;
  const cg=rectangularLiquidCentroidAtHeel({tcg:Number(it.tcg??sp.tcg)||0,bottom:Number(sp.bottom)||0,breadth:Number(sp.breadth)||.1,height:Number(sp.height)||.1,fill},angleDeg);if(!cg.valid)return;
  const ux=Number(it.tcg??sp.tcg)||0,uy=cargoPhysicsVCG(it);tm+=m*(cg.x-ux);vm+=m*(cg.y-uy);modelledFSM+=cargoLiquidFSM(it);cargoCount++;
 });
 const totalFSM=Math.max(0,(state.fsmGeneric||0)+(state.fsmIndividual||0)),residualFSM=Math.max(0,totalFSM-modelledFSM),residualFSC=residualFSM/state.dispMass;
 const result={tcg:tm/state.dispMass,kg:vm/state.dispMass+residualFSC,active:ballastCount+cargoCount>0,modelledFSM,residualFSC,ballastCount,cargoCount};state.finiteAngleLiquid=result;return result;
}
function effectiveCGAtHeel(angleDeg=0){return finiteAngleLiquidCG(angleDeg);}
function calculateMassProperties(){
 const items=[];
 cargoItems.forEach(raw=>{const it=syncCargoComputedFields(raw),mass=cargoPhysicsMass(it),vcg=cargoPhysicsVCG(it);items.push({mass,vcg,tcg:Number(it.tcg)||0,lcg:Number(it.lcg)||0});});
 if(state.ballastPlanEnabled&&Array.isArray(ballastTanks))ballastTanks.forEach(t=>{const mass=ballastTankMass(t);if(mass<=0)return;items.push({mass,vcg:ballastTankLiquidVCG(t),tcg:Number(t.tcg)||0,lcg:Number(t.lcg)||0});});
 if(state.crane)items.push({mass:state.craneMass,vcg:state.craneHeight,tcg:state.craneOutreach*state.craneSide,lcg:state.craneLCG||0});
 if(state.damage&&state.damageMode==='added')items.push({mass:state.dmgMass,vcg:state.dmgVCG,tcg:state.dmgTCG,lcg:state.dmgLCG||0});
 const agg=AMCOLPhysics.mass.aggregate({lightship:{mass:state.lightshipMass,kg:state.lightshipKG,tcg:state.lightshipTCG,lcg:state.lightshipLCG||0},items});
 state.dispMass=agg.mass;state.kgSolid=agg.kgSolid;state.tcg=agg.tcg;state.lcg=agg.lcg;
 let genericFSM=0,individualFSM=0,cargoFSM=0;
 // The Free Surface switch is global: OFF means no FSM/FSC is applied anywhere.
 // Source/workbook conditions that contain a documented FSC load with state.fse=true.
 if(state.fse){
   if(state.tankFill>0&&state.tankFill<100&&!state.individualBallastFSE&&!state.ballastPlanEnabled){const i=state.tankLength*Math.pow(state.tankBreadth,3)/12;genericFSM=state.tankCount*i*state.tankDensity;}
   if(state.ballastPlanEnabled&&Array.isArray(ballastTanks))individualFSM+=ballastTanks.reduce((a,t)=>a+ballastTankFSM(t),0);
   cargoFSM=cargoItems.reduce((a,it)=>a+cargoLiquidFSM(it),0);individualFSM+=cargoFSM;
   if(state.individualBallastFSE&&Array.isArray(state.ballastTankPhysics)&&!state.ballastPlanEnabled){state.ballastTankPhysics.forEach(t=>{const fill=Math.max(0,Math.min(1,Number(t.fill)||0));if(fill>.001&&fill<.999){const l=Math.max(.1,Number(t.length)||0),b=Math.max(.1,Number(t.breadth)||0),rho=Math.max(.1,Number(t.density)||1.025);individualFSM+=rho*l*Math.pow(b,3)/12;}});}
 }
 const fs=AMCOLPhysics.mass.applyFreeSurface({displacement:state.dispMass,kgSolid:state.kgSolid,genericFSM,individualFSM,cargoFSM});
 state.fsmGeneric=fs.genericFSM;state.fsmIndividual=fs.individualFSM;state.cargoFSM=fs.cargoFSM;state.fsc=fs.fsc;state.kgCorr=fs.kgCorr;
 const fse=document.getElementById('fseReadout');if(fse)fse.textContent=state.fse?`FSM ${fs.totalFSM.toFixed(0)} t·m (${cargoFSM>0?'ballast + cargo liquids':state.ballastPlanEnabled?'ballast plan':state.individualBallastFSE?'individual ballast':'generic'}) · FSC ${state.fsc.toFixed(3)} m · KGsolid ${state.kgSolid.toFixed(3)} m → KGcorr ${state.kgCorr.toFixed(3)} m`:`Free Surface OFF · FSC 0.000 m · KGsolid = KGcorr ${state.kgCorr.toFixed(3)} m`;
}

function smoothStep01(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
window.AMCOL_HULL_STATION_ENVELOPES=window.AMCOL_HULL_STATION_ENVELOPES||{
 container:[[.35,1,.72,0,0],[.58,.995,.70,.012,.004],[.72,.965,.63,.030,.014],[.84,.86,.52,.060,.038],[.92,.66,.38,.100,.075],[.97,.38,.21,.135,.120],[1,.055,.065,.155,.155]],
 bulk:[[.42,1,.74,0,0],[.64,.998,.72,.010,.003],[.78,.975,.67,.025,.012],[.88,.90,.57,.052,.030],[.95,.66,.39,.090,.070],[.985,.31,.19,.122,.115],[1,.065,.075,.140,.145]],
 general:[[.38,1,.72,0,0],[.60,.995,.70,.012,.004],[.75,.965,.62,.032,.016],[.86,.84,.49,.066,.043],[.94,.59,.33,.105,.085],[.98,.30,.17,.135,.128],[1,.055,.065,.150,.150]],
 roro:[[.48,1,.76,0,0],[.70,.998,.74,.008,.002],[.84,.955,.64,.024,.010],[.93,.76,.45,.050,.030],[.98,.40,.23,.072,.060],[1,.085,.085,.082,.078]],
 ferry:[[.48,1,.76,0,0],[.70,.998,.74,.010,.002],[.84,.96,.64,.028,.012],[.93,.78,.46,.058,.034],[.98,.42,.24,.080,.065],[1,.085,.085,.092,.084]],
 tanker:[[.50,1,.78,0,0],[.70,1,.77,.008,.002],[.83,.975,.71,.020,.009],[.91,.88,.59,.045,.025],[.96,.66,.42,.070,.050],[.99,.30,.21,.090,.082],[1,.075,.085,.100,.100]],
 chemical:[[.48,1,.77,0,0],[.69,1,.76,.009,.002],[.82,.97,.69,.022,.010],[.91,.86,.57,.048,.028],[.96,.63,.40,.075,.055],[.99,.29,.20,.096,.088],[1,.07,.08,.108,.108]],
 lng:[[.50,1,.79,0,0],[.71,1,.77,.008,.002],[.84,.98,.71,.021,.010],[.92,.88,.58,.047,.027],[.97,.62,.39,.074,.054],[.99,.29,.20,.096,.088],[1,.075,.085,.108,.108]],
 osv:[[.36,1,.70,0,0],[.58,.995,.68,.016,.005],[.73,.96,.60,.040,.020],[.84,.84,.48,.078,.050],[.93,.61,.32,.118,.095],[.98,.30,.17,.150,.140],[1,.055,.065,.165,.165]],
 box:[[.72,1,.90,0,0],[.88,.96,.86,.005,.003],[.96,.90,.80,.012,.010],[1,.84,.78,.020,.015]],
 axe:[[.30,1,.68,0,0],[.58,.92,.60,.020,.015],[.76,.72,.48,.050,.050],[.90,.44,.30,.090,.105],[1,.055,.07,.115,.170]]
};
const MAIN_HULL_STERN_FULL={container:.72,bulk:.76,general:.73,roro:.86,ferry:.86,tanker:.88,chemical:.86,lng:.89,osv:.70,box:.97,axe:.70};
function interpolateMainHullEnvelope(points,x){if(!points?.length)return null;if(x<=points[0][0])return points[0];if(x>=points[points.length-1][0])return points[points.length-1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=smoothStep01((x-a[0])/Math.max(1e-6,b[0]-a[0]));return [x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t,a[4]+(b[4]-a[4])*t];}return points.at(-1);}
function mainHullStationEnvelopeAt(xNorm,type=state.hullType){
 xNorm=Math.max(-1,Math.min(1,Number(xNorm)||0));
 const custom=window.AMCOL_CUSTOM_HULL_FORM,customRows=(custom?.enabled&&Array.isArray(custom.stations)&&custom.stations.length>=5&&(!custom.vesselName||custom.vesselName===state.vesselName))?custom.stations:null;
 const shared=window.AMCOLPhysics?.hull?.stationEnvelopeAt;
 if(shared)return shared(xNorm,type,customRows);
 const key=type==='barge'?'box':(window.AMCOL_HULL_STATION_ENVELOPES[type]?type:'general'),pts=window.AMCOL_HULL_STATION_ENVELOPES[key],first=pts[0][0];if(xNorm<-.70){const u=smoothStep01((xNorm+1)/.30),aft=MAIN_HULL_STERN_FULL[key]??.73;return {beamFactor:aft+(1-aft)*u,bottomFactor:.45+.27*u,sheerRatio:.010*(1-u),keelRiseRatio:0,source:'family'};}if(xNorm<first)return {beamFactor:1,bottomFactor:key==='box'?.90:.72,sheerRatio:0,keelRiseRatio:0,source:'family'};const r=interpolateMainHullEnvelope(pts,xNorm);return {beamFactor:r[1],bottomFactor:r[2],sheerRatio:r[3],keelRiseRatio:r[4],source:'family'};
}
function longitudinalWaterplaneFactor(xNorm,type=state.hullType){
 // Uses the same family station envelope concept as the 3D hull. The local waterline breadth is
 // approximated between bottom and deck breadth according to the current mean-draft fraction.
 const e=mainHullStationEnvelopeAt(xNorm,type),f=Math.max(0,Math.min(1,(+state.eqDraft||state.depth*.5)/Math.max(.1,state.depth))),blend=Math.pow(f,.55),width=e.bottomFactor+(e.beamFactor-e.bottomFactor)*blend;return Math.max(.02,Math.min(1.08,width));
}
function calculateLongitudinalWaterplane(bwl){
 const L=Math.max(1,state.length),N=160,dx=L/N;
 let A=0,Q=0;const samples=[];
 for(let i=0;i<=N;i++){
  const x=-L/2+i*dx,xn=x/(L/2),b=bwl*longitudinalWaterplaneFactor(xn,state.hullType);
  const w=(i===0||i===N)?.5:1;
  A+=b*w*dx;Q+=x*b*w*dx;samples.push({x,b,w});
 }
 const lcf=A>0?Q/A:0;
 let IL=0;
 samples.forEach(s=>{IL+=Math.pow(s.x-lcf,2)*s.b*s.w*dx;});
 return {area:A,lcf,IL};
}


function coupledSectionShape(longitudinal){
 const L=Math.max(1,state.length),xn=Math.max(-1,Math.min(1,longitudinal/(L/2))),e=mainHullStationEnvelopeAt(xn,state.hullType),draftFrac=Math.max(0,Math.min(1,(+state.eqDraft||state.depth*.5)/Math.max(.1,state.depth))),immersedBlend=.42+.58*Math.pow(draftFrac,.55),beamScale=Math.max(.055,e.bottomFactor+(e.beamFactor-e.bottomFactor)*immersedBlend),depthScale=1,keelRise=state.depth*(e.keelRiseRatio||0);return {beamScale,depthScale,keelRise,f:beamScale,envelope:e};
}
function coupledSectionPolygon(longitudinal){
 const sh=coupledSectionShape(longitudinal);
 return makeHullPolygon(state.hullType,state.beam*sh.beamScale,state.depth*sh.depthScale).map(([x,y])=>[x,y+sh.keelRise]);
}
function coupledWorldPoint(x,y,longitudinal,phi,theta,sink){
 // Preserve the existing transverse sign convention, then apply positive bow-down trim.
 const cp=Math.cos(phi),sp=Math.sin(phi),ct=Math.cos(theta),st=Math.sin(theta);
 const xr=x*cp+y*sp,yr=-x*sp+y*cp;
 return {x:xr,y:yr*ct-longitudinal*st+sink,l:yr*st+longitudinal*ct};
}
function coupledClipSection(poly,longitudinal,phi,theta,sink){
 const out=[];if(!poly.length)return out;
 const H=p=>coupledWorldPoint(p[0],p[1],longitudinal,phi,theta,sink).y;
 for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ha=H(a),hb=H(b),ina=ha<=0,inb=hb<=0;
   if(ina)out.push(a);
   if(ina!==inb){
     const t=ha/(ha-hb);
     out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
   }
 }
 return out;
}
function coupledWaterlineBreadth(poly,longitudinal,phi,theta,sink){
 const xs=[];const H=p=>coupledWorldPoint(p[0],p[1],longitudinal,phi,theta,sink).y;
 for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ha=H(a),hb=H(b);
   if(Math.abs(ha)<1e-8)xs.push(a[0]);
   if(ha*hb<0){const t=ha/(ha-hb);xs.push(a[0]+t*(b[0]-a[0]));}
 }
 return xs.length>=2?Math.max(...xs)-Math.min(...xs):0;
}
function integrateCoupledHydro(phi,theta,sink,N=32){
 const L=Math.max(1,state.length),dx=L/N;let V=0,MX=0,MY=0,ML=0,Awp=0,Qwp=0;
 const stations=[];
 for(let i=0;i<=N;i++){
   const longitudinal=-L/2+i*dx,w=(i===0||i===N)?.5:1,poly=coupledSectionPolygon(longitudinal);
   const sub=coupledClipSection(poly,longitudinal,phi,theta,sink),base=polygonAreaCentroid(sub);
   let area=base.area,cx=base.cx,cy=base.cy;
   if(state.damage&&state.damageMode==='lost'&&area>1e-8&&damageAppliesAtLongitudinal(longitudinal)){
     const sh=coupledSectionShape(longitudinal),localB=state.beam*sh.beamScale,localD=state.depth*sh.depthScale;
     const sign=state.damageSide,wDam=localB*(state.damageWidth/100),x2=sign*localB/2,x1=x2-sign*wDam;
     const hDam=localD*(state.damageHeight/100),y0=sh.keelRise;
     const dr=[[x1,y0],[x2,y0],[x2,y0+hDam],[x1,y0+hDam]];
     const dsub=coupledClipSection(dr,longitudinal,phi,theta,sink),da=polygonAreaCentroid(dsub),remove=Math.max(0,Math.min(area*.98,state.damagePerm*da.area));
     if(remove>0&&area-remove>1e-8){cx=(area*cx-remove*da.cx)/(area-remove);cy=(area*cy-remove*da.cy)/(area-remove);area-=remove;}
   }
   const bwl=coupledWaterlineBreadth(poly,longitudinal,phi,theta,sink);
   V+=area*w*dx;MX+=area*cx*w*dx;MY+=area*cy*w*dx;ML+=area*longitudinal*w*dx;
   Awp+=bwl*w*dx;Qwp+=longitudinal*bwl*w*dx;
   stations.push({longitudinal,area,bwl,weight:w});
 }
 return {volume:V,tcb:V>0?MX/V:0,vcb:V>0?MY/V:0,lcb:V>0?ML/V:0,waterplaneArea:Awp,lcf:Awp>0?Qwp/Awp:0,stations,phi,theta,sink};
}
function solveCoupledSinkage(phi,theta,targetVolume){
 let lo=-3*state.depth,hi=3*state.depth;
 for(let i=0;i<30;i++){
   const mid=(lo+hi)/2,V=integrateCoupledHydro(phi,theta,mid,24).volume;
   if(V>targetVolume)lo=mid;else hi=mid;
 }
 return (lo+hi)/2;
}
function coupledResidualAt(phi,theta,sink,targetVolume){
 const h=integrateCoupledHydro(phi,theta,sink,36),B=coupledWorldPoint(h.tcb,h.vcb,h.lcb,phi,theta,sink),effG=effectiveCGAtHeel(phi*180/Math.PI),Gp=coupledWorldPoint(effG.tcg,effG.kg,state.lcg,phi,theta,sink);
 const env=state.dispMass>0?environmentalHeelingMomentN(phi*180/Math.PI)/(state.dispMass*1000*G):0;
 return {rv:h.volume-targetVolume,rt:B.x-Gp.x-env,rl:B.l-Gp.l,h,B,G:Gp};
}
function coupledResidual(phi,theta){
 const target=Math.max(.001,state.dispMass/state.density),sink=solveCoupledSinkage(phi,theta,target);return coupledResidualAt(phi,theta,sink,target);
}
function solveLinear3(A,b){
 const m=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<3;c++){
  let p=c;for(let r=c+1;r<3;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
  if(!Number.isFinite(m[p][c])||Math.abs(m[p][c])<1e-10)return null;if(p!==c)[m[p],m[c]]=[m[c],m[p]];
  const d=m[c][c];for(let j=c;j<4;j++)m[c][j]/=d;
  for(let r=0;r<3;r++)if(r!==c){const f=m[r][c];for(let j=c;j<4;j++)m[r][j]-=f*m[c][j];}
 }
 const x=[m[0][3],m[1][3],m[2][3]];return x.every(Number.isFinite)?x:null;
}
function coupledConvergenceMetrics(r,targetVolume){
 const massResidual=Math.abs(r.rv*state.density),tMoment=Math.abs(r.rt*state.dispMass),lMoment=Math.abs(r.rl*state.dispMass),massTol=Math.max(.25,state.dispMass*2e-5),tTol=Math.max(2,state.dispMass*Math.max(1,state.beam)*1.5e-5),lTol=Math.max(5,state.dispMass*Math.max(1,state.length)*1.5e-5);
 const pass=massResidual<=massTol&&tMoment<=tTol&&lMoment<=lTol;return {massResidual,tMoment,lMoment,massTol,tTol,lTol,pass};
}
function solveCoupledEquilibrium(initialHeelDeg=0,initialTrimDeg=0){
 const target=Math.max(.001,state.dispMass/state.density),Bscale=Math.max(1,state.beam),Lscale=Math.max(1,state.length),Vscale=Math.max(.001,target);
 let phi=THREE_SAFE_RAD(initialHeelDeg),theta=THREE_SAFE_RAD(initialTrimDeg),sink=solveCoupledSinkage(phi,theta,target),last=null,metrics=null,iterations=0,valid=false;
 const loll=state.gm<0&&Math.abs(initialHeelDeg)>1&&!state.windEnabled&&!state.currentEnabled,lollSign=Math.sign(initialHeelDeg)||1;
 for(let k=0;k<16;k++){
  iterations=k+1;const r=coupledResidualAt(phi,theta,sink,target);last=r;metrics=coupledConvergenceMetrics(r,target);if(metrics.pass){valid=true;break;}
  const F=[r.rv/Vscale,r.rt/Bscale,r.rl/Lscale],steps=[7e-4,5e-4,Math.max(.002,state.depth*2e-4)],vars=[phi,theta,sink],J=[[],[],[]];
  for(let j=0;j<3;j++){
   const v=[...vars];v[j]+=steps[j];const rp=coupledResidualAt(v[0],v[1],v[2],target),Fp=[rp.rv/Vscale,rp.rt/Bscale,rp.rl/Lscale];for(let i=0;i<3;i++)J[i][j]=(Fp[i]-F[i])/steps[j];
  }
  const dx=solveLinear3(J,F.map(v=>-v));if(!dx)break;
  let [dphi,dtheta,dsink]=dx;dphi=Math.max(-3*Math.PI/180,Math.min(3*Math.PI/180,dphi));dtheta=Math.max(-.8*Math.PI/180,Math.min(.8*Math.PI/180,dtheta));dsink=Math.max(-state.depth*.12,Math.min(state.depth*.12,dsink));
  // Damped Newton step: reduce the step if the normalised residual grows.
  const norm=Math.hypot(...F);let accepted=false,alpha=1;
  for(let trial=0;trial<5;trial++,alpha*=.5){let np=phi+dphi*alpha,nt=theta+dtheta*alpha,ns=sink+dsink*alpha;np=Math.max(-65*Math.PI/180,Math.min(65*Math.PI/180,np));nt=Math.max(-10*Math.PI/180,Math.min(10*Math.PI/180,nt));if(loll&&Math.sign(np)!==lollSign)np=lollSign*Math.max(.5*Math.PI/180,Math.abs(np));const rr=coupledResidualAt(np,nt,ns,target),Fn=[rr.rv/Vscale,rr.rt/Bscale,rr.rl/Lscale],nn=Math.hypot(...Fn);if(Number.isFinite(nn)&&nn<=norm*1.03){phi=np;theta=nt;sink=ns;accepted=true;break;}}
  if(!accepted)break;
 }
 if(!last||last.h?.sink!==sink){last=coupledResidualAt(phi,theta,sink,target);metrics=coupledConvergenceMetrics(last,target);valid=metrics.pass;}
 const h=last.h,deep=integrateCoupledHydro(phi,theta,h.sink-.005,28),shallow=integrateCoupledHydro(phi,theta,h.sink+.005,28),Awp=Math.max(.01,(deep.volume-shallow.volume)/.01),bowKeel=coupledWorldPoint(0,0,state.length/2,phi,theta,h.sink),sternKeel=coupledWorldPoint(0,0,-state.length/2,phi,theta,h.sink);
 state.coupledMode=loll?'3d-newton-loll':'3d-newton';state.coupledValid=valid;state.coupledHeel=phi*180/Math.PI;state.coupledTrim=theta*180/Math.PI;state.coupledSinkage=h.sink;state.coupledTCB=h.tcb;state.coupledVCB=h.vcb;state.coupledLCB=h.lcb;state.coupledResidualT=last.rt;state.coupledResidualL=last.rl;state.coupledResidualMass=metrics?.massResidual??Infinity;state.coupledResidualTMoment=metrics?.tMoment??Infinity;state.coupledResidualLMoment=metrics?.lMoment??Infinity;state.coupledIterations=iterations;state.coupledConvergenceQuality=valid?(iterations<=5?'HIGH':iterations<=10?'GOOD':'ACCEPTABLE'):'INVALID';state.coupledWaterplaneArea=Awp;state.coupledHydro=h;
 if(state.coupledValid){state.equilibrium=state.coupledHeel;state.trimAngle=state.coupledTrim;state.eqDraft=Math.max(0,-h.sink);state.draftBow=Math.max(0,-bowKeel.y);state.draftStern=Math.max(0,-sternKeel.y);state.trimMeters=state.draftBow-state.draftStern;state.trimCm=state.trimMeters*100;state.ukc=state.waterDepth-Math.max(state.eqDraft,state.draftBow,state.draftStern);state.tpc=Awp*state.density/100;const tpcSW=Awp*1.025/100;state.fwa=tpcSW>0?state.dispMass/(4*tpcSW):0;}
 return state.coupledValid;
}
function anchorCoupledHydroToAuthoritativeEquilibrium(heelDeg=0,trimDeg=0){
 // When a source hydrostatic/KN pack is available, do not let the generic section solver
 // overwrite the vessel-data equilibrium. Instead, evaluate the generic submerged sections
 // at the authoritative heel/trim solely for teaching strength/buoyancy distribution.
 const phi=THREE_SAFE_RAD(heelDeg),theta=THREE_SAFE_RAD(trimDeg),target=Math.max(.001,state.dispMass/state.density);
 const sink=solveCoupledSinkage(phi,theta,target),h=integrateCoupledHydro(phi,theta,sink,32);
 if(!h||!Number.isFinite(h.volume)||h.volume<=0){state.coupledValid=false;state.coupledMode='source-anchor-check';return false;}
 const r=coupledResidual(phi,theta);
 state.coupledMode='source-anchored';state.coupledValid=true;
 state.coupledHeel=heelDeg;state.coupledTrim=trimDeg;state.coupledSinkage=sink;
 state.coupledTCB=h.tcb;state.coupledVCB=h.vcb;state.coupledLCB=h.lcb;
 state.coupledResidualT=Number.isFinite(r?.rt)?r.rt:0;state.coupledResidualL=Number.isFinite(r?.rl)?r.rl:0;state.coupledResidualMass=Math.abs((h.volume-target)*state.density);state.coupledResidualTMoment=Math.abs(state.coupledResidualT*state.dispMass);state.coupledResidualLMoment=Math.abs(state.coupledResidualL*state.dispMass);
 state.coupledIterations=0;state.coupledConvergenceQuality='SOURCE-ANCHORED';state.coupledWaterplaneArea=Math.max(.01,h.waterplaneArea||0);state.coupledHydro=h;
 return true;
}
function THREE_SAFE_RAD(deg){return (Number(deg)||0)*Math.PI/180;}

function calculateUprightHydro(){
 const h=hydroAtAngle(0);state.hydro=h;if(h.invalid)return;
 state.geometryUprightDraft=-h.sink;state.visualHeelDraftDelta=0;state.eqDraft=-h.sink;
 const KB=h.by-h.sink;const V=state.dispMass/state.density;const I=state.length*Math.pow(h.bwl,3)/12;const BM=V>0?I/V:0;
 const epsDeg=0.1,epsRad=epsDeg*Math.PI/180;const hp=hydroAtAngle(epsDeg),hm=hydroAtAngle(-epsDeg);
 state.gm=(!hp.invalid&&!hm.invalid)?(hp.gz-hm.gz)/(2*epsRad):(KB+BM-state.kgCorr);
 const KM=state.kgCorr+state.gm;
 const wp=calculateLongitudinalWaterplane(h.bwl);
 state.waterplaneArea=wp.area;state.lcf=wp.lcf;
 state.bmLong=V>0?wp.IL/V:0;
 state.gmLong=Math.max(.01,KB+state.bmLong-state.kgCorr);
 // Small-angle longitudinal equilibrium using trimming moment and MCT 1 cm.
 // +LCG = Forward, so +trim means deeper at bow.
 state.mct1cm=(state.dispMass>0&&state.length>0)?state.dispMass*state.gmLong/(100*state.length):0;
 const trimSol=AMCOLPhysics.trim.solve({displacement:state.dispMass,lcg:state.lcg,lcb:0,lcf:state.lcf,mct1cm:state.mct1cm,length:state.length,meanDraft:state.eqDraft,waterDepth:state.waterDepth});
 state.longitudinalMoment=trimSol.longitudinalMoment;state.trimCm=trimSol.trimCm;state.trimMeters=trimSol.trimMeters;state.trimAngle=trimSol.trimAngle;state.draftBow=trimSol.draftForward;state.draftStern=trimSol.draftAft;state.ukc=trimSol.ukc;
 state.tpc=wp.area*state.density/100;const tpcSW=wp.area*1.025/100;state.fwa=tpcSW>0?state.dispMass/(4*tpcSW):0;
 state.upright={KB,BM,KM,bwl:h.bwl,LCF:state.lcf,IL:wp.IL,Awp:wp.area,source:'geometry'};
 // Optional source-backed upright hydrostatics. Only values actually tabulated in the book are replaced.
 const refHyd=hydroTableAtCurrentDisplacement();
 if(refHyd){
   const p=hydroPack(),rho0=Math.max(.001,p.sourceDensity||1.025),refAwp=Number.isFinite(refHyd.tpc)?refHyd.tpc*100/rho0:state.waterplaneArea;
   const geomKB=Number.isFinite(state.upright?.KB)?state.upright.KB:0,refKB=Number.isFinite(refHyd.kb)?refHyd.kb:geomKB;
   state.eqDraft=refHyd.draft;if(Number.isFinite(refHyd.tpc))state.tpc=refHyd.tpc*(state.density/rho0);
   state.fwa=Number.isFinite(refHyd.tpc)&&refHyd.tpc>0?state.dispMass/(4*(refHyd.tpc*(1.025/rho0))):state.fwa;
   if(Number.isFinite(refHyd.lcf))state.lcf=refHyd.lcf;
   if(Number.isFinite(refHyd.mctc))state.mct1cm=refHyd.mctc*(state.density/rho0);
   if(Number.isFinite(refHyd.kml)){state.gmLong=refHyd.kml-state.kgCorr;state.bmLong=Math.max(0,refHyd.kml-refKB);}
   else if(state.mct1cm>0){state.gmLong=state.mct1cm*100*state.length/Math.max(.001,state.dispMass);state.bmLong=Math.max(0,state.gmLong+state.kgCorr-refKB);}
   state.gm=refHyd.kmt-state.kgCorr;
   state.waterplaneArea=refAwp;
   const derivedKML=Number.isFinite(refHyd.kml)?refHyd.kml:state.kgCorr+state.gmLong;
   state.upright={KB:refKB,BM:refHyd.kmt-refKB,KM:refHyd.kmt,bwl:h.bwl,LCF:Number.isFinite(refHyd.lcf)?refHyd.lcf:state.lcf,LCB:Number.isFinite(refHyd.lcb)?refHyd.lcb:0,KML:derivedKML,IL:state.bmLong*(state.dispMass/state.density),Awp:refAwp,source:p.badge==='WORKBOOK SOURCE'?'Workbook hydrostatic table · KB geometry fallback':p.kind==='uploadedBundle'?'Uploaded hydrostatic table':'Barrass table'};
   const refLCB=Number.isFinite(refHyd.lcb)?refHyd.lcb:0;
   const refTrim=AMCOLPhysics.trim.solve({displacement:state.dispMass,lcg:state.lcg,lcb:refLCB,lcf:state.lcf,mct1cm:state.mct1cm,length:state.length,meanDraft:state.eqDraft,waterDepth:state.waterDepth});
   state.longitudinalMoment=refTrim.longitudinalMoment;state.trimCm=refTrim.trimCm;state.trimMeters=refTrim.trimMeters;state.trimAngle=refTrim.trimAngle;state.draftBow=refTrim.draftForward;state.draftStern=refTrim.draftAft;state.ukc=refTrim.ukc;
 }
 state.naturalPeriod=state.gm>0?2*Math.PI*(state.krRatio*state.beam)/Math.sqrt(G*state.gm):null;
}

function gaussianStationWeights(xs,center,sigma){
 const a=xs.map(x=>Math.exp(-.5*Math.pow((x-center)/Math.max(.2,sigma),2)));
 const s=a.reduce((p,v)=>p+v,0)||1;return a.map(v=>v/s);
}
function calculateLongitudinalStrength(){
 const h=state.coupledHydro;if(!h?.stations?.length){state.strength=null;return;}
 const stations=h.stations,N=stations.length,L=Math.max(1,state.length),dx=L/(N-1),xs=stations.map(s=>s.longitudinal);
 const weight=new Array(N).fill(0),buoy=new Array(N).fill(0);
 // Lightship: distribute smoothly with generic hull fullness.
 const lightShape=xs.map(x=>Math.pow(longitudinalWaterplaneFactor(x/(L/2),state.hullType),.72));
 const lightSum=lightShape.reduce((a,v)=>a+v,0)||1;
 lightShape.forEach((v,i)=>weight[i]+=state.lightshipMass*v/lightSum);
 // Movable cargo / ballast: finite longitudinal footprint rather than mathematical point load.
 cargoItems.forEach(it=>{
   const mass=cargoPhysicsMass(it),span=Math.max(L*.012,Math.min(L*.075,Number(it.strengthSpan)||L*(.018+Math.min(.045,mass/Math.max(1,state.dispMass)*.20))));
   const w=gaussianStationWeights(xs,Number(it.lcg)||0,span);
   w.forEach((v,i)=>weight[i]+=mass*v);
 });
 // Ballast is a real longitudinal weight component. Distribute each active tank over a finite span
 // so trim corrections do not disappear from the SF/BM model.
 if(state.ballastPlanEnabled&&Array.isArray(ballastTanks))ballastTanks.forEach(t=>{
   const mass=ballastTankMass(t);if(mass<=0)return;const span=Math.max(L*.008,Math.min(L*.10,Math.max(Number(t.length)||0,L*.018)*.38)),w=gaussianStationWeights(xs,Number(t.lcg)||0,span);w.forEach((v,i)=>weight[i]+=mass*v);
 });
 if(state.crane){
   const w=gaussianStationWeights(xs,state.craneLCG||0,L*.018);
   w.forEach((v,i)=>weight[i]+=state.craneMass*v);
 }
 if(state.damage&&state.damageMode==='added'){
   const w=gaussianStationWeights(xs,state.dmgLCG||0,Math.max(L*.012,L*.035));w.forEach((v,i)=>weight[i]+=state.dmgMass*v);
 }
 // Buoyancy from the actual coupled submerged section areas.
 stations.forEach((s,i)=>buoy[i]=s.area*dx*state.density);
 // Correct trapezoid endpoint accounting to preserve total displacement.
 if(N>1){buoy[0]*=.5;buoy[N-1]*=.5;}
 const bsum=buoy.reduce((a,v)=>a+v,0)||1;
 buoy.forEach((v,i)=>buoy[i]=v*state.dispMass/bsum);
 // Convert nodal masses to distributed kN/m. Endpoint control lengths are dx/2 so
 // trapezoidal integration reproduces the exact nodal total rather than under-counting the ends.
 const q=weight.map((w,i)=>(buoy[i]-w)*G/((i===0||i===N-1)?dx*.5:dx));
 const shear=new Array(N).fill(0),moment=new Array(N).fill(0);
 for(let i=1;i<N;i++){
   shear[i]=shear[i-1]+.5*(q[i-1]+q[i])*dx;
   moment[i]=moment[i-1]+.5*(shear[i-1]+shear[i])*dx;
 }
 // Preserve raw closure residuals for the integrity monitor, then remove only numerical drift for display.
 const rawEndS=shear[N-1],rawEndM=moment[N-1],massResidual=weight.reduce((a,v)=>a+v,0)-buoy.reduce((a,v)=>a+v,0);
 for(let i=0;i<N;i++){const t=i/(N-1);shear[i]-=rawEndS*t;moment[i]-=rawEndM*t;}
 const maxSF=Math.max(...shear.map(Math.abs)),maxBM=Math.max(...moment.map(Math.abs)),maxPositiveBM=Math.max(...moment),maxNegativeBM=Math.min(...moment),iPos=moment.indexOf(maxPositiveBM),iNeg=moment.indexOf(maxNegativeBM);
 const sfIndex=maxSF/Math.max(1,state.dispMass*G),bmIndex=maxBM/Math.max(1,state.dispMass*G*L),concentration=Math.max(sfIndex,bmIndex*4);
 // With q = buoyancy − weight and integration from aft to bow, negative midship BM represents hogging in this teaching convention.
 state.strength={xs,weight,buoy,q,shear,moment,maxSF,maxBM,maxSaggingBM:maxPositiveBM,maxHoggingBM:Math.abs(maxNegativeBM),saggingX:xs[iPos]||0,hoggingX:xs[iNeg]||0,rawEndShear:rawEndS,rawEndMoment:rawEndM,massResidual,sfIndex,bmIndex,concentration};
 const limits=Array.isArray(window.AMCOL_ACTIVE_STRUCTURAL_LIMITS)?window.AMCOL_ACTIVE_STRUCTURAL_LIMITS:[];
 const envelope=window.AMCOLPhysics?.longitudinalStrength?.evaluate?.({xs,shear,moment,length:L,limits});
 if(envelope?.valid){state.strength.envelope=envelope;state.strength.utilization=envelope.maxUtil;state.strength.governing=envelope.governing;}
}


const ballastFamilyProfiles={
 general:{desc:'Reference-informed general-cargo arrangement: aft machinery, one long box-hold region divided into teaching zones, peak tanks, DB ballast below the hold and limited side ballast.',reference:'Damen Combi Freighter 5000',engine:{lcg:-.360,length:.13,breadth:.70,bottom:.055,height:.58,label:'Engine Room'},bands:[['DB Aft','doubleBottom',-.18],['DB Mid','doubleBottom',.02],['DB Fwd','doubleBottom',.22],['WBT Aft','wing',-.12],['WBT Mid','wing',.08],['WBT Fwd','wing',.28]]},
 bulk:{desc:'IMO-type bulk carrier arrangement: cargo holds are bounded by double-bottom, bilge-hopper and topside ballast spaces, with machinery aft and peak tanks at the ends.',reference:'IMO A.866(20) typical bulk-carrier structure',engine:{lcg:-.360,length:.13,breadth:.70,bottom:.05,height:.60,label:'Engine Room'},bands:[['DB 5','doubleBottom',-.20],['Hopper 5','hopper',-.20],['Topside 5','topside',-.20],['DB 4','doubleBottom',-.08],['Hopper 4','hopper',-.08],['Topside 4','topside',-.08],['DB 3','doubleBottom',.04],['Hopper 3','hopper',.04],['Topside 3','topside',.04],['DB 2','doubleBottom',.16],['Hopper 2','hopper',.16],['Topside 2','topside',.16],['DB 1','doubleBottom',.28],['Hopper 1','hopper',.28],['Topside 1','topside',.28]]},
 container:{desc:'Conventional cellular container-carrier arrangement: accommodation/machinery at the stern, container holds/bays forward, DB ballast below and wing ballast along the cargo region.',reference:'Tsuneishi 2,806 TEU container-carrier family',engine:{lcg:-.360,length:.13,breadth:.72,bottom:.05,height:.60,label:'Engine Room'},bands:[['DB Aft','doubleBottom',-.20],['WBT Aft','wing',-.20],['DB 4','doubleBottom',-.08],['WBT 4','wing',-.08],['DB 3','doubleBottom',.04],['WBT 3','wing',.04],['DB 2','doubleBottom',.16],['WBT 2','wing',.16],['DB Fwd','doubleBottom',.28],['WBT Fwd','wing',.28]]},
 roro:{desc:'High-speed Ro-Ro arrangement informed by MHI: five vehicle-deck levels, low aft engine room, relatively limited ballast because of wide/high-stability hull form, plus peak and lower side/DB tanks.',reference:'MHI high-efficiency Ro-Ro arrangement',engine:{lcg:-.345,length:.16,breadth:.66,bottom:.04,height:.30,label:'Engine Room'},bands:[['DB Aft','doubleBottom',-.20],['DB Mid','doubleBottom',.02],['DB Fwd','doubleBottom',.23],['Side/AH Aft','wing',-.08],['Side/AH Fwd','wing',.18]]},
 tanker:{desc:'Double-hull tanker arrangement: paired liquid cargo tanks inside protective wing and double-bottom segregated ballast spaces, machinery aft and peak tanks at the ends.',reference:'IMO MARPOL double-hull/protective SBT + Damen Combi Tanker',engine:{lcg:-.360,length:.13,breadth:.70,bottom:.05,height:.58,label:'Engine Room'},bands:[['DB 5','doubleBottom',-.19],['SBT 5','wing',-.19],['DB 4','doubleBottom',-.08],['SBT 4','wing',-.08],['DB 3','doubleBottom',.03],['SBT 3','wing',.03],['DB 2','doubleBottom',.14],['SBT 2','wing',.14],['DB 1','doubleBottom',.25],['SBT 1','wing',.25]]},
 chemical:{desc:'Chemical/product tanker arrangement: multiple smaller paired cargo tanks inside double-bottom/wing ballast protection, with machinery aft and segregated parcel spaces.',reference:'Damen Combi Tanker / IBC-style parcel segregation concept',engine:{lcg:-.360,length:.13,breadth:.70,bottom:.05,height:.58,label:'Engine Room'},bands:[['DB Aft','doubleBottom',-.20],['WBT Aft','wing',-.20],['DB 4','doubleBottom',-.09],['WBT 4','wing',-.09],['DB 3','doubleBottom',.02],['WBT 3','wing',.02],['DB 2','doubleBottom',.13],['WBT 2','wing',.13],['DB Fwd','doubleBottom',.24],['WBT Fwd','wing',.24]]},
 lng:{desc:'Moss LNG arrangement: four spherical cargo tanks in line, machinery/accommodation aft, and paired bottom/side ballast spaces around the tank holds with fore/aft peak tanks.',reference:'MHI Sakhalin Moss LNG carrier general arrangement',engine:{lcg:-.360,length:.13,breadth:.68,bottom:.05,height:.60,label:'Engine Room'},bands:[['DB 4','doubleBottom',-.18],['WBT 4','wing',-.18],['DB 3','doubleBottom',-.045],['WBT 3','wing',-.045],['DB 2','doubleBottom',.095],['WBT 2','wing',.095],['DB 1','doubleBottom',.235],['WBT 1','wing',.235]]},
 osv:{desc:'Offshore-service arrangement: forward accommodation/machinery zone leaves a large clear aft weather deck; under-deck mission tanks and ballast are concentrated around the midbody/aft working region.',reference:'Damen offshore-service-vessel arrangement; machinery location is a visual inference from the forward superstructure / clear aft deck',engine:{lcg:.245,length:.18,breadth:.68,bottom:.05,height:.42,label:'Diesel-Electric Machinery'},bands:[['Aft DB','doubleBottom',-.22],['Aft Wing','wing',-.16],['Mid DB','doubleBottom',-.05],['Mid Wing','wing',.03],['Fwd DB','doubleBottom',.16],['Fwd Wing','wing',.18]]},
 box:{desc:'Deck-cargo barge arrangement: large central deck/hopper volume with peak/void/ballast spaces; a small aft utility/pump room is shown only as an optional powered-barge teaching space.',reference:'Damen modular-barge family (configuration-dependent)',engine:{lcg:-.360,length:.10,breadth:.50,bottom:.04,height:.30,label:'Optional Utility / Pump Room',optional:true},bands:[['Aft Wing','wing',-.20],['Aft DB','doubleBottom',-.12],['Mid DB','doubleBottom',.04],['Fwd DB','doubleBottom',.20],['Fwd Wing','wing',.28]]}
};
Object.values(ballastFamilyProfiles).forEach(p=>{p.count=2+p.bands.length*2;p.types=[...new Set(p.bands.map(b=>b[1]))];p.zones=p.bands.length;});
function ballastFamilyKey(){return state.hullType==='ferry'?'roro':state.hullType==='barge'?'box':(ballastFamilyProfiles[state.hullType]?state.hullType:'general');}
function engineRoomArrangement(){
 if(isGreatFortuneWorkbookVessel())return greatFortuneWorkbookEngineRoom();
 const p=ballastFamilyProfiles[ballastFamilyKey()]||ballastFamilyProfiles.general,L=state.length,B=state.beam,D=state.depth,e=p.engine;
 return {label:e.label||'Engine Room',lcg:e.lcg*L,length:e.length*L,breadth:B*(e.breadth??.70),bottom:D*(e.bottom??.05),height:D*(e.height??.58),source:'reference-informed representative',reference:p.reference||'',optional:!!e.optional};
}
const cargoSpaceProfiles={
 general:{label:'Long Box-Hold Zones',desc:'A long box-shaped hold occupies most of the cargo body; three teaching zones represent movable bulkhead / stowage sections while preserving realistic longitudinal extent.',kind:'Dry cargo hold zones'},
 bulk:{label:'Bulk Cargo Holds',desc:'Five representative holds lie between the aft machinery bulkhead and forebody. Hopper/topside/DB ballast surrounds the holds rather than occupying the cargo volume.',kind:'Bulk cargo holds'},
 container:{label:'Cellular Container Bays',desc:'Eight representative below-deck cellular bay groups extend forward from the stern machinery/accommodation block. Deck stacks sit directly above these bay groups.',kind:'Container bays'},
 roro:{label:'Five-Level Ro-Ro Vehicle Holds',desc:'Five vehicle-deck levels (B3, B2, B1, No.1 and No.2) span most of the hull, with the engine room low and aft plus bow/stern ramp access zones.',kind:'Vehicle decks'},
 tanker:{label:'Paired Oil Cargo Tanks',desc:'Five longitudinal segregations are represented as Port/Starboard cargo-tank pairs inside the protective double hull.',kind:'Liquid cargo tanks'},
 chemical:{label:'Segregated Chemical Parcel Tanks',desc:'Seven smaller Port/Starboard parcel-tank groups illustrate the greater subdivision typical of chemical/product service.',kind:'Chemical cargo tanks'},
 lng:{label:'Four Moss Cargo Tanks',desc:'Four spherical centreline cargo tanks follow the MHI Moss arrangement, with Tank No.4 aft through Tank No.1 forward and machinery/accommodation aft.',kind:'Spherical gas cargo tanks'},
 osv:{label:'OSV Aft Working Deck + Under-Deck Tanks',desc:'The clear aft weather deck carries containers/equipment while dry-bulk and liquid mission tanks sit below the working deck; machinery is kept forward under the superstructure.',kind:'Deck + under-deck cargo'},
 box:{label:'Barge Central Cargo Zone',desc:'A broad central deck/hopper zone is retained between end void/ballast spaces. Machinery is optional rather than assumed for every barge.',kind:'Deck / hopper cargo'}
};
function cargoFamilyKey(){return state.hullType==='ferry'?'roro':state.hullType==='barge'?'box':(cargoSpaceProfiles[state.hullType]?state.hullType:'general');}
function cargoSpaceColor(type=''){
 const t=String(type).toLowerCase();
 if(t.includes('vehicle'))return '#c4b5fd';
 if(t.includes('container'))return '#60a5fa';
 if(t.includes('chemical'))return '#f0abfc';
 if(t.includes('oil')||t.includes('liquid'))return '#2dd4bf';
 if(t.includes('gas')||t.includes('lng')||t.includes('lpg'))return '#93c5fd';
 if(t.includes('deck'))return '#fbbf24';
 if(t.includes('bulk'))return '#d6d3d1';
 return '#fde68a';
}
function cargoSpaceShortName(name=''){return String(name).replace(/Cargo/gi,'').replace(/Container/gi,'').replace(/Vehicle/gi,'Veh.').trim().slice(0,19);}
function representativeCargoSpaces(key=cargoFamilyKey()){
 const training=activeAMCOLTrainingVessel();if(training)return (training.cargoSpaces||[]).map(sp=>({...deepClonePlain(sp),source:'AMCOL TRAINING MODEL',reference:`${training.name} training capacity/space plan`}));
 if(isGreatFortuneWorkbookVessel())return greatFortuneWorkbookCargoSpaces();
 const L=Math.max(20,state.length),B=Math.max(4,state.beam),D=Math.max(3,state.depth),spaces=[];
 const reference=(ballastFamilyProfiles[key]||{}).reference||'reference-informed representative arrangement';
 const add=(name,type,xn,ln,bn,bottomN,heightN,tcgN=0,extra={})=>spaces.push({id:`cargo_space_${key}_${spaces.length}`,name,type,lcg:xn*L,length:ln*L,breadth:bn*B,bottom:bottomN*D,height:heightN*D,tcg:tcgN*B,source:'reference-informed representative',reference,...extra});
 if(key==='general'){
   add('Aft Hold Zone','Dry Cargo Hold',-.18,.22,.70,.19,.58,0,{hatch:true,sharedHold:true,bulkhead:'movable'});
   add('Mid Hold Zone','Dry Cargo Hold', .05,.22,.70,.19,.58,0,{hatch:true,sharedHold:true,bulkhead:'movable'});
   add('Forward Hold Zone','Dry Cargo Hold',.28,.20,.70,.20,.56,0,{hatch:true,sharedHold:true,bulkhead:'movable'});
 }else if(key==='bulk'){
   [[5,-.20],[4,-.08],[3,.04],[2,.16],[1,.28]].forEach(([n,x])=>add(`Cargo Hold ${n}`,'Bulk Cargo Hold',x,.105,.50,.24,.52,0,{hatch:true,hopper:true}));
 }else if(key==='container'){
   [-.22,-.14,-.06,.02,.10,.18,.26,.34].forEach((x,i)=>add(`Container Bay Group ${i+1}`,'Container Bay',x,.060,.68,.20,.57,0,{hatch:true,cellGuides:true,bayGroup:true}));
 }else if(key==='roro'){
   // Lower decks remain within the hull; upper vehicle decks live inside the enclosed Ro-Ro side shell.
   add('B3 Car Deck','Vehicle Deck',.035,.66,.66,.42,.075,0,{deckLevel:'B3',vehicle:'car'});
   add('B2 Car Deck','Vehicle Deck',.035,.66,.68,.61,.075,0,{deckLevel:'B2',vehicle:'car'});
   add('B1 Trailer / Car Deck','Vehicle Deck',.035,.66,.70,.80,.080,0,{deckLevel:'B1',vehicle:'mixed'});
   add('No.1 Trailer Deck','Vehicle Deck',.035,.64,.72,1.055,.075,0,{deckLevel:'No.1',vehicle:'trailer',superstructure:true});
   add('No.2 Trailer Deck','Vehicle Deck',.035,.62,.72,1.285,.075,0,{deckLevel:'No.2',vehicle:'trailer',superstructure:true});
   add('Stern Quarter Ramp Zone','Ramp / Vehicle Access',-.36,.08,.56,1.02,.070,0,{ramp:true,rampEnd:'stern',superstructure:true});
   add('Bow Quarter Ramp Zone','Ramp / Vehicle Access', .37,.07,.52,1.02,.070,0,{ramp:true,rampEnd:'bow',superstructure:true});
 }else if(key==='tanker'){
   [-.19,-.08,.03,.14,.25].forEach((x,i)=>{
     add(`Cargo Tank ${5-i} P`,'Oil Cargo Tank',x,.095,.32,.20,.55,-.20,{group:5-i,side:'port',doubleHull:true});
     add(`Cargo Tank ${5-i} S`,'Oil Cargo Tank',x,.095,.32,.20,.55,.20,{group:5-i,side:'starboard',doubleHull:true});
   });
 }else if(key==='chemical'){
   [-.20,-.11,-.02,.07,.16,.25,.34].forEach((x,i)=>{
     add(`Chem Tank ${7-i} P`,'Chemical Cargo Tank',x,.062,.30,.20,.53,-.19,{group:7-i,side:'port',doubleHull:true});
     add(`Chem Tank ${7-i} S`,'Chemical Cargo Tank',x,.062,.30,.20,.53,.19,{group:7-i,side:'starboard',doubleHull:true});
   });
 }else if(key==='lng'){
   const diameter=Math.min(B*.72,L*.13,D*1.60);
   [-.18,-.045,.095,.235].forEach((x,i)=>spaces.push({id:`cargo_space_${key}_${spaces.length}`,name:`Moss Tank No.${4-i}`,type:'Gas Cargo Tank',lcg:x*L,length:diameter,breadth:diameter,bottom:Math.max(D*.04,D*.82-diameter*.5),height:diameter,tcg:0,source:'reference-informed representative',reference,group:4-i,containment:true,moss:true,shape:'sphere',diameter}));
 }else if(key==='osv'){
   add('Aft Weather Deck Cargo Zone','Deck Cargo',-.15,.50,.82,.98,.055,0,{openDeck:true,workingDeck:true});
   add('Dry Bulk Tank P','Dry Bulk Cargo Tank',-.08,.10,.24,.20,.26,-.19,{side:'port',underDeck:true});
   add('Dry Bulk Tank S','Dry Bulk Cargo Tank',-.08,.10,.24,.20,.26,.19,{side:'starboard',underDeck:true});
   add('Liquid Mission Tank P', 'Liquid Cargo Tank',-.22,.10,.24,.19,.25,-.19,{side:'port',underDeck:true});
   add('Liquid Mission Tank S', 'Liquid Cargo Tank',-.22,.10,.24,.19,.25,.19,{side:'starboard',underDeck:true});
   add('Covered Warehouse / Stores', 'Dry Cargo Hold',.10,.15,.54,.27,.25,0,{warehouse:true});
 }else{
   add('Central Cargo Hopper','Barge Cargo Hold',.02,.60,.70,.19,.50,0,{hopper:true});
   add('Open Cargo Deck','Deck Cargo',.02,.72,.88,.96,.055,0,{openDeck:true});
 }
 return spaces;
}
function cargoArrangementProfile(){const tv=activeAMCOLTrainingVessel();if(tv)return {label:`${tv.name} · AMCOL Training Spaces`,desc:`${tv.cargoSpaces?.length||0} vessel-family cargo spaces loaded from the embedded AMCOL training dataset. Geometry/capacity values are synthetic/derived educational data.`,kind:'AMCOL training cargo plan'};if(isGreatFortuneWorkbookVessel())return {label:'GREAT FORTUNE Source Holds',desc:'Five wheat cargo holds use workbook LCG centres and grain capacities. Visual hold boundaries are inferred from adjacent hold centres and constrained to the hull because the workbook is not a GA/lines plan.',kind:'Workbook cargo holds'};return cargoSpaceProfiles[cargoFamilyKey()]||cargoSpaceProfiles.general;}
function renderCargoArrangementSchematic(){
 const host=document.getElementById('cargoArrangementSchematic');if(!host)return;
 const key=cargoFamilyKey(),L=Math.max(1,state.length),B=Math.max(1,state.beam),D=Math.max(1,state.depth),spaces=cargoSpacesWithFill(),er=engineRoomArrangement(),p=cargoArrangementProfile();
 const sig=[key,L.toFixed(2),B.toFixed(2),D.toFixed(2),spaces.map(sp=>`${sp.id}:${Number(sp.fillRawPercent||0).toFixed(1)}`).join(',')].join('|');if(renderCargoArrangementSchematic._sig===sig)return;renderCargoArrangementSchematic._sig=sig;
 const xMap=lcg=>55+((Number(lcg)/L)+.5)*890,ySide=z=>150-Math.max(0,Math.min(D,Number(z)))/D*108,yPlan=tcg=>300-(Number(tcg)/(B*.5))*72;
 const side=[];const sideSeen=new Set();spaces.forEach(sp=>{const k=`${Math.round(sp.lcg*100)}|${sp.type}|${Math.round(sp.bottom*100)}`;if((sp.side==='port'||sp.side==='starboard')&&sideSeen.has(k))return;sideSeen.add(k);const x=xMap(sp.lcg),w=Math.max(10,sp.length/L*890),y=ySide(sp.bottom+sp.height),h=Math.max(7,sp.height/D*108),c=cargoSpaceColor(sp.type);const fp=Math.max(0,Math.min(100,Number(sp.fillPercent)||0)),fy=y+h*(1-fp/100),fh=h*fp/100;side.push(`<g><rect x="${(x-w/2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-opacity=".95"/>${fp>0?`<rect x="${(x-w/2+1).toFixed(1)}" y="${fy.toFixed(1)}" width="${Math.max(0,w-2).toFixed(1)}" height="${fh.toFixed(1)}" rx="1" fill="${c}" fill-opacity=".58"/>`:''}<text class="cargo-label" x="${x.toFixed(1)}" y="${(y+h*.43).toFixed(1)}" text-anchor="middle" font-size="7" fill="#f8fafc">${escapeHtml(cargoSpaceShortName(sp.name))}</text><text class="cargo-label" x="${x.toFixed(1)}" y="${(y+h*.72).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${Number(sp.fillRawPercent)>100?'#fda4af':'#67e8f9'}">${escapeHtml(fillPercentLabel(sp.fillRawPercent))}</text>${sp.hatch?`<line x1="${(x-w*.42).toFixed(1)}" y1="${(y-2).toFixed(1)}" x2="${(x+w*.42).toFixed(1)}" y2="${(y-2).toFixed(1)}" stroke="#fbbf24" stroke-width="2"/>`:''}</g>`);});
 const plan=[];spaces.forEach(sp=>{const x=xMap(sp.lcg),w=Math.max(10,sp.length/L*890),cy=yPlan(sp.tcg||0),hh=Math.max(7,Math.min(132,sp.breadth/B*142)),c=cargoSpaceColor(sp.type);plan.push(`<g><rect x="${(x-w/2).toFixed(1)}" y="${(cy-hh/2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-opacity=".9"/><text class="cargo-label" x="${x.toFixed(1)}" y="${(cy-2).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#f8fafc">${escapeHtml(cargoSpaceShortName(sp.name))}</text><text class="cargo-label" x="${x.toFixed(1)}" y="${(cy+7).toFixed(1)}" text-anchor="middle" font-size="6" fill="${Number(sp.fillRawPercent)>100?'#fda4af':'#67e8f9'}">${escapeHtml(fillPercentLabel(sp.fillRawPercent))}</text></g>`);});
 const ex=xMap(er.lcg),ew=Math.max(20,er.length/L*890),ey=ySide(er.bottom+er.height),eh=Math.max(12,er.height/D*108);
 host.innerHTML=`<svg viewBox="0 0 1000 385" role="img" aria-label="Representative ${escapeHtml(p.label)} side and plan view"><rect x="35" y="35" width="930" height="130" rx="18" fill="#0f172a" stroke="#334155"/><path d="M38 150 L38 72 Q58 48 92 45 H930 Q955 48 965 75 V150 Z" fill="#111827" stroke="#64748b"/><text x="500" y="22" text-anchor="middle" font-size="14" fill="#fbbf24" class="cargo-label">${escapeHtml(p.label.toUpperCase())} · SIDE ELEVATION</text>${side.join('')}<rect x="${(ex-ew/2).toFixed(1)}" y="${ey.toFixed(1)}" width="${ew.toFixed(1)}" height="${eh.toFixed(1)}" rx="2" fill="#f97316" fill-opacity=".30" stroke="#fb923c"/><text x="${ex.toFixed(1)}" y="${(ey+eh*.53).toFixed(1)}" text-anchor="middle" font-size="7" fill="#fed7aa" class="cargo-label">ENGINE ROOM</text><line x1="55" y1="178" x2="945" y2="178" stroke="#334155"/><text x="500" y="203" text-anchor="middle" font-size="14" fill="#fbbf24" class="cargo-label">PLAN VIEW</text><path d="M55 300 Q85 232 150 225 H880 Q930 238 945 300 Q930 362 880 370 H150 Q85 363 55 300 Z" fill="#111827" stroke="#64748b"/>${plan.join('')}<text x="70" y="378" font-size="8" fill="#64748b" class="cargo-sub">STERN / AFT</text><text x="930" y="378" text-anchor="end" font-size="8" fill="#64748b" class="cargo-sub">BOW / FORWARD</text></svg>`;
 const sub=document.getElementById('cargoArrangementSubtitle'),info=document.getElementById('cargoArrangementInfo');if(sub)sub.textContent=`${p.kind} · ${spaces.length} cargo spaces · ${spaces.filter(sp=>Number(sp.fillRawPercent||0)>.05).length} currently loaded`;if(info)info.innerHTML=`<b class="text-amber-300">${escapeHtml(p.label)}</b><br>${escapeHtml(p.desc)}<br><span class="text-slate-500">Reference basis: ${escapeHtml(isGreatFortuneWorkbookVessel()?GREAT_FORTUNE_WORKBOOK_DATA.sourceFile:((ballastFamilyProfiles[key]||{}).reference||'representative family arrangement'))}. The schematic scales with L/B/D. Exact boundaries still require the vessel GA/capacity plan.</span>`;
}
function representativeTankGeometry(type='doubleBottom'){
 const L=state.length,B=state.beam,D=state.depth;
 // Representative extents deliberately leave clearance from the cargo envelope.
 if(type==='topside')return {length:L*.098,breadth:B*.16,height:D*.18,bottom:D*.70,tcg:B*.36,block:.76,label:'Topside'};
 if(type==='hopper')return {length:L*.098,breadth:B*.15,height:D*.22,bottom:D*.17,tcg:B*.36,block:.76,label:'Hopper'};
 if(type==='wing')return {length:L*.098,breadth:B*.11,height:D*.40,bottom:D*.18,tcg:B*.42,block:.78,label:'Wing Ballast'};
 if(type==='deep')return {length:L*.080,breadth:B*.18,height:D*.40,bottom:D*.10,tcg:B*.27,block:.80,label:'Deep'};
 return {length:L*.098,breadth:B*.30,height:D*.13,bottom:D*.025,tcg:B*.22,block:.86,label:'Double Bottom'};
}
function makeTank(name,type,side,lcg,geom,fill=null,id=null){const sign=side==='starboard'?1:side==='port'?-1:0,tcg=sign*Math.abs(geom.tcg||0),fluid=defaultBallastFluidKey(),density=ballastFluidPresets[fluid]?.density||1.025,blockFactor=geom.block||.82,vol=Math.max(.1,geom.length*geom.breadth*geom.height*blockFactor),actualFill=fill===null?defaultBallastFillValue():fill;return {id:id||('bt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),name,type,zone:ballastTankZoneFromLCG(lcg),side,fluid,autoCapacity:true,blockFactor,capacity:vol*density,fill:actualFill,lcg,tcg,bottom:geom.bottom||0,length:geom.length,breadth:geom.breadth,height:geom.height,density,fsmFactor:1,source:'representative'};}
function representativeArrangementTanks(key=ballastFamilyKey()){
 const p=ballastFamilyProfiles[key]||ballastFamilyProfiles.general,L=state.length,B=state.beam,D=state.depth,tanks=[];
 const peakGeom={length:L*.070,breadth:B*.64,height:D*.42,bottom:D*.030,tcg:0,block:.58};
 tanks.push(makeTank('Aft Peak Tank','Peak','centre',-L*.455,peakGeom,0,`rep_${key}_aft_peak`));
 tanks.push(makeTank('Fore Peak Tank','Peak','centre', L*.455,peakGeom,0,`rep_${key}_fore_peak`));
 p.bands.forEach(([name,typ,xn],i)=>{const g=representativeTankGeometry(typ);['port','starboard'].forEach(side=>tanks.push(makeTank(`${name} ${side==='port'?'P':'S'}`,g.label,side,xn*L,g,0,`rep_${key}_${i}_${side}`)));});
 return tanks;
}
function visualBallastTanks(){return ballastTanks.length?ballastTanks:representativeArrangementTanks();}
function initialiseEmptyBallastTemplate(){
 const key=ballastFamilyKey(),p=ballastFamilyProfiles[key]||ballastFamilyProfiles.general;
 ballastTanks=representativeArrangementTanks(key).map(t=>({...t,fill:0,source:'representative-empty-template',autoCapacity:true,zone:ballastTankZoneFromLCG(t.lcg)}));
 state.ballastPlanSource='representative-template';
 state.ballastPlanLabel=`Preloaded empty ${vesselPresets[state.hullType]?.label||state.hullType} ballast arrangement · ${ballastTanks.length} tanks`;
 state.ballastPlanEnabled=true;
 return ballastTanks;
}
function initialiseEmptyVesselContainers({render=true,announce=false,revision=true}={}){
 initialiseEmptyCargoTemplate();
 initialiseEmptyBallastTemplate();
 state.individualBallastFSE=false;
 state.spaceLayoutFamily=cargoFamilyKey();state.spaceLayoutLabel=vesselPresets[state.hullType]?.label||state.hullType;
 if(revision)bumpSpaceLayoutRevision('empty-vessel-containers');
 if(render){renderCargoTable();renderCargoManager();renderBallastPlan();populateCargoLibraryUI();renderSpaceFillMonitor();}
 if(announce&&typeof showCleanFeedback==='function')showCleanFeedback(`${vesselPresets[state.hullType]?.label||'Vessel'} spaces loaded empty — enter cargo and ballast.`);
 return {cargo:cargoItems.length,ballast:ballastTanks.length};
}
function expectedVesselSpaceLayout(){
 const cargo=representativeCargoSpaces(cargoFamilyKey()).filter(isEditableCargoSpace);
 const ballast=representativeArrangementTanks(ballastFamilyKey());
 return {cargo,ballast,cargoIds:new Set(cargo.map(s=>String(s.id))),ballastIds:new Set(ballast.map(t=>String(t.id)))};
}
function ensureCurrentVesselSpaceLayout({force=false,render=false}={}){
 if(isGreatFortuneWorkbookVessel()&&state.sourceConditionKey==='great_fortune_workbook')return false;
 // Embedded AMCOL Training Vessels already carry their complete vessel-specific cargo and ballast plans.
 // Never replace them with generic empty family templates during scenario/challenge consistency checks.
 if(typeof activeAMCOLTrainingVessel==='function'&&activeAMCOLTrainingVessel()&&state.amcolTrainingVesselId)return false;
 const family=cargoFamilyKey(),exp=expectedVesselSpaceLayout();let changed=false;
 const familyChanged=String(state.spaceLayoutFamily||'')!==String(family);
 const slots=cargoItems.filter(x=>x?.preloadedSpaceSlot);
 const slotIds=new Set(slots.map(x=>String(x.spaceId||'')));
 const cargoMismatch=familyChanged||slots.length!==exp.cargo.length||[...exp.cargoIds].some(id=>!slotIds.has(id));
 if(force||cargoMismatch){
   const manual=cargoItems.filter(x=>!x?.preloadedSpaceSlot);
   cargoItems=createEmptyCargoTemplateItems().concat(manual.filter(x=>!x.spaceId||exp.cargoIds.has(String(x.spaceId))));
   changed=true;
 }
 const representativePlan=['representative-template','representative'].includes(state.ballastPlanSource)||!ballastTanks.length;
 if(representativePlan){
   const ids=new Set(ballastTanks.map(t=>String(t.id||'')));
   const mismatch=familyChanged||ballastTanks.length!==exp.ballast.length||exp.ballast.some(t=>!ids.has(String(t.id)));
   if(force||mismatch){
     const old=new Map(ballastTanks.map(t=>[String(t.id),t]));
     ballastTanks=exp.ballast.map(t=>{const o=old.get(String(t.id));return {...t,fill:(!familyChanged&&o)?Math.max(0,Math.min(100,Number(o.fill)||0)):0,fluid:(!familyChanged&&o?.fluid)||t.fluid,density:(!familyChanged&&o?.density)||t.density,source:'representative-empty-template',autoCapacity:true,zone:ballastTankZoneFromLCG(t.lcg)};});
     state.ballastPlanSource='representative-template';state.ballastPlanEnabled=true;changed=true;
   }
 }
 if(changed){
   state.spaceLayoutFamily=family;state.spaceLayoutLabel=vesselPresets[state.hullType]?.label||state.hullType;
   bumpSpaceLayoutRevision(familyChanged?'automatic-family-change':'layout-consistency-repair');
   state.ballastPlanLabel=`Preloaded ${vesselPresets[state.hullType]?.label||state.hullType} ballast arrangement · ${ballastTanks.length} tanks`;
   if(render){renderCargoTable();renderBallastPlan();populateCargoLibraryUI();renderSpaceFillMonitor();}
   if(vesselVisualTransaction)pendingHard3DReload=true;else try{forceInternalArrangement3DRefresh();}catch(e){}
 }
 return changed;
}
function refreshRepresentativeBallastTemplateGeometry(){
 if(state.ballastPlanSource!=='representative-template')return;
 const old=new Map(ballastTanks.map(t=>[t.id,t]));
 ballastTanks=representativeArrangementTanks(ballastFamilyKey()).map(t=>{const prev=old.get(t.id);return {...t,fill:prev?Math.max(0,Math.min(100,Number(prev.fill)||0)):0,fluid:prev?.fluid||t.fluid,density:prev?.density||t.density,source:'representative-empty-template',autoCapacity:true,zone:ballastTankZoneFromLCG(t.lcg)};});
 state.ballastPlanLabel=`Preloaded ${vesselPresets[state.hullType]?.label||state.hullType} ballast arrangement · ${ballastTanks.length} tanks`;
}
function generateRepresentativeBallastPlan(countOverride=null){
 const key=ballastFamilyKey(),p=ballastFamilyProfiles[key];let tanks=representativeArrangementTanks(key);
 if(Number.isFinite(Number(countOverride))&&Number(countOverride)>0&&Number(countOverride)!==tanks.length)tanks=resizeRepresentativeTanks(tanks,Number(countOverride));
 ballastTanks=tanks.map(t=>({...t,fluid:t.fluid||defaultBallastFluidKey(),density:ballastFluidPresets[t.fluid||defaultBallastFluidKey()]?.density||t.density||1.025,fill:defaultBallastFillValue(),autoCapacity:true,zone:ballastTankZoneFromLCG(t.lcg),id:'bt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}));state.ballastPlanSource='representative';state.ballastPlanLabel=`${p.desc} · ${ballastTanks.length} tanks`;state.ballastPlanEnabled=true;renderBallastPlan();calculateAll();saveBallastPlanLocal();return ballastTanks;
}
function resizeRepresentativeTanks(existing,n){n=Math.max(1,Math.min(48,Math.round(n)));if(n===existing.length)return existing;const L=state.length,out=[];if(n===1){const g=representativeTankGeometry('deep');out.push(makeTank('Centre Deep Ballast','Deep','centre',0,{...g,tcg:0},0));return out;}const peakGeom={length:L*.065,breadth:state.beam*.72,height:state.depth*.36,bottom:state.depth*.035,tcg:0,block:.62};out.push(makeTank('Aft Peak Tank','Peak','centre',-L*.455,peakGeom,0));if(n>1)out.push(makeTank('Fore Peak Tank','Peak','centre',L*.455,peakGeom,0));let remaining=n-out.length;if(remaining<=0)return out;const pairCount=Math.floor(remaining/2),positions=Array.from({length:Math.max(1,pairCount)},(_,i)=>pairCount<=1?.08:-.20+.58*i/(pairCount-1));for(let i=0;i<pairCount;i++){const types=ballastFamilyProfiles[ballastFamilyKey()].types,g=representativeTankGeometry(types[i%types.length]),xn=positions[i];out.push(makeTank(`${g.label} ${i+1} P`,g.label,'port',xn*L,g,0));out.push(makeTank(`${g.label} ${i+1} S`,g.label,'starboard',xn*L,g,0));}if(out.length<n){const g=representativeTankGeometry('deep');out.push(makeTank('Centre Deep Ballast','Deep','centre',L*.37,{...g,tcg:0,breadth:Math.min(state.beam*.45,g.breadth*1.5)},0));}return out.slice(0,n);}
function arrangementTankColor(type=''){
 const t=String(type).toLowerCase();if(t.includes('peak'))return '#7dd3fc';if(t.includes('top'))return '#a7f3d0';if(t.includes('hopper'))return '#6ee7b7';if(t.includes('deep'))return '#67e8f9';if(t.includes('wing')||t.includes('wbt')||t.includes('sbt'))return '#93c5fd';return '#bfdbfe';
}
function arrangementShortName(name=''){return String(name).replace(/Tank/gi,'').replace(/Double Bottom/gi,'DB').trim().slice(0,18);}
function renderBallastArrangementSchematic(){
 const host=document.getElementById('ballastArrangementSchematic');if(!host)return;const L=Math.max(1,state.length),B=Math.max(1,state.beam),D=Math.max(1,state.depth),tanks=visualBallastTanks(),er=engineRoomArrangement(),key=ballastFamilyKey();
 const xMap=lcg=>55+((Number(lcg)/L)+.5)*890,ySide=(z)=>145-Math.max(0,Math.min(D,Number(z)))/D*105,yPlan=tcg=>275-(Number(tcg)/(B*.5))*70;
 const sideTanks=[];const seen=new Set();tanks.forEach(t=>{const k=`${Math.round((+t.lcg||0)*10)}|${t.type}`;if(t.side!=='centre'&&seen.has(k))return;seen.add(k);const x=xMap(t.lcg),w=Math.max(12,(+t.length||L*.06)/L*890),y=ySide((+t.bottom||0)+(+t.height||D*.15)),h=Math.max(10,(+t.height||D*.15)/D*105),c=arrangementTankColor(t.type);const fp=Math.max(0,Math.min(100,Number(t.fill)||0)),fy=y+h*(1-fp/100),fh=h*fp/100;sideTanks.push(`<g><rect x="${(x-w/2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c}" fill-opacity=".16" stroke="${c}"/>${fp>0?`<rect x="${(x-w/2+1).toFixed(1)}" y="${fy.toFixed(1)}" width="${Math.max(0,w-2).toFixed(1)}" height="${fh.toFixed(1)}" rx="1" fill="${c}" fill-opacity=".72"/>`:''}<text x="${x.toFixed(1)}" y="${(y+h*.42+2).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#e2e8f0">${escapeHtml(arrangementShortName(t.name).replace(/ [PS]$/,''))}</text><text x="${x.toFixed(1)}" y="${(y+h*.70+2).toFixed(1)}" text-anchor="middle" font-size="7" fill="#67e8f9">${fp.toFixed(0)}%</text></g>`);});
 const planTanks=tanks.map(t=>{const x=xMap(t.lcg),w=Math.max(10,(+t.length||L*.06)/L*890),b=Math.max(7,(+t.breadth||B*.15)/B*140),cy=t.side==='centre'?275:yPlan(t.tcg),c=arrangementTankColor(t.type);return `<g><rect x="${(x-w/2).toFixed(1)}" y="${(cy-b/2).toFixed(1)}" width="${w.toFixed(1)}" height="${b.toFixed(1)}" rx="2" fill="${c}" fill-opacity=".42" stroke="${c}"/><text x="${x.toFixed(1)}" y="${(cy-1).toFixed(1)}" text-anchor="middle" font-size="6.8" fill="#e2e8f0">${escapeHtml(arrangementShortName(t.name))}</text><text x="${x.toFixed(1)}" y="${(cy+7).toFixed(1)}" text-anchor="middle" font-size="6.3" fill="#67e8f9">${Math.max(0,Math.min(100,Number(t.fill)||0)).toFixed(0)}%</text></g>`}).join('');
 const erx=xMap(er.lcg),erw=er.length/L*890,ery=ySide(er.bottom+er.height),erh=er.height/D*105;
 host.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2 mb-2"><div><div class="text-[10px] font-bold text-slate-200">${escapeHtml(vesselPresets[state.hullType]?.label||state.hullType)} · Representative Internal Arrangement</div><div class="text-[8px] text-slate-500">STERN ← · +LCG forward → BOW · ${tanks.length} ballast spaces shown</div></div><span class="text-[8px] px-2 py-1 rounded-full border border-amber-500/30 text-amber-300">${state.ballastPlanSource==='training'?'AMCOL TRAINING TANK PLAN + REPRESENTATIVE MACHINERY':state.ballastPlanSource==='vessel'?(isGreatFortuneWorkbookVessel()?'WORKBOOK BALLAST + SOURCE-INFORMED MACHINERY':'IMPORTED BALLAST + REPRESENTATIVE MACHINERY'):'REPRESENTATIVE SCHEMATIC'}</span></div><svg viewBox="0 0 1000 360" class="w-full h-auto" role="img" aria-label="Side and plan schematic of ballast tanks and engine room"><text x="25" y="20" font-size="11" fill="#94a3b8">SIDE ARRANGEMENT</text><path d="M35 145 L75 126 L865 126 L945 105 L970 126 L945 145 Z" fill="#0f172a" stroke="#64748b" stroke-width="2"/>${sideTanks.join('')}<rect x="${(erx-erw/2).toFixed(1)}" y="${ery.toFixed(1)}" width="${erw.toFixed(1)}" height="${erh.toFixed(1)}" rx="3" fill="#fb923c" fill-opacity=".72" stroke="#fdba74"/><text x="${erx.toFixed(1)}" y="${(ery+erh/2+3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#431407">${escapeHtml(er.label)}</text><text x="25" y="190" font-size="11" fill="#94a3b8">PLAN VIEW</text><path d="M35 275 L95 213 L875 213 L970 275 L875 337 L95 337 Z" fill="#0f172a" stroke="#64748b" stroke-width="2"/><line x1="45" y1="275" x2="960" y2="275" stroke="#475569" stroke-dasharray="5 4"/>${planTanks}<rect x="${(erx-erw/2).toFixed(1)}" y="225" width="${erw.toFixed(1)}" height="100" rx="3" fill="#fb923c" fill-opacity=".62" stroke="#fdba74"/><text x="${erx.toFixed(1)}" y="279" text-anchor="middle" font-size="9" font-weight="700" fill="#431407">${escapeHtml(er.label)}</text><text x="65" y="355" font-size="8" fill="#64748b">AFT / STERN</text><text x="900" y="355" font-size="8" fill="#64748b">FORE / BOW</text></svg><div class="mt-1 text-[8px] text-slate-500">Family logic: ${escapeHtml(isGreatFortuneWorkbookVessel()?'Workbook tank centres/VCG/TCG are source values; 3D tank extents are inferred because no GA/capacity plan is in the workbook.':ballastFamilyProfiles[key].desc)} · Reference basis: ${escapeHtml(isGreatFortuneWorkbookVessel()?GREAT_FORTUNE_WORKBOOK_DATA.sourceFile:(ballastFamilyProfiles[key].reference||'representative family arrangement'))}.</div>`;
}
function openBallastArrangementSchematic(){openBallastPlanManager();const d=document.getElementById('ballastSchematicDetails');if(d)d.open=true;renderBallastArrangementSchematic();setTimeout(()=>d?.scrollIntoView?.({block:'nearest'}),30);}
function toggleInternalArrangement(){showInternalArrangement=!showInternalArrangement;const b=document.getElementById('internalArrangementBtn');if(b){b.classList.toggle('bg-blue-500/15',showInternalArrangement);b.classList.toggle('border-blue-500/30',showInternalArrangement);b.classList.toggle('bg-slate-900/85',!showInternalArrangement);b.classList.toggle('border-slate-800',!showInternalArrangement);}render();}
function generateCustomNTankPlan(n){n=Math.max(1,Math.min(48,Math.round(Number(n)||10)));const L=state.length,g=representativeTankGeometry('lower'),arr=[];for(let i=0;i<n;i++){const side=n===1?'centre':(i%2?'starboard':'port'),pair=Math.floor(i/2),pairs=Math.ceil(n/2),xn=pairs<=1?0:-.36+.72*pair/(pairs-1);arr.push(makeTank(`Ballast ${i+1}`,g.label,side,xn*L,g,0));}ballastTanks=arr;state.ballastPlanSource='representative';state.ballastPlanLabel=`Custom ${n}-tank representative grid`;state.ballastPlanEnabled=true;renderBallastPlan();calculateAll();saveBallastPlanLocal();}
function generateBallastPlanFromUI(){const n=Number(document.getElementById('inputBallastTankNumber')?.value)||null,basis=document.getElementById('ballastPlanBasis')?.value||'family';if(basis==='custom')generateCustomNTankPlan(n);else generateRepresentativeBallastPlan(n);openBallastPlanManager();}
function setBallastPlanEnabled(v){state.ballastPlanEnabled=!!v;renderBallastPlan();calculateAll();saveBallastPlanLocal();}
function addBallastTank(){const g=representativeTankGeometry('lower');ballastTanks.push(makeTank(`Ballast ${ballastTanks.length+1}`,g.label,'centre',0,g,0));state.ballastPlanSource=state.ballastPlanSource==='vessel'?'vessel':'custom';state.ballastPlanLabel=`Custom ballast plan · ${ballastTanks.length} tanks`;state.ballastPlanEnabled=true;renderBallastPlan();calculateAll();openBallastPlanManager();}
function deleteBallastTank(id){ballastTanks=ballastTanks.filter(t=>t.id!==id);renderBallastPlan();calculateAll();saveBallastPlanLocal();}
function ballastTypeOptionsHtml(selected=''){const types=['Peak','Double Bottom','Wing Ballast','Hopper','Topside','Deep Tank','Anti-Heeling','Other'];return types.map(v=>`<option value="${v}" ${String(selected).toLowerCase()===v.toLowerCase()?'selected':''}>${v}</option>`).join('');}
function updateBallastTank(id,key,value){const t=ballastTanks.find(x=>x.id===id);if(!t)return;const numeric=['capacity','fill','lcg','tcg','bottom','length','breadth','height','density','fsmFactor','blockFactor'];if(t.sourceLocked&&!['name'].includes(key)){t.sourceReferenceMass=Number(t.sourceMass)||0;t.sourceReferenceVCG=Number(t.sourceVCG)||0;t.sourceReferenceFSM=Number(t.sourceFSM)||0;t.sourceLocked=false;t.source=state.ballastPlanSource==='training'?'Edited from AMCOL training baseline':'Edited from source workbook';}if(key==='autoCapacity')t.autoCapacity=!!value;else t[key]=numeric.includes(key)?Number(value):value;if(key==='side'){t.side=value;if(value==='centre')t.tcg=0;else if(Math.abs(t.tcg)<.01)t.tcg=(value==='starboard'?1:-1)*state.beam*.3;else t.tcg=Math.abs(t.tcg)*(value==='starboard'?1:-1);}if(key==='fluid'&&ballastFluidPresets[value]?.density){t.density=ballastFluidPresets[value].density;}if(key==='zone'){t.lcg=ballastZoneLCG(value);}if(key==='lcg')t.zone=ballastTankZoneFromLCG(t.lcg);if(t.autoCapacity)t.capacity=ballastTankFullCapacity(t);const templateContentEdit=['fill','fluid','density'].includes(key);if(state.ballastPlanSource==='representative-template'&&templateContentEdit)state.ballastPlanSource='representative-template';else if(state.ballastPlanSource==='training'&&templateContentEdit)state.ballastPlanSource='training';else state.ballastPlanSource=state.ballastPlanSource==='vessel'?'vessel':'custom';renderBallastPlan();calculateAll();saveBallastPlanLocal();}
function ballastPlanTotals(){let mass=0,vm=0,tm=0,lm=0,fsm=0;ballastTanks.forEach(t=>{const m=ballastTankMass(t),v=ballastTankLiquidVCG(t);mass+=m;vm+=m*v;tm+=m*(Number(t.tcg)||0);lm+=m*(Number(t.lcg)||0);fsm+=ballastTankFSM(t);});return {mass,kg:mass?vm/mass:0,tcg:mass?tm/mass:0,lcg:mass?lm/mass:0,fsm,fsc:state.dispMass?fsm/state.dispMass:0};}
function ballastQuickLocationLabel(t){
 const side=t.side==='port'?'PORT':t.side==='starboard'?'STBD':'CENTRE';
 const zone={aft_peak:'AFT PEAK',aft:'AFT',mid:'MIDSHIP',forward:'FORWARD',fore_peak:'FORE PEAK'}[t.zone||ballastTankZoneFromLCG(t.lcg)]||'MIDSHIP';
 return `${side} · ${zone}`;
}
function renderBallastQuickList(){
 const host=document.getElementById('ballastQuickList');if(!host)return;
 if(!ballastTanks.length){host.innerHTML='<div class="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-3 text-[10px] text-slate-500">No tanks are loaded. Select/reload a vessel to restore its preloaded ballast arrangement.</div>';return;}
 host.innerHTML=ballastTanks.map(t=>{
   t.fluid=t.fluid||'seawater';t.zone=t.zone||ballastTankZoneFromLCG(t.lcg);
   const fill=Math.max(0,Math.min(100,Number(t.fill)||0)),cap=ballastTankFullCapacity(t),mass=ballastTankMass(t),fsm=ballastTankFSM(t);
   const fillCls=fill>=99.95?'bg-blue-400':fill>0?'bg-cyan-400':'bg-slate-700';
   const sourceTag=t.sourceLocked?(state.ballastPlanSource==='training'?'TRAINING':'SOURCE'):state.ballastPlanSource==='training'?'TRAINING EDIT':state.ballastPlanSource==='vessel'?'VESSEL':state.ballastPlanSource==='representative-template'?'PRELOADED':'TEACHING';
   return `<div class="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 hover:border-cyan-900/70 transition-colors">
     <div class="flex items-start justify-between gap-2 mb-2">
       <div class="min-w-0"><div class="text-[11px] font-black text-slate-100 truncate">${escapeHtml(t.name||'Ballast Tank')}</div><div class="text-[9px] text-slate-500">${escapeHtml(t.type||'Ballast')} · ${ballastQuickLocationLabel(t)}</div></div>
       <div class="text-right shrink-0"><div class="text-[13px] font-black ${fill>0?'text-cyan-300':'text-slate-500'}">${fill.toFixed(0)}%</div><div class="text-[8px] text-slate-600">${sourceTag}</div></div>
     </div>
     <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2"><div class="h-full ${fillCls} transition-all" style="width:${fill}%"></div></div>
     <div class="grid grid-cols-[1fr_86px_84px] gap-2 items-end">
       <label class="text-[9px] text-slate-500">Ballast liquid<select class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-100" onchange="updateBallastTank('${t.id}','fluid',this.value)"><option value="seawater" ${t.fluid==='seawater'?'selected':''}>Seawater</option><option value="fresh" ${t.fluid==='fresh'?'selected':''}>Fresh water</option><option value="brackish" ${t.fluid==='brackish'?'selected':''}>Brackish</option><option value="custom" ${t.fluid==='custom'?'selected':''}>Custom</option></select></label>
       <label class="text-[9px] text-slate-500">Fill %<input type="number" min="0" max="100" step="5" value="${fill.toFixed(0)}" class="mt-1 w-full rounded-lg border border-cyan-900/70 bg-slate-900 px-2 py-1.5 text-[11px] font-black text-cyan-200" onchange="updateBallastTank('${t.id}','fill',Math.max(0,Math.min(100,Number(this.value)||0)))"></label>
       <div class="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1.5"><div class="text-[8px] text-slate-500">Mass</div><div class="text-[10px] font-mono font-bold text-slate-200">${mass.toFixed(0)} t</div></div>
     </div>
     <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-slate-500"><span>Capacity <b class="text-slate-300">${cap.toFixed(0)} t</b></span><span>LCG <b class="text-slate-300">${Number(t.lcg||0).toFixed(1)} m</b></span><span>TCG <b class="text-slate-300">${Number(t.tcg||0).toFixed(1)} m</b></span>${fill>0&&fill<100?`<span>FSM <b class="text-amber-300">${fsm.toFixed(0)} t·m</b></span>`:''}</div>
   </div>`;
 }).join('');
}
function renderBallastPlan(){
 const badge=document.getElementById('ballastPlanBadge'),summary=document.getElementById('ballastPlanSummary'),cb=document.getElementById('checkBallastPlanEnabled'),n=document.getElementById('inputBallastTankNumber');if(cb)cb.checked=state.ballastPlanEnabled;if(n&&document.activeElement!==n)n.value=ballastTanks.length||ballastFamilyProfiles[ballastFamilyKey()].count;
 const isVessel=state.ballastPlanSource==='vessel',isTraining=state.ballastPlanSource==='training',isRep=['representative','representative-template'].includes(state.ballastPlanSource);if(badge){badge.textContent=!ballastTanks.length?'NO PLAN':isTraining?'AMCOL TRAINING':isVessel?'VESSEL DATA':state.ballastPlanSource==='representative-template'?'PRELOADED EMPTY':isRep?'REPRESENTATIVE':'CUSTOM';badge.className=`text-[8px] px-2 py-1 rounded-full border ${isTraining?'border-violet-500/30 text-violet-300 bg-violet-500/10':isVessel?'border-emerald-500/30 text-emerald-300 bg-emerald-500/10':isRep?'border-amber-500/30 text-amber-300 bg-amber-500/10':'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'}`;}
 const tot=ballastPlanTotals(),hasCargoBallast=cargoItems.some(x=>/ballast/i.test(String(x.name||'')));if(summary){const fp=ballastFamilyProfiles[ballastFamilyKey()];summary.innerHTML=ballastTanks.length?`<b>${escapeHtml(state.ballastPlanLabel)}</b><br>${ballastTanks.length} tanks · average fill ${(ballastTanks.reduce((a,t)=>a+Math.max(0,Math.min(100,Number(t.fill)||0)),0)/Math.max(1,ballastTanks.length)).toFixed(0)}% · filled mass ${tot.mass.toFixed(1)} t · plan FSM ${tot.fsm.toFixed(0)} t·m · ${state.ballastPlanEnabled?'APPLIED':'not applied'}${hasCargoBallast&&state.ballastPlanEnabled?'<br><span class="text-amber-300">⚠ Cargo table also contains ballast-named weights; check for double counting.</span>':''}`:`Suggested ${vesselPresets[state.hullType]?.label||state.hullType} representative arrangement: <b>${fp.count} tanks</b><br>${escapeHtml(fp.desc)}. Exact count requires the vessel tank/capacity plan.`;}
 const tb=document.getElementById('ballastPlanTableBody');if(tb){tb.innerHTML=ballastTanks.map(t=>{t.zone=t.zone||ballastTankZoneFromLCG(t.lcg);t.fluid=t.fluid||'seawater';if(t.autoCapacity===undefined)t.autoCapacity=false;const cap=ballastTankFullCapacity(t);return `<tr><td><input value="${escapeHtml(t.name)}" onchange="updateBallastTank('${t.id}','name',this.value)" style="width:105px"></td><td><select onchange="updateBallastTank('${t.id}','type',this.value)" style="width:105px">${ballastTypeOptionsHtml(t.type)}</select></td><td><select onchange="updateBallastTank('${t.id}','zone',this.value)"><option value="aft_peak" ${t.zone==='aft_peak'?'selected':''}>Aft Peak</option><option value="aft" ${t.zone==='aft'?'selected':''}>Aft</option><option value="mid" ${t.zone==='mid'?'selected':''}>Midship</option><option value="forward" ${t.zone==='forward'?'selected':''}>Forward</option><option value="fore_peak" ${t.zone==='fore_peak'?'selected':''}>Fore Peak</option></select></td><td><select onchange="updateBallastTank('${t.id}','side',this.value)"><option value="port" ${t.side==='port'?'selected':''}>Port</option><option value="centre" ${t.side==='centre'?'selected':''}>Centre</option><option value="starboard" ${t.side==='starboard'?'selected':''}>Starboard</option></select></td><td><select onchange="updateBallastTank('${t.id}','fluid',this.value)"><option value="seawater" ${t.fluid==='seawater'?'selected':''}>Sea 1.025</option><option value="fresh" ${t.fluid==='fresh'?'selected':''}>Fresh 1.000</option><option value="brackish" ${t.fluid==='brackish'?'selected':''}>Brackish 1.010</option><option value="custom" ${t.fluid==='custom'?'selected':''}>Custom</option></select></td><td class="text-center"><input type="checkbox" ${t.autoCapacity?'checked':''} onchange="updateBallastTank('${t.id}','autoCapacity',this.checked)"></td><td><input type="number" value="${Number(cap).toFixed(1)}" ${t.autoCapacity?'disabled':''} onchange="updateBallastTank('${t.id}','capacity',this.value)" style="width:70px"></td><td><input type="number" min="0" max="100" value="${Number(t.fill).toFixed(1)}" onchange="updateBallastTank('${t.id}','fill',this.value)" style="width:55px"></td><td><input type="number" value="${Number(t.lcg).toFixed(2)}" onchange="updateBallastTank('${t.id}','lcg',this.value)" style="width:62px"></td><td><input type="number" value="${Number(t.tcg).toFixed(2)}" onchange="updateBallastTank('${t.id}','tcg',this.value)" style="width:62px"></td><td><input type="number" value="${Number(t.bottom).toFixed(2)}" onchange="updateBallastTank('${t.id}','bottom',this.value)" style="width:55px"></td><td><input type="number" value="${Number(t.length).toFixed(2)}" onchange="updateBallastTank('${t.id}','length',this.value)" style="width:58px"></td><td><input type="number" value="${Number(t.breadth).toFixed(2)}" onchange="updateBallastTank('${t.id}','breadth',this.value)" style="width:58px"></td><td><input type="number" value="${Number(t.height).toFixed(2)}" onchange="updateBallastTank('${t.id}','height',this.value)" style="width:58px"></td><td><input type="number" value="${Number(t.density).toFixed(3)}" step=".005" onchange="updateBallastTank('${t.id}','density',this.value);updateBallastTank('${t.id}','fluid','custom')" style="width:58px"></td><td class="font-mono text-cyan-300">${ballastTankMass(t).toFixed(1)}</td><td class="font-mono text-amber-300">${ballastTankLiquidVCG(t).toFixed(2)}</td><td class="font-mono text-violet-300">${ballastTankFSM(t).toFixed(0)}</td><td><button onclick="deleteBallastTank('${t.id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button></td></tr>`}).join('');}
 const set=(id,html)=>{const e=document.getElementById(id);if(e)e.innerHTML=html};set('ballastPlanMassReadout',`<b>Ballast mass</b><br>${tot.mass.toFixed(1)} t · KG ${tot.kg.toFixed(2)} m`);set('ballastPlanMomentReadout',`<b>Ballast CG</b><br>TCG ${tot.tcg>=0?'+':''}${tot.tcg.toFixed(2)} m · LCG ${tot.lcg>=0?'+':''}${tot.lcg.toFixed(2)} m`);set('ballastPlanFSCReadout',`<b>Free surface</b><br>FSM ${tot.fsm.toFixed(0)} t·m · FSC ≈ ${tot.fsc.toFixed(3)} m`);
 renderBallastQuickList();updatePhysicsValidity();renderBallastArrangementSchematic();
}
function openBallastPlanManager(){document.getElementById('ballastPlanBackdrop')?.classList.remove('hidden');renderBallastPlan();renderBallastArrangementSchematic();}
function closeBallastPlanManager(){document.getElementById('ballastPlanBackdrop')?.classList.add('hidden');}
function clearBallastPlan(){if(!confirm('Empty all ballast tanks? The vessel tank arrangement will remain loaded.'))return;ballastTanks.forEach(t=>{t.fill=0;if(t.sourceLocked){t.sourceLocked=false;t.sourceReferenceMass=Number(t.sourceMass)||0;t.sourceReferenceVCG=Number(t.sourceVCG)||0;t.sourceReferenceFSM=Number(t.sourceFSM)||0;t.source=(t.source||'Vessel source')+' · emptied by user';}});state.ballastPlanEnabled=true;if(!ballastTanks.length)initialiseEmptyBallastTemplate();try{localStorage.removeItem(BALLAST_PLAN_STORAGE_KEY)}catch(e){}renderBallastPlan();calculateAll();}
function saveBallastPlanLocal(){try{localStorage.setItem(BALLAST_PLAN_STORAGE_KEY,JSON.stringify({vesselKey:`${state.hullType}|${Number(state.length).toFixed(2)}|${Number(state.beam).toFixed(2)}|${Number(state.depth).toFixed(2)}`,tanks:ballastTanks,enabled:state.ballastPlanEnabled,source:state.ballastPlanSource,label:state.ballastPlanLabel}));}catch(e){}}
function restoreBallastPlanLocal(){try{const raw=localStorage.getItem(BALLAST_PLAN_STORAGE_KEY);if(!raw)return false;const o=JSON.parse(raw),key=`${state.hullType}|${Number(state.length).toFixed(2)}|${Number(state.beam).toFixed(2)}|${Number(state.depth).toFixed(2)}`;if(!o.vesselKey||o.vesselKey!==key)return false;if(Array.isArray(o.tanks)){ballastTanks=o.tanks;state.ballastPlanEnabled=!!o.enabled;state.ballastPlanSource=o.source||'custom';state.ballastPlanLabel=o.label||`Custom ballast plan · ${ballastTanks.length} tanks`;renderBallastPlan();return true;}}catch(e){}return false;}
function exportBallastPlanJSON(){downloadText(`${(state.vesselName||'vessel').replace(/[^a-z0-9]+/gi,'_')}_ballast_plan.json`,JSON.stringify({metadata:{vessel:state.vesselName,type:state.hullType,length:state.length,beam:state.beam,depth:state.depth,source:state.ballastPlanSource},tanks:ballastTanks},null,2),'application/json');}
function downloadBallastTankTemplate(){const csv='name,type,zone,side,fluid,capacity,fill,lcg,tcg,bottom,length,breadth,height,density,fsmFactor\\nFore Peak,Peak,fore_peak,centre,seawater,500,0,35,0,0.4,8,12,3,1.025,1\\nDB 1 P,Double Bottom,forward,port,seawater,350,0,15,-4.5,0.3,10,4,2.5,1.025,1';downloadText('ballast_tank_plan_template.csv',csv,'text/csv');}
async function importBallastTankPlan(files){const file=files?.[0];if(!file)return;try{const text=await file.text();let rows=[];if(file.name.toLowerCase().endsWith('.json')){const o=JSON.parse(text);rows=o.tanks||o.ballastTanks||[];}else{rows=csvParse(text).map(r=>({name:sFrom(r,['name','tank']),type:sFrom(r,['type','tanktype']),zone:sFrom(r,['zone','position']),side:(sFrom(r,['side'])||'centre').toLowerCase(),fluid:sFrom(r,['fluid','liquid']),capacity:nFrom(r,['capacity','capacityt','tonnes']),fill:nFrom(r,['fill','fillpercent']),lcg:nFrom(r,['lcg']),tcg:nFrom(r,['tcg']),bottom:nFrom(r,['bottom','bottomz']),length:nFrom(r,['length']),breadth:nFrom(r,['breadth','width']),height:nFrom(r,['height']),density:nFrom(r,['density','rho']),fsmFactor:nFrom(r,['fsmfactor'])}));}ballastTanks=rows.map((r,i)=>({id:`import_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`,sourceId:r.id?String(r.id):'',name:r.name||`Tank ${i+1}`,type:r.type||'Ballast',side:['port','starboard','centre','center'].includes(String(r.side).toLowerCase())?(String(r.side).toLowerCase()==='center'?'centre':String(r.side).toLowerCase()):((Number(r.tcg)||0)>0?'starboard':(Number(r.tcg)||0)<0?'port':'centre'),capacity:Math.max(0,Number(r.capacity)||0),fill:Math.max(0,Math.min(100,Number(r.fill)||0)),lcg:Number(r.lcg)||0,tcg:Number(r.tcg)||0,bottom:Math.max(0,Number(r.bottom)||0),length:Math.max(.1,Number(r.length)||1),breadth:Math.max(.1,Number(r.breadth)||1),height:Math.max(.1,Number(r.height)||1),density:Math.max(.1,Number(r.density)||1.025),fluid:(['seawater','fresh','brackish'].includes(String(r.fluid||'').toLowerCase())?String(r.fluid).toLowerCase():'custom'),autoCapacity:false,blockFactor:.85,zone:(['aft_peak','aft','mid','forward','fore_peak'].includes(String(r.zone||'').toLowerCase())?String(r.zone).toLowerCase():ballastTankZoneFromLCG(Number(r.lcg)||0)),fsmFactor:Number.isFinite(Number(r.fsmFactor))?Number(r.fsmFactor):1,source:'vessel'}));state.ballastPlanSource='vessel';state.ballastPlanLabel=`Imported vessel tank plan · ${ballastTanks.length} tanks`;state.ballastPlanEnabled=true;renderBallastPlan();calculateAll();saveBallastPlanLocal();openBallastPlanManager();}catch(e){alert('Ballast tank plan import failed: '+e.message);}}
function physicsValidity(){const p=hydroPack(),hr=hydroTableAtCurrentDisplacement(),hydro=!!hr,kn=p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length&&Number.isFinite(uploadedOperationalGZAt(Math.min(20,Math.max(5,Math.abs(state.heel)||10))))),tank=['vessel','training'].includes(state.ballastPlanSource)&&ballastTanks.length>0,wave=state.waveModel==='physical',damageExact=false;return {hydro,kn:!!kn,tank,wave,damageExact};}
function updatePhysicsValidity(){const v=physicsValidity(),grid=document.getElementById('physicsValidityGrid'),badge=document.getElementById('physicsFidelityBadge'),note=document.getElementById('physicsValidityNote');if(badge){badge.textContent=state.physicsFidelity==='vessel'?'VESSEL DATA':state.physicsFidelity==='teaching'?'TEACHING':'ENHANCED';}if(grid){const items=[['Upright hydro',v.hydro,'Vessel/table','Geometry model'],['Large-angle GZ',v.kn,'KN/GZ source','Generic geometry'],['Ballast tanks',v.tank,state.ballastPlanSource==='training'?'AMCOL training tank plan':'Vessel tank plan',ballastTanks.length?'Representative/custom':'No tank plan'],['Wave field',v.wave,'Dispersion solved','Manual wave'],['Damage','warn','Teaching compartment','Teaching model'],['Long. strength','warn','Teaching distribution','Teaching model']];grid.innerHTML=items.map(([k,ok,a,b])=>{const cls=ok===true?'text-emerald-300 border-emerald-900/40':ok==='warn'?'text-amber-300 border-amber-900/40':'text-amber-300 border-amber-900/40';return `<div class="validity-chip ${cls}"><div class="text-slate-500">${k}</div><b>${ok===true?a:b}</b></div>`}).join('');}if(note)note.innerHTML=state.physicsFidelity==='vessel'&&!v.hydro?'<span class="text-rose-300"><b>Vessel Data Mode:</b> no source-backed upright hydrostatics cover the current displacement. Results continue only as clearly labelled model fallback.</span>':'No hidden extrapolation: source tables are used only inside their valid ranges; missing data fall back to teaching models and are shown here.';}
function setPhysicsFidelity(v){state.physicsFidelity=['teaching','enhanced','vessel'].includes(v)?v:'enhanced';if(state.physicsFidelity!=='teaching'&&state.waveModel==='physical')applyPhysicalWaveFromPeriod(true);updatePhysicsValidity();calculateAll({curve:false});}
function refreshInitialGMFromActiveSourceCurve(){
 const p=hydroPack(),refHyd=hydroTableAtCurrentDisplacement();
 // When KMT is tabulated it remains the preferred initial-GM source.
 if(refHyd&&Number.isFinite(refHyd.kmt))return false;
 const external=(p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length&&!state.damage));
 if(!external)return false;
 const epsDeg=.5,epsRad=epsDeg*Math.PI/180,gp=operationalGZAt(epsDeg),gm=operationalGZAt(-epsDeg);
 if(!Number.isFinite(gp)||!Number.isFinite(gm))return false;
 const slope=(gp-gm)/(2*epsRad);if(!Number.isFinite(slope))return false;
 state.gm=slope;
 if(state.upright){state.upright.KM=state.kgCorr+slope;if(Number.isFinite(state.upright.KB))state.upright.BM=state.upright.KM-state.upright.KB;state.upright.source=(state.upright.source||'geometry')+' · initial GM from active source GZ slope';}
 state.naturalPeriod=state.gm>0?2*Math.PI*(state.krRatio*state.beam)/Math.sqrt(G*state.gm):null;
 return true;
}
function physicsAuthority(){
 const p=hydroPack(),tv=activeAMCOLTrainingVessel(),hyd=hydroTableAtCurrentDisplacement(),probe=10;
 const kn=(p.kind==='gzReference'||p.kind==='knReference')?Number.isFinite(textbookReferenceGZAt(probe)):(p.kind==='uploadedBundle'&&p.knRows?.length?Number.isFinite(uploadedOperationalGZAt(probe)):false),exactTank=state.ballastPlanSource==='vessel'&&ballastTanks.length>0;
 let level='D',label='Generic Teaching Vessel',detail='Procedural hydrostatics and nonlinear geometry.';
 if(tv){level='C';if(tv.realSourceCalibrated){label='Source-Anchored AMCOL Calibrated Real Vessel';detail='Official/company/class particulars anchor the vessel identity and summer draught; hydrostatics, KN, tank geometry, loading targets and strength limits are AMCOL-derived training data.';}else{label='AMCOL Calibrated Training Vessel';detail='Complete AMCOL educational dataset; not approved ship data.';}}
 else if(hyd&&kn&&exactTank){level='A';label='Vessel-Data Condition';detail='Source hydrostatics + valid KN/GZ + imported/source tank plan.';}
 else if(hyd||kn){level='B';label='Hybrid Vessel-Data Condition';detail=`${hyd?'Source hydrostatics':'Model hydrostatics'} + ${kn?'source KN/GZ':'model large-angle GZ'}.`;}
 state.physicsAuthorityLevel=level;state.physicsAuthorityLabel=label;return {level,label,detail,hydro:!!hyd,kn:!!kn,tanks:exactTank};
}
function runPhysicsIntegrityMonitor(){
 const checks=[],add=(name,pass,value='',severity='error')=>checks.push({name,pass:!!pass,value,severity});
 const finite=['dispMass','kgSolid','kgCorr','gm','eqDraft','draftBow','draftStern','equilibrium','trimMeters'];finite.forEach(k=>add(`Finite ${k}`,Number.isFinite(Number(state[k])),Number.isFinite(Number(state[k]))?Number(state[k]).toFixed(4):'NaN/∞'));
 add('Positive displacement',state.dispMass>0,`${state.dispMass.toFixed(2)} t`);
 add('Draft inside numeric envelope',state.eqDraft>=0&&state.draftBow>=0&&state.draftStern>=0,'non-negative drafts');
 if(state.coupledHydro){const cm=state.coupledResidualMass||0,ct=state.coupledResidualTMoment||0,cl=state.coupledResidualLMoment||0;add('Coupled displacement closure',state.coupledMode==='source-anchored'||cm<=Math.max(.5,state.dispMass*5e-5),`${cm.toFixed(3)} t`);add('Coupled transverse moment closure',state.coupledMode==='source-anchored'||ct<=Math.max(5,state.dispMass*state.beam*4e-5),`${ct.toFixed(2)} t·m`);add('Coupled longitudinal moment closure',state.coupledMode==='source-anchored'||cl<=Math.max(20,state.dispMass*state.length*4e-5),`${cl.toFixed(2)} t·m`);}
 if(state.ballastPlanEnabled){const bad=ballastTanks.filter(t=>!Number.isFinite(Number(t.fill))||Number(t.fill)<-1e-6||Number(t.fill)>100+1e-6||ballastTankMass(t)<-1e-6);add('Ballast bounds',bad.length===0,bad.length?`${bad.length} invalid tank(s)`:`${ballastTanks.length} tanks valid`);}
 if(state.strength){const s=state.strength,forceTol=Math.max(5,state.dispMass*G*.002),momentTol=Math.max(50,state.dispMass*G*state.length*.002);add('Strength mass closure',Math.abs(s.massResidual||0)<=Math.max(.5,state.dispMass*5e-5),`${(s.massResidual||0).toFixed(3)} t`);add('Raw SF end closure',Math.abs(s.rawEndShear||0)<=forceTol,`${(s.rawEndShear||0).toFixed(1)} kN`,'warn');add('Raw BM end closure',Math.abs(s.rawEndMoment||0)<=momentTol,`${((s.rawEndMoment||0)/1000).toFixed(2)} MN·m`,'warn');}
 const p=hydroPack(),sourceDraftRow=hydroTableAtCurrentDisplacement();if(sourceDraftRow&&Number.isFinite(sourceDraftRow.draft))add('Hydrostatic draft authority',Math.abs(state.eqDraft-sourceDraftRow.draft)<=.002,`calc ${state.eqDraft.toFixed(3)} / source ${sourceDraftRow.draft.toFixed(3)} m`);if(p.kind==='uploadedBundle'&&p.knRows?.length){const kr=uploadedKNInterpolation(Math.min(10,Math.max(5,Math.abs(state.equilibrium)||5)),state.equilibrium<0?'port':'starboard');add('Uploaded KN validity',kr.valid,kr.valid?`Δ bracket ${kr.lower?.toFixed?.(0)||'—'}–${kr.upper?.toFixed?.(0)||'—'} t`:(kr.reason||'out of range'),'warn');const k5=uploadedKNInterpolation(5,'starboard');if(k5.valid&&sourceDraftRow&&Number.isFinite(sourceDraftRow.kmt)){const km5=k5.kn/Math.sin(5*Math.PI/180),err=100*(km5/sourceDraftRow.kmt-1);add('KN↔KMT small-angle consistency',Math.abs(err)<=2,`KM(5°) ${km5.toFixed(3)} / KMT ${sourceDraftRow.kmt.toFixed(3)} m · ${err>=0?'+':''}${err.toFixed(2)}%`,'warn');}}
 const hard=checks.filter(c=>!c.pass&&c.severity!=='warn'),warnings=checks.filter(c=>!c.pass&&c.severity==='warn'),pass=hard.length===0;state.physicsIntegrity={pass,checks,hardFailures:hard.length,warnings:warnings.length,timestamp:Date.now()};return state.physicsIntegrity;
}
function renderPhysicsIntegrity(){
 const box=document.getElementById('physicsIntegrityReadout'),badge=document.getElementById('physicsIntegrityBadge');if(!box)return;const r=state.physicsIntegrity||runPhysicsIntegrityMonitor(),a=physicsAuthority();
 if(badge){badge.textContent=r.pass?(r.warnings?'PASS + WARN':'PASS'):'INVALID';badge.className=`text-[8px] px-2 py-1 rounded-full border font-black ${r.pass?(r.warnings?'border-amber-500/40 text-amber-300 bg-amber-500/10':'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'):'border-rose-500/50 text-rose-300 bg-rose-500/10'}`;}
 const key=r.checks.filter(c=>!c.pass).slice(0,5);box.innerHTML=`<div class="rounded-lg border border-slate-800 bg-slate-950/70 p-2"><div class="flex justify-between gap-2"><span class="font-bold text-cyan-300">Authority Level ${a.level}</span><span>${escapeHtml(a.label)}</span></div><div class="text-[8px] text-slate-500 mt-1">${escapeHtml(a.detail)}</div></div><div class="grid grid-cols-2 gap-1 mt-2"><div class="rounded bg-slate-900 p-2"><div class="text-slate-500">Coupled residual Δ</div><div class="font-mono">${Number(state.coupledResidualMass||0).toFixed(3)} t</div></div><div class="rounded bg-slate-900 p-2"><div class="text-slate-500">T / L moments</div><div class="font-mono">${Number(state.coupledResidualTMoment||0).toFixed(1)} / ${Number(state.coupledResidualLMoment||0).toFixed(1)} t·m</div></div><div class="rounded bg-slate-900 p-2"><div class="text-slate-500">Iterations</div><div class="font-mono">${state.coupledIterations||0} · ${escapeHtml(state.coupledConvergenceQuality||'—')}</div></div><div class="rounded bg-slate-900 p-2"><div class="text-slate-500">Finite-angle liquid</div><div class="font-mono">${state.finiteAngleLiquid?.active?`${state.finiteAngleLiquid.ballastCount||0} ballast + ${state.finiteAngleLiquid.cargoCount||0} cargo`:'equivalent FSC / none'}</div></div></div>${key.length?`<div class="mt-2 space-y-1">${key.map(c=>`<div class="rounded px-2 py-1 ${c.severity==='warn'?'bg-amber-950/20 text-amber-300':'bg-rose-950/25 text-rose-300'}">${c.severity==='warn'?'⚠':'✕'} ${escapeHtml(c.name)} · ${escapeHtml(String(c.value||''))}</div>`).join('')}</div>`:'<div class="mt-2 text-emerald-300">✓ No hard numerical-integrity failures detected.</div>'}`;
}

function renderDamageDiagnostics(){
 const box=document.getElementById('damageDiagnosticReadout');if(!box)return;
 if(!state.damage){box.innerHTML='Enable damage to inspect affected training compartments and the derived floodable-volume estimate.';return;}
 const estimate=window.AMCOLPhysics?.damageStability?.estimate?.({length:state.length,beam:state.beam,depth:state.depth,density:state.density,damage:{side:state.damageSide,widthPct:state.damageWidth,heightPct:state.damageHeight,lengthPct:state.damageLengthPct,lcg:state.damageLCG,permeability:state.damagePerm},cargoSpaces:cargoSpacesWithFill(),ballastTanks});
 if(!estimate?.valid){box.innerHTML='<span class="text-amber-300">Damage diagnostic unavailable.</span>';return;}
 const top=estimate.affected.slice().sort((a,b)=>b.mass-a.mass).slice(0,5),tv=activeAMCOLTrainingVessel(),explicit=Array.isArray(tv?.damageCompartments)?tv.damageCompartments:[],prog=explicit.length?window.AMCOLPhysics?.damageStability?.progressiveFlooding?.(explicit,estimate.affected.map(x=>x.id)):null;
 const progHtml=prog?.hasConnectivity?`<div class="mt-2 rounded border border-rose-900/40 bg-rose-950/10 p-2"><b class="text-rose-200">Explicit progressive-flooding paths:</b> ${prog.flooded.length} compartment(s) reached · order ${prog.progressionOrder.map(escapeHtml).join(' → ')||'—'}<div class="text-[7.5px] text-slate-500 mt-1">${escapeHtml(prog.warning)}</div></div>`:`<div class="mt-2 text-[8px] text-slate-500">Progressive flooding: <b>NOT MODELLED</b> because no explicit watertight-compartment connectivity is loaded. Missing doors, ducts and cross-flooding paths are never invented.</div>`;
 box.innerHTML=`<div class="flex justify-between gap-2"><b class="text-rose-300">Derived compartment exposure</b><span class="text-[8px] text-amber-300">${escapeHtml(estimate.authority)}</span></div><div class="mt-1 grid grid-cols-2 gap-1"><div class="rounded bg-slate-900 p-1.5"><span class="text-slate-500">Affected spaces</span><br><b>${estimate.affected.length}</b></div><div class="rounded bg-slate-900 p-1.5"><span class="text-slate-500">Floodable mass proxy</span><br><b>${estimate.totalMass.toFixed(0)} t</b></div><div class="rounded bg-slate-900 p-1.5"><span class="text-slate-500">Derived flood TCG</span><br><b>${estimate.tcg.toFixed(2)} m</b></div><div class="rounded bg-slate-900 p-1.5"><span class="text-slate-500">Derived flood LCG</span><br><b>${estimate.lcg.toFixed(2)} m</b></div></div>${top.length?`<div class="mt-1 space-y-0.5">${top.map(c=>`<div class="flex justify-between"><span>${escapeHtml(c.name)}</span><span class="font-mono">${c.mass.toFixed(0)} t</span></div>`).join('')}</div>`:''}${progHtml}<div class="mt-1 text-[8px] text-slate-500">Diagnostic only. ${escapeHtml(estimate.warning)} It does not replace the selected added-weight/lost-buoyancy calculation or approved damage-control information.</div>`;
}
function renderSeakeepingProxy(){
 const box=document.getElementById('seakeepingProxyReadout');if(!box)return;
 if(!state.waveEnabled){box.innerHTML='<span class="text-slate-500">Enable waves to evaluate the AMCOL seakeeping response proxy.</span>';return;}
 const Te=calculateEncounterPeriod(),r=window.AMCOLPhysics?.seakeepingProxy?.evaluate?.({length:state.length,beam:state.beam,draft:state.eqDraft||state.uprightDraft||state.depth*.55,gm:state.gm,waveHeight:state.waveHeight,wavelength:state.waveLength,wavePeriod:state.wavePeriod,encounterPeriod:Number.isFinite(Te)?Te:state.wavePeriod,rollNaturalPeriod:state.naturalPeriod||8,heading:state.waveHeading});
 if(!r){box.innerHTML='<span class="text-amber-300">Seakeeping proxy module unavailable.</span>';return;}
 const tone=r.risk==='HIGH'?'text-rose-300':r.risk==='ELEVATED'?'text-amber-300':'text-emerald-300';
 box.innerHTML=`<div class="flex justify-between gap-2"><b class="text-cyan-300">${escapeHtml(r.authority)}</b><span class="font-black ${tone}">${r.risk}</span></div><div class="mt-2 grid grid-cols-2 gap-1"><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Heave proxy</span><br><b>${r.heaveAmplitudeM.toFixed(2)} m</b> · RAO ${r.heaveRAO.toFixed(2)}</div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Pitch proxy</span><br><b>${r.pitchAmplitudeDeg.toFixed(2)}°</b> · RAO ${r.pitchRAO.toFixed(2)}</div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Encounter / roll period</span><br><b>${r.encounterRatio.toFixed(2)}</b></div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Vertical accel proxy</span><br><b>${r.verticalAccelG.toFixed(2)} g</b></div></div><div class="mt-1 text-[8px] text-slate-500">${escapeHtml(r.notes)} Current nonlinear roll dynamics remain the roll-physics source; this card does not claim vessel-specific 6-DOF RAOs.</div>`;
}
function calculateAll({curve=true}={}){
 ensureCurrentVesselSpaceLayout({render:false});
 calculateMassProperties();calculateUprightHydro();if(state.hydro?.invalid){updateUI();return;}
 refreshInitialGMFromActiveSourceCurve();
 updateAutoEnvironmentGeometry();
 state.environmentMoment=environmentalHeelingMomentN(state.heel);
 state.environmentHeelingArm=state.dispMass>0?state.environmentMoment/(state.dispMass*1000*G):0;
 state.hydro=hydroAtAngle(state.heel);
 if(state.hydro&&!state.hydro.invalid&&Number.isFinite(state.geometryUprightDraft)){const d=(-state.hydro.sink)-state.geometryUprightDraft;state.visualHeelDraftDelta=Math.max(-state.depth*.12,Math.min(state.depth*.12,d));}else state.visualHeelDraftDelta=0;
 state.operationalGZ=operationalGZAt(state.heel);state.operationalRM=state.dispMass*G*state.operationalGZ;
 if(curve)rebuildCurve();

 // Transverse equilibrium comes from the active GZ source (KN when available, otherwise geometry).
 state.equilibrium=findEquilibriumRoot();
 const sourceHyd=hydroTableAtCurrentDisplacement(),p=hydroPack();
 const probeAngle=Math.min(10,Math.max(5,Math.abs(state.equilibrium)||5));
 const sourceLargeAngle=(p.kind==='gzReference'||p.kind==='knReference')?Number.isFinite(textbookReferenceGZAt(probeAngle)):(p.kind==='uploadedBundle'&&p.knRows?.length&&Number.isFinite(uploadedOperationalGZAt(probeAngle)));
 const authoritativeSource=!!sourceHyd||!!sourceLargeAngle;

 if(authoritativeSource){
   // calculateUprightHydro() has already applied source draft/KMT/TPC/MCTC/LCB/LCF and source trim.
   // Preserve those values and only sample the generic 3D sections at that solved condition for strength.
   anchorCoupledHydroToAuthoritativeEquilibrium(state.equilibrium,state.trimAngle);
 }else{
   solveCoupledEquilibrium(state.equilibrium,state.trimAngle);
 }

 calculateLongitudinalStrength();
 physicsAuthority();runPhysicsIntegrityMonitor();
 updatePhysicsValidity();renderBallastPlan();renderDataAuthority();renderPhysicsIntegrity();renderDamageDiagnostics();renderSeakeepingProxy();if(document.getElementById('cargoManagerBackdrop')&&!document.getElementById('cargoManagerBackdrop').classList.contains('hidden'))renderCargoManager();
 state.operationalGZ=operationalGZAt(state.heel);state.operationalRM=state.dispMass*G*state.operationalGZ;
 updateUI();
}


function curveGZAt(angle){
 const pts=curveCache.slice().sort((a,b)=>a.angle-b.angle);
 if(!pts.length)return NaN;
 if(angle<=pts[0].angle)return pts[0].gz;
 if(angle>=pts[pts.length-1].angle)return pts[pts.length-1].gz;
 for(let i=1;i<pts.length;i++){
   if(pts[i].angle>=angle){
     const a=pts[i-1],b=pts[i],t=(angle-a.angle)/(b.angle-a.angle);
     return a.gz+t*(b.gz-a.gz);
   }
 }
 return NaN;
}
function grainHeelingArmAt(angle,lambda0=null){
 const l0=lambda0===null?(state.dispMass>0?state.grainMoment/state.dispMass:0):lambda0;
 const a=Math.max(0,Math.min(40,Number(angle)||0));
 return l0*(1-.005*a); // straight A-B: lambda40 = 0.80 lambda0
}
function bisectGrainIntersection(a,b,lambda0){
 let fa=curveGZAt(a)-grainHeelingArmAt(a,lambda0);
 for(let i=0;i<45;i++){
   const m=(a+b)/2,fm=curveGZAt(m)-grainHeelingArmAt(m,lambda0);
   if(fa*fm<=0)b=m;else{a=m;fa=fm;}
 }
 return(a+b)/2;
}
function authoritativeDownfloodAngle(side='starboard'){
 const basis=side==='port'?state.downfloodBasisPort:state.downfloodBasisStarboard;
 const angle=side==='port'?downfloodAnglePort:downfloodAngle;
 // Only an explicitly supplied/source vessel opening may truncate regulatory-style teaching criteria.
 // Representative openings and deck-edge fallbacks remain visible teaching boundaries only.
 return Number.isFinite(angle)&&/uploaded vessel opening/i.test(String(basis||''))?angle:NaN;
}
function calculateGrainStability(){
 if(!state.grainEnabled||!curveCache.length||state.dispMass<=0){state.grainResult=null;return null;}
 const lambda0=Math.max(0,state.grainMoment/state.dispMass),lambda40=.80*lambda0;
 const authDf=authoritativeDownfloodAngle('starboard'),physicalLimit=Math.max(0,Math.min(40,Number.isFinite(authDf)?authDf:40));

 let listAngle=NaN,prevA=0,prev=curveGZAt(0)-grainHeelingArmAt(0,lambda0);
 for(let a=.1;a<=physicalLimit+1e-9;a+=.1){
   const f=curveGZAt(a)-grainHeelingArmAt(a,lambda0);
   if(Number.isFinite(prev)&&Number.isFinite(f)&&prev<=0&&f>=0){listAngle=bisectGrainIntersection(prevA,a,lambda0);break;}
   prevA=a;prev=f;
 }

 let residualArea=NaN;
 if(Number.isFinite(listAngle)&&physicalLimit>listAngle){
   const n=Math.max(8,Math.ceil((physicalLimit-listAngle)/.1)),d=(physicalLimit-listAngle)/n;
   let sum=0,prevD=curveGZAt(listAngle)-grainHeelingArmAt(listAngle,lambda0);
   for(let i=1;i<=n;i++){
     const a=listAngle+i*d,diff=curveGZAt(a)-grainHeelingArmAt(a,lambda0);
     sum+=.5*(prevD+diff)*(d*Math.PI/180);prevD=diff;
   }
   residualArea=sum;
 }

 const maxLimit=Math.max(physicalLimit,Math.min(60,Number.isFinite(authDf)?authDf:60));
 const domain=curveCache.filter(p=>p.angle>=0&&p.angle<=maxLimit);
 let max={angle:NaN,gz:NaN};
 domain.forEach(p=>{if(!Number.isFinite(max.gz)||p.gz>max.gz)max={angle:p.angle,gz:p.gz};});

 const listLimit=Math.min(12,Number.isFinite(authDf)&&authDf<12?authDf:12);
 state.grainResult={
   lambda0,lambda40,listAngle,listLimit,limitAngle:physicalLimit,residualArea,
   gzMax:max.gz,gzMaxAngle:max.angle,gmFluid:state.gm,
   areaPass:Number.isFinite(residualArea)&&residualArea>=.075,
   listPass:Number.isFinite(listAngle)&&listAngle<=listLimit+1e-9,
   gmPass:state.gm>=.30
 };
 state.grainResult.pass=state.grainResult.areaPass&&state.grainResult.listPass&&state.grainResult.gmPass;
 return state.grainResult;
}
function grainCriteria(){
 const r=state.grainResult;
 if(!r)return [];
 const areaFmt=v=>Number.isFinite(v)?v.toFixed(3)+' m·rad':'NO INTERSECTION';
 const degFmt=v=>Number.isFinite(v)?v.toFixed(1)+'°':'NO INTERSECTION';
 const mFmt=v=>Number.isFinite(v)?v.toFixed(3)+' m':'N/A';
 return [
   {name:'Residual dynamic stability',actual:r.residualArea,req:'≥ 0.075 m·rad',pass:r.areaPass,fmt:areaFmt},
   {name:'Angle of list due to grain shift',actual:r.listAngle,req:`≤ ${r.listLimit.toFixed(1)}°`,pass:r.listPass,fmt:degFmt},
   {name:'Initial corrected GM (fluid)',actual:r.gmFluid,req:'≥ 0.300 m',pass:r.gmPass,fmt:mFmt}
 ];
}
function setToGrainList(){
 const r=state.grainResult;
 if(!state.grainEnabled){state.grainEnabled=true;const c=document.getElementById('checkGrainStability');if(c)c.checked=true;rebuildCurve();}
 if(state.grainResult&&Number.isFinite(state.grainResult.listAngle))setHeel(state.grainResult.listAngle);
}
function setGrainMomentFromLambda(lambda0){
 state.grainMoment=Math.max(0,(Number(lambda0)||0)*Math.max(0,state.dispMass));
 const el=document.getElementById('inputGrainMoment');if(el)el.value=state.grainMoment.toFixed(0);
 calculateGrainStability();updateChart();updateGrainUI();
}
function toggleGrainOverlay(){
 state.grainEnabled=!state.grainEnabled;
 const el=document.getElementById('checkGrainStability');if(el)el.checked=state.grainEnabled;
 calculateGrainStability();updateChart();updateGrainUI();
 if(state.grainEnabled)expandGZForGrain();
}
function expandGZForGrain(){
 const p=document.getElementById('gzFloatingPanel');if(!p)return;
 p.classList.remove('gz-collapsed','gz-hidden');p.classList.add('gz-expanded');
 gzPanelCollapsed=false;gzPanelExpanded=true;
 document.getElementById('gzRestoreBtn')?.classList.remove('visible');
 setTimeout(()=>gzChart?.resize(),180);
}


function interpolateZeroCrossing(a,b){
 const den=b.gz-a.gz;
 if(Math.abs(den)<1e-9)return a.angle;
 return a.angle+(0-a.gz)*(b.angle-a.angle)/den;
}
function calculateGZFeaturesForSide(side='starboard'){
 const pts=sideCurvePoints(side);if(pts.length<4)return null;
 const interp=(ang)=>sideCurveGZAt(ang,side);
 let max={angle:pts[0].angle,gz:pts[0].gz,index:0};pts.forEach((p,i)=>{if(p.gz>max.gz)max={angle:p.angle,gz:p.gz,index:i};});
 let avs=NaN;
 for(let i=Math.max(1,max.index+1);i<pts.length;i++){const a=pts[i-1],b=pts[i];if(a.gz>0&&b.gz<=0){avs=interpolateZeroCrossing(a,b);break;}if(Math.abs(b.gz)<1e-6&&b.angle>max.angle){avs=b.angle;break;}}
 const second=[];
 for(let i=1;i<pts.length-1;i++){const p0=pts[i-1],p=pts[i],p1=pts[i+1];if(p.angle<4||p.angle>=max.angle)continue;const h1=p.angle-p0.angle,h2=p1.angle-p.angle;if(Math.abs(h1-h2)>.15||h1<=0)continue;second.push({angle:p.angle,d2:(p1.gz-2*p.gz+p0.gz)/(h1*h1),gz:p.gz});}
 let contra=NaN,contraGZ=NaN;
 for(let i=1;i<second.length;i++){const a=second[i-1],b=second[i];if(a.d2===0||a.d2*b.d2<0){const den=b.d2-a.d2,t=Math.abs(den)>1e-12?(-a.d2/den):0;contra=a.angle+t*(b.angle-a.angle);contraGZ=interp(contra);break;}}
 const positiveEnd=Number.isFinite(avs)?Math.min(90,avs):90;let positiveArea=0;
 if(positiveEnd>0){const n=Math.max(20,Math.ceil(positiveEnd/.25)),d=positiveEnd/n;let prev=Math.max(0,interp(0));for(let i=1;i<=n;i++){const a=i*d,v=Math.max(0,interp(a));positiveArea+=.5*(prev+v)*(d*Math.PI/180);prev=v;}}
 let negativeArea=0;if(Number.isFinite(avs)&&avs<90){const n=Math.max(10,Math.ceil((90-avs)/.25)),d=(90-avs)/n;let prev=Math.min(0,interp(avs));for(let i=1;i<=n;i++){const a=avs+i*d,v=Math.min(0,interp(a));negativeArea+=.5*(prev+v)*(d*Math.PI/180);prev=v;}}
 const df=authoritativeDownfloodAngle(side);
 const integratePositiveTo=(end)=>{const lim=Math.max(0,Math.min(end,Number.isFinite(avs)?avs:90,df||90));if(lim<=0)return NaN;const n=Math.max(12,Math.ceil(lim/.25)),d=lim/n;let sum=0,prev=Math.max(0,interp(0));for(let i=1;i<=n;i++){const a=i*d,v=Math.max(0,interp(a));sum+=.5*(prev+v)*(d*Math.PI/180);prev=v;}return sum;};
 return {side,maxGZ:max.gz,maxAngle:max.angle,contraflexureAngle:contra,contraflexureGZ:contraGZ,avs,rangeOfStability:Number.isFinite(avs)?avs:NaN,positiveArea,negativeArea,area30:integratePositiveTo(30),area40:integratePositiveTo(40),maxRM:state.dispMass*G*max.gz/1000,gm:state.gm};
}
function calculateStaticGZFeatures(){
 state.staticGZResult=calculateGZFeaturesForSide('starboard');
 state.staticGZPortResult=calculateGZFeaturesForSide('port');
 return state.staticGZResult;
}

function rebuildCurve(){
 curveCache=[];downfloodAngle=null;downfloodAnglePort=null;deckEdgeAngle=null;deckEdgeAnglePort=null;
 const p=hydroPack(),externalLargeAngle=(p.kind==='gzReference'||p.kind==='knReference')||(p.kind==='uploadedBundle'&&p.knRows?.length&&!state.damage);
 for(let a=-90;a<=90;a+=1){
  const h=hydroAtAngle(a),gz=operationalGZAt(a);if(!Number.isFinite(gz)||(h.invalid&&!externalLargeAngle))continue;curveCache.push({angle:a,gz});
  if(!h.invalid&&h.deckEdgeImmersed){if(a>=0)deckEdgeAngle=deckEdgeAngle===null?a:Math.min(deckEdgeAngle,a);if(a<=0){const mag=Math.abs(a);deckEdgeAnglePort=deckEdgeAnglePort===null?mag:Math.min(deckEdgeAnglePort,mag);}}
 }
 // Downflooding is now based on actual uploaded opening angles when available. Otherwise a clearly
 // labelled representative opening is immersed against the solved waterline. Deck-edge immersion is
 // kept as a separate visual/teaching boundary instead of automatically being treated as downflooding.
 state.downfloodBasisStarboard='';state.downfloodBasisPort='';
 if(p.kind==='uploadedBundle'&&Number.isFinite(+p.downfloodStarboard)){downfloodAngle=+p.downfloodStarboard;state.downfloodBasisStarboard='uploaded vessel opening';}
 if(p.kind==='uploadedBundle'&&Number.isFinite(+p.downfloodPort)){downfloodAnglePort=+p.downfloodPort;state.downfloodBasisPort='uploaded vessel opening';}
 if(!Number.isFinite(downfloodAngle)){const r=representativeOpeningDownflood('starboard');if(r){downfloodAngle=r.angle;state.downfloodBasisStarboard=r.name+' · representative';}}
 if(!Number.isFinite(downfloodAnglePort)){const r=representativeOpeningDownflood('port');if(r){downfloodAnglePort=r.angle;state.downfloodBasisPort=r.name+' · representative';}}
 if(!Number.isFinite(downfloodAngle)&&Number.isFinite(deckEdgeAngle)){downfloodAngle=deckEdgeAngle;state.downfloodBasisStarboard='deck edge fallback';}
 if(!Number.isFinite(downfloodAnglePort)&&Number.isFinite(deckEdgeAnglePort)){downfloodAnglePort=deckEdgeAnglePort;state.downfloodBasisPort='deck edge fallback';}
 calculateStaticGZFeatures();calculateGrainStability();updateChart();
}
function gzAt(angle){return operationalGZAt(angle);}
function equilibriumResidualAt(angle){return environmentalResidual(angle);}
function bisectEquilibriumRoot(a,b){let fa=equilibriumResidualAt(a),fb=equilibriumResidualAt(b);for(let i=0;i<45;i++){const m=(a+b)/2,fm=equilibriumResidualAt(m);if(fa*fm<=0){b=m;fb=fm}else{a=m;fa=fm}}return(a+b)/2;}
function findEquilibriumRoot(){
 state.equilibriumValid=false;
 const roots=[];let prevA=-70,prev=equilibriumResidualAt(prevA);
 for(let a=-69.5;a<=70;a+=0.5){const g=equilibriumResidualAt(a);if(Number.isFinite(prev)&&Number.isFinite(g)&&prev*g<0)roots.push(bisectEquilibriumRoot(prevA,a));prevA=a;prev=g;}
 if(Math.abs(equilibriumResidualAt(0))<1e-5)roots.push(0);
 const uniq=[];roots.forEach(r=>{if(!uniq.some(x=>Math.abs(x-r)<0.3))uniq.push(r)});
 const stable=uniq.filter(r=>{const e=.1;return (equilibriumResidualAt(r+e)-equilibriumResidualAt(r-e))/(2*e)>0;});
 if(state.gm<0&&!state.windEnabled&&!state.currentEnabled){const nonzero=stable.filter(r=>Math.abs(r)>1);if(nonzero.length){state.equilibriumValid=true;return nonzero.sort((a,b)=>Math.abs(a)-Math.abs(b))[0];}}
 if(stable.length){state.equilibriumValid=true;return stable.sort((a,b)=>Math.abs(a)-Math.abs(b))[0];}return 0;
}
function findAndSetEquilibrium(){
 const eq=findEquilibriumRoot();
 state.equilibrium=Number.isFinite(eq)?eq:0;
 state.heel=state.equilibrium;
 setControlValues();
 calculateAll({curve:false});
 return state.equilibrium;
}
function setHeel(v){state.heel=Math.max(-80,Math.min(80,v));setControlValues();calculateAll({curve:false});updateActivePoint();}

function evaluateIMOSide(side='starboard'){
 const pts=sideCurvePoints(side),interp=(ang)=>sideCurveGZAt(ang,side);
 const integrate=(a0,a1)=>{if(!(a1>a0))return NaN;const inner=pts.filter(p=>p.angle>a0&&p.angle<a1),all=[{angle:a0,gz:interp(a0)},...inner,{angle:a1,gz:interp(a1)}];if(all.some(p=>!Number.isFinite(p.gz)))return NaN;let sum=0;for(let i=1;i<all.length;i++){const dphi=(all[i].angle-all[i-1].angle)*Math.PI/180;sum+=.5*(all[i].gz+all[i-1].gz)*dphi;}return sum;};
 const authDf=authoritativeDownfloodAngle(side),usableLimit=Number.isFinite(authDf)?authDf:80,limit40=Math.min(40,usableLimit),maxDomain=pts.filter(p=>p.angle<=usableLimit);let max={gz:-Infinity,angle:0};maxDomain.forEach(p=>{if(p.gz>max.gz)max={gz:p.gz,angle:p.angle};});
 const area30=usableLimit>=30?integrate(0,30):NaN,area40=integrate(0,limit40),area30_40=limit40>30?integrate(30,limit40):NaN,gz30Domain=pts.filter(p=>p.angle>=30&&p.angle<=usableLimit),gz30plus=gz30Domain.length?Math.max(...gz30Domain.map(p=>p.gz)):NaN;
 const fmtArea=v=>Number.isFinite(v)?v.toFixed(3)+' m·rad':'N/A',fmtM=v=>Number.isFinite(v)?v.toFixed(3)+' m':'N/A',fmtDeg=v=>Number.isFinite(v)?v.toFixed(0)+'°':'N/A';
 const sideLabel=side==='port'?'PORT':'STARBOARD';
 return [
  {name:'Area 0–30°',actual:area30,req:'≥ 0.055 m·rad',pass:Number.isFinite(area30)&&area30>=.055,fmt:fmtArea,side:sideLabel},
  {name:`Area 0–${limit40.toFixed(0)}°`,actual:area40,req:'≥ 0.090 m·rad',pass:Number.isFinite(area40)&&area40>=.09,fmt:fmtArea,side:sideLabel},
  {name:`Area 30–${limit40.toFixed(0)}°`,actual:area30_40,req:'≥ 0.030 m·rad',pass:Number.isFinite(area30_40)&&area30_40>=.03,fmt:fmtArea,side:sideLabel},
  {name:'GZ at ≥30°',actual:gz30plus,req:'≥ 0.200 m',pass:Number.isFinite(gz30plus)&&gz30plus>=.2,fmt:fmtM,side:sideLabel},
  {name:'Angle of maximum GZ',actual:max.angle,req:'≥ 25°',pass:Number.isFinite(max.angle)&&max.angle>=25,fmt:fmtDeg,side:sideLabel},
  {name:'Initial corrected GM',actual:state.gm,req:'≥ 0.150 m',pass:state.gm>=.15,fmt:fmtM,side:sideLabel}
 ];
}
function evaluateIMO(){
 const stbd=evaluateIMOSide('starboard'),port=evaluateIMOSide('port');
 const failCount=a=>a.filter(x=>!x.pass).length,marginScore=a=>a.reduce((sum,x)=>{if(!Number.isFinite(x.actual))return sum-100;const req=parseFloat(String(x.req).replace(/[^0-9.\-]/g,''));return sum+(Number.isFinite(req)&&Math.abs(req)>1e-9?(x.actual-req)/Math.abs(req):0);},0);
 const fs=failCount(stbd),fp=failCount(port);let governing=fs>fp?'starboard':fp>fs?'port':(marginScore(stbd)<=marginScore(port)?'starboard':'port');
 state.imoAuditBySide={starboard:stbd,port};state.imoAuditGoverningSide=governing;
 return (governing==='port'?port:stbd).map(c=>({...c,name:`${c.name} · ${c.side}`}));
}

let liveCalcTimer=null,liveCurveTimer=null;
function requestLiveCalculation(delay=55){
 clearTimeout(liveCalcTimer);clearTimeout(liveCurveTimer);
 liveCalcTimer=setTimeout(()=>{liveCalcTimer=null;calculateAll({curve:false});},delay);
 // Rebuild the expensive full GZ/IMO curve only after interaction settles.
 liveCurveTimer=setTimeout(()=>{liveCurveTimer=null;calculateAll({curve:true});},Math.max(220,delay+150));
}
function bind(id,key,parser=parseFloat){
 const el=document.getElementById(id);if(!el)return;
 const dimensionField=['inputLength','inputBeam','inputDepth'].includes(id);
 el.addEventListener('input',()=>{state[key]=parser(el.value);requestLiveCalculation();});
 el.addEventListener('change',()=>{state[key]=parser(el.value);clearTimeout(liveCalcTimer);clearTimeout(liveCurveTimer);liveCalcTimer=null;liveCurveTimer=null;if(!dimensionField)calculateAll();});
}
function bindControls(){
 const hullTypeEl=document.getElementById('inputHullType');
 if(hullTypeEl){const applyHullType=()=>{const next=hullTypeEl.value;if(next===state.hullType&&String(state.spaceLayoutFamily||'')===String(cargoFamilyKey()))return;applyVesselFamilyTemplate(next,{announce:true});};hullTypeEl.addEventListener('change',applyHullType);}
 bind('inputDensity','density');
 const companyInput=document.getElementById('inputCompanyName'),vesselInput=document.getElementById('inputVesselName');
 if(companyInput)companyInput.addEventListener('input',e=>state.companyName=e.target.value);
 if(vesselInput)vesselInput.addEventListener('input',e=>state.vesselName=e.target.value);bind('inputLength','length');bind('inputBeam','beam');bind('inputDepth','depth');['inputLength','inputBeam','inputDepth'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{vesselVisualTransaction=true;try{refreshRepresentativeBallastTemplateGeometry();bumpSpaceLayoutRevision('principal-dimensions-change');renderBallastPlan();renderCargoTable();calculateAll();}finally{vesselVisualTransaction=false;}commitVesselVisualRefresh('principal-dimensions-change');}));bind('inputWaterDepth','waterDepth');bind('inputLightshipMass','lightshipMass');bind('inputLightshipKG','lightshipKG');bind('inputLightshipTCG','lightshipTCG');bind('inputLightshipLCG','lightshipLCG');
 bind('inputTankCount','tankCount');bind('inputTankLength','tankLength');bind('inputTankBreadth','tankBreadth');bind('inputTankDensity','tankDensity');bind('inputTankFill','tankFill');
 bind('inputGrainMoment','grainMoment');
 bind('inputCraneMass','craneMass');bind('inputCraneHeight','craneHeight');bind('inputCraneOutreach','craneOutreach');bind('inputCraneSide','craneSide');bind('inputCraneLCG','craneLCG');
 bind('damageMode','damageMode',v=>v);bind('inputDmgMass','dmgMass');bind('inputDmgVCG','dmgVCG');bind('inputDmgTCG','dmgTCG');bind('inputDmgLCG','dmgLCG');bind('inputDamageSide','damageSide');bind('inputDamageWidth','damageWidth');bind('inputDamageHeight','damageHeight');bind('inputDamageLengthPct','damageLengthPct');bind('inputDamageLCG','damageLCG');bind('inputDamagePerm','damagePerm');
 bind('inputKrRatio','krRatio');bind('inputDamping','damping');bind('inputQuadraticDamping','quadraticDamping');bind('inputWaveMoment','waveMoment');bind('inputWaveHeight','waveHeight');bind('inputWaveHeading','waveHeading',v=>v);bind('inputWaveGain','waveGain');bind('inputRollMode','rollMode',v=>v);bind('inputShipSpeed','shipSpeedKts');bind('inputParametricVariation','parametricVariation');
 bind('inputWindSpeed','windSpeedKts');bind('inputGustFactor','gustFactor');bind('inputWindDirection','windDirection',v=>v);bind('inputWindageArea','windageArea');bind('inputWindLever','windLever');bind('inputWindCd','windCd');
 bind('inputCurrentSpeed','currentSpeedKts');bind('inputCurrentDirection','currentDirection',v=>v);bind('inputCurrentMode','currentMode',v=>v);bind('inputShipHeading','shipHeadingDeg');bind('inputCurrentSet','currentSetDeg');bind('inputCurrentArea','currentArea');bind('inputCurrentLever','currentLever');bind('inputCurrentCd','currentCd');
 bind('inputRainIntensity','rainIntensity');bind('inputVisibility','visibilityNm');
 const wp=document.getElementById('inputWeatherPreset'),op=document.getElementById('inputOceanPreset');
 if(wp)wp.addEventListener('change',e=>applyWeatherPreset(e.target.value));
 if(op)op.addEventListener('change',e=>applyOceanPreset(e.target.value));
 const windCheck=document.getElementById('checkWindEnabled'),currentCheck=document.getElementById('checkCurrentEnabled'),autoWind=document.getElementById('checkAutoWindage'),autoCurrent=document.getElementById('checkAutoCurrentArea');
 if(windCheck)windCheck.addEventListener('change',e=>{state.windEnabled=e.target.checked;calculateAll();});
 if(currentCheck)currentCheck.addEventListener('change',e=>{state.currentEnabled=e.target.checked;calculateAll();});
 if(autoWind)autoWind.addEventListener('change',e=>{state.autoWindage=e.target.checked;calculateAll();syncEnvironmentForm();});
 if(autoCurrent)autoCurrent.addEventListener('change',e=>{state.autoCurrentArea=e.target.checked;calculateAll();syncEnvironmentForm();});
 bindWaveKinematics();
 const fidelityEl=document.getElementById('inputPhysicsFidelity');if(fidelityEl)fidelityEl.value=state.physicsFidelity;const waveModelEl=document.getElementById('inputWaveModel');if(waveModelEl)waveModelEl.value=state.waveModel;
 const rollModeEl=document.getElementById('inputRollMode');if(rollModeEl)rollModeEl.addEventListener('change',()=>{updateDynamicsButton();updateInstabilityMonitor();});
 const paramEl=document.getElementById('inputParametricVariation');if(paramEl)paramEl.addEventListener('input',()=>updateEncounterReadout());
 const grainCheck=document.getElementById('checkGrainStability');
 if(grainCheck)grainCheck.addEventListener('change',e=>{state.grainEnabled=e.target.checked;calculateGrainStability();updateChart();updateGrainUI();if(state.grainEnabled)expandGZForGrain();});
  document.getElementById('checkFSE').addEventListener('change',e=>{state.fse=e.target.checked;calculateAll()});document.getElementById('checkCrane').addEventListener('change',e=>{state.crane=e.target.checked;calculateAll()});document.getElementById('checkDamage').addEventListener('change',e=>{state.damage=e.target.checked;calculateAll()});document.getElementById('checkWaveEnabled').addEventListener('change',e=>{state.waveEnabled=e.target.checked;calculateAll({curve:false})});
 document.getElementById('damageMode').addEventListener('change',()=>toggleDamageInputs());
 document.getElementById('inputCraneSide').addEventListener('change',e=>{
  state.craneSide=parseFloat(e.target.value);
  if(state.craneSide===0){
   state.craneOutreach=0;
   const o=document.getElementById('inputCraneOutreach');if(o)o.value='0';
  }else if(state.craneOutreach===0){
   state.craneOutreach=Math.min(3,state.beam/2);
   const o=document.getElementById('inputCraneOutreach');if(o)o.value=state.craneOutreach;
  }
  calculateAll();
 });
 document.getElementById('sliderHeel').addEventListener('input',e=>setHeel(parseFloat(e.target.value)));
 document.getElementById('loadScenarioBtn').addEventListener('click',()=>loadScenario(document.getElementById('scenarioSelect').value));document.getElementById('scenarioSelect')?.addEventListener('change',updateMissionSelectorUI);updateMissionSelectorUI();
}

function solveWaveDispersion(T,h){
 const omega=2*Math.PI/Math.max(.1,T),depth=Math.max(.2,h);let k=Math.max(1e-5,omega*omega/G);
 for(let i=0;i<30;i++){const kh=k*depth,th=Math.tanh(kh),sech2=1/(Math.cosh(Math.min(20,kh))**2),f=G*k*th-omega*omega,df=G*(th+k*depth*sech2);const nk=k-f/Math.max(1e-9,df);if(!Number.isFinite(nk)||nk<=0)break;if(Math.abs(nk-k)<1e-10){k=nk;break;}k=nk;}
 const lambda=2*Math.PI/k,c=lambda/Math.max(.1,T),kh=k*depth;return {k,lambda,c,kh,regime:kh>Math.PI?'deep':kh<Math.PI/10?'shallow':'intermediate'};
}
function applyPhysicalWaveFromPeriod(updateForm=true){const r=solveWaveDispersion(state.wavePeriod,state.waterDepth);state.waveLength=r.lambda;state.waveSpeed=r.c;state.waveRegime=r.regime;if(updateForm){const l=document.getElementById('inputWaveLength'),c=document.getElementById('inputWaveSpeed');if(l)l.value=state.waveLength.toFixed(2);if(c)c.value=state.waveSpeed.toFixed(3);}return r;}
function updateWaveInputMode(){
 const physical=state.waveModel==='physical',l=document.getElementById('inputWaveLength'),c=document.getElementById('inputWaveSpeed'),t=document.getElementById('inputWavePeriod');
 [l,c].forEach(el=>{if(!el)return;el.readOnly=physical;el.classList.toggle('derived-physics-output',physical);el.setAttribute('aria-readonly',physical?'true':'false');});
 if(l)l.title=physical?'Calculated from finite-depth dispersion using wave period and water depth.':'Editable wavelength in Manual Teaching Wave mode.';
 if(c)c.title=physical?'Calculated phase celerity from the active physical wave solution.':'Editable celerity in Manual Teaching Wave mode.';
 if(t)t.title=physical?'Primary wave input in Physical Wave mode.':'Editable period; manual wavelength/celerity remain linked.';
}
function setWaveModel(v){state.waveModel=v==='manual'?'manual':'physical';if(state.waveModel==='physical')applyPhysicalWaveFromPeriod(true);syncFormFromState();updateWaveInputMode();calculateAll({curve:false});}
function bindWaveKinematics(){
 const l=document.getElementById('inputWaveLength'),c=document.getElementById('inputWaveSpeed'),t=document.getElementById('inputWavePeriod');if(!l||!c||!t)return;
 const refreshPhysical=()=>{state.wavePeriod=Math.max(.1,parseFloat(t.value)||state.wavePeriod);applyPhysicalWaveFromPeriod(true);calculateAll({curve:false});};
 const recalcFromLC=()=>{if(state.waveModel==='physical'){refreshPhysical();return;}state.waveLength=Math.max(.1,parseFloat(l.value)||state.waveLength);state.waveSpeed=Math.max(.1,parseFloat(c.value)||state.waveSpeed);state.wavePeriod=state.waveLength/state.waveSpeed;t.value=state.wavePeriod.toFixed(3);calculateAll({curve:false});};
 const recalcFromLT=()=>{if(state.waveModel==='physical'){refreshPhysical();return;}state.waveLength=Math.max(.1,parseFloat(l.value)||state.waveLength);state.wavePeriod=Math.max(.1,parseFloat(t.value)||state.wavePeriod);state.waveSpeed=state.waveLength/state.wavePeriod;c.value=state.waveSpeed.toFixed(3);calculateAll({curve:false});};
 l.addEventListener('input',recalcFromLC);c.addEventListener('input',recalcFromLC);t.addEventListener('input',recalcFromLT);
}

function toggleDamageInputs(){document.getElementById('damageAddedInputs').classList.toggle('hidden',state.damageMode!=='added');document.getElementById('damageLostInputs').classList.toggle('hidden',state.damageMode!=='lost');}


function tcgSide(tcg){
 const v=Number(tcg)||0;
 if(Math.abs(v)<1e-6)return 'center';
 return v>0?'starboard':'port';
}
function tcgDistance(tcg){return Math.abs(Number(tcg)||0);}
function tcgFromSide(side,distance){
 const d=Math.max(0,Number(distance)||0);
 return side==='starboard'?d:side==='port'?-d:0;
}
function updateCargoSide(id,side){
 const it=cargoItems.find(x=>x.id===id);
 if(!it)return;
 const d=Math.max(.5,Math.abs(it.tcg)||Math.min(state.beam*.25,3));
 it.tcg=tcgFromSide(side,d);
 renderCargoTable();
 calculateAll();
}
function updateCargoDistance(id,distance){
 const it=cargoItems.find(x=>x.id===id);
 if(!it)return;
 const side=tcgSide(it.tcg);
 it.tcg=tcgFromSide(side,Math.min(state.beam/2,Math.max(0,Number(distance)||0)));
 calculateAll();
}



const cargoPhysicsLibrary={
 steel_coils:{label:'Steel coils / steel products',physics:'discrete',unitMass:25,density:7.85,desc:'Discrete heavy cargo. Enter actual piece/coil weights and securement.'},
 timber:{label:'Timber / forest products',physics:'discrete',unitMass:12,density:.55,desc:'Unitised/break-bulk cargo; deck stow increases KG and windage.'},
 project:{label:'Heavy project cargo / machinery',physics:'discrete',unitMass:100,density:7.0,desc:'Concentrated discrete load. Position and VCG are critical.'},
 container20:{label:'20 ft container',physics:'container',unitMass:18,density:0,desc:'Use actual Verified Gross Mass (VGM) per container.'},
 container40:{label:'40 ft container',physics:'container',unitMass:24,density:0,desc:'Use actual Verified Gross Mass (VGM) per container.'},
 reefer40:{label:'40 ft reefer container',physics:'container',unitMass:27,density:0,desc:'Teaching VGM only; enter actual VGM.'},
 grain:{label:'Grain',physics:'grain',unitMass:0,density:.75,desc:'Bulk cargo with Grain Code shift considerations. Enter approved grain heeling moment when available.'},
 iron_ore:{label:'Iron / mineral ore',physics:'bulk',unitMass:0,density:2.20,desc:'Dense dry bulk. Low cargo VCG but high displacement and longitudinal load concentration.'},
 coal:{label:'Coal',physics:'bulk',unitMass:0,density:.85,desc:'Dry bulk teaching density; actual bulk density varies.'},
 bauxite:{label:'Bauxite',physics:'bulk',unitMass:0,density:1.25,desc:'Bulk cargo; verify cargo declaration and moisture characteristics.'},
 sand:{label:'Sand / aggregates',physics:'bulk',unitMass:0,density:1.60,desc:'Aggregate/sand cargo. Moist/fine material may need separate liquefaction assessment.'},
 cement:{label:'Cement / dry powder',physics:'bulk',unitMass:0,density:1.40,desc:'Fine dry bulk teaching value; actual stowage factor/density governs.'},
 fertiliser:{label:'Fertiliser / urea',physics:'bulk',unitMass:0,density:.95,desc:'Dry bulk cargo; actual IMSBC schedule and cargo data govern.'},
 woodchips:{label:'Woodchips',physics:'bulk',unitMass:0,density:.35,desc:'Low-density bulk cargo; high volume for relatively low mass.'},
 limestone:{label:'Limestone',physics:'bulk',unitMass:0,density:1.40,desc:'Aggregate/mineral bulk cargo teaching value.'},
 concentrate:{label:'Mineral concentrate / liquefaction-sensitive bulk',physics:'liquefiable',unitMass:0,density:2.00,desc:'Moisture and TML must be checked. The simulator warns when MC > TML.'},
 car:{label:'Passenger car',physics:'vehicle',unitMass:1.6,density:0,desc:'Ro-Ro movable weight; quantity and deck/side determine CG.'},
 truck:{label:'Truck',physics:'vehicle',unitMass:18,density:0,desc:'Heavy Ro-Ro vehicle; use actual gross vehicle mass.'},
 trailer:{label:'Tractor + semi-trailer',physics:'vehicle',unitMass:32,density:0,desc:'Heavy Ro-Ro transport unit; actual mass and lane location govern.'},
 heavy_vehicle:{label:'Heavy equipment / machinery vehicle',physics:'vehicle',unitMass:45,density:0,desc:'High-concentration Ro-Ro load.'},
 crude:{label:'Crude oil',physics:'liquid',unitMass:0,density:.85,desc:'Liquid bulk; density is a teaching default. Slack tanks contribute FSC.'},
 product:{label:'Petroleum product',physics:'liquid',unitMass:0,density:.78,desc:'Liquid bulk; verify cargo density/temperature. Slack tanks contribute FSC.'},
 methanol:{label:'Methanol',physics:'liquid',unitMass:0,density:.79,desc:'Chemical cargo teaching density; actual cargo data govern.'},
 caustic:{label:'Caustic solution',physics:'liquid',unitMass:0,density:1.50,desc:'Chemical cargo; density varies with concentration.'},
 vegetable_oil:{label:'Vegetable oil',physics:'liquid',unitMass:0,density:.92,desc:'Liquid chemical/product cargo teaching value.'},
 molasses:{label:'Molasses',physics:'liquid',unitMass:0,density:1.40,desc:'High-density liquid cargo teaching value.'},
 brine:{label:'Drilling brine / dense liquid',physics:'liquid',unitMass:0,density:1.20,desc:'OSV/chemical liquid cargo; use actual product density.'},
 lng:{label:'LNG / methane',physics:'gas',unitMass:0,density:.45,desc:'Liquefied-gas teaching density only; containment/thermodynamics not modelled.'},
 lpg:{label:'LPG / propane-butane',physics:'gas',unitMass:0,density:.54,desc:'Liquefied-gas teaching density only.'},
 ammonia:{label:'Ammonia',physics:'gas',unitMass:0,density:.68,desc:'Liquefied-gas teaching density only.'},
 tubulars:{label:'Tubulars / pipes',physics:'discrete',unitMass:12,density:7.85,desc:'OSV deck cargo; concentrated deck load and position matter.'},
 deck_equipment:{label:'Deck equipment / project cargo',physics:'discrete',unitMass:60,density:0,desc:'OSV/barge deck cargo; high VCG and windage may be important.'}
};
const cargoLibraryByHull={
 general:['steel_coils','timber','project','container20','container40'],
 bulk:['grain','iron_ore','coal','bauxite','sand','concentrate','cement','fertiliser','woodchips','limestone'],
 container:['container20','container40','reefer40'],
 roro:['car','truck','trailer','heavy_vehicle'],
 tanker:['crude','product'],
 chemical:['methanol','caustic','vegetable_oil','molasses','brine'],
 lng:['lng','lpg','ammonia'],
 osv:['deck_equipment','container20','container40','tubulars','cement','brine'],
 box:['sand','iron_ore','coal','container20','project']
};
function cargoHullKey(){return state.hullType==='ferry'?'roro':state.hullType==='barge'?'box':(cargoLibraryByHull[state.hullType]?state.hullType:'general');}
function cargoProfile(key){if(key==='empty')return {label:'Empty / select cargo',physics:'discrete',unitMass:0,density:0,desc:'Preloaded vessel cargo space with zero load.'};return cargoPhysicsLibrary[key]||{label:'Manual weight',physics:'discrete',unitMass:0,density:0,desc:'Manual movable weight.'};}
function cargoClassLabel(c){return ({discrete:'Discrete solid',container:'Container / VGM',vehicle:'Ro-Ro vehicle',bulk:'Stable dry bulk',grain:'Grain',liquefiable:'Liquefaction-sensitive bulk',liquid:'Liquid bulk',gas:'Liquefied gas'})[c]||'Manual weight';}
function cargoSpaces(){return representativeCargoSpaces(cargoFamilyKey());}
function cargoSpaceById(id){return cargoSpaces().find(x=>x.id===id)||null;}
function isEditableCargoSpace(sp){
 if(!sp)return false;
 const t=String(sp.type||'').toLowerCase();
 return !sp.ramp&&!t.includes('ramp')&&!t.includes('access');
}
function emptyCargoTemplateItem(sp,index=0){
 return {
  id:-(1000+index),name:sp.name,cargoKey:'empty',physicsClass:'discrete',quantity:0,unitMass:0,density:0,fill:0,
  spaceId:sp.id,autoMass:false,autoVCG:true,volume:cargoSpaceVolume(sp),mass:0,
  vcg:Number(sp.bottom||0)+Math.max(.1,Number(sp.height)||1)*.5,tcg:Number(sp.tcg)||0,lcg:Number(sp.lcg)||0,
  moisture:0,tml:0,grainMoment:0,fsmFactor:.85,tier:1,source:'preloaded-empty-vessel-space',preloadedSpaceSlot:true
 };
}
function createEmptyCargoTemplateItems(){
 return cargoSpaces().filter(isEditableCargoSpace).map((sp,i)=>emptyCargoTemplateItem(sp,i));
}
function resetCargoTemplateSlot(it){
 if(!it)return;
 const sp=cargoSpaceById(it.spaceId);
 it.cargoKey='empty';it.physicsClass='discrete';it.quantity=0;it.unitMass=0;it.density=0;it.fill=0;it.mass=0;
 it.autoMass=false;it.autoVCG=true;it.moisture=0;it.tml=0;it.grainMoment=0;it.fsmFactor=.85;it.tier=1;
 if(sp){it.name=sp.name;it.lcg=Number(sp.lcg)||0;it.tcg=Number(sp.tcg)||0;it.vcg=Number(sp.bottom||0)+Math.max(.1,Number(sp.height)||1)*.5;it.volume=cargoSpaceVolume(sp);}
 it.source='preloaded-empty-vessel-space';it.preloadedSpaceSlot=true;
 delete it.sourceLocked;delete it.sourceFSM;
}
function initialiseEmptyCargoTemplate(){cargoItems=createEmptyCargoTemplateItems();return cargoItems;}
function cargoOptionsHtml(selected='',includeEmpty=true){const empty=includeEmpty?`<option value="empty" ${selected==='empty'?'selected':''}>— Empty / select cargo —</option>`:'';return empty+(cargoLibraryByHull[cargoHullKey()]||cargoLibraryByHull.general).map(k=>`<option value="${k}" ${selected===k?'selected':''}>${escapeHtml(cargoProfile(k).label)}</option>`).join('')+`<option value="manual" ${selected==='manual'?'selected':''}>Manual / custom cargo</option>`;}
function cargoSpaceOptionsHtml(selected=''){const a=[`<option value="">Manual position</option>`];cargoSpaces().forEach(sp=>a.push(`<option value="${sp.id}" ${selected===sp.id?'selected':''}>${escapeHtml(sp.name)}</option>`));return a.join('');}
function populateCargoLibraryUI(){const sel=document.getElementById('cargoLibrarySelect'),sp=document.getElementById('cargoSpaceSelect');if(sel){const old=sel.value;sel.innerHTML=cargoOptionsHtml(old,false);if(!sel.value)sel.value=(cargoLibraryByHull[cargoHullKey()]||['manual'])[0];}if(sp){const old=sp.value;sp.innerHTML=cargoSpaceOptionsHtml(old);}updateCargoLibraryHint();}
function updateCargoLibraryHint(){const sel=document.getElementById('cargoLibrarySelect'),p=cargoProfile(sel?.value);const e=document.getElementById('cargoLibraryHint');if(e)e.innerHTML=`<b class="text-amber-300">${escapeHtml(p.label)}</b> · ${escapeHtml(cargoClassLabel(p.physics))}<br>${escapeHtml(p.desc)} <span class="text-slate-600">Preset values are editable teaching defaults.</span>`;}
function cargoSpaceVolume(sp){if(!sp)return 0;if(Number.isFinite(Number(sp.capacityVolume))&&Number(sp.capacityVolume)>0)return Number(sp.capacityVolume);if(sp.shape==='sphere'||sp.moss){const d=Math.max(0,Number(sp.diameter)||Math.min(Number(sp.length)||0,Number(sp.breadth)||0,Number(sp.height)||0));return Math.PI*Math.pow(d,3)/6;}let factor=.88;const t=String(sp.type||'').toLowerCase();if(t.includes('bulk')||t.includes('hopper'))factor=.80;else if(t.includes('gas'))factor=.92;else if(t.includes('tank')||t.includes('liquid')||t.includes('oil')||t.includes('chemical'))factor=.94;return Math.max(0,Number(sp.length)||0)*Math.max(0,Number(sp.breadth)||0)*Math.max(0,Number(sp.height)||0)*factor;}
function cargoSpaceFillStats(sp,items=cargoItems){
 const capVol=Math.max(0,cargoSpaceVolume(sp)),assigned=(Array.isArray(items)?items:[]).filter(it=>String(it.spaceId||'')===String(sp?.id||''));
 let usedVol=0,mass=0,method='empty';
 assigned.forEach(raw=>{
  const it=ensureCargoPhysicsItem(raw);if(it.cargoKey==='empty')return;const m=Math.max(0,cargoPhysicsMass(it)),rho=Math.max(0,Number(it.density)||0),cls=String(it.physicsClass||'').toLowerCase();mass+=m;
  if(capVol>0&&rho>0&&['bulk','grain','liquefiable','liquid','gas'].includes(cls)){usedVol+=m/rho;method='mass ÷ density';}
  else if(capVol>0&&Number.isFinite(Number(it.fill))){usedVol+=capVol*Math.max(0,Number(it.fill))/100;method=assigned.length>1?'entered fill (summed)':'entered fill';}
 });
 const rawPercent=capVol>0?100*usedVol/capVol:(assigned.length?Math.max(...assigned.map(it=>Math.max(0,Number(it.fill)||0))):0),percent=Math.max(0,Math.min(100,rawPercent));
 const status=rawPercent>100.05?'over':percent>=99.5?'full':percent>.05?'partial':'empty';
 return {capacityVolume:capVol,usedVolume:usedVol,mass,assignedCount:assigned.length,rawPercent,percent,status,method};
}
function cargoSpacesWithFill(items=cargoItems){return representativeCargoSpaces().map(sp=>{const f=cargoSpaceFillStats(sp,items);return {...sp,fillPercent:f.percent,fillRawPercent:f.rawPercent,fillStatus:f.status,fillMass:f.mass,fillUsedVolume:f.usedVolume,fillCapacityVolume:f.capacityVolume,fillMethod:f.method,assignedCount:f.assignedCount};});}
function fillPercentLabel(raw){const n=Math.max(0,Number(raw)||0);return n>100.05?`${n.toFixed(0)}% OVER`:`${n.toFixed(0)}% FULL`;}
function fillStatusClass(raw){const n=Math.max(0,Number(raw)||0);return n>100.05?'text-rose-300 border-rose-500/30 bg-rose-500/10':n>=99.5?'text-emerald-300 border-emerald-500/30 bg-emerald-500/10':n>.05?'text-cyan-300 border-cyan-500/30 bg-cyan-500/10':'text-slate-400 border-slate-700 bg-slate-900/70';}
function renderSpaceFillMonitor(){
 const host=document.getElementById('spaceFillMonitor');if(!host)return;const spaces=cargoSpacesWithFill(),tanks=visualBallastTanks();
 const cargoRows=spaces.map(sp=>{const f={rawPercent:sp.fillRawPercent,percent:sp.fillPercent,mass:sp.fillMass,usedVolume:sp.fillUsedVolume,capacityVolume:sp.fillCapacityVolume,method:sp.fillMethod};return `<div class="rounded-lg border ${fillStatusClass(f.rawPercent)} p-2"><div class="flex items-center justify-between gap-2"><span class="font-bold text-[9px] text-slate-200 truncate">${escapeHtml(sp.name)}</span><span class="text-[9px] font-black whitespace-nowrap">${fillPercentLabel(f.rawPercent)}</span></div><div class="h-1.5 rounded-full bg-slate-800 mt-1 overflow-hidden"><div class="h-full bg-current opacity-80" style="width:${Math.min(100,f.percent).toFixed(1)}%"></div></div><div class="text-[8px] text-slate-500 mt-1">${f.mass.toFixed(0)} t · ${f.capacityVolume?`${f.usedVolume.toFixed(0)} / ${f.capacityVolume.toFixed(0)} m³ · `:''}${escapeHtml(f.method)}</div></div>`}).join('');
 const tankRows=tanks.map(t=>{const raw=Math.max(0,Number(t.fill)||0),mass=typeof ballastTankMass==='function'?ballastTankMass(t):0;return `<div class="rounded-lg border ${fillStatusClass(raw)} p-2"><div class="flex items-center justify-between gap-2"><span class="font-bold text-[9px] text-slate-200 truncate">${escapeHtml(t.name||'Tank')}</span><span class="text-[9px] font-black whitespace-nowrap">${fillPercentLabel(raw)}</span></div><div class="h-1.5 rounded-full bg-slate-800 mt-1 overflow-hidden"><div class="h-full bg-current opacity-80" style="width:${Math.min(100,raw).toFixed(1)}%"></div></div><div class="text-[8px] text-slate-500 mt-1">${mass.toFixed(1)} t${Number(t.capacity)>0?` · capacity ${Number(t.capacity).toFixed(0)} t`:''}</div></div>`}).join('');
 host.innerHTML=`<div class="grid grid-cols-1 xl:grid-cols-2 gap-2"><div><div class="text-[9px] font-bold text-amber-300 mb-1.5">CARGO HOLDS / CARGO TANKS</div><div class="space-y-1.5">${cargoRows||'<div class="text-[9px] text-slate-500">No cargo spaces available.</div>'}</div></div><div><div class="text-[9px] font-bold text-blue-300 mb-1.5">BALLAST / LIQUID TANKS</div><div class="space-y-1.5">${tankRows||'<div class="text-[9px] text-slate-500">No ballast tanks available.</div>'}</div></div></div><div class="mt-2 text-[8px] text-slate-500">% FULL is input-derived. Bulk/grain/liquid/gas uses occupied volume from mass ÷ density when possible; containers, vehicles and discrete loads use the entered Fill %. Engine rooms and machinery spaces are not given a fictitious fullness percentage.</div>`;
}
function ensureCargoPhysicsItem(it){if(!it.physicsClass){it.physicsClass='discrete';it.cargoKey='manual';it.autoMass=false;it.autoVCG=false;it.quantity=1;it.unitMass=Number(it.mass)||0;it.fill=100;it.density=0;it.spaceId='';it.moisture=0;it.tml=0;it.grainMoment=0;it.fsmFactor=.85;}return it;}
function cargoPhysicsMass(it){ensureCargoPhysicsItem(it);if(!it.autoMass)return Math.max(0,Number(it.mass)||0);const cls=it.physicsClass,sp=cargoSpaceById(it.spaceId),fill=Math.max(0,Math.min(1,(Number(it.fill)||0)/100));if(['bulk','grain','liquefiable','liquid','gas'].includes(cls)){const vol=sp?cargoSpaceVolume(sp):Math.max(0,Number(it.volume)||0);return vol*Math.max(0,Number(it.density)||0)*fill;}return Math.max(0,Number(it.quantity)||0)*Math.max(0,Number(it.unitMass)||0);}
function cargoPhysicsVCG(it){ensureCargoPhysicsItem(it);if(!it.autoVCG)return Number(it.vcg)||0;const sp=cargoSpaceById(it.spaceId);if(!sp)return Number(it.vcg)||0;const fill=Math.max(0,Math.min(1,(Number(it.fill)||0)/100));if(['bulk','grain','liquefiable','liquid','gas'].includes(it.physicsClass))return Number(sp.bottom||0)+Math.max(.05,Number(sp.height)||.05)*Math.max(.05,fill)/2;if(it.physicsClass==='container'){const tier=Math.max(1,Number(it.tier)||1);return Number(sp.bottom||0)+Math.min(Number(sp.height||state.depth*.6),.65+tier*2.55);}return Number(sp.bottom||0)+Math.max(.2,Number(sp.height)||1)*.5;}
function cargoLiquidFSM(it){ensureCargoPhysicsItem(it);if(it?.sourceLocked&&Number.isFinite(Number(it.sourceFSM)))return Math.max(0,Number(it.sourceFSM));if(!['liquid','gas'].includes(it.physicsClass))return 0;const f=Math.max(0,Math.min(1,(Number(it.fill)||0)/100));if(f<=.001||f>=.98)return 0;const sp=cargoSpaceById(it.spaceId);if(!sp)return 0;const l=Math.max(.1,Number(sp.length)||.1),b=Math.max(.1,Number(sp.breadth)||.1),rho=Math.max(.01,Number(it.density)||.01),factor=Math.max(0,Math.min(1,Number.isFinite(Number(it.fsmFactor))?Number(it.fsmFactor):.85));return rho*l*Math.pow(b,3)/12*factor;}
function syncCargoComputedFields(it){
 ensureCargoPhysicsItem(it);const sp=cargoSpaceById(it.spaceId),volumetric=['bulk','grain','liquefiable','liquid','gas'].includes(it.physicsClass);
 if(it.autoMass)it.mass=cargoPhysicsMass(it);
 else if(it.preloadedSpaceSlot&&sp&&volumetric&&Number(it.density)>0){const cap=cargoSpaceVolume(sp),raw=cap>0?100*Math.max(0,Number(it.mass)||0)/(cap*Number(it.density)):0;it.derivedFillRaw=raw;it.fill=Math.max(0,Math.min(100,raw));}
 if(it.autoVCG)it.vcg=cargoPhysicsVCG(it);
 if(sp){if(it.autoLCG!==false)it.lcg=Number(sp.lcg)||0;if(it.autoTCG!==false)it.tcg=Number(sp.tcg)||0;}
 return it;
}
function addCargoFromLibrary(){
 populateCargoLibraryUI();const key=document.getElementById('cargoLibrarySelect')?.value||'manual',p=cargoProfile(key),spaceId=document.getElementById('cargoSpaceSelect')?.value||'',sp=cargoSpaceById(spaceId),qty=Math.max(0,Number(document.getElementById('cargoQuickQuantity')?.value)||0),fill=Math.max(0,Math.min(100,Number(document.getElementById('cargoQuickFill')?.value)||0));
 const slot=spaceId?cargoItems.find(x=>x.preloadedSpaceSlot&&String(x.spaceId)===String(spaceId)):null;
 if(slot){applyCargoProfileToItem(slot,key);slot.quantity=qty;slot.fill=fill;slot.autoMass=key!=='manual'&&key!=='empty';slot.autoVCG=true;syncCargoComputedFields(slot);renderCargoTable();renderCargoManager();calculateAll();return slot;}
 const item={id:Date.now()+Math.floor(Math.random()*1000),name:p.label,cargoKey:key,physicsClass:p.physics,quantity:qty||1,unitMass:p.unitMass||0,density:p.density||0,fill,spaceId,autoMass:key!=='manual'&&key!=='empty',autoVCG:!!sp,volume:sp?cargoSpaceVolume(sp):0,mass:key==='manual'?100:0,vcg:sp?Number(sp.bottom||0)+Number(sp.height||1)*.5:state.depth*.45,tcg:sp?Number(sp.tcg)||0:0,lcg:sp?Number(sp.lcg)||0:0,moisture:0,tml:0,grainMoment:0,fsmFactor:.85,tier:1,source:'teaching-preset'};syncCargoComputedFields(item);cargoItems.push(item);renderCargoTable();renderCargoManager();calculateAll();return item;
}
function cargoItemWarning(it){ensureCargoPhysicsItem(it);if(it.cargoKey==='empty')return '<span class="text-slate-500">EMPTY</span>';if(it.physicsClass==='liquefiable'&&Number(it.tml)>0&&Number(it.moisture)>Number(it.tml))return `<span class="cargo-danger">MC ${Number(it.moisture).toFixed(1)}% &gt; TML ${Number(it.tml).toFixed(1)}%</span>`;if(it.physicsClass==='grain'&&!(Number(it.grainMoment)>0))return '<span class="cargo-warning">Enter Grain HM</span>';if(['liquid','gas'].includes(it.physicsClass)&&cargoLiquidFSM(it)>0)return `<span class="cargo-warning">Slack · FSM ${cargoLiquidFSM(it).toFixed(0)}</span>`;return '<span class="cargo-ok">OK</span>';}
function cargoTotals(){let mass=0,vm=0,tm=0,lm=0,fsm=0;cargoItems.forEach(raw=>{const it=syncCargoComputedFields(raw),m=cargoPhysicsMass(it),v=cargoPhysicsVCG(it);mass+=m;vm+=m*v;tm+=m*(Number(it.tcg)||0);lm+=m*(Number(it.lcg)||0);fsm+=cargoLiquidFSM(it);});return {mass,kg:mass?vm/mass:0,tcg:mass?tm/mass:0,lcg:mass?lm/mass:0,fsm};}
function openCargoManager(){populateCargoLibraryUI();document.getElementById('cargoManagerBackdrop')?.classList.remove('hidden');renderCargoManager();}
function closeCargoManager(){document.getElementById('cargoManagerBackdrop')?.classList.add('hidden');}
function clearAllCargo(){if(!confirm('Empty all cargo spaces? Preloaded holds/bays/tanks will remain available.'))return;cargoItems=createEmptyCargoTemplateItems();renderCargoTable();renderCargoManager();calculateAll();}
function applyCargoProfileToItem(it,key){
 if(key==='empty'){resetCargoTemplateSlot(it);return;}
 const p=cargoProfile(key);it.cargoKey=key;it.physicsClass=p.physics;it.unitMass=p.unitMass||0;it.density=p.density||0;
 if(it.preloadedSpaceSlot){it.autoMass=false;it.mass=Math.max(0,Number(it.mass)||0);it.fill=Math.max(0,Number(it.fill)||0);it.autoVCG=true;const sp=cargoSpaceById(it.spaceId);if(sp)it.name=sp.name;}
 else{it.autoMass=key!=='manual';it.name=p.label;}
 syncCargoComputedFields(it);
}
function updateCargoAdvanced(id,key,value){const it=cargoItems.find(x=>String(x.id)===String(id));if(!it)return;ensureCargoPhysicsItem(it);if(it.sourceLocked&&key!=='name'){it.sourceLocked=false;delete it.sourceFSM;it.source=state.amcolTrainingVesselId?'Edited from AMCOL training baseline':'Edited from source workbook';}if(key==='cargoKey'){applyCargoProfileToItem(it,value);}else if(key==='spaceId'){it.spaceId=value;it.autoVCG=!!value;it.autoLCG=true;it.autoTCG=true;const sp=cargoSpaceById(value);if(sp){it.lcg=sp.lcg;it.tcg=sp.tcg;}}else if(['quantity','unitMass','density','fill','mass','vcg','lcg','tcg','moisture','tml','grainMoment','tier','fsmFactor'].includes(key)){it[key]=Number(value);if(key==='mass')it.autoMass=false;if(key==='fill'&&it.preloadedSpaceSlot&&['bulk','grain','liquefiable','liquid','gas'].includes(it.physicsClass))it.autoMass=true;if(key==='vcg')it.autoVCG=false;if(key==='lcg')it.autoLCG=false;if(key==='tcg')it.autoTCG=false;}else it[key]=value;syncCargoComputedFields(it);const gm=cargoItems.reduce((a,x)=>a+(Number(x.grainMoment)||0),0);if(gm>0){state.grainEnabled=true;state.grainMoment=gm;}renderCargoTable();renderCargoManager();calculateAll();}
function renderCargoManager(){const tb=document.getElementById('cargoManagerTableBody');if(!tb)return;populateCargoLibraryUI();cargoItems.forEach(ensureCargoPhysicsItem);tb.innerHTML=cargoItems.map(it=>{syncCargoComputedFields(it);return `<tr><td><input value="${escapeHtml(it.name)}" onchange="updateCargoAdvanced('${it.id}','name',this.value)" style="width:115px" ${it.preloadedSpaceSlot?'disabled':''}></td><td><select onchange="updateCargoAdvanced('${it.id}','cargoKey',this.value)" style="width:165px">${cargoOptionsHtml(it.cargoKey,true)}</select></td><td><span class="cargo-physics-chip">${escapeHtml(cargoClassLabel(it.physicsClass))}</span></td><td><select onchange="updateCargoAdvanced('${it.id}','spaceId',this.value)" style="width:150px" ${it.preloadedSpaceSlot?'disabled':''}>${cargoSpaceOptionsHtml(it.spaceId)}</select></td><td><input type="number" min="0" value="${(Number.isFinite(Number(it.quantity))?Number(it.quantity):1).toFixed(0)}" onchange="updateCargoAdvanced('${it.id}','quantity',this.value)" style="width:48px"></td><td><input type="number" step=".1" value="${Number(it.unitMass||0).toFixed(1)}" onchange="updateCargoAdvanced('${it.id}','unitMass',this.value)" style="width:55px"></td><td><input type="number" step=".01" value="${Number(it.density||0).toFixed(2)}" onchange="updateCargoAdvanced('${it.id}','density',this.value)" style="width:58px"></td><td><input type="number" min="0" max="100" value="${(Number.isFinite(Number(it.fill))?Number(it.fill):100).toFixed(0)}" onchange="updateCargoAdvanced('${it.id}','fill',this.value)" style="width:50px"></td><td><input type="number" min="1" max="12" value="${Number(it.tier||1).toFixed(0)}" onchange="updateCargoAdvanced('${it.id}','tier',this.value)" style="width:42px" ${it.physicsClass==='container'?'':'disabled'}></td><td class="font-mono text-amber-300">${cargoPhysicsMass(it).toFixed(1)}</td><td><input type="number" step=".1" value="${Number(cargoPhysicsVCG(it)).toFixed(2)}" onchange="updateCargoAdvanced('${it.id}','vcg',this.value);updateCargoAdvanced('${it.id}','autoVCG',false)" style="width:58px"></td><td><input type="number" step=".5" value="${Number(it.lcg||0).toFixed(2)}" onchange="updateCargoAdvanced('${it.id}','lcg',this.value)" style="width:58px"></td><td><input type="number" step=".1" value="${Number(it.tcg||0).toFixed(2)}" onchange="updateCargoAdvanced('${it.id}','tcg',this.value)" style="width:58px"></td><td><input type="number" min="0" step=".1" value="${Number(it.moisture||0).toFixed(1)}" onchange="updateCargoAdvanced('${it.id}','moisture',this.value)" style="width:50px"></td><td><input type="number" min="0" step=".1" value="${Number(it.tml||0).toFixed(1)}" onchange="updateCargoAdvanced('${it.id}','tml',this.value)" style="width:50px"></td><td><input type="number" min="0" step="25" value="${Number(it.grainMoment||0).toFixed(0)}" onchange="updateCargoAdvanced('${it.id}','grainMoment',this.value)" style="width:65px"></td><td class="font-mono">${cargoLiquidFSM(it).toFixed(0)}<div>${cargoItemWarning(it)}</div></td><td><button onclick="deleteCargo(${it.id});renderCargoManager()" class="text-rose-400"><i class="fa-solid fa-trash"></i></button></td></tr>`}).join('');const t=cargoTotals();const set=(id,html)=>{const e=document.getElementById(id);if(e)e.innerHTML=html};set('cargoManagerStatus',`${cargoItems.length} cargo records · vessel family <b>${escapeHtml(cargoHullKey())}</b> · liquid cargo FSM is added to the same corrected-KG calculation as ballast free surface.`);set('cargoManagerMass',`<b>Cargo mass</b><br>${t.mass.toFixed(1)} t · cargo KG ${t.kg.toFixed(2)} m`);set('cargoManagerCG',`<b>Cargo CG</b><br>TCG ${t.tcg>=0?'+':''}${t.tcg.toFixed(2)} m · LCG ${t.lcg>=0?'+':''}${t.lcg.toFixed(2)} m`);set('cargoManagerSpecial',`<b>Cargo liquid free surface</b><br>FSM ${t.fsm.toFixed(0)} t·m · ${cargoItems.filter(x=>x.physicsClass==='grain').length} grain record(s)`);}

function cargoLongitudinalZoneLCG(zone){
 const L=Math.max(10,Number(state.length)||80);
 const map={bow:.40,forward:.23,mid:0,aft:-.23,stern:-.40};
 return Object.prototype.hasOwnProperty.call(map,zone)?L*map[zone]:null;
}
function cargoLongitudinalZoneFromLCG(lcg){
 const L=Math.max(10,Number(state.length)||80),x=Number(lcg)||0;
 const targets=[
  ['bow', .40*L],
  ['forward', .23*L],
  ['mid', 0],
  ['aft', -.23*L],
  ['stern', -.40*L]
 ];
 let best=null,bestD=Infinity;
 targets.forEach(([z,t])=>{const d=Math.abs(x-t);if(d<bestD){best=z;bestD=d;}});
 return bestD<=Math.max(.25,L*.025)?best:'custom';
}
function updateCargoLongitudinalZone(id,zone){
 const it=cargoItems.find(x=>x.id===id);
 if(!it)return;
 if(zone==='custom'){renderCargoTable();return;}
 const lcg=cargoLongitudinalZoneLCG(zone);
 if(lcg===null)return;
 it.lcg=lcg;
 renderCargoTable();
 calculateAll();
}

function renderCargoTable(){
 populateCargoLibraryUI();
 const tb=document.getElementById('cargoTableBody');if(!tb)return;tb.innerHTML='';
 cargoItems.forEach(raw=>{
  const it=ensureCargoPhysicsItem(raw);syncCargoComputedFields(it);
  const side=tcgSide(it.tcg),dist=tcgDistance(it.tcg),longZone=cargoLongitudinalZoneFromLCG(it.lcg),p=cargoProfile(it.cargoKey);
  const tr=document.createElement('tr');tr.className='border-t border-slate-800/60';
  tr.innerHTML=`
   <td class="py-1 pr-1"><input value="${escapeHtml(it.name)}" onchange="updateCargo(${it.id},'name',this.value)" ${it.preloadedSpaceSlot?'disabled':''} class="w-24 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"></td>
   <td><select onchange="updateCargoAdvanced('${it.id}','cargoKey',this.value)" class="w-28 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[8px] ${['liquid','gas'].includes(it.physicsClass)?'text-cyan-300':it.physicsClass==='grain'?'text-amber-300':'text-slate-300'}" title="Select cargo for this vessel space">${cargoOptionsHtml(it.cargoKey,true)}</select></td>
   <td><input type="number" value="${Number(cargoPhysicsMass(it)).toFixed(1)}" onchange="updateCargo(${it.id},'mass',parseFloat(this.value));updateCargoAdvanced('${it.id}','autoMass',false)" class="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 font-mono"></td>
   <td><input type="number" min="0" max="100" step="1" value="${Math.max(0,Math.min(100,Number(it.fill)||0)).toFixed(0)}" onchange="updateCargoAdvanced('${it.id}','fill',this.value)" class="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 font-mono text-cyan-300"></td>
   <td><input type="number" value="${Number(cargoPhysicsVCG(it)).toFixed(2)}" step="0.1" onchange="updateCargo(${it.id},'vcg',parseFloat(this.value));updateCargoAdvanced('${it.id}','autoVCG',false)" class="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 font-mono"></td>
   <td><select onchange="updateCargoLongitudinalZone(${it.id},this.value)" ${it.preloadedSpaceSlot?'disabled':''} class="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px]"><option value="bow" ${longZone==='bow'?'selected':''}>Bow</option><option value="forward" ${longZone==='forward'?'selected':''}>Forward</option><option value="mid" ${longZone==='mid'?'selected':''}>Midship</option><option value="aft" ${longZone==='aft'?'selected':''}>Aft</option><option value="stern" ${longZone==='stern'?'selected':''}>Stern</option><option value="custom" ${longZone==='custom'?'selected':''}>Custom</option></select></td>
   <td><input type="number" value="${Number(it.lcg||0).toFixed(1)}" step="0.5" min="${(-state.length/2).toFixed(1)}" max="${(state.length/2).toFixed(1)}" onchange="updateCargo(${it.id},'lcg',parseFloat(this.value))" ${it.preloadedSpaceSlot?'disabled':''} class="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 font-mono" title="+ forward · − aft"></td>
   <td><select onchange="updateCargoSide(${it.id},this.value)" ${it.preloadedSpaceSlot?'disabled':''} class="w-20 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px]"><option value="starboard" ${side==='starboard'?'selected':''}>Starboard</option><option value="center" ${side==='center'?'selected':''}>Centre</option><option value="port" ${side==='port'?'selected':''}>Port</option></select></td>
   <td><input type="number" min="0" max="${(state.beam/2).toFixed(1)}" step="0.1" value="${dist.toFixed(1)}" ${(side==='center'||it.preloadedSpaceSlot)?'disabled':''} onchange="updateCargoDistance(${it.id},parseFloat(this.value))" class="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 font-mono disabled:opacity-40"></td>
   <td class="text-right"><button onclick="deleteCargo(${it.id})" class="text-rose-400 px-1"><i class="fa-solid fa-trash"></i></button></td>`;
  tb.appendChild(tr);
 });
 const sm=document.getElementById('cargoPhysicsSummary');if(sm){const t=cargoTotals();sm.innerHTML=`Vessel cargo spaces <b class="text-slate-300">${cargoSpaces().filter(isEditableCargoSpace).length}</b> available · Loaded cargo <b class="text-slate-300">${t.mass.toFixed(0)} t</b> · cargo KG <b>${t.kg.toFixed(2)} m</b> · liquid-cargo FSM <b class="text-cyan-300">${t.fsm.toFixed(0)} t·m</b>. Teaching density presets remain editable.`;}
}
function addCargoItem(){cargoItems.push({id:Date.now(),name:'Manual load',mass:100,vcg:5,tcg:0,lcg:cargoLongitudinalZoneLCG('mid')||0,cargoKey:'manual',physicsClass:'discrete',quantity:1,unitMass:100,density:0,fill:100,spaceId:'',autoMass:false,autoVCG:false,moisture:0,tml:0,grainMoment:0,fsmFactor:.85});renderCargoTable();renderCargoManager();calculateAll();}
function updateCargo(id,k,v){
 const i=cargoItems.find(x=>x.id===id);
 if(i){
  ensureCargoPhysicsItem(i);if(i.sourceLocked&&k!=='name'){i.sourceLocked=false;delete i.sourceFSM;i.source=state.amcolTrainingVesselId?'Edited from AMCOL training baseline':'Edited from source workbook';}i[k]=v;if(k==='mass')i.autoMass=false;if(k==='vcg')i.autoVCG=false;if(k==='lcg')i.autoLCG=false;if(k==='tcg')i.autoTCG=false;
  calculateAll();
  if(k==='lcg'||k==='mass'||k==='vcg')renderCargoTable();
  if(!document.getElementById('cargoManagerBackdrop')?.classList.contains('hidden'))renderCargoManager();
 }
}
function deleteCargo(id){const it=cargoItems.find(x=>String(x.id)===String(id));if(it?.preloadedSpaceSlot)resetCargoTemplateSlot(it);else cargoItems=cargoItems.filter(x=>String(x.id)!==String(id));renderCargoTable();if(document.getElementById('cargoManagerBackdrop')&&!document.getElementById('cargoManagerBackdrop').classList.contains('hidden'))renderCargoManager();calculateAll();}
window.AMCOL_DIRECT3D_BRIDGE={
 moveCargo(id,patch={}){
  const it=cargoItems.find(x=>String(x.id)===String(id));
  if(!it)return {ok:false,message:'Cargo item not found'};
  if(it.sourceLocked){it.sourceLocked=false;delete it.sourceFSM;it.source=state.amcolTrainingVesselId?'Edited from AMCOL training baseline':'Edited from source workbook';}
  if(Number.isFinite(Number(patch.tcg))){it.tcg=Number(patch.tcg);it.autoTCG=false;}
  if(Number.isFinite(Number(patch.vcg))){it.vcg=Number(patch.vcg);it.autoVCG=false;}
  if(Number.isFinite(Number(patch.lcg))){it.lcg=Number(patch.lcg);it.autoLCG=false;}
  renderCargoTable();calculateAll();
  return {ok:true,item:{...it}};
 },
 moveCrane(patch={}){
  state.crane=true;
  if(Number.isFinite(Number(patch.height)))state.craneHeight=Number(patch.height);
  if(Number.isFinite(Number(patch.lcg)))state.craneLCG=Number(patch.lcg);
  if(Number.isFinite(Number(patch.tcg))){
   const x=Number(patch.tcg);
   state.craneSide=Math.abs(x)<.01?0:(x>0?1:-1);
   state.craneOutreach=Math.abs(x);
  }else{
   if(Number.isFinite(Number(patch.side)))state.craneSide=Number(patch.side);
   if(Number.isFinite(Number(patch.outreach)))state.craneOutreach=Math.max(0,Number(patch.outreach));
  }
  syncFormFromState();calculateAll();
  return {ok:true,crane:{height:state.craneHeight,lcg:state.craneLCG,side:state.craneSide,outreach:state.craneOutreach}};
 },
 getCargo(){
  return cargoItems.map(x=>({...x}));
 },
 getState(){
  return {beam:state.beam,depth:state.depth,length:state.length,crane:state.crane,craneHeight:state.craneHeight,craneOutreach:state.craneOutreach,craneSide:state.craneSide,craneLCG:state.craneLCG,
    fse:state.fse,tankCount:state.tankCount,tankFill:state.tankFill,tankLength:state.tankLength,tankBreadth:state.tankBreadth,tankDensity:state.tankDensity,ballastPlanEnabled:state.ballastPlanEnabled,ballastTanks:ballastTanks.map(t=>({...t,mass:ballastTankMass(t),vcg:ballastTankLiquidVCG(t)}))};
 },
 getBallastPlan(){
  return ballastTanks.map(t=>({...t,capacity:ballastTankFullCapacity(t),mass:ballastTankMass(t),vcg:ballastTankLiquidVCG(t),fsm:ballastTankFSM(t)}));
 },
 getBallastSnapshot(){
  return {
   cargo:cargoItems.map(x=>({...x})),
   ballast:ballastTanks.map(t=>({...t})),
   plan:{enabled:state.ballastPlanEnabled,source:state.ballastPlanSource,label:state.ballastPlanLabel},
   fse:{enabled:state.fse,count:state.tankCount,fill:state.tankFill,length:state.tankLength,breadth:state.tankBreadth,density:state.tankDensity}
  };
 },
 applyBallastLab(tanks=[]){
  if(!Array.isArray(tanks)||!tanks.length)return {ok:false,total:0};
  const byId=new Map(ballastTanks.map(t=>[String(t.id),t]));
  let changed=false;
  tanks.forEach(p=>{
   const id=String(p.id||p.key||'');const t=byId.get(id);if(!t)return;
   const cap=Math.max(.001,ballastTankFullCapacity(t));
   const oldMass=ballastTankMass(t);
   const requested=Math.max(0,Math.min(cap,Number(p.mass)||0));
   if(Math.abs(requested-oldMass)>.001||p.modified){
    t.fill=Math.max(0,Math.min(100,requested/cap*100));
    if(t.sourceLocked){
     t.sourceLocked=false;
     t.sourceReferenceMass=Number(t.sourceMass)||oldMass;
     t.sourceReferenceVCG=Number(t.sourceVCG)||ballastTankLiquidVCG(t);
     t.sourceReferenceFSM=Number(t.sourceFSM)||ballastTankFSM(t);
     t.source=`${t.source||'Vessel source'} · user-modified transfer`;
    }
    changed=true;
   }
  });
  state.ballastPlanEnabled=true;
  state.individualBallastFSE=false;
  if(changed&&['vessel','training'].includes(state.ballastPlanSource))state.ballastPlanLabel=(state.ballastPlanLabel||(state.ballastPlanSource==='training'?'AMCOL training ballast plan':'Vessel ballast plan')).replace(/ · transfer modified$/,'')+' · transfer modified';
  renderBallastPlan();calculateAll();
  return {ok:true,total:ballastTanks.reduce((a,t)=>a+ballastTankMass(t),0)};
 },
 restoreBallastSnapshot(snapshot){
  if(!snapshot)return {ok:false};
  if(Array.isArray(snapshot.cargo))cargoItems=snapshot.cargo.map(x=>({...x}));
  if(Array.isArray(snapshot.ballast))ballastTanks=snapshot.ballast.map(x=>({...x}));
  const p=snapshot.plan||{};
  state.ballastPlanEnabled=p.enabled!==undefined?!!p.enabled:ballastTanks.length>0;
  state.ballastPlanSource=p.source||state.ballastPlanSource||'custom';
  state.ballastPlanLabel=p.label||state.ballastPlanLabel||`Ballast plan · ${ballastTanks.length} tanks`;
  const f=snapshot.fse||{};
  if(f.enabled!==undefined)state.fse=!!f.enabled;
  if(Number.isFinite(Number(f.count)))state.tankCount=Math.max(1,Number(f.count));
  if(Number.isFinite(Number(f.fill)))state.tankFill=Math.max(0,Math.min(100,Number(f.fill)));
  if(Number.isFinite(Number(f.length)))state.tankLength=Number(f.length);
  if(Number.isFinite(Number(f.breadth)))state.tankBreadth=Number(f.breadth);
  if(Number.isFinite(Number(f.density)))state.tankDensity=Number(f.density);
  state.individualBallastFSE=false;state.ballastTankPhysics=[];
  syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();return {ok:true};
 },
 restoreBallastFSE(f){
  if(!f)return {ok:false};state.fse=!!f.enabled;state.individualBallastFSE=false;state.ballastTankPhysics=[];syncFormFromState();calculateAll();return {ok:true};
 },
 listOperationalChallenges(){
  return Object.keys(challengeMeta).map(key=>{
   const sc=scenarios[key],meta=challengeMeta[key]||['Challenge',''];
   return {key,title:sc?.title||key,brief:sc?.brief||'',goal:sc?.goal||'',tasks:Array.isArray(sc?.tasks)?[...sc.tasks]:[],category:meta[0],difficulty:meta[1]};
  });
 },
 loadOperationalChallenge(key){
  if(!challengeMeta[key])return {ok:false};
  loadScenario(key);
  const sc=scenarios[key],meta=challengeMeta[key];
  return {ok:true,key,title:sc.title,brief:sc.brief,goal:sc.goal,tasks:[...(sc.tasks||[])],category:meta[0],difficulty:meta[1]};
 },
 getOperationalMissionSnapshot(){
  calculateAll();
  const key=activeScenarioKey();
  const o=challengeMeta[key]?challengeOutcome(key):null;
  const stateKeys=['density','waterDepth','lightshipMass','lightshipKG','lightshipTCG','lightshipLCG','tankCount','tankLength','tankBreadth','tankDensity','tankFill','fse','crane','craneMass','craneHeight','craneOutreach','craneSide','craneLCG','windEnabled','windSpeedKts','gustFactor','windDirection','currentEnabled','currentSpeedKts','currentDirection','waveEnabled','waveHeight','waveLength','waveSpeed','wavePeriod','waveHeading','damage','damageMode','dmgMass','dmgVCG','dmgTCG'];
  const inputs={};stateKeys.forEach(k=>inputs[k]=state[k]);
  return {
   key,
   metrics:{disp:state.dispMass,kg:state.kgCorr,gm:state.gm,gz:restoringGZAt(state.heel),equilibrium:state.equilibrium,trim:state.trimAngle,ukc:state.ukc,fsc:state.fsc,tpc:state.tpc,fwa:state.fwa,envArm:state.environmentHeelingArm},
   inputs,
   cargo:cargoItems.filter(x=>!String(x.id||'').startsWith('ballast_lab_')).map(x=>({id:x.id,name:x.name,mass:x.mass,vcg:x.vcg,tcg:x.tcg,lcg:Number(x.lcg)||0})),
   outcome:o?{pass:o.pass,changed:o.changed,targetPass:!!o.target?.pass,targetMessage:o.target?.message||'',physicalPass:!!o.physical?.pass,physicalReasons:[...(o.physical?.reasons||[])],advisories:[...(o.physical?.advisories||[])]}:null,
   imoPass:evaluateIMO().every(c=>c.pass)
  };
 },
 runOperationalPhysicsTest(){return testCurrentStability(true);}
};


let cleanControlMode='basic',cleanFeedbackTimer=null;
function cleanMoveTopCard(id,target){
 const el=document.getElementById(id);if(!el||!target)return null;
 let node=el;
 const tabs=new Set(['tabVessel','tabCargoOps','tabEnvironment','tabPhysics','tabSimulate','tabOperations','tabData']);
 while(node.parentElement&&!tabs.has(node.parentElement.id))node=node.parentElement;
 if(node.parentElement&&node!==target){target.appendChild(node);return node;}return null;
}
function cleanIntro(kicker,title,copy,buttons=''){
 const d=document.createElement('div');d.className='clean-section-intro';d.innerHTML=`<div class="clean-section-kicker">${kicker}</div><div class="clean-section-title">${title}</div><div class="clean-section-copy">${copy}</div>${buttons?`<div class="clean-quick-grid">${buttons}</div>`:''}`;return d;
}
function deepClonePlain(v){return JSON.parse(JSON.stringify(v));}
function conditionSummarySnapshot(){
 return {disp:+state.dispMass||0,gm:+state.gm||0,kg:+state.kgCorr||0,draft:+state.eqDraft||0,draftFwd:+state.draftBow||0,draftAft:+state.draftStern||0,list:+state.equilibrium||0,trim:(+state.draftStern||0)-(+state.draftBow||0),fsc:+state.fsc||0,ukc:+state.ukc||0};
}
function makeConditionSnapshot(name='Condition'){
 const s=deepClonePlain(state);delete s.hydro;delete s.coupledHydro;delete s.strength;delete s.staticGZResult;delete s.staticGZPortResult;delete s.grainResult;delete s.ballastTankPhysics;delete s.hydroDataReference;
 const tv=activeAMCOLTrainingVessel(),embeddedVesselPackage=tv?.userImported?{format:'AMCOL_VESSEL_PACKAGE',schemaVersion:1,vessel:deepClonePlain(tv)}:null;
 return {id:`cond_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,name,created:new Date().toISOString(),state:s,cargo:deepClonePlain(cargoItems||[]),ballast:deepClonePlain(ballastTanks||[]),operationalLimits:deepClonePlain(operationalLimits),customHullForm:window.AMCOL_CUSTOM_HULL_FORM?deepClonePlain(window.AMCOL_CUSTOM_HULL_FORM):null,embeddedVesselPackage,summary:conditionSummarySnapshot()};
}
function restoreConditionSnapshot(rec,{announce=true}={}){
 if(!rec?.state)return false;prepareReferenceVesselLoad();vesselVisualTransaction=true;
 try{
   Object.assign(state,deepClonePlain(rec.state));cargoItems=deepClonePlain(rec.cargo||[]);ballastTanks=deepClonePlain(rec.ballast||[]);operationalLimits=rec.operationalLimits?deepClonePlain(rec.operationalLimits):operationalLimits;window.AMCOL_CUSTOM_HULL_FORM=rec.customHullForm?deepClonePlain(rec.customHullForm):null;
   restoreAMCOLTrainingContextFromState();
   bumpSpaceLayoutRevision('condition-library-load');
   syncFormFromState();syncEnvironmentForm();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});renderConditionLibrary();renderOperationalLimitsCard();renderDataCompleteness();renderHullEnvelopeStatus();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh('condition-library-load');if(announce)showCleanFeedback(`Loaded condition: ${rec.name||'Saved condition'}`);return true;
}
function exportCurrentConditionJSON(){const rec=makeConditionSnapshot((document.getElementById('conditionNameInput')?.value||'').trim()||`${state.vesselName||'AMCOL Vessel'} Condition`);rec.format='AMCOL_SIMULATOR_CONDITION';rec.schemaVersion=3;downloadText(`${String(rec.name).replace(/[^a-z0-9_-]+/gi,'_')}.amcol-condition.json`,JSON.stringify(rec,null,2),'application/json');}
function exportConditionLibraryJSON(){const pack={format:'AMCOL_SIMULATOR_CONDITION_LIBRARY',schemaVersion:3,exported:new Date().toISOString(),conditions:deepClonePlain(savedConditionLibrary)};downloadText(`AMCOL_Condition_Library_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(pack,null,2),'application/json');}
async function importConditionJSON(files){const file=files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());let records=[];if(obj?.format==='AMCOL_SIMULATOR_CONDITION_LIBRARY'&&Array.isArray(obj.conditions))records=obj.conditions;else if(obj?.state)records=[obj];else throw new Error('This file is not an AMCOL condition or condition-library export.');records=records.filter(r=>r&&r.state&&Array.isArray(r.cargo)&&Array.isArray(r.ballast));if(!records.length)throw new Error('No valid condition records were found.');let embeddedCount=0;records.forEach(r=>{if(r.embeddedVesselPackage){try{registerImportedVesselPackage(r.embeddedVesselPackage,{persist:true,load:false});embeddedCount++;}catch(e){throw new Error(`Embedded vessel package in “${r.name||'condition'}” is invalid: ${e.message}`);}}r.id=r.id||`cond_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;r.name=r.name||'Imported Condition';r.created=r.created||new Date().toISOString();});savedConditionLibrary=[...records,...savedConditionLibrary.filter(old=>!records.some(r=>r.id===old.id))].slice(0,12);persistConditionLibrary();renderConditionLibrary();restoreConditionSnapshot(records[0],{announce:false});showCleanFeedback(`Imported ${records.length} AMCOL condition${records.length===1?'':'s'}${embeddedCount?` · restored ${embeddedCount} embedded user vessel package${embeddedCount===1?'':'s'}`:''} · loaded ${records[0].name}.`);}catch(e){alert('Condition import failed: '+e.message);}finally{const input=document.getElementById('conditionImportInput');if(input)input.value='';}}
function loadConditionLibrary(){try{const a=JSON.parse(localStorage.getItem(CONDITION_LIBRARY_STORAGE_KEY)||'[]');savedConditionLibrary=Array.isArray(a)?a:[];}catch(e){savedConditionLibrary=[];}renderConditionLibrary();}
function persistConditionLibrary(){try{localStorage.setItem(CONDITION_LIBRARY_STORAGE_KEY,JSON.stringify(savedConditionLibrary.slice(0,12)));}catch(e){console.warn('Condition library save failed',e);}}
function saveCurrentCondition(){const inp=document.getElementById('conditionNameInput'),name=(inp?.value||'').trim()||`${state.vesselName||'Training vessel'} · ${new Date().toLocaleString()}`;savedConditionLibrary.unshift(makeConditionSnapshot(name));savedConditionLibrary=savedConditionLibrary.slice(0,12);persistConditionLibrary();if(inp)inp.value='';renderConditionLibrary();showCleanFeedback(`Saved condition: ${name}`);}
function selectedConditionRecord(){const id=document.getElementById('conditionLibrarySelect')?.value;return savedConditionLibrary.find(x=>x.id===id)||null;}
function loadSelectedCondition(){const r=selectedConditionRecord();if(r)restoreConditionSnapshot(r);}
function deleteSelectedCondition(){const r=selectedConditionRecord();if(!r)return;savedConditionLibrary=savedConditionLibrary.filter(x=>x.id!==r.id);persistConditionLibrary();renderConditionLibrary();}
function compareSelectedCondition(){const r=selectedConditionRecord(),box=document.getElementById('conditionCompareReadout');if(!r||!box)return;const a=conditionSummarySnapshot(),b=r.summary||{};const row=(n,k,u,d=2)=>`<div class="flex justify-between gap-3"><span>${n}</span><span class="font-mono">${Number(a[k]).toFixed(d)} <span class="text-slate-600">vs</span> ${Number(b[k]||0).toFixed(d)} ${u} <span class="${a[k]-b[k]>=0?'text-cyan-300':'text-amber-300'}">(${a[k]-b[k]>=0?'+':''}${(a[k]-b[k]).toFixed(d)})</span></span></div>`;box.innerHTML=`<div class="font-bold text-cyan-300 mb-1">Current vs ${escapeHtml(r.name)}</div>${row('Displacement','disp','t',0)}${row('GM','gm','m',3)}${row('Mean draft','draft','m',3)}${row('List','list','°',2)}${row('Trim by stern','trim','m',3)}${row('FSC','fsc','m',3)}`;}
function renderConditionLibrary(){const sel=document.getElementById('conditionLibrarySelect');if(!sel)return;const keep=sel.value;sel.innerHTML='<option value="">Choose saved condition…</option>'+savedConditionLibrary.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');if(savedConditionLibrary.some(r=>r.id===keep))sel.value=keep;const c=document.getElementById('conditionLibraryCount');if(c)c.textContent=`${savedConditionLibrary.length}/12 saved`;}

function teachingOperationalLimitDefaults(){const D=Math.max(1,state.depth),L=Math.max(20,state.length);return {enabled:true,source:'teaching',label:'Representative teaching advisory limits',minForwardDraft:+(D*.28).toFixed(2),minAftDraft:+(D*.30).toFixed(2),maxDraft:+(D*.86).toFixed(2),minUKC:+Math.max(1,D*.08).toFixed(2),maxList:5,maxTrim:+Math.max(.5,L*.01).toFixed(2)};}
function applyTeachingOperationalLimits(){operationalLimits=teachingOperationalLimitDefaults();renderOperationalLimitsCard();calculateAll({curve:false});showCleanFeedback('Representative teaching operational limits applied — replace with approved vessel limits for real data.');}
function setOperationalLimit(k,v){if(k==='enabled')operationalLimits.enabled=!!v;else{const n=Number(v);operationalLimits[k]=Number.isFinite(n)?n:null;operationalLimits.source='user';operationalLimits.label='User-entered advisory limits';}renderOperationalLimitsCard();updateCleanLivePanel();}
function operationalLimitChecks(){if(!operationalLimits.enabled)return [];const l=operationalLimits,c=[];const add=(name,actual,limit,pass,rule)=>c.push({name,actual,limit,pass,rule});if(Number.isFinite(l.minForwardDraft))add('Forward draft',state.draftBow,l.minForwardDraft,state.draftBow>=l.minForwardDraft,'≥');if(Number.isFinite(l.minAftDraft))add('Aft draft / propeller-immersion proxy',state.draftStern,l.minAftDraft,state.draftStern>=l.minAftDraft,'≥');if(Number.isFinite(l.maxDraft))add('Maximum draft',Math.max(state.draftBow,state.draftStern),l.maxDraft,Math.max(state.draftBow,state.draftStern)<=l.maxDraft,'≤');if(Number.isFinite(l.minUKC))add('UKC',state.ukc,l.minUKC,state.ukc>=l.minUKC,'≥');if(Number.isFinite(l.maxList))add('List',Math.abs(state.equilibrium),l.maxList,Math.abs(state.equilibrium)<=l.maxList,'≤');if(Number.isFinite(l.maxTrim))add('Trim',Math.abs(state.draftStern-state.draftBow),l.maxTrim,Math.abs(state.draftStern-state.draftBow)<=l.maxTrim,'≤');return c;}
function renderOperationalLimitsCard(){const box=document.getElementById('operationalLimitsReadout');if(!box)return;const l=operationalLimits,checks=operationalLimitChecks();const field=(label,key,unit)=>`<label class="text-[8px] text-slate-500">${label}<div class="flex items-center gap-1 mt-1"><input type="number" step="0.01" value="${Number.isFinite(l[key])?l[key]:''}" onchange="setOperationalLimit('${key}',this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"><span>${unit}</span></div></label>`;box.innerHTML=`<div class="flex items-center justify-between gap-2 mb-2"><label class="flex items-center gap-2 text-[9px]"><input type="checkbox" ${l.enabled?'checked':''} onchange="setOperationalLimit('enabled',this.checked)" class="accent-cyan-500"> Enable advisory checks</label><span class="text-[8px] ${l.source==='teaching'?'text-amber-300':'text-cyan-300'}">${escapeHtml(l.label||'User limits')}</span></div><div class="grid grid-cols-2 md:grid-cols-3 gap-2">${field('Min forward draft','minForwardDraft','m')}${field('Min aft draft','minAftDraft','m')}${field('Max draft','maxDraft','m')}${field('Min UKC','minUKC','m')}${field('Max list','maxList','°')}${field('Max trim','maxTrim','m')}</div><button onclick="applyTeachingOperationalLimits()" class="mt-2 px-2 py-1 rounded border border-amber-600/40 text-amber-300 text-[8px]">Use teaching defaults</button><div class="mt-2 space-y-1">${checks.length?checks.map(c=>`<div class="flex justify-between rounded px-2 py-1 ${c.pass?'bg-emerald-950/20 text-emerald-300':'bg-rose-950/25 text-rose-300'}"><span>${c.pass?'✓':'⚠'} ${c.name}</span><span class="font-mono">${c.actual.toFixed(2)} ${c.rule} ${c.limit.toFixed(2)}</span></div>`).join(''):'<div class="text-slate-500">Advisory checks are OFF. No operational limit is assumed.</div>'}</div><div class="mt-2 text-[8px] text-slate-500">Teaching defaults are representative only. Replace them with the vessel's approved draft, immersion, UKC and company/class limits.</div>`;}

function vesselDataCompleteness(){const tv=activeAMCOLTrainingVessel();if(tv){const real=!!tv.realSourceCalibrated,items=real?[
 {name:'Principal dimensions / summer draught',status:'source',weight:12},{name:'Hydrostatic table',status:'training',weight:18},{name:'KN / cross-curves',status:'training',weight:18},{name:'Cargo-space geometry/capacity',status:'training',weight:10},{name:'Ballast tank centres/FSM',status:'training',weight:10},{name:'Hull station / offset geometry',status:'training',weight:12},{name:'Downflooding openings',status:'missing',weight:8},{name:'Tank calibration / sounding tables',status:(tv.tankCalibration||[]).length?'training':'missing',weight:6},{name:'Allowable SF/BM envelopes',status:(tv.structuralLimits||[]).length?'training':'missing',weight:6}
 ]:[
 {name:'Principal dimensions',status:'training',weight:12},{name:'Hydrostatic table',status:'training',weight:18},{name:'KN / cross-curves',status:'training',weight:18},{name:'Cargo hold centres/capacities',status:'training',weight:10},{name:'Ballast tank centres/FSM',status:'training',weight:10},{name:'Hull station / offset geometry',status:'training',weight:12},{name:'Downflooding openings',status:'training',weight:8},{name:'Tank calibration / sounding tables',status:(tv.tankCalibration||[]).length?'training':'missing',weight:6},{name:'Allowable SF/BM envelopes',status:(tv.structuralLimits||[]).length?'training':'missing',weight:6}
 ];return {items,score:real?12:0,trainingScore:items.filter(i=>i.status==='training').reduce((sum,i)=>sum+i.weight,0),realCalibrated:real};}
 const hp=hydroPack(),pv=physicsValidity(),ref=Object.values(referenceVesselPresets||{}).find(r=>r.vesselName===state.vesselName),ch=window.AMCOL_CUSTOM_HULL_FORM,custom=!!(ch?.enabled&&(!ch.vesselName||ch.vesselName===state.vesselName));const exactDf=hp.kind==='uploadedBundle'&&(Number.isFinite(+hp.downfloodPort)||Number.isFinite(+hp.downfloodStarboard));const items=[{name:'Principal dimensions',status:ref||state.sourceConditionKey?'source':'model',weight:12},{name:'Hydrostatic table',status:pv.hydro?'source':'model',weight:18},{name:'KN / cross-curves',status:pv.kn?'source':'model',weight:18},{name:'Cargo hold centres/capacities',status:isGreatFortuneWorkbookVessel()?'source':'representative',weight:10},{name:'Ballast tank centres/FSM',status:state.ballastPlanSource==='vessel'&&ballastTanks.length?'source':'representative',weight:10},{name:'Hull station / offset geometry',status:custom?'user':'representative',weight:12},{name:'Downflooding openings',status:exactDf?'source':'representative',weight:8},{name:'Tank calibration / sounding tables',status:'missing',weight:6},{name:'Allowable SF/BM envelopes',status:'missing',weight:6}];const score=items.reduce((sum,i)=>sum+(i.status==='source'?i.weight:i.status==='user'?i.weight*.7:0),0);return {items,score:Math.round(score)};}
function fieldAuthorityMatrix(){
 const p=hydroPack(),tv=activeAMCOLTrainingVessel(),great=isGreatFortuneWorkbookVessel(),realCal=!!tv?.realSourceCalibrated,user=!!tv?.userImported,sourceCond=String(state.sourceConditionKey||'');
 const sourceHyd=!!hydroTableAtCurrentDisplacement(),knSource=(p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length));
 const exactDf=(p.kind==='uploadedBundle')&&(Number.isFinite(+p.downfloodPort)||Number.isFinite(+p.downfloodStarboard))&&!/representative|deck.?edge|training/i.test(String(p.downfloodBasis||p.note||''));
 const row=(field,status,detail)=>({field,status,detail});
 const dimStatus=user?'USER IMPORTED':realCal?'SOURCE':great?'MIXED':tv?'TRAINING':'REPRESENTATIVE';
 const hydroStatus=user?'USER IMPORTED':realCal?'CALIBRATED':great&&sourceHyd?'SOURCE':tv?'TRAINING':sourceHyd?'SOURCE':'MODELLED';
 const knStatus=user?(p.knRows?.length?'USER IMPORTED':'NOT AVAILABLE'):realCal?'CALIBRATED':great&&knSource?'SOURCE':tv?'TRAINING':knSource?'SOURCE':'MODELLED';
 const endDraftStatus=great&&sourceCond==='great_fortune_workbook'?'SOURCE':user?'DERIVED':realCal?'DERIVED':tv?'TRAINING DERIVED':'DERIVED';
 const tankStatus=great?'NOT AVAILABLE':user?(tv?.tankCalibration?.length?'USER IMPORTED':'NOT AVAILABLE'):realCal?'CALIBRATED':tv?'TRAINING':'REPRESENTATIVE';
 const structural=user?(tv?.structuralLimits?.length?'USER IMPORTED':'NOT AVAILABLE'):(tv&&window.AMCOL_ACTIVE_STRUCTURAL_LIMITS?.length)?'TRAINING':'NOT AVAILABLE';
 return [
  row('Principal dimensions',dimStatus,great?'LBP/source condition is workbook-backed; beam/depth retain source-informed teaching geometry unless approved particulars are supplied.':realCal?'Published/company/class dimensions are source anchors.':user?'Values supplied by the imported vessel package; source verification remains the user/instructor responsibility.':tv?'AMCOL educational vessel design values.':'Family/reference dimensions with modelling boundary.'),
  row('Current mean draught',hydroStatus,realCal?'Calculated from AMCOL-calibrated hydrostatics anchored to published summer draught.':great?'Interpolated from the supplied GREAT FORTUNE hydrostatic table when within range.':'Current hydrostatic calculation authority.'),
  row('Forward / aft draught & trim',endDraftStatus,great&&sourceCond==='great_fortune_workbook'?'FWD 7.201 m, AFT 8.637 m and 1.436 m by stern are source-workbook condition values.':realCal?'Condition-dependent outputs derived from displacement, LCG/LCB, MCT1cm and LCF; not published ONE/RCL operating draughts.':user?'Derived by the simulator from the imported hydrostatic/weight condition unless explicitly identified in the package as an approved condition.':'Condition-dependent simulator result.'),
  row('Upright hydrostatic table',hydroStatus,p.source||p.label||'Active hydrostatic model'),
  row('KN / large-angle stability',knStatus,knStatus==='NOT AVAILABLE'?'No ship-specific KN dataset is loaded.':(p.source||p.label||'Active large-angle model')),
  row('Tank calibration / sounding',tankStatus,great?'The supplied GREAT FORTUNE workbook has tank masses/VCG/FSM but no sounding/calibration book; conversion remains disabled.':realCal?'AMCOL reconstructed training tank tables; not official operator/class sounding books.':user?'Imported tank calibration rows.':'Training/representative tank basis.'),
  row('Hull stations / offsets',user?'USER IMPORTED':tv?(realCal?'CALIBRATED':'TRAINING'):(window.AMCOL_CUSTOM_HULL_FORM?.enabled?'USER IMPORTED':'REPRESENTATIVE'),user?'Imported station envelope.':tv?'Shared geometry kernel uses the active training/calibrated station envelope for damage/strength visuals; source hydro/KN remain authoritative where loaded.':'Shared representative family geometry kernel.'),
  row('Downflooding openings',exactDf?'SOURCE':'NOT AVAILABLE',exactDf?'Explicit vessel opening/downflooding data loaded.':'No approved opening coordinates are loaded; representative/deck-edge cues do not control statutory-style PASS/FAIL.'),
  row('Allowable SF/BM limits',structural,structural==='TRAINING'?'AMCOL-derived educational envelopes; not class permissible values.':structural==='USER IMPORTED'?'Imported limits; approval/source status must be verified by instructor.':'No approved structural envelope loaded.'),
  row('Damage subdivision/connectivity',user&&tv?.damageCompartments?.length?'USER IMPORTED':'REPRESENTATIVE','Damage exposure is a teaching model. Progressive flooding is propagated only when explicit compartment connections are supplied; missing doors/ducts/cross-flooding paths are never invented.')
 ];
}
function renderDataAuthority(){
 const box=document.getElementById('dataAuthorityReadout');if(!box)return;
 const p=hydroPack(),hr=hydroTableAtCurrentDisplacement(),tv=activeAMCOLTrainingVessel();
 const largeSource=(p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length));
 const tankStatus=state.ballastPlanSource==='training'?'AMCOL TRAINING':state.ballastPlanSource==='vessel'?'VESSEL / IMPORTED':state.ballastPlanSource==='representative-template'||state.ballastPlanSource==='representative'?'REPRESENTATIVE':'CUSTOM / NONE';
 const realCal=!!tv?.realSourceCalibrated,rows=[
  {n:'Upright hydrostatics',b:realCal?'AMCOL CALIBRATED':hr?'SOURCE DATA':tv?'AMCOL TRAINING':'MODELLED',c:realCal?'training':hr?'good':tv?'training':'model',s:realCal?'Source-anchored reconstructed hydrostatics; not class-approved':hr?(p.source||p.label):tv?'AMCOL synthetic/derived training hydrostatics':'Procedural geometry hydrostatics'},
  {n:'Large-angle GZ / KN',b:realCal?'AMCOL CALIBRATED KN':largeSource?'SOURCE / TABLE':tv?'AMCOL TRAINING':'MODELLED',c:realCal?'training':largeSource?'good':tv?'training':'model',s:realCal?'AMCOL-derived KN with KN↔KMT small-angle consistency calibration':largeSource?(p.source||p.label):tv?'AMCOL training KN/cross-curve dataset':'Procedural nonlinear geometry model'},
  {n:'Ballast tank plan',b:tankStatus,c:state.ballastPlanSource==='vessel'?'good':state.ballastPlanSource==='training'?'training':'model',s:state.ballastPlanLabel||'No active tank plan'},
  {n:'Structural SF/BM limits',b:(tv&&window.AMCOL_ACTIVE_STRUCTURAL_LIMITS?.length)?'AMCOL TRAINING':'NOT APPROVED',c:(tv&&window.AMCOL_ACTIVE_STRUCTURAL_LIMITS?.length)?'training':'warn',s:(tv&&window.AMCOL_ACTIVE_STRUCTURAL_LIMITS?.length)?'Training limit rows loaded; not class permissible values.':'No approved permissible SF/BM limits are loaded.'}
 ];
 const cls={good:'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',training:'border-violet-500/30 bg-violet-500/10 text-violet-300',model:'border-amber-500/30 bg-amber-500/10 text-amber-300',warn:'border-rose-500/30 bg-rose-500/10 text-rose-300'};
 const libs=`Chart.js ${typeof window.Chart==='function'?'READY':'MISSING'} · 3D ${window.AMCOL3D?'READY':'CDN / NOT INITIALISED'}`,a=physicsAuthority();
 const matrix=fieldAuthorityMatrix(),tone={SOURCE:'text-emerald-300 border-emerald-700/40',CALIBRATED:'text-cyan-300 border-cyan-700/40',DERIVED:'text-amber-300 border-amber-700/40','TRAINING DERIVED':'text-violet-300 border-violet-700/40',TRAINING:'text-violet-300 border-violet-700/40','USER IMPORTED':'text-sky-300 border-sky-700/40',MIXED:'text-amber-200 border-amber-700/40',REPRESENTATIVE:'text-amber-300 border-amber-700/40',MODELLED:'text-amber-300 border-amber-700/40','NOT AVAILABLE':'text-rose-300 border-rose-800/40'};
 box.innerHTML=`<div class="mb-2 rounded-lg border border-cyan-500/25 bg-cyan-950/20 p-2"><div class="flex items-center justify-between gap-2"><span class="font-black text-cyan-300">PHYSICS AUTHORITY · LEVEL ${a.level}</span><span class="text-[8px] font-bold text-slate-200">${escapeHtml(a.label)}</span></div><div class="mt-1 text-[8px] text-slate-500">${escapeHtml(a.detail)} Source data are never extrapolated outside their declared displacement/angle envelope; the simulator falls back to a visibly modelled calculation instead.</div></div>`+rows.map(r=>`<div class="data-authority-row"><div><div class="font-bold text-slate-200">${escapeHtml(r.n)}</div><div class="src">${escapeHtml(r.s)}</div></div><span class="data-authority-badge ${cls[r.c]||cls.model}">${escapeHtml(r.b)}</span></div>`).join('')+`<details class="mt-2 rounded-lg border border-slate-800 bg-slate-950/55 p-2"><summary class="cursor-pointer font-bold text-slate-300">Field-level authority matrix</summary><div class="mt-2 space-y-1">${matrix.map(r=>`<div class="grid grid-cols-[1fr_auto] gap-2 rounded border border-slate-800 bg-slate-950/70 p-2"><div><b>${escapeHtml(r.field)}</b><div class="text-[8px] text-slate-500">${escapeHtml(r.detail)}</div></div><span class="h-fit rounded border px-1.5 py-0.5 text-[7px] font-black ${tone[r.status]||tone.MODELLED}">${escapeHtml(r.status)}</span></div>`).join('')}</div></details><div class="mt-2 text-[8px] text-slate-500">Authority labels describe the current calculation source. They do not convert training/model/imported data into approved operational data.<br><span class="text-cyan-400">Runtime libraries:</span> ${escapeHtml(libs)}. When served over HTTP, the v2.0 Stable service worker caches local files and successfully fetched runtime dependencies for subsequent offline use. First-time fully offline use still requires locally vendored CDN libraries.</div>`;
}
function renderDataCompleteness(){const box=document.getElementById('dataCompletenessReadout');if(!box)return;const r=vesselDataCompleteness(),training=Number.isFinite(r.trainingScore),cls=x=>x==='source'?'text-emerald-300':x==='training'?'text-violet-300':x==='user'?'text-cyan-300':x==='representative'?'text-amber-300':'text-rose-300';if(training){const title=r.realCalibrated?'Source-anchored + calibrated dataset':'AMCOL training-dataset completeness',score=r.realCalibrated?r.score+r.trainingScore:r.trainingScore,note=r.realCalibrated?'Green = public source anchor · violet = AMCOL calibrated/derived · red = unavailable source data.':'Complete educational dataset · NOT source/class-approved data.';box.innerHTML=`<div class="flex items-end justify-between gap-3"><div><div class="text-[8px] uppercase text-slate-500">${title}</div><div class="text-2xl font-black ${r.realCalibrated?'text-cyan-300':'text-violet-300'}">${score}%</div></div><div class="text-[8px] text-amber-300 text-right">${note}</div></div><div class="mt-2 grid md:grid-cols-2 gap-1">${r.items.map(i=>`<div class="flex justify-between rounded bg-slate-950/70 border border-slate-800 px-2 py-1"><span>${i.name}</span><span class="font-bold uppercase ${cls(i.status)}">${i.status}</span></div>`).join('')}</div>`;return;}box.innerHTML=`<div class="flex items-end justify-between gap-3"><div><div class="text-[8px] uppercase text-slate-500">Source-backed completeness</div><div class="text-2xl font-black ${r.score>=70?'text-emerald-300':r.score>=40?'text-amber-300':'text-rose-300'}">${r.score}%</div></div><div class="text-[8px] text-slate-500 text-right">Representative geometry does not increase<br>the source-backed score.</div></div><div class="mt-2 grid md:grid-cols-2 gap-1">${r.items.map(i=>`<div class="flex justify-between rounded bg-slate-950/70 border border-slate-800 px-2 py-1"><span>${i.name}</span><span class="font-bold uppercase ${cls(i.status)}">${i.status}</span></div>`).join('')}</div>`;}
function renderAMCOLTrainingDataPanel(){const box=document.getElementById('amcolTrainingDataReadout');if(!box)return;const v=activeAMCOLTrainingVessel();if(!v){box.innerHTML='<span class="text-slate-500">Load an AMCOL Training Vessel or a source-anchored calibrated real vessel from Ship → Reference Vessel Library to activate its complete training dataset.</span>';return;}const pp=v.principalParticulars||{},c=(v.loadingConditions||[])[0]||{},s=state.strength,realCal=!!v.realSourceCalibrated;box.innerHTML=`<div class="flex items-center justify-between gap-2"><div><div class="font-black ${realCal?'text-cyan-300':'text-violet-300'}">${realCal?`${escapeHtml(v.companyName)} · `:''}${escapeHtml(v.name)}</div><div class="text-slate-500">${escapeHtml(v.typeLabel||v.family)} · ${realCal?'SOURCE-ANCHORED AMCOL CALIBRATED MODEL':'AMCOL TRAINING MODEL'}</div></div><span class="rounded-full border ${realCal?'border-cyan-500/30 bg-cyan-500/10 text-cyan-300':'border-violet-500/30 bg-violet-500/10 text-violet-300'} px-2 py-1 font-bold">${realCal?'CALIBRATED DATA':'TRAINING DATA'}</span></div><div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1"><div class="rounded bg-slate-950 p-2">Hydro<br><b>${v.hydrostatics?.length||0} rows</b></div><div class="rounded bg-slate-950 p-2">KN<br><b>${v.knCrossCurves?.length||0} rows</b></div><div class="rounded bg-slate-950 p-2">Cargo<br><b>${v.cargoSpaces?.length||0} spaces</b></div><div class="rounded bg-slate-950 p-2">Ballast<br><b>${v.ballastTanks?.length||0} tanks</b></div><div class="rounded bg-slate-950 p-2">Tank calibration<br><b>${v.tankCalibration?.length||0} rows</b></div><div class="rounded bg-slate-950 p-2">Hull envelope<br><b>${v.stationEnvelope?.length||0} stations</b></div><div class="rounded bg-slate-950 p-2">SF/BM envelope<br><b>${v.structuralLimits?.length||0} rows</b></div><div class="rounded bg-slate-950 p-2">Conditions<br><b>${v.loadingConditions?.length||0}</b></div></div><div class="mt-2 rounded border border-slate-800 bg-slate-950/70 p-2"><b class="text-cyan-300">Loaded Departure target:</b> Δ ${(Number(c.displacement)||0).toFixed(0)} t · mean draft ${(Number(c.meanDraft)||0).toFixed(3)} m · F/A ${(Number(c.draftForward)||Number(c.meanDraft)||0).toFixed(3)} / ${(Number(c.draftAft)||Number(c.meanDraft)||0).toFixed(3)} m · trim F−A ${(Number(c.trimForwardMinusAft)||0).toFixed(3)} m · KGc ${(Number(c.correctedKG)||0).toFixed(3)} m · GM ${(Number(c.GM)||0).toFixed(3)} m.<br>${realCal?`<span class="text-amber-200"><b>Draft authority:</b> published source gives summer mean draught only; FWD/AFT/trim targets are AMCOL-derived unless an approved loading condition is supplied.</span><br>`:''}<b>Current simulator:</b> Δ ${Number.isFinite(state.dispMass)?state.dispMass.toFixed(0):'—'} t · mean/F/A ${Number.isFinite(state.eqDraft)?state.eqDraft.toFixed(3):'—'} / ${Number.isFinite(state.draftBow)?state.draftBow.toFixed(3):'—'} / ${Number.isFinite(state.draftStern)?state.draftStern.toFixed(3):'—'} m · trim F−A ${Number.isFinite(state.trimMeters)?state.trimMeters.toFixed(3):'—'} m · KGc ${Number.isFinite(state.kgCorr)?state.kgCorr.toFixed(3):'—'} m · GM ${Number.isFinite(state.gm)?state.gm.toFixed(3):'—'} m.</div><div class="mt-2 text-amber-200">${escapeHtml(v.statutoryDisclaimer||'AMCOL TRAINING MODEL — educational use only.')}</div>`;}

function hullStationTemplate(){return `x_norm,beam_factor,bottom_factor,sheer_ratio,keel_rise_ratio\n-1.00,0.72,0.45,0.010,0.000\n-0.70,1.00,0.72,0.000,0.000\n0.40,1.00,0.72,0.000,0.000\n0.65,0.99,0.70,0.015,0.005\n0.80,0.94,0.61,0.040,0.020\n0.90,0.76,0.44,0.080,0.060\n0.97,0.38,0.22,0.125,0.115\n1.00,0.06,0.07,0.150,0.150`;}
function downloadHullStationTemplate(){downloadText('AMCOL_hull_station_envelope_template.csv',hullStationTemplate(),'text/csv');}
async function importHullStationEnvelope(files){const file=files?.[0];if(!file)return;try{const rows=csvParse(await file.text());const stations=rows.map(r=>({xNorm:nFrom(r,['xnorm','x_norm','stationnorm','longitudinalnorm']),beamFactor:nFrom(r,['beamfactor','beam_factor','deckbeamfactor']),bottomFactor:nFrom(r,['bottomfactor','bottom_factor']),sheerRatio:nFrom(r,['sheerratio','sheer_ratio']),keelRiseRatio:nFrom(r,['keelriseratio','keel_rise_ratio'])})).filter(r=>Number.isFinite(r.xNorm)&&Number.isFinite(r.beamFactor)&&Number.isFinite(r.bottomFactor)).sort((a,b)=>a.xNorm-b.xNorm);if(stations.length<5)throw new Error('At least five valid station-envelope rows are required.');window.AMCOL_CUSTOM_HULL_FORM={enabled:true,label:file.name,vesselName:state.vesselName||'',hullType:state.hullType,stations};window.AMCOL3D?.invalidateHull?.();calculateAll({curve:false});renderHullEnvelopeStatus();renderDataCompleteness();showCleanFeedback('Custom hull station envelope loaded for the current vessel visual.');}catch(e){alert('Hull station-envelope import failed: '+e.message);}}
function clearHullStationEnvelope(){window.AMCOL_CUSTOM_HULL_FORM=null;window.AMCOL3D?.invalidateHull?.();renderHullEnvelopeStatus();renderDataCompleteness();}
function renderHullEnvelopeStatus(){const box=document.getElementById('hullEnvelopeStatus');if(!box)return;const c=window.AMCOL_CUSTOM_HULL_FORM,applies=!!(c?.enabled&&(!c.vesselName||c.vesselName===state.vesselName));box.innerHTML=applies?`<span class="${c.trainingModel?'text-violet-300':'text-cyan-300'} font-bold">${c.trainingModel?'AMCOL TRAINING STATION ENVELOPE':'CUSTOM STATION ENVELOPE'}</span> · ${escapeHtml(c.label||'Imported')} · ${c.stations?.length||0} stations<br><span class="text-slate-500">Applied to ${escapeHtml(state.vesselName||state.hullType)}. 3D/distributed-geometry teaching envelope only; it does not replace approved hydrostatic/KN data.</span>`:c?.enabled?`<span class="text-slate-400 font-bold">CUSTOM ENVELOPE SAVED · NOT ACTIVE FOR THIS VESSEL</span><br><span class="text-slate-500">The imported envelope belongs to ${escapeHtml(c.vesselName||c.hullType||'another vessel')}.</span>`:`<span class="text-amber-300 font-bold">VESSEL-FAMILY STATION ENGINE</span><br><span class="text-slate-500">The 3D hull uses family-specific fair station curves. Exact vessel offsets are not loaded.</span>`;}

function renderDownfloodBasis(){const box=document.getElementById('downfloodBasisReadout');if(!box)return;box.innerHTML=`<div class="grid grid-cols-2 gap-2"><div class="rounded bg-slate-950 p-2"><div class="text-slate-500">Starboard opening</div><div class="font-mono text-cyan-300">${Number.isFinite(downfloodAngle)?downfloodAngle.toFixed(1)+'°':'—'}</div><div class="text-[8px] text-slate-500">${escapeHtml(state.downfloodBasisStarboard||'not available')}</div></div><div class="rounded bg-slate-950 p-2"><div class="text-slate-500">Port opening</div><div class="font-mono text-cyan-300">${Number.isFinite(downfloodAnglePort)?downfloodAnglePort.toFixed(1)+'°':'—'}</div><div class="text-[8px] text-slate-500">${escapeHtml(state.downfloodBasisPort||'not available')}</div></div></div><div class="mt-2 text-[8px] text-slate-500">Deck-edge immersion is tracked separately (${Number.isFinite(deckEdgeAngle)?deckEdgeAngle.toFixed(1)+'° STBD':'—'} / ${Number.isFinite(deckEdgeAnglePort)?deckEdgeAnglePort.toFixed(1)+'° PORT':'—'}). Uploaded/source vessel opening angles override representative openings. <b>Representative openings and deck-edge fallbacks are display/teaching boundaries only and do not truncate the intact-stability audit.</b></div>`;}


let lastReleaseAcceptanceReport=null;
function acceptanceCheck(name,status,detail='',level='required'){return {name,status:!!status,detail:String(detail||''),level};}
function measureAcceptanceFPS(durationMs=900){
 return new Promise(resolve=>{
  if(typeof requestAnimationFrame!=='function'){resolve({fps:0,frames:0,duration:0});return;}
  let frames=0,start=performance.now(),last=start;
  const tick=now=>{frames++;last=now;if(now-start>=durationMs){resolve({fps:frames*1000/Math.max(1,now-start),frames,duration:now-start});return;}requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 });
}
async function runReleaseAcceptanceSuite(){
 const box=document.getElementById('releaseAcceptanceReadout');if(!box)return;
 box.innerHTML='<div class="text-cyan-300 font-bold"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Running classroom hardware acceptance checks…</div>';
 const checks=[];
 checks.push(acceptanceCheck('Modern browser APIs',typeof Promise!=='undefined'&&typeof URL!=='undefined'&&typeof Blob!=='undefined'&&typeof fetch==='function','Promise / URL / Blob / fetch','required'));
 let canvas2d=false;try{const c=document.createElement('canvas');canvas2d=!!c.getContext('2d');}catch(_){}checks.push(acceptanceCheck('Canvas 2D',canvas2d,canvas2d?'Available':'Unavailable','required'));
 let storage=false;try{const k='__amcol_acceptance__';localStorage.setItem(k,'1');storage=localStorage.getItem(k)==='1';localStorage.removeItem(k);}catch(_){}checks.push(acceptanceCheck('Local storage',storage,storage?'Read/write OK':'Blocked or unavailable','recommended'));
 checks.push(acceptanceCheck('Chart.js',typeof window.Chart!=='undefined',typeof window.Chart!=='undefined'?'Loaded':'Not loaded — charts may fail','required'));
 let glType='';try{const c=document.createElement('canvas');if(c.getContext('webgl2'))glType='WebGL2';else if(c.getContext('webgl')||c.getContext('experimental-webgl'))glType='WebGL1';}catch(_){}checks.push(acceptanceCheck('WebGL',!!glType,glType||'Unavailable — 3D view cannot run','required'));
 checks.push(acceptanceCheck('3D module',!!window.AMCOL3D,window.AMCOL3D?(window.AMCOL3D.ready?'Loaded and scene ready':'Module loaded; enter 3D once if scene is not yet initialised'):'Three.js module did not load','required'));
 let workerOK=false,workerDetail='Unavailable';try{if(window.AMCOLPhysicsWorker?.call){const r=await window.AMCOLPhysicsWorker.call('mass.aggregate',{lightship:{mass:100,kg:5,tcg:0,lcg:0},items:[{mass:20,vcg:10,tcg:1,lcg:2}]},2500);workerOK=Math.abs((r?.mass||0)-120)<1e-9&&Math.abs((r?.kgSolid||0)-5.8333333333)<1e-6;workerDetail=workerOK?'Worker numerical round-trip OK':'Worker returned an unexpected result';}}catch(e){workerDetail=String(e?.message||e);}checks.push(acceptanceCheck('Physics Web Worker',workerOK,workerDetail,'recommended'));
 const fps=await measureAcceptanceFPS(900);const fpsOK=fps.fps>=28;checks.push(acceptanceCheck('Browser animation cadence',fpsOK,`${fps.fps.toFixed(1)} FPS sample`, 'recommended'));
 const required=checks.filter(c=>c.level==='required'),recommended=checks.filter(c=>c.level!=='required');
 const requiredPass=required.every(c=>c.status),recommendedPass=recommended.filter(c=>c.status).length;
 const overall=requiredPass?(recommendedPass===recommended.length?'ACCEPTED':'ACCEPTED WITH ADVISORY'):'NOT ACCEPTED';
 const report={product:'AMCOL Advanced Ship Stability & Hydrostatic Simulator',version:'2.0.0 Stable',timestamp:new Date().toISOString(),overall,userAgent:navigator.userAgent,locationProtocol:location.protocol,checks};lastReleaseAcceptanceReport=report;
 const tone=overall==='ACCEPTED'?'text-emerald-300':overall==='ACCEPTED WITH ADVISORY'?'text-amber-300':'text-rose-300';
 box.innerHTML=`<div class="font-bold ${tone} mb-2">${overall}</div><div class="text-[8px] text-slate-500 mb-2">Run this on each AMCOL classroom computer after browser/GPU updates. A WebGL failure affects 3D only; 2D and numerical physics remain separate.</div>${checks.map(c=>`<div class="flex items-start justify-between gap-2 rounded px-2 py-1 ${c.status?'bg-emerald-950/20':'bg-rose-950/25'}"><span>${c.status?'✓':'✕'} ${escapeHtml(c.name)} <span class="text-[7px] text-slate-500">${c.level.toUpperCase()}</span></span><span class="text-right text-[8px] ${c.status?'text-slate-300':'text-rose-300'}">${escapeHtml(c.detail)}</span></div>`).join('')}<button onclick="exportReleaseAcceptanceReport()" class="mt-2 w-full py-1.5 rounded border border-cyan-700/50 text-cyan-300 font-bold">Export Acceptance Report</button>`;
 if(typeof showCleanFeedback==='function')showCleanFeedback(`Release acceptance: ${overall}`);
}
function exportReleaseAcceptanceReport(){
 if(!lastReleaseAcceptanceReport){runReleaseAcceptanceSuite();return;}
 const r=lastReleaseAcceptanceReport,lines=[`${r.product} · v${r.version}`,'CLASSROOM RELEASE ACCEPTANCE REPORT',`Time: ${r.timestamp}`,`Result: ${r.overall}`,`Browser: ${r.userAgent}`,`Protocol: ${r.locationProtocol}`,'',...r.checks.map(c=>`${c.status?'PASS':'FAIL'} · ${c.name} · ${c.level.toUpperCase()} · ${c.detail}`),'','Acceptance scope: browser/GPU/runtime readiness only. It does not convert calibrated or training vessel data into class-approved data.'];
 const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`AMCOL_v2.0_Classroom_Acceptance_${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function runPhysicsValidationSuite(){const box=document.getElementById('physicsValidationReadout');if(!box)return;if(unifiedMission?.active){box.innerHTML='<span class="text-amber-300">Exit the active mission before running diagnostics.</span>';return;}const saved=makeConditionSnapshot('__diagnostic_restore__');const rows=[];try{loadGreatFortuneWorkbookCondition();const t=GREAT_FORTUNE_WORKBOOK_DATA.target;const test=(n,a,b,tol,u)=>rows.push({n,a,b,tol,u,pass:Math.abs(a-b)<=tol});test('GREAT FORTUNE displacement',state.dispMass,t.disp,1,'t');test('GREAT FORTUNE corrected GM',state.gm,t.gmCondition,.03,'m');test('GREAT FORTUNE fwd draft',state.draftBow,t.draftFwd,.04,'m');test('GREAT FORTUNE aft draft',state.draftStern,t.draftAft,.04,'m');test('GREAT FORTUNE list',state.equilibrium,t.listStarboard,.05,'°');const baseMoment=state.environmentMoment;state.windEnabled=false;state.currentEnabled=true;state.currentSpeedKts=2;state.currentDirection='port_to_starboard';calculateAll();const plus=state.equilibrium;state.currentDirection='starboard_to_port';calculateAll();const minus=state.equilibrium;rows.push({n:'Current-direction symmetry',a:plus+minus,b:0,tol:.08,u:'° sum',pass:Math.abs(plus+minus)<=.08});}catch(e){rows.push({n:'Runtime diagnostic',a:NaN,b:0,tol:0,u:e.message,pass:false});}finally{restoreConditionSnapshot(saved,{announce:false});}box.innerHTML=`<div class="font-bold mb-2 ${rows.every(r=>r.pass)?'text-emerald-300':'text-rose-300'}">${rows.every(r=>r.pass)?'ALL CORE CHECKS PASSED':'CHECKS REQUIRE ATTENTION'}</div>${rows.map(r=>`<div class="flex justify-between gap-2 rounded px-2 py-1 ${r.pass?'bg-emerald-950/20':'bg-rose-950/25'}"><span>${r.pass?'✓':'✕'} ${r.n}</span><span class="font-mono">${Number.isFinite(r.a)?r.a.toFixed(3):'ERROR'} ${r.u||''}</span></div>`).join('')}`;}
function runVesselDataRegressionSuite(){
 const box=document.getElementById('vesselDataRegressionReadout');if(!box)return;const results=[];
 const lerp=(rows,x,key)=>{const rr=rows.slice().sort((a,b)=>a.disp-b.disp);for(let i=1;i<rr.length;i++)if(rr[i].disp>=x){const a=rr[i-1],b=rr[i],t=(x-a.disp)/(b.disp-a.disp||1);return a[key]+t*(b[key]-a[key]);}return rr.at(-1)?.[key];};
 (AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).forEach(v=>{const h=v.hydrostatics||[],k=v.knCrossCurves||[],conds=v.loadingConditions||[],name=v.realSourceCalibrated?`${v.companyName} · ${v.name}`:v.name;let issues=[];if(h.some((r,i)=>i&&(!(r.draft>h[i-1].draft)||!(r.disp>h[i-1].disp))))issues.push('non-monotonic hydro');const levels=[...new Set(k.map(r=>r.disp))];let maxErr=0;levels.forEach(d=>{const r5=k.find(r=>r.disp===d&&r.angle===5),kmt=lerp(h,d,'kmt');if(r5&&Number.isFinite(kmt)){const err=Math.abs(100*((r5.kn/Math.sin(5*Math.PI/180))/kmt-1));maxErr=Math.max(maxErr,err);}});if(levels.length&&maxErr>2)issues.push(`KN/KMT ${maxErr.toFixed(2)}%`);conds.forEach(c=>{const mass=(+c.lightshipMass||0)+(+c.cargoMass||0)+(+c.ballastMass||0)+(+c.consumablesMass||0);if(Math.abs(mass-(+c.displacement||0))>1)issues.push(`${c.name} mass closure`);if(Number.isFinite(+c.draftForward)&&Number.isFinite(+c.draftAft)&&Math.abs((+c.draftForward)-(+c.draftAft)-(+c.trimForwardMinusAft))>.002)issues.push(`${c.name} F/A trim closure`);});results.push({name,pass:!issues.length,maxErr,issues});});
 box.innerHTML=`<div class="font-bold mb-2 ${results.every(r=>r.pass)?'text-emerald-300':'text-rose-300'}">${results.every(r=>r.pass)?'ALL VESSEL DATA CHECKS PASSED':'VESSEL DATA CHECKS REQUIRE ATTENTION'}</div>${results.map(r=>`<div class="rounded px-2 py-1 ${r.pass?'bg-emerald-950/20 text-emerald-300':'bg-rose-950/25 text-rose-300'}"><b>${r.pass?'✓':'✕'} ${escapeHtml(r.name)}</b> · KN/KMT max ${r.maxErr.toFixed(2)}%${r.issues.length?` · ${escapeHtml(r.issues.join('; '))}`:''}</div>`).join('')}`;
}
function runChallengeRegressionSuite(){
 const box=document.getElementById('challengeRegressionReadout');if(!box)return;if(activeMissionLoaded()){box.innerHTML='<span class="text-amber-300">Exit the active mission before running challenge regression.</span>';return;}
 const saved=makeConditionSnapshot('__challenge_regression_restore__'),savedKey=document.getElementById('scenarioSelect')?.value||'free',results=[];
 box.innerHTML='<span class="text-cyan-300">Running 25 challenge/reference-solution checks…</span>';
 try{
  for(const key of Object.keys(challengeMeta)){
   const selector=document.getElementById('scenarioSelect');if(selector)selector.value=key;
   const sc=scenarios[key],ref=scenarioReferenceSolutions[key];let pass=false,msg='';
   try{
    if(!sc||typeof sc.apply!=='function'||!ref||typeof ref.apply!=='function')throw new Error('missing scenario/reference solution');
    vesselVisualTransaction=true;try{sc.apply();ensureCurrentVesselSpaceLayout({force:true,render:false});calculateAll();findAndSetEquilibrium();calculateAll({curve:false});}finally{vesselVisualTransaction=false;}
    challengeBaselineSnapshot=captureChallengeSnapshot();
    ref.apply();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});
    const o=challengeOutcome(key);pass=!!o?.pass;msg=pass?'reference solution reaches PASS':(o?.target?.message||o?.physical?.reasons?.join(' · ')||'reference solution did not pass');
   }catch(e){msg=e.message||String(e);pass=false;}
   results.push({key,pass,msg});
  }
 }finally{restoreConditionSnapshot(saved,{announce:false});const sel=document.getElementById('scenarioSelect');if(sel)sel.value=scenarios[savedKey]?savedKey:'free';updateMissionSelectorUI();challengeBaselineSnapshot=null;}
 const ok=results.filter(r=>r.pass).length;box.innerHTML=`<div class="font-bold mb-2 ${ok===results.length?'text-emerald-300':'text-rose-300'}">${ok}/${results.length} REFERENCE SOLUTIONS PASS THEIR CURRENT CHALLENGE LOGIC</div>${results.map(r=>`<div class="flex justify-between gap-2 rounded px-2 py-1 ${r.pass?'bg-emerald-950/20':'bg-rose-950/25'}"><span>${r.pass?'✓':'✕'} ${escapeHtml(r.key)}</span><span class="text-right text-[8px]">${escapeHtml(r.msg)}</span></div>`).join('')}`;
}


/* ================================================================
   v1.15.3 · BULK CARRIER DRAUGHT SURVEY + TRAINING MISSIONS + FORMAL TANK MEASUREMENT REPORT
   UN/ECE ECE/ENERGY/19-style educational workflow. The active
   vessel hydrostatic table remains the calculation authority.
   ================================================================ */
let draftSurveyResults={initial:null,final:null},draftSurveyValidationTarget=null;

/* v1.15.3 · Guided Draft Survey Training Missions.
   Mission truth is generated from the embedded AMCOL FORTUNE hydrostatic/tank model,
   then rounded to the same observations shown to students before grading. */
const DRAFT_SURVEY_TRAINING_MISSIONS={
  full_load:{title:'Mission A · Full Bulk Loading',level:'Foundation',vesselId:'AMCOL-FORTUNE',initialCondition:1,finalCondition:0,initialDensity:1.0250,finalDensity:1.0250,sideDelta:.006,operation:'The vessel completes a full bulk-cargo loading operation from ballast passage condition to loaded departure. Ballast is adjusted during loading. Determine the cargo loaded by draught survey.'},
  top_off:{title:'Mission B · Top-Off Loading',level:'Intermediate',vesselId:'AMCOL-FORTUNE',initialCondition:2,finalCondition:0,initialDensity:1.0250,finalDensity:1.0250,sideDelta:.007,operation:'The vessel arrives partly loaded, then receives the remaining bulk cargo and adjusts ballast/consumables before departure. Determine the additional cargo loaded.'},
  full_discharge:{title:'Mission C · Full Discharge',level:'Intermediate',vesselId:'AMCOL-FORTUNE',initialCondition:0,finalCondition:1,initialDensity:1.0250,finalDensity:1.0250,sideDelta:.005,operation:'The vessel discharges its bulk cargo and takes ballast for passage. Determine the cargo discharged from the Initial and Final surveys.'},
  dock_water:{title:'Mission D · Dock-Water Top-Off',level:'Advanced',vesselId:'AMCOL-FORTUNE',initialCondition:2,finalCondition:0,initialDensity:1.0100,finalDensity:1.0180,sideDelta:.008,toleranceScale:1,operation:'A top-off loading operation is surveyed in different dock-water densities. Apply density correction, tank soundings and changing deductibles before reporting cargo loaded.'}
};
const DRAFT_SURVEY_CUSTOM_MISSION_KEY='amcol_draft_survey_custom_missions_v1';
let draftSurveyCustomMissionKeys=[];
function loadDraftSurveyCustomMissions(){try{const rows=JSON.parse(localStorage.getItem(DRAFT_SURVEY_CUSTOM_MISSION_KEY)||'[]');if(Array.isArray(rows))rows.forEach((m,i)=>{if(!m?.title||!m?.vesselId)return;const key=m.key||`custom_${Date.now()}_${i}`;DRAFT_SURVEY_TRAINING_MISSIONS[key]={...m,key,custom:true};draftSurveyCustomMissionKeys.push(key);});}catch(e){console.warn('Custom draft missions unavailable',e);}}
function persistDraftSurveyCustomMissions(){try{localStorage.setItem(DRAFT_SURVEY_CUSTOM_MISSION_KEY,JSON.stringify(draftSurveyCustomMissionKeys.map(k=>({...DRAFT_SURVEY_TRAINING_MISSIONS[k],key:k}))));}catch(e){console.warn('Custom draft mission save failed',e);}}
let draftSurveyMissionState={active:false,key:'',truth:null,startedAt:null,grade:null,studentName:'',studentId:'',reportedCargo:'',reportedDirection:'LOADED',assisted:false};
function draftSurveyMissionRound(v,d=3){const x=Number(v);return Number.isFinite(x)?Number(x.toFixed(d)):NaN;}
function draftSurveyMissionTankTruth(v,condition,roleSeed=0){
  const tanks=(v.ballastTanks||[]),cal=v.tankCalibration||[],target=Math.max(0,Number(condition?.ballastMass)||0);
  const base=tanks.map(t=>({tank:t,cap:Math.max(0,Number(t.capacityTonnes??t.capacity)||0),baseMass:Math.max(0,Number(t.capacityTonnes??t.capacity)||0)*Math.max(0,Math.min(100,Number(t.fill)||0))/100}));
  const baseSum=base.reduce((s,x)=>s+x.baseMass,0),totalCap=base.reduce((s,x)=>s+x.cap,0);let masses=[];
  if(target<=baseSum+1e-8&&baseSum>0){const f=target/baseSum;masses=base.map(x=>x.baseMass*f);}
  else{const extra=Math.max(0,target-baseSum),headroom=Math.max(1e-9,totalCap-baseSum),ratio=Math.min(1,extra/headroom);masses=base.map(x=>x.baseMass+(x.cap-x.baseMass)*ratio);}
  const entries=tanks.map((t,i)=>{
    const cap=Math.max(.001,Number(t.capacityTonnes??t.capacity)||.001),vp=Math.max(0,Math.min(100,100*(masses[i]||0)/cap));
    let sp=AMCOLPhysics.tankSounding.soundingPercentFromVolumePercent(cal,t.id,vp);if(!Number.isFinite(sp))sp=vp;
    const mode=((i+roleSeed)%2===0)?'sounding':'ullage';let reading=AMCOLPhysics.tankSounding.readingFromSoundingPercent(mode,sp,t.height);reading=draftSurveyMissionRound(reading,2);
    return {tank:t,tankId:t.id,mode,reading,density:Number(t.density)||1.025,height:t.height,calibrationRows:cal};
  });
  const total=AMCOLPhysics.tankSounding.calculateMany(entries,cal);
  return {entries,total,targetMass:target};
}
function draftSurveyMissionRoleTruth(v,condition,density,sideDelta,roleSeed){
  const pp=v.principalParticulars||{},trimAft=-(Number(condition?.trim)||0),sol=AMCOLPhysics.draftSurveyMission.solveSurveyDraft({hydroRows:v.hydrostatics||[],tableDensity:Number(v.sourceDensity)||1.025,observedDensity:density,lbp:Number(pp.LBP)||177,displacement:Number(condition.displacement)||0,trimAft});
  if(!sol.valid)return {valid:false,reason:sol.reason};
  const raw=AMCOLPhysics.draftSurveyMission.observationReadings(sol.surveyDraft,trimAft,sideDelta)||{},readings={};Object.keys(raw).forEach(k=>readings[k]=draftSurveyMissionRound(raw[k],3));
  const tank=draftSurveyMissionTankTruth(v,condition,roleSeed),other=draftSurveyMissionRound(Number(condition.consumablesMass)||0,1);
  const result=AMCOLPhysics.draftSurvey.calculateSurvey({hydroRows:v.hydrostatics||[],tableDensity:Number(v.sourceDensity)||1.025,observedDensity:density,geometry:{lbp:Number(pp.LBP)||177,forwardMarkOffset:0,midshipMarkOffset:0,aftMarkOffset:0,keelThickness:0},readings,deductibles:{ballast:tank.total?.totalMassT||0,other}});
  return {valid:!!result.valid,conditionName:condition.name,density,readings,tank,other,result,nominalCargoMass:Number(condition.cargoMass)||0,trimAft,surveyDraft:sol.surveyDraft};
}
function buildDraftSurveyMissionTruth(key){
  const def=DRAFT_SURVEY_TRAINING_MISSIONS[key],v=def&&AMCOL_TRAINING_VESSELS_BY_ID[def.vesselId];if(!def||!v)return null;
  const ci=(v.loadingConditions||[])[def.initialCondition],cf=(v.loadingConditions||[])[def.finalCondition];if(!ci||!cf)return null;
  const initial=draftSurveyMissionRoleTruth(v,ci,def.initialDensity,def.sideDelta,0),final=draftSurveyMissionRoleTruth(v,cf,def.finalDensity,def.sideDelta,1);if(!initial.valid||!final.valid)return null;
  const cargo=AMCOLPhysics.draftSurvey.cargoDifference(initial.result,final.result),nominal=(Number(cf.cargoMass)||0)-(Number(ci.cargoMass)||0);
  return {def,v,initial,final,cargo:cargo.cargo,direction:cargo.direction,magnitude:cargo.magnitude,nominalCargo:nominal};
}
function draftSurveyMissionStart(key){
  const def=DRAFT_SURVEY_TRAINING_MISSIONS[key];if(!def)return;loadAMCOLTrainingVessel(def.vesselId);draftSurveyReset();
  const truth=buildDraftSurveyMissionTruth(key);if(!truth){alert('Mission truth could not be generated from the current training dataset.');return;}
  draftSurveyMissionState={active:true,key,truth,startedAt:Date.now(),grade:null,studentName:'',studentId:'',reportedCargo:'',reportedDirection:truth.cargo>=0?'LOADED':'DISCHARGED',assisted:false};draftSurveyValidationTarget=null;renderDraftSurveyMissionPanel();renderDraftSurveyResults();switchTab('draftSurvey');
}
function draftSurveyMissionExit(){draftSurveyMissionState={active:false,key:'',truth:null,startedAt:null,grade:null,studentName:'',studentId:'',reportedCargo:'',reportedDirection:'LOADED',assisted:false};renderDraftSurveyMissionPanel();}
function draftSurveyMissionField(field,value){if(!draftSurveyMissionState.active)return;draftSurveyMissionState[field]=value;}
function draftSurveyMissionReadingInput(role){const pre=role==='initial'?'dsInitial':'dsFinal';return {forwardPort:draftSurveyNum(pre+'FwdP'),forwardStarboard:draftSurveyNum(pre+'FwdS'),midshipPort:draftSurveyNum(pre+'MidP'),midshipStarboard:draftSurveyNum(pre+'MidS'),aftPort:draftSurveyNum(pre+'AftP'),aftStarboard:draftSurveyNum(pre+'AftS')};}
function draftSurveyMissionSubmit(){
  if(!draftSurveyMissionState.active||!draftSurveyMissionState.truth)return;
  draftSurveyMissionState.studentName=document.getElementById('dsMissionStudentName')?.value||draftSurveyMissionState.studentName||'';draftSurveyMissionState.studentId=document.getElementById('dsMissionStudentId')?.value||draftSurveyMissionState.studentId||'';draftSurveyMissionState.reportedCargo=document.getElementById('dsMissionReportedCargo')?.value??draftSurveyMissionState.reportedCargo;draftSurveyMissionState.reportedDirection=document.getElementById('dsMissionReportedDirection')?.value||draftSurveyMissionState.reportedDirection||'LOADED';
  calculateDraftSurveyUI();const t=draftSurveyMissionState.truth,c=AMCOLPhysics.draftSurvey.cargoDifference(draftSurveyResults.initial,draftSurveyResults.final),dir=draftSurveyMissionState.reportedDirection||'LOADED',mag=Math.abs(Number(draftSurveyMissionState.reportedCargo));const reported=Number.isFinite(mag)?(dir==='DISCHARGED'?-mag:mag):NaN;
  const entered={initialReadings:draftSurveyMissionReadingInput('initial'),finalReadings:draftSurveyMissionReadingInput('final'),initialDensity:draftSurveyNum('dsInitialDensity'),finalDensity:draftSurveyNum('dsFinalDensity'),initialBallast:draftSurveyTankTotals.initial?.validCount?draftSurveyTankTotals.initial.totalMassT:draftSurveyNum('dsInitialBallast'),finalBallast:draftSurveyTankTotals.final?.validCount?draftSurveyTankTotals.final.totalMassT:draftSurveyNum('dsFinalBallast'),initialOther:draftSurveyNum('dsInitialOther'),finalOther:draftSurveyNum('dsFinalOther'),calculatedCargo:c.valid?c.cargo:NaN,reportedCargo:reported};
  const truth={initialReadings:t.initial.readings,finalReadings:t.final.readings,initialDensity:t.initial.density,finalDensity:t.final.density,initialBallast:t.initial.tank.total.totalMassT,finalBallast:t.final.tank.total.totalMassT,initialOther:t.initial.other,finalOther:t.final.other,cargo:t.cargo};
  draftSurveyMissionState.grade=AMCOLPhysics.draftSurveyMission.gradeMission({truth,entered,toleranceScale:Number(t.def?.toleranceScale)||1});renderDraftSurveyMissionPanel();
}
function draftSurveyMissionCopyTankSheet(role){
  const t=draftSurveyMissionState.truth?.[role];if(!t)return;draftSurveyMissionState.assisted=true;const store={};t.tank.entries.forEach(e=>{store[e.tankId]={mode:e.mode,reading:e.reading,density:e.density};});draftSurveyTankEntries[role]=store;draftSurveyTankTotals[role]=null;draftSurveyRenderTankPanel(role,true);renderDraftSurveyMissionPanel();
}
function draftSurveyMissionObservationTable(role){
  const t=draftSurveyMissionState.truth?.[role];if(!t)return '';const r=t.readings,fmt=x=>Number(x).toFixed(3),tankRows=t.tank.entries.map((e,i)=>`<tr><td>${i+1}. ${escapeHtml(e.tank.name||e.tankId)}</td><td>${e.mode==='ullage'?'Ullage':'Sounding'}</td><td>${Number(e.reading).toFixed(2)} m</td><td>${Number(e.density).toFixed(4)}</td></tr>`).join('');
  return `<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2"><div><b class="${role==='initial'?'text-cyan-300':'text-emerald-300'}">${role.toUpperCase()} OBSERVATION SHEET</b><div class="text-[7px] text-slate-500">${escapeHtml(t.conditionName)} · water density ${t.density.toFixed(4)} t/m³ · Other/consumables deductible ${t.other.toFixed(1)} t</div></div><button onclick="draftSurveyMissionCopyTankSheet('${role}')" class="px-2 py-1 rounded border border-violet-600/40 text-violet-300 text-[7px]" title="Practice assist: copies only the tank readings into the sounding calculator">Copy tank sheet</button></div><table class="ds-observation-table mt-2"><tr><th>Station</th><th>Port m</th><th>Starboard m</th></tr><tr><td>Forward</td><td>${fmt(r.forwardPort)}</td><td>${fmt(r.forwardStarboard)}</td></tr><tr><td>Midship</td><td>${fmt(r.midshipPort)}</td><td>${fmt(r.midshipStarboard)}</td></tr><tr><td>Aft</td><td>${fmt(r.aftPort)}</td><td>${fmt(r.aftStarboard)}</td></tr></table><details class="mt-2 rounded border border-slate-800 p-2"><summary class="cursor-pointer text-[8px] font-bold text-amber-300">Tank sounding / ullage observation sheet · ${t.tank.entries.length} tanks</summary><div class="max-h-[250px] overflow-auto mt-1"><table class="ds-observation-table"><tr><th>Tank</th><th>Mode</th><th>Reading</th><th>ρ t/m³</th></tr>${tankRows}</table></div></details></div>`;
}
function draftSurveyMissionStepsHTML(){
  if(!draftSurveyMissionState.active)return '';const six=x=>Object.values(x).every(Number.isFinite),iDone=six(draftSurveyMissionReadingInput('initial'))&&Number.isFinite(draftSurveyNum('dsInitialDensity')),fDone=six(draftSurveyMissionReadingInput('final'))&&Number.isFinite(draftSurveyNum('dsFinalDensity')),tankDone=!!(draftSurveyTankTotals.initial?.validCount&&draftSurveyTankTotals.final?.validCount),calcDone=!!(draftSurveyResults.initial?.valid&&draftSurveyResults.final?.valid),reportDone=Number.isFinite(Number(draftSurveyMissionState.reportedCargo)),graded=!!draftSurveyMissionState.grade;
  const arr=[['1','Enter observations',iDone&&fDone],['2','Tank measurements',tankDone],['3','Calculate surveys',calcDone],['4','Report cargo',reportDone],['5','Submit & grade',graded]];let activeFound=false;return `<div class="grid grid-cols-2 lg:grid-cols-5 gap-1">${arr.map(([n,l,d])=>{let c=d?'done':(!activeFound?(activeFound=true,'active'):'');return `<div class="ds-mission-step ${c}"><span>${d?'✓':n}</span><span>${l}</span></div>`;}).join('')}</div>`;
}
function draftSurveyMissionGradeHTML(){
  const g=draftSurveyMissionState.grade,t=draftSurveyMissionState.truth;if(!g||!t)return '';const tone=g.pass?'text-emerald-300':'text-amber-300';return `<div class="rounded-xl border ${g.pass?'border-emerald-700/40 bg-emerald-950/10':'border-amber-700/40 bg-amber-950/10'} p-3"><div class="flex items-end justify-between gap-3"><div><div class="text-[8px] text-slate-500 uppercase tracking-wider">Mission Assessment</div><div class="text-3xl font-black ${tone}">${g.score.toFixed(1)} / 100</div><div class="font-bold ${tone}">${draftSurveyMissionState.assisted?'ASSISTED PRACTICE · ':''}${g.grade}</div></div><div class="text-right text-[8px] text-slate-500">Hidden true cargo revealed after submission<br><b class="text-white text-lg">${Math.abs(t.cargo).toFixed(1)} t ${t.cargo>=0?'LOADED':'DISCHARGED'}</b></div></div><div class="ds-mission-scorebar mt-2"><span style="width:${Math.max(0,Math.min(100,g.score))}%"></span></div><div class="mt-2 space-y-1">${g.breakdown.map(x=>`<div class="flex justify-between gap-2 text-[8px]"><span>${escapeHtml(x.label)}</span><b>${x.points.toFixed(1)} / ${x.max}</b></div>`).join('')}</div><div class="mt-2 text-[7.5px] text-slate-500">Nominal cargo change in the embedded loading-condition dataset: ${Math.abs(t.nominalCargo).toFixed(1)} t ${t.nominalCargo>=0?'loaded':'discharged'}. Mission ground truth uses the rounded observation/tank sheet actually issued to the student.</div><div class="mt-2 flex flex-wrap gap-1.5"><button onclick="printDraftSurveyMissionAssessment()" class="px-3 py-1.5 rounded border border-slate-700 text-slate-300 text-[8px]"><i class="fa-solid fa-print mr-1"></i>Print assessment</button><button onclick="downloadDraftSurveyMissionResult()" class="px-3 py-1.5 rounded border border-cyan-700/50 text-cyan-300 text-[8px]"><i class="fa-solid fa-file-arrow-down mr-1"></i>Export result JSON</button></div></div>`;
}
function draftSurveyMissionBuilderHTML(){
 const vessels=(AMCOL_TRAINING_VESSELS_MASTER.vessels||[]).filter(v=>v.family==='bulk'&&(v.loadingConditions||[]).length>=2),v=vessels[0],conds=v?.loadingConditions||[];
 const missionOpts=draftSurveyCustomMissionKeys.map(k=>`<option value="${k}">${escapeHtml(DRAFT_SURVEY_TRAINING_MISSIONS[k]?.title||k)}</option>`).join('');
 return `<details class="rounded-xl border border-amber-800/35 bg-amber-950/10 p-3"><summary class="cursor-pointer font-black text-amber-300 text-[9px]"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>Instructor Mission Builder</summary><div class="mt-3 space-y-2"><div class="grid grid-cols-2 gap-2"><label class="text-[8px] text-slate-500 col-span-2">Mission title<input id="dsBuilderTitle" value="Custom Draught Survey Mission" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"></label><label class="text-[8px] text-slate-500">Level<select id="dsBuilderLevel" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"><option>Foundation</option><option selected>Intermediate</option><option>Advanced</option><option>Assessment</option></select></label><label class="text-[8px] text-slate-500">Bulk vessel<select id="dsBuilderVessel" onchange="renderDraftSurveyMissionBuilderConditions()" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5">${vessels.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}</select></label><label class="text-[8px] text-slate-500">Initial condition<select id="dsBuilderInitial" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5">${conds.map((c,i)=>`<option value="${i}" ${i===1?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></label><label class="text-[8px] text-slate-500">Final condition<select id="dsBuilderFinal" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5">${conds.map((c,i)=>`<option value="${i}">${escapeHtml(c.name)}</option>`).join('')}</select></label><label class="text-[8px] text-slate-500">Initial water ρ<input id="dsBuilderRhoI" type="number" min="0.98" max="1.04" step="0.0001" value="1.0250" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"></label><label class="text-[8px] text-slate-500">Final water ρ<input id="dsBuilderRhoF" type="number" min="0.98" max="1.04" step="0.0001" value="1.0250" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"></label><label class="text-[8px] text-slate-500">P/S observation delta, m<input id="dsBuilderSideDelta" type="number" min="0" max="0.05" step="0.001" value="0.006" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"></label><label class="text-[8px] text-slate-500">Tolerance<select id="dsBuilderTolerance" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5"><option value="0.7">Strict</option><option value="1" selected>Standard</option><option value="1.5">Training</option><option value="2">Guided</option></select></label><label class="text-[8px] text-slate-500 col-span-2">Operation brief<textarea id="dsBuilderOperation" rows="3" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5">Complete the Initial and Final draught surveys, tank measurements and deductibles, then report the cargo quantity.</textarea></label></div><div class="grid grid-cols-3 gap-2"><button onclick="saveDraftSurveyCustomMission()" class="rounded bg-amber-500/15 border border-amber-500/35 text-amber-200 py-1.5 font-bold">Save mission</button><button onclick="exportDraftSurveyCustomMissions()" class="rounded border border-cyan-700/40 text-cyan-300 py-1.5">Export</button><label class="rounded border border-emerald-700/40 text-emerald-300 py-1.5 text-center cursor-pointer">Import<input type="file" accept=".json" class="hidden" onchange="importDraftSurveyCustomMissions(this.files);this.value=null"></label></div>${missionOpts?`<div class="grid grid-cols-[1fr_auto] gap-2"><select id="dsBuilderSaved" class="bg-slate-950 border border-slate-700 rounded px-2 py-1.5">${missionOpts}</select><button onclick="deleteDraftSurveyCustomMission()" class="px-3 rounded border border-rose-800/40 text-rose-300"><i class="fa-solid fa-trash"></i></button></div>`:''}<div class="text-[8px] text-slate-500">Custom missions use existing calibrated loading conditions and tank tables. They do not create new statutory vessel data.</div></div></details>`;
}
function renderDraftSurveyMissionBuilderConditions(){const id=document.getElementById('dsBuilderVessel')?.value,v=AMCOL_TRAINING_VESSELS_BY_ID[id],conds=v?.loadingConditions||[];for(const [selId,def] of [['dsBuilderInitial',1],['dsBuilderFinal',0]]){const el=document.getElementById(selId);if(el)el.innerHTML=conds.map((c,i)=>`<option value="${i}" ${i===def?'selected':''}>${escapeHtml(c.name)}</option>`).join('');}}
function saveDraftSurveyCustomMission(){const id=document.getElementById('dsBuilderVessel')?.value,v=AMCOL_TRAINING_VESSELS_BY_ID[id];if(!v)return alert('Choose a valid bulk training vessel.');const def={title:(document.getElementById('dsBuilderTitle')?.value||'Custom Draught Survey Mission').trim(),level:document.getElementById('dsBuilderLevel')?.value||'Assessment',vesselId:id,initialCondition:Number(document.getElementById('dsBuilderInitial')?.value)||0,finalCondition:Number(document.getElementById('dsBuilderFinal')?.value)||0,initialDensity:Number(document.getElementById('dsBuilderRhoI')?.value)||1.025,finalDensity:Number(document.getElementById('dsBuilderRhoF')?.value)||1.025,sideDelta:Math.max(0,Number(document.getElementById('dsBuilderSideDelta')?.value)||0),toleranceScale:Number(document.getElementById('dsBuilderTolerance')?.value)||1,operation:(document.getElementById('dsBuilderOperation')?.value||'Complete the draught survey and report cargo.').trim(),custom:true};if(def.initialCondition===def.finalCondition)return alert('Choose different Initial and Final conditions.');const key=`custom_${Date.now().toString(36)}`;DRAFT_SURVEY_TRAINING_MISSIONS[key]={...def,key};draftSurveyCustomMissionKeys.push(key);persistDraftSurveyCustomMissions();renderDraftSurveyMissionPanel();showCleanFeedback(`Saved custom mission: ${def.title}`);}
function deleteDraftSurveyCustomMission(){const key=document.getElementById('dsBuilderSaved')?.value;if(!key||!DRAFT_SURVEY_TRAINING_MISSIONS[key]?.custom)return;delete DRAFT_SURVEY_TRAINING_MISSIONS[key];draftSurveyCustomMissionKeys=draftSurveyCustomMissionKeys.filter(k=>k!==key);persistDraftSurveyCustomMissions();renderDraftSurveyMissionPanel();}
function exportDraftSurveyCustomMissions(){const pack={format:'AMCOL_DRAFT_SURVEY_MISSIONS',schemaVersion:1,exported:new Date().toISOString(),missions:draftSurveyCustomMissionKeys.map(k=>({...DRAFT_SURVEY_TRAINING_MISSIONS[k],key:k}))};downloadText(`AMCOL_Draft_Survey_Custom_Missions_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(pack,null,2),'application/json');}
async function importDraftSurveyCustomMissions(files){const file=files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj?.format!=='AMCOL_DRAFT_SURVEY_MISSIONS'||!Array.isArray(obj.missions))throw new Error('Not an AMCOL Draft Survey mission pack.');let added=0;for(const raw of obj.missions){if(!raw?.title||!raw?.vesselId)continue;const key=`custom_${Date.now().toString(36)}_${added}_${Math.random().toString(36).slice(2,6)}`;DRAFT_SURVEY_TRAINING_MISSIONS[key]={...raw,key,custom:true};draftSurveyCustomMissionKeys.push(key);added++;}persistDraftSurveyCustomMissions();renderDraftSurveyMissionPanel();showCleanFeedback(`Imported ${added} custom Draft Survey mission${added===1?'':'s'}.`);}catch(e){alert('Mission import failed: '+e.message);}}

function renderDraftSurveyMissionPanel(){
  const host=document.getElementById('dsMissionPanel');if(!host)return;if(!draftSurveyMissionState.active){host.innerHTML=`<div class="rounded-xl border border-violet-800/45 bg-violet-950/10 p-3 space-y-2"><div class="flex items-start justify-between gap-2"><div><div class="text-[8px] font-black uppercase tracking-wider text-violet-300">Draft Survey Training Missions</div><div class="text-[8px] text-slate-500 mt-1">Run a complete Initial → operation → Final → cargo assessment. The true cargo remains hidden until submission.</div></div><i class="fa-solid fa-graduation-cap text-violet-300"></i></div><select id="dsMissionSelect" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[9px]">${Object.entries(DRAFT_SURVEY_TRAINING_MISSIONS).map(([k,m])=>`<option value="${k}">${escapeHtml(m.title)} · ${escapeHtml(m.level)}${m.custom?' · CUSTOM':''}</option>`).join('')}</select><button onclick="draftSurveyMissionStart(document.getElementById('dsMissionSelect').value)" class="w-full px-3 py-2 rounded bg-violet-500/15 border border-violet-500/35 text-violet-200 font-black text-[9px]"><i class="fa-solid fa-play mr-1"></i>START TRAINING MISSION</button></div>${draftSurveyMissionBuilderHTML()}`;return;}
  const t=draftSurveyMissionState.truth,def=t.def,g=draftSurveyMissionState.grade;host.innerHTML=`<div class="rounded-xl border border-violet-700/45 bg-violet-950/10 p-3 space-y-3"><div class="flex flex-wrap items-start justify-between gap-2"><div><div class="text-[8px] font-black text-violet-300 uppercase tracking-wider">ACTIVE DRAFT SURVEY MISSION · ${escapeHtml(def.level)}</div><div class="text-[12px] font-black text-white">${escapeHtml(def.title)}</div><div class="text-[8px] text-slate-400 mt-1">${escapeHtml(def.operation)}</div></div><button onclick="draftSurveyMissionExit()" class="px-2 py-1 rounded border border-rose-800/50 text-rose-300 text-[8px]">Exit mission</button></div>${draftSurveyMissionStepsHTML()}<div class="grid grid-cols-2 gap-2"><label class="text-[8px] text-slate-500">Student name<input id="dsMissionStudentName" value="${escapeHtml(draftSurveyMissionState.studentName||'')}" oninput="draftSurveyMissionField('studentName',this.value)" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label><label class="text-[8px] text-slate-500">Student ID<input id="dsMissionStudentId" value="${escapeHtml(draftSurveyMissionState.studentId||'')}" oninput="draftSurveyMissionField('studentId',this.value)" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label></div><div class="rounded border border-amber-800/30 bg-amber-950/10 p-2 text-[8px] text-amber-100"><b>Operation Log:</b> ${escapeHtml(def.operation)} Do not use the nominal cargo values in the vessel Data workspace during this assessment. Work only from the issued survey observations below.</div><div class="grid xl:grid-cols-2 gap-2">${draftSurveyMissionObservationTable('initial')}${draftSurveyMissionObservationTable('final')}</div><div class="rounded-lg border border-slate-800 bg-slate-950/55 p-2"><div class="grid grid-cols-[1fr_120px] gap-2 items-end"><label class="text-[8px] text-slate-500">Student-reported cargo quantity<input id="dsMissionReportedCargo" type="number" min="0" step="0.1" value="${escapeHtml(String(draftSurveyMissionState.reportedCargo||''))}" oninput="draftSurveyMissionField('reportedCargo',this.value)" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[10px]" placeholder="tonnes"></label><select id="dsMissionReportedDirection" onchange="draftSurveyMissionField('reportedDirection',this.value)" class="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[9px]"><option value="LOADED" ${draftSurveyMissionState.reportedDirection==='LOADED'?'selected':''}>Loaded</option><option value="DISCHARGED" ${draftSurveyMissionState.reportedDirection==='DISCHARGED'?'selected':''}>Discharged</option></select></div><button onclick="draftSurveyMissionSubmit()" class="mt-2 w-full px-4 py-2 rounded bg-emerald-500 text-emerald-950 font-black text-[9px]"><i class="fa-solid fa-check-double mr-1"></i>SUBMIT MISSION FOR GRADING</button></div>${g?draftSurveyMissionGradeHTML():''}</div>`;
}
function downloadDraftSurveyMissionResult(){
 const g=draftSurveyMissionState.grade,t=draftSurveyMissionState.truth;if(!g||!t)return alert('Submit the mission first.');
 const payload={format:'AMCOL_DRAFT_SURVEY_ASSESSMENT',schemaVersion:1,exported:new Date().toISOString(),student:{name:draftSurveyMissionState.studentName||'',id:draftSurveyMissionState.studentId||''},mission:{key:draftSurveyMissionState.key,title:t.def.title,level:t.def.level,assisted:!!draftSurveyMissionState.assisted,startedAt:draftSurveyMissionState.startedAt,elapsedSeconds:draftSurveyMissionState.startedAt?Math.round((Date.now()-draftSurveyMissionState.startedAt)/1000):null},result:{score:g.score,grade:g.grade,pass:g.pass,breakdown:g.breakdown,trueCargo:t.cargo,trueDirection:t.cargo>=0?'LOADED':'DISCHARGED',reportedCargo:Number(draftSurveyMissionState.reportedCargo)||0,reportedDirection:draftSurveyMissionState.reportedDirection}};
 const base=`AMCOL_Draft_Survey_${String(draftSurveyMissionState.studentId||draftSurveyMissionState.studentName||'Student').replace(/[^a-z0-9_-]+/gi,'_')}_${new Date().toISOString().slice(0,10)}`;downloadText(base+'.json',JSON.stringify(payload,null,2),'application/json');
}
function printDraftSurveyMissionAssessment(){
  const g=draftSurveyMissionState.grade,t=draftSurveyMissionState.truth;if(!g||!t)return alert('Submit the mission first.');const w=window.open('','_blank','width=900,height=850');if(!w)return;const elapsed=draftSurveyMissionState.startedAt?Math.max(0,Math.round((Date.now()-draftSurveyMissionState.startedAt)/60000)):0;w.document.write(`<html><head><title>AMCOL Draft Survey Mission Assessment</title><style>body{font-family:Arial;padding:24px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd4df;padding:7px;font-size:11px}th{background:#eef2f7;text-align:left}</style></head><body><h2>AMCOL Draft Survey Training Mission Assessment</h2><p><b>Mission:</b> ${escapeHtml(t.def.title)}<br><b>Assessment mode:</b> ${draftSurveyMissionState.assisted?'ASSISTED PRACTICE':'INDEPENDENT'}<br><b>Student:</b> ${escapeHtml(draftSurveyMissionState.studentName||'—')} &nbsp; <b>ID:</b> ${escapeHtml(draftSurveyMissionState.studentId||'—')}<br><b>Elapsed:</b> ${elapsed} min</p><h1>${g.score.toFixed(1)} / 100 · ${g.grade}</h1><table><tr><th>Assessment component</th><th>Score</th></tr>${g.breakdown.map(x=>`<tr><td>${escapeHtml(x.label)}</td><td>${x.points.toFixed(1)} / ${x.max}</td></tr>`).join('')}</table><p><b>Mission ground-truth cargo:</b> ${Math.abs(t.cargo).toFixed(1)} t ${t.cargo>=0?'LOADED':'DISCHARGED'}</p><p style="font-size:10px;color:#667085">Educational training assessment using the AMCOL calibrated training vessel dataset. Not a commercial draught survey certificate.</p></body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
}

const DRAFT_SURVEY_DEDUCTIBLES=[
 ['ballast','Ballast water'],['freshWater','Fresh water'],['fuelOil','Fuel oil / HFO'],['dieselOil','Diesel oil'],
 ['lubeOil','Lubricating oil'],['slopsBilge','Slops / bilge'],['anchorChain','Anchor & chain'],['other','Others / constant change']
];
let draftSurveyTankEntries={initial:{},final:{}},draftSurveyTankTotals={initial:null,final:null},draftSurveyTankPanelSig={initial:'',final:''};
function draftSurveyTankContext(){
 const v=activeAMCOLTrainingVessel();
 if(v&&Array.isArray(v.tankCalibration)&&v.tankCalibration.length&&Array.isArray(v.ballastTanks)&&v.ballastTanks.length){return {available:true,vessel:v,tanks:v.ballastTanks,calibrationRows:v.tankCalibration,authority:v.realSourceCalibrated?'AMCOL CALIBRATED TRAINING TANK TABLE':'AMCOL TRAINING TANK TABLE',boundary:v.realSourceCalibrated?'Tank geometry/calibration are AMCOL-derived from the calibrated training model; they are not the vessel’s approved sounding/ullage book.':'Synthetic/derived AMCOL training tank calibration; not an approved vessel tank table.'};}
 if(isGreatFortuneWorkbookVessel())return {available:false,reason:'GREAT FORTUNE workbook contains source tank masses/VCG/FSM for the supplied loading condition, but no approved tank sounding/ullage calibration table. Sounding conversion is intentionally disabled; use the source/current tank masses as deductibles.'};
 return {available:false,reason:'No integrated tank calibration table is available for the active vessel. Manual deductibles remain available.'};
}
function draftSurveyTankRuntimeMap(){return new Map((Array.isArray(ballastTanks)?ballastTanks:[]).map(t=>[String(t.id),t]));}
function draftSurveyTankDefaultEntry(t){return {mode:'sounding',reading:0,density:Number(t?.density)||1.025};}
function draftSurveyTankEnsureEntries(role){
 const ctx=draftSurveyTankContext();if(!ctx.available)return ctx;
 const store=draftSurveyTankEntries[role]||(draftSurveyTankEntries[role]={});
 ctx.tanks.forEach(t=>{if(!store[t.id])store[t.id]=draftSurveyTankDefaultEntry(t);});
 Object.keys(store).forEach(id=>{if(!ctx.tanks.some(t=>String(t.id)===String(id)))delete store[id];});return ctx;
}
function draftSurveyTankCalc(role){
 const ctx=draftSurveyTankEnsureEntries(role);if(!ctx.available){draftSurveyTankTotals[role]=null;return null;}
 const store=draftSurveyTankEntries[role]||{};
 const entries=ctx.tanks.map(t=>({tank:t,tankId:t.id,mode:store[t.id]?.mode||'sounding',reading:store[t.id]?.reading??0,density:store[t.id]?.density??t.density,height:t.height}));
 const total=AMCOLPhysics.tankSounding.calculateMany(entries,ctx.calibrationRows);draftSurveyTankTotals[role]=total;return total;
}
function draftSurveyTankEdit(role,encodedId,field,value){
 const ctx=draftSurveyTankEnsureEntries(role);if(!ctx.available)return;const id=decodeURIComponent(encodedId),tank=ctx.tanks.find(t=>String(t.id)===String(id));if(!tank)return;const e=draftSurveyTankEntries[role][id]||draftSurveyTankDefaultEntry(tank);
 if(field==='mode'){
  const oldMode=e.mode||'sounding',sp=AMCOLPhysics.tankSounding.soundingPercentFromReading(oldMode,e.reading,tank.height);e.mode=String(value||'sounding');e.reading=Number.isFinite(sp)?AMCOLPhysics.tankSounding.readingFromSoundingPercent(e.mode,sp,tank.height):0;
 }else if(field==='reading')e.reading=Number(value);else if(field==='density')e.density=Number(value);
 draftSurveyTankEntries[role][id]=e;draftSurveyRenderTankPanel(role,true);draftSurveyRenderTankMeasurementReport();renderDraftSurveyMissionPanel();
}
function draftSurveyTankLoadCurrent(role='initial'){
 const ctx=draftSurveyTankEnsureEntries(role);if(!ctx.available){draftSurveyRenderTankPanel(role,true);return;}
 const runtime=draftSurveyTankRuntimeMap(),store={};
 ctx.tanks.forEach(t=>{const rt=runtime.get(String(t.id))||t,density=Number(rt.density||t.density)||1.025,capVol=Math.max(0,Number(t.capacityVolume)||0),mass=Math.max(0,Number(rt.sourceMass ?? rt.mass ?? 0)||0);let vp=capVol>0?100*mass/(capVol*density):Number(rt.fill)||0;if(!(mass>0)&&Number.isFinite(Number(rt.fill)))vp=Number(rt.fill);vp=Math.max(0,Math.min(100,vp));const sp=AMCOLPhysics.tankSounding.soundingPercentFromVolumePercent(ctx.calibrationRows,t.id,vp),reading=AMCOLPhysics.tankSounding.readingFromSoundingPercent('sounding',Number.isFinite(sp)?sp:0,t.height);store[t.id]={mode:'sounding',reading:Number.isFinite(reading)?reading:0,density};});
 draftSurveyTankEntries[role]=store;draftSurveyTankApply(role,false);draftSurveyRenderTankPanel(role,true);draftSurveyRenderTankMeasurementReport();
}
function draftSurveyTankClear(role='initial'){
 const ctx=draftSurveyTankContext();draftSurveyTankEntries[role]={};draftSurveyTankTotals[role]=null;if(ctx.available)ctx.tanks.forEach(t=>draftSurveyTankEntries[role][t.id]=draftSurveyTankDefaultEntry(t));draftSurveyRenderTankPanel(role,true);draftSurveyRenderTankMeasurementReport();
}
function draftSurveyTankApply(role='initial',recalculate=true){
 const total=draftSurveyTankCalc(role),pre=role==='initial'?'dsInitial':'dsFinal';if(total&&total.validCount){draftSurveySet(pre+'Ballast',total.totalMassT,1);}if(recalculate)calculateDraftSurveyUI();draftSurveyRenderTankMeasurementReport();renderDraftSurveyMissionPanel();return total;
}
function draftSurveyTankRowHTML(role,t,i,ctx){
 const e=(draftSurveyTankEntries[role]||{})[t.id]||draftSurveyTankDefaultEntry(t),r=AMCOLPhysics.tankSounding.calculateTank({tank:t,tankId:t.id,mode:e.mode,reading:e.reading,density:e.density,height:t.height,calibrationRows:ctx.calibrationRows}),enc=encodeURIComponent(String(t.id)),unit=e.mode==='percent'?'%':'m';
 return `<tr class="border-t border-slate-800/70"><td class="py-1.5 pr-2"><b class="text-slate-300">${escapeHtml(t.name||t.id)}</b><div class="text-[7px] text-slate-600">${escapeHtml(t.type||'Tank')} · ${escapeHtml(t.side||'centre')} · H ${Number(t.height||0).toFixed(2)} m</div></td><td class="px-1"><select onchange="draftSurveyTankEdit('${role}','${enc}','mode',this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[8px]"><option value="sounding" ${e.mode==='sounding'?'selected':''}>Sounding</option><option value="ullage" ${e.mode==='ullage'?'selected':''}>Ullage</option><option value="percent" ${e.mode==='percent'?'selected':''}>Sounding %</option></select></td><td class="px-1"><div class="flex items-center gap-1"><input onchange="draftSurveyTankEdit('${role}','${enc}','reading',this.value)" type="number" min="0" step="${e.mode==='percent'?'0.1':'0.01'}" value="${Number.isFinite(Number(e.reading))?Number(e.reading).toFixed(e.mode==='percent'?1:2):''}" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[8px]"><span class="text-[7px] text-slate-600">${unit}</span></div></td><td class="px-1"><input onchange="draftSurveyTankEdit('${role}','${enc}','density',this.value)" type="number" min="0.70" max="1.20" step="0.0001" value="${Number(e.density||t.density||1.025).toFixed(4)}" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[8px]"></td><td class="px-1 text-right font-mono text-slate-400">${r.valid?r.soundingPercent.toFixed(1):'—'}%</td><td class="px-1 text-right font-mono text-cyan-200">${r.valid?r.volumeM3.toFixed(1):'—'}</td><td class="pl-1 text-right font-mono font-bold text-amber-200">${r.valid?r.massT.toFixed(1):'—'}</td></tr>`;
}
function draftSurveyRenderTankPanel(role,force=false){
 const host=document.getElementById(role==='initial'?'dsInitialTankSoundingPanel':'dsFinalTankSoundingPanel');if(!host)return;const ctx=draftSurveyTankContext(),sig=`${state.vesselName}|${ctx.available?ctx.tanks.length:0}|${ctx.available?ctx.calibrationRows.length:0}`;if(!force&&draftSurveyTankPanelSig[role]===sig&&host.innerHTML)return;draftSurveyTankPanelSig[role]=sig;
 if(!ctx.available){host.innerHTML=`<div class="rounded border border-amber-900/40 bg-amber-950/10 p-2 text-[8px] text-amber-100"><b>Tank sounding/ullage conversion unavailable.</b><br><span class="text-slate-500">${escapeHtml(ctx.reason||'No calibration table.')}</span></div>`;return;}
 draftSurveyTankEnsureEntries(role);const total=draftSurveyTankCalc(role),rows=ctx.tanks.map((t,i)=>draftSurveyTankRowHTML(role,t,i,ctx)).join('');
 host.innerHTML=`<div class="rounded border border-cyan-900/40 bg-cyan-950/5 p-2 space-y-2"><div class="flex flex-wrap items-start justify-between gap-2"><div><div class="text-[9px] font-bold text-cyan-300">Tank Sounding / Ullage → Ballast Deductible</div><div class="text-[7.5px] text-slate-500">${escapeHtml(ctx.authority)} · ${ctx.tanks.length} tanks · ${ctx.calibrationRows.length} calibration rows</div></div><div class="flex gap-1"><button onclick="draftSurveyTankLoadCurrent('${role}')" class="px-2 py-1 rounded border border-cyan-700/40 text-cyan-300 text-[7.5px]">Use Current Levels</button><button onclick="draftSurveyTankApply('${role}')" class="px-2 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-[7.5px] font-bold">Apply Ballast</button><button onclick="draftSurveyTankClear('${role}')" class="px-2 py-1 rounded border border-slate-700 text-slate-400 text-[7.5px]">Clear</button></div></div><div class="max-h-[360px] overflow-auto"><table class="w-full text-[8px]"><thead class="sticky top-0 bg-slate-950 text-slate-500"><tr><th class="text-left py-1">Tank</th><th>Mode</th><th>Reading</th><th>ρ t/m³</th><th class="text-right">Sounding</th><th class="text-right">Vol m³</th><th class="text-right">Mass t</th></tr></thead><tbody>${rows}</tbody></table></div><div class="grid grid-cols-3 gap-1"><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Volume</span><br><b>${total?total.totalVolumeM3.toFixed(1):'0.0'} m³</b></div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Ballast mass</span><br><b class="text-amber-300">${total?total.totalMassT.toFixed(1):'0.0'} t</b></div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">FSM</span><br><b>${total?total.totalFSM.toFixed(1):'0.0'} t·m</b></div></div><div class="text-[7.5px] text-amber-200"><b>Boundary:</b> ${escapeHtml(ctx.boundary)} Sounding is measured from the training tank bottom datum; ullage is measured down from the training tank top. Interpolation is limited to the integrated calibration table.</div></div>`;
}
function draftSurveyRenderTankPanels(force=false){draftSurveyRenderTankPanel('initial',force);draftSurveyRenderTankPanel('final',force);draftSurveyRenderTankMeasurementReport();}
function draftSurveyTankReportData(role){
 const ctx=draftSurveyTankContext(),total=ctx.available?draftSurveyTankCalc(role):null;
 const results=total?.results||[],summary=AMCOLPhysics?.tankSounding?.summarizeResults?AMCOLPhysics.tankSounding.summarizeResults(results):{bySide:{},byCategory:{}};
 return {role,ctx,total,results,summary};
}
function draftSurveyAppliedDeductibleSummary(role){
 const pre=role==='initial'?'dsInitial':'dsFinal';
 const map={
  'BALLAST':draftSurveyNum(pre+'Ballast')||0,'FRESH WATER':draftSurveyNum(pre+'FreshWater')||0,'FUEL OIL / HFO':draftSurveyNum(pre+'FuelOil')||0,
  'DIESEL OIL':draftSurveyNum(pre+'DieselOil')||0,'LUBRICATING OIL':draftSurveyNum(pre+'LubeOil')||0,'SLOPS / BILGE':draftSurveyNum(pre+'SlopsBilge')||0,
  'ANCHOR & CHAIN':draftSurveyNum(pre+'AnchorChain')||0,'OTHER':draftSurveyNum(pre+'Other')||0
 };
 return map;
}
function draftSurveyTankMeasurementReportHTML(){
 const a=draftSurveyTankReportData('initial'),b=draftSurveyTankReportData('final'),ctx=a.ctx.available?a.ctx:b.ctx;
 if(!ctx.available)return `<div class="rounded border border-amber-900/40 bg-amber-950/10 p-3 text-[8px] text-amber-100"><b>Formal tank measurement sheet unavailable for this vessel.</b><br><span class="text-slate-500">${escapeHtml(ctx.reason||'No calibrated tank table is integrated.')}</span></div>`;
 const cmp=AMCOLPhysics.tankSounding.compareResults(a.results,b.results),fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):'—',read=r=>r?`${r.mode==='ullage'?'Ullage':r.mode==='percent'?'Sounding %':'Sounding'} ${Number(r.reading).toFixed(r.mode==='percent'?1:2)}${r.mode==='percent'?'%':' m'} · ρ ${Number(r.density).toFixed(4)}`:'—';
 const rows=cmp.rows.map(r=>`<tr class="border-t border-slate-800/70"><td class="py-1.5 pr-2"><b>${escapeHtml(r.tankName)}</b><div class="text-[7px] text-slate-600">${r.side} · ${r.category}</div></td><td class="px-1 text-slate-400">${read(r.initial)}</td><td class="px-1 text-right font-mono">${r.initial?fmt(r.initial.volumeM3):'—'}</td><td class="px-1 text-right font-mono text-cyan-200">${r.initial?fmt(r.initial.massT):'—'}</td><td class="px-1 text-slate-400">${read(r.final)}</td><td class="px-1 text-right font-mono">${r.final?fmt(r.final.volumeM3):'—'}</td><td class="px-1 text-right font-mono text-emerald-200">${r.final?fmt(r.final.massT):'—'}</td><td class="pl-1 text-right font-mono font-bold ${r.deltaMassT>0?'text-amber-300':r.deltaMassT<0?'text-cyan-300':'text-slate-400'}">${r.deltaMassT>=0?'+':''}${fmt(r.deltaMassT)}</td></tr>`).join('');
 const sides=['PORT','STARBOARD','CENTRE'].map(side=>{const i=a.summary.bySide[side]||{},f=b.summary.bySide[side]||{};return `<tr><td>${side}</td><td class="text-right font-mono">${fmt(i.volumeM3||0)}</td><td class="text-right font-mono">${fmt(i.massT||0)}</td><td class="text-right font-mono">${fmt(f.volumeM3||0)}</td><td class="text-right font-mono">${fmt(f.massT||0)}</td><td class="text-right font-mono">${((f.massT||0)-(i.massT||0))>=0?'+':''}${fmt((f.massT||0)-(i.massT||0))}</td></tr>`}).join('');
 const ai=draftSurveyAppliedDeductibleSummary('initial'),af=draftSurveyAppliedDeductibleSummary('final'),cats=['BALLAST','FRESH WATER','FUEL OIL / HFO','DIESEL OIL','LUBRICATING OIL','SLOPS / BILGE','ANCHOR & CHAIN','OTHER'];
 const catRows=cats.map(c=>{const si=a.summary.byCategory[c]?.massT,sf=b.summary.byCategory[c]?.massT;return `<tr><td>${c}</td><td class="text-right font-mono">${Number.isFinite(si)?fmt(si):'—'}</td><td class="text-right font-mono text-amber-200">${fmt(ai[c])}</td><td class="text-right font-mono">${Number.isFinite(sf)?fmt(sf):'—'}</td><td class="text-right font-mono text-emerald-200">${fmt(af[c])}</td><td class="text-right font-mono">${af[c]-ai[c]>=0?'+':''}${fmt(af[c]-ai[c])}</td></tr>`}).join('');
 return `<div class="space-y-3"><div class="flex flex-wrap items-start justify-between gap-2"><div><div class="text-[10px] font-black text-cyan-300">TANK MEASUREMENT / SOUNDING SHEET</div><div class="text-[7.5px] text-slate-500">${escapeHtml(ctx.authority)} · ${ctx.tanks.length} calibrated tanks · Initial vs Final comparison</div></div><button onclick="printTankMeasurementReport()" class="px-3 py-1.5 rounded border border-cyan-600/40 text-cyan-200 text-[8px] font-bold"><i class="fa-solid fa-print mr-1"></i>PRINT TANK SHEET</button></div>
 <div class="grid lg:grid-cols-2 gap-3"><div class="rounded border border-slate-800 bg-slate-950/55 p-2"><div class="text-[8px] font-bold text-slate-300 mb-1">PORT / STARBOARD / CENTRE TOTALS</div><table class="w-full text-[8px]"><thead class="text-slate-500"><tr><th class="text-left">Side</th><th class="text-right">I Vol m³</th><th class="text-right">I Mass t</th><th class="text-right">F Vol m³</th><th class="text-right">F Mass t</th><th class="text-right">Δ Mass t</th></tr></thead><tbody>${sides}</tbody></table></div>
 <div class="rounded border border-slate-800 bg-slate-950/55 p-2"><div class="text-[8px] font-bold text-slate-300 mb-1">DEDUCTIBLE CATEGORY SUMMARY</div><table class="w-full text-[8px]"><thead class="text-slate-500"><tr><th class="text-left">Category</th><th class="text-right">I Tank calc</th><th class="text-right">I Applied</th><th class="text-right">F Tank calc</th><th class="text-right">F Applied</th><th class="text-right">Δ Applied</th></tr></thead><tbody>${catRows}</tbody></table><div class="mt-1 text-[7px] text-slate-600">Tank-calculated values appear only where calibrated tank tables exist. Applied values are the deductibles used by the Draught Survey calculation.</div></div></div>
 <div class="max-h-[420px] overflow-auto rounded border border-slate-800"><table class="w-full text-[8px]"><thead class="sticky top-0 bg-slate-950 text-slate-500"><tr><th class="text-left py-1.5">Tank</th><th>Initial reading / density</th><th class="text-right">I Vol</th><th class="text-right">I Mass</th><th>Final reading / density</th><th class="text-right">F Vol</th><th class="text-right">F Mass</th><th class="text-right">Δ t</th></tr></thead><tbody>${rows}</tbody></table></div>
 <div class="grid grid-cols-3 gap-2"><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Initial calibrated tank mass</span><br><b class="text-cyan-200">${fmt(a.total?.totalMassT||0)} t</b></div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Final calibrated tank mass</span><br><b class="text-emerald-200">${fmt(b.total?.totalMassT||0)} t</b></div><div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Tank mass change</span><br><b class="${cmp.totalDeltaMassT>=0?'text-amber-300':'text-cyan-300'}">${cmp.totalDeltaMassT>=0?'+':''}${fmt(cmp.totalDeltaMassT)} t</b></div></div>
 <div class="text-[7.5px] text-amber-200"><b>Authority boundary:</b> ${escapeHtml(ctx.boundary)} This sheet is a training measurement record and is not an approved ship tank sounding book.</div></div>`;
}
function draftSurveyRenderTankMeasurementReport(){const host=document.getElementById('dsTankMeasurementReport');if(host)host.innerHTML=draftSurveyTankMeasurementReportHTML();}
function printTankMeasurementReport(){
 const a=draftSurveyTankReportData('initial'),b=draftSurveyTankReportData('final'),ctx=a.ctx.available?a.ctx:b.ctx;if(!ctx.available)return alert(ctx.reason||'No calibrated tank table is available.');
 const cmp=AMCOLPhysics.tankSounding.compareResults(a.results,b.results),w=window.open('','_blank','width=1100,height=900');if(!w)return;const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—',rd=r=>r?`${r.mode==='ullage'?'Ullage':r.mode==='percent'?'Sounding %':'Sounding'} ${Number(r.reading).toFixed(r.mode==='percent'?1:2)}${r.mode==='percent'?'%':' m'}`:'—';
 const tankRows=cmp.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.tankName)}</td><td>${r.side}</td><td>${r.category}</td><td>${rd(r.initial)}</td><td>${r.initial?fmt(r.initial.density):'—'}</td><td>${r.initial?fmt(r.initial.volumeM3):'—'}</td><td>${r.initial?fmt(r.initial.massT):'—'}</td><td>${rd(r.final)}</td><td>${r.final?fmt(r.final.density):'—'}</td><td>${r.final?fmt(r.final.volumeM3):'—'}</td><td>${r.final?fmt(r.final.massT):'—'}</td><td>${r.deltaMassT>=0?'+':''}${fmt(r.deltaMassT)}</td></tr>`).join('');
 const sideRows=['PORT','STARBOARD','CENTRE'].map(side=>{const i=a.summary.bySide[side]||{},f=b.summary.bySide[side]||{};return `<tr><td>${side}</td><td>${fmt(i.volumeM3||0)}</td><td>${fmt(i.massT||0)}</td><td>${fmt(f.volumeM3||0)}</td><td>${fmt(f.massT||0)}</td><td>${fmt((f.massT||0)-(i.massT||0))}</td></tr>`}).join('');
 const ai=draftSurveyAppliedDeductibleSummary('initial'),af=draftSurveyAppliedDeductibleSummary('final'),cats=['BALLAST','FRESH WATER','FUEL OIL / HFO','DIESEL OIL','LUBRICATING OIL','SLOPS / BILGE','ANCHOR & CHAIN','OTHER'];
 const catRows=cats.map(c=>`<tr><td>${c}</td><td>${fmt(a.summary.byCategory[c]?.massT)}</td><td>${fmt(ai[c])}</td><td>${fmt(b.summary.byCategory[c]?.massT)}</td><td>${fmt(af[c])}</td><td>${af[c]-ai[c]>=0?'+':''}${fmt(af[c]-ai[c])}</td></tr>`).join('');
 w.document.write(`<html><head><title>AMCOL Tank Measurement Sheet</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#172033;font-size:10px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:8px;margin-bottom:10px}h1{font-size:18px;margin:0}h2{font-size:12px;margin:14px 0 5px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aeb8c6;padding:4px;text-align:right}td:nth-child(2),td:nth-child(3),td:nth-child(4),th:nth-child(2),th:nth-child(3),th:nth-child(4){text-align:left}th{background:#e9eef5}.note{font-size:8px;color:#667085;margin-top:8px}.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:30px}.sig{border-top:1px solid #172033;padding-top:4px;text-align:center}</style></head><body><div class="head"><div><b>ASIAN MARITIME TECHNOLOGICAL COLLEGE (AMCOL)</b><h1>Tank Measurement / Sounding Sheet</h1><div>Draught Survey Supporting Record</div></div><div><b>Vessel:</b> ${escapeHtml(state.companyName||'—')} · ${escapeHtml(state.vesselName||'—')}<br><b>Generated:</b> ${new Date().toLocaleString()}<br><b>Authority:</b> ${escapeHtml(ctx.authority)}</div></div><h2>Tank-by-Tank Initial / Final Measurements</h2><table><tr><th>No.</th><th>Tank</th><th>Side</th><th>Category</th><th>Initial reading</th><th>I ρ</th><th>I Vol m³</th><th>I Mass t</th><th>Final reading</th><th>F ρ</th><th>F Vol m³</th><th>F Mass t</th><th>Δ t</th></tr>${tankRows}</table><h2>Port / Starboard / Centre Totals</h2><table><tr><th style="text-align:left">Side</th><th>I Volume m³</th><th>I Mass t</th><th>F Volume m³</th><th>F Mass t</th><th>Δ Mass t</th></tr>${sideRows}</table><h2>Deductible Category Summary</h2><table><tr><th style="text-align:left">Category</th><th>I Tank Calc t</th><th>I Applied t</th><th>F Tank Calc t</th><th>F Applied t</th><th>Δ Applied t</th></tr>${catRows}</table><p><b>Initial calibrated tank total:</b> ${fmt(a.total?.totalMassT||0)} t &nbsp; | &nbsp; <b>Final:</b> ${fmt(b.total?.totalMassT||0)} t &nbsp; | &nbsp; <b>Change:</b> ${cmp.totalDeltaMassT>=0?'+':''}${fmt(cmp.totalDeltaMassT)} t</p><div class="note"><b>Educational data boundary:</b> ${escapeHtml(ctx.boundary)} This report is not a commercial survey certificate, approved tank sounding book or substitute for ship-specific calibration tables.</div><div class="sign"><div class="sig">Prepared by</div><div class="sig">Checked by</div><div class="sig">Chief Officer</div><div class="sig">Master / Instructor</div></div></body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
}
function draftSurveyNum(id){const el=document.getElementById(id);if(!el||String(el.value).trim()==='')return NaN;const v=Number(el.value);return Number.isFinite(v)?v:NaN;}
function draftSurveySet(id,v,digits=3){const el=document.getElementById(id);if(!el)return;el.value=Number.isFinite(Number(v))?Number(v).toFixed(digits):'';}
function draftSurveyHydroContext(){
 const p=hydroPack(),rows=(p.kind==='hydroTable'||p.kind==='uploadedBundle')&&Array.isArray(p.rows)?p.rows:[];
 return {pack:p,rows,tableDensity:Number(p.sourceDensity)||1.025,lbp:Number(state.length)||NaN,eligible:state.hullType==='bulk'&&rows.length>=2};
}
function draftSurveyRoleInput(role){
 const pre=role==='initial'?'dsInitial':'dsFinal',ctx=draftSurveyHydroContext();
 const deductibles={};DRAFT_SURVEY_DEDUCTIBLES.forEach(([k])=>deductibles[k]=draftSurveyNum(pre+k[0].toUpperCase()+k.slice(1))||0);
 return {hydroRows:ctx.rows,tableDensity:ctx.tableDensity,observedDensity:draftSurveyNum(pre+'Density'),geometry:{lbp:ctx.lbp,forwardMarkOffset:draftSurveyNum('dsMarkFwdOffset')||0,midshipMarkOffset:draftSurveyNum('dsMarkMidOffset')||0,aftMarkOffset:draftSurveyNum('dsMarkAftOffset')||0,keelThickness:draftSurveyNum('dsKeelThickness')||0},readings:{forwardPort:draftSurveyNum(pre+'FwdP'),forwardStarboard:draftSurveyNum(pre+'FwdS'),midshipPort:draftSurveyNum(pre+'MidP'),midshipStarboard:draftSurveyNum(pre+'MidS'),aftPort:draftSurveyNum(pre+'AftP'),aftStarboard:draftSurveyNum(pre+'AftS')},deductibles};
}
function draftSurveyResultHTML(r,role){
 if(!r?.valid){return `<div class="rounded-lg border border-slate-800 bg-slate-950/65 p-3 text-slate-500">${escapeHtml(r?.reason||'Enter all six draught readings and water density, then calculate.')}</div>`;}
 const d=r.drafts,h=r.hydro,dn=r.density,dd=r.deductibles,sg=d.hogSagSense==='SAG'?'text-amber-300':d.hogSagSense==='HOG'?'text-cyan-300':'text-emerald-300';
 const second=h.secondAvailable?`${h.secondTrimCorrection>=0?'+':''}${h.secondTrimCorrection.toFixed(2)} t`:'N/A · MCTC ±0.50 m unavailable';
 const val=(role==='final'&&Number.isFinite(draftSurveyValidationTarget))?`<div class="mt-2 rounded border border-violet-500/30 bg-violet-950/20 p-2"><b class="text-violet-300">GREAT FORTUNE validation:</b> target corrected displacement ${draftSurveyValidationTarget.toFixed(1)} t · error ${(r.correctedDisplacement-draftSurveyValidationTarget).toFixed(2)} t.</div>`:'';
 return `<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Corrected F / M / A</span><br><b>${d.forward.toFixed(3)} / ${d.midship.toFixed(3)} / ${d.aft.toFixed(3)} m</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Trim</span><br><b>${Math.abs(d.trimAft).toFixed(3)} m ${d.trimAft>=0?'BY STERN':'BY HEAD'}</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Hull deflection</span><br><b class="${sg}">${d.hogSagSense} ${Math.abs(d.hogSag*1000).toFixed(1)} mm</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">M/M/M survey draught</span><br><b>${d.mouldedDraft.toFixed(4)} m</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Table displacement</span><br><b>${h.displacementTable.toFixed(1)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">1st trim correction</span><br><b>${h.firstTrimCorrection>=0?'+':''}${h.firstTrimCorrection.toFixed(2)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">2nd trim correction</span><br><b>${second}</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Trim-corrected Δ</span><br><b>${h.displacementTrimCorrected.toFixed(1)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Density correction</span><br><b>${dn.correction>=0?'+':''}${dn.correction.toFixed(2)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Corrected displacement</span><br><b class="text-cyan-300">${r.correctedDisplacement.toFixed(1)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Deductibles</span><br><b>${dd.total.toFixed(1)} t</b></div>
 <div class="rounded bg-slate-950 p-2"><span class="text-slate-500">Net after deductibles</span><br><b class="text-amber-300">${r.netDisplacement.toFixed(1)} t</b></div></div>${val}`;
}
function calculateDraftSurveyUI(){
 const ctx=draftSurveyHydroContext(),status=document.getElementById('draftSurveyStatus');
 if(!ctx.rows.length){draftSurveyResults={initial:null,final:null};if(status)status.innerHTML='<span class="text-rose-300 font-bold">No active upright hydrostatic table.</span> Load GREAT FORTUNE or an AMCOL bulk carrier with calibrated hydrostatics.';renderDraftSurveyResults();return;}
 for(const role of ['initial','final']){const input=draftSurveyRoleInput(role);draftSurveyResults[role]=AMCOLPhysics.draftSurvey.calculateSurvey(input);}
 renderDraftSurveyResults();renderDraftSurveyMissionPanel();
}
function renderDraftSurveyResults(){
 const a=document.getElementById('dsInitialResult'),b=document.getElementById('dsFinalResult');if(a)a.innerHTML=draftSurveyResultHTML(draftSurveyResults.initial,'initial');if(b)b.innerHTML=draftSurveyResultHTML(draftSurveyResults.final,'final');
 const cargo=AMCOLPhysics.draftSurvey.cargoDifference(draftSurveyResults.initial,draftSurveyResults.final),box=document.getElementById('dsCargoResult');
 if(box){if(cargo.valid){const tone=cargo.direction==='LOADED'?'text-emerald-300':cargo.direction==='DISCHARGED'?'text-amber-300':'text-slate-300';box.innerHTML=`<div class="text-[9px] uppercase tracking-wider text-slate-500">Cargo by draught survey</div><div class="text-3xl font-black ${tone}">${cargo.magnitude.toFixed(1)} t</div><div class="text-xs font-bold ${tone}">${cargo.direction}</div><div class="mt-1 text-[8px] text-slate-500">Final net displacement − Initial net displacement. Assumes unchanged lightship basis and that all changing non-cargo weights are included as deductibles.</div>`;}else box.innerHTML='<div class="text-slate-500">Complete both Initial and Final surveys to calculate cargo loaded/discharged.</div>';}
 updateDraftSurveyVesselBanner();
}
function currentDraftSurveyDeductibles(){
 const d={ballast:0,freshWater:0,fuelOil:0,dieselOil:0,lubeOil:0,slopsBilge:0,anchorChain:0,other:0};
 try{d.ballast=state.ballastPlanEnabled?ballastPlanTotals().mass:0;}catch(e){}
 if(isGreatFortuneWorkbookVessel()){
  (GREAT_FORTUNE_WORKBOOK_DATA.sourceItems||[]).forEach(r=>{const m=Math.max(0,Number(r.mass)||0),c=String(r.content||'').toUpperCase(),nm=String(r.name||'').toUpperCase();if(c==='F.W.')d.freshWater+=m;else if(c==='H.F.O.')d.fuelOil+=m;else if(c==='D.O.')d.dieselOil+=m;else if(c==='L.O.')d.lubeOil+=m;else if(c==='MISC.')d.slopsBilge+=m;else if(/CREW|STORE|PROVISION/.test(nm))d.other+=m;});
 }
 return d;
}
function draftSurveyFillRole(role,data={}){
 const pre=role==='initial'?'dsInitial':'dsFinal',r=data.readings||{};
 [['FwdP',r.forwardPort],['FwdS',r.forwardStarboard],['MidP',r.midshipPort],['MidS',r.midshipStarboard],['AftP',r.aftPort],['AftS',r.aftStarboard]].forEach(([s,v])=>draftSurveySet(pre+s,v,3));draftSurveySet(pre+'Density',data.density,4);
 const dd=data.deductibles||{};DRAFT_SURVEY_DEDUCTIBLES.forEach(([k])=>draftSurveySet(pre+k[0].toUpperCase()+k.slice(1),dd[k]||0,1));
}
function draftSurveyLoadCurrent(role='initial'){
 calculateAll({curve:false});const F=Number(state.draftBow),A=Number(state.draftStern);if(!Number.isFinite(F)||!Number.isFinite(A)){alert('Current forward/aft draughts are unavailable.');return;}const M=(F+A)/2,heel=Number(state.heel)||0,half=Math.max(0,Number(state.beam)||0)*.5*Math.tan(heel*Math.PI/180),mk=x=>({port:x-half,starboard:x+half});const f=mk(F),m=mk(M),a=mk(A);
 draftSurveyFillRole(role,{readings:{forwardPort:f.port,forwardStarboard:f.starboard,midshipPort:m.port,midshipStarboard:m.starboard,aftPort:a.port,aftStarboard:a.starboard},density:Number(state.density)||1.025,deductibles:currentDraftSurveyDeductibles()});draftSurveyValidationTarget=null;if(draftSurveyTankContext().available)draftSurveyTankLoadCurrent(role);else calculateDraftSurveyUI();
}
function draftSurveyLoadGreatFortuneValidation(){
 if(!isGreatFortuneWorkbookVessel())loadGreatFortuneWorkbookCondition();
 draftSurveySet('dsMarkFwdOffset',0,2);draftSurveySet('dsMarkMidOffset',0,2);draftSurveySet('dsMarkAftOffset',0,2);draftSurveySet('dsKeelThickness',0,3);
 const t=GREAT_FORTUNE_WORKBOOK_DATA.target,F=t.draftFwd,A=t.draftAft,trim=t.trimByStern;
 // The workbook supplies FWD/AFT/mean hydrostatic condition but no midship observation. This midship value is a DERIVED teaching reading chosen so the UN/ECE M/M/M + trim-correction workflow closes on the workbook displacement.
 const validationSurveyDraft=7.914697954953178,extreme=(F+A)/2,mid=(4*validationSurveyDraft-extreme)/3;
 draftSurveyTankEntries.final={};draftSurveyTankTotals.final=null;draftSurveyFillRole('final',{readings:{forwardPort:F,forwardStarboard:F,midshipPort:mid,midshipStarboard:mid,aftPort:A,aftStarboard:A},density:1.025,deductibles:{}});draftSurveyValidationTarget=t.disp;calculateDraftSurveyUI();draftSurveyRenderTankPanel('final',true);
 const note=document.getElementById('draftSurveyTeachingNote');if(note)note.innerHTML=`<b class="text-violet-300">Validation case loaded.</b> GREAT FORTUNE FWD ${F.toFixed(3)} m, AFT ${A.toFixed(3)} m and trim ${trim.toFixed(3)} m by stern are source-workbook values. Midship ${mid.toFixed(3)} m is an <b>AMCOL-derived teaching observation</b> because the workbook does not contain a midship draught reading.`;
}
function draftSurveyReset(){
 ['Initial','Final'].forEach(role=>{['FwdP','FwdS','MidP','MidS','AftP','AftS'].forEach(s=>draftSurveySet('ds'+role+s,NaN));const ctx=draftSurveyHydroContext();draftSurveySet('ds'+role+'Density',ctx.tableDensity,4);DRAFT_SURVEY_DEDUCTIBLES.forEach(([k])=>draftSurveySet('ds'+role+k[0].toUpperCase()+k.slice(1),0,1));});draftSurveySet('dsMarkFwdOffset',0,2);draftSurveySet('dsMarkMidOffset',0,2);draftSurveySet('dsMarkAftOffset',0,2);draftSurveySet('dsKeelThickness',0,3);draftSurveyResults={initial:null,final:null};draftSurveyValidationTarget=null;draftSurveyTankEntries={initial:{},final:{}};draftSurveyTankTotals={initial:null,final:null};draftSurveyTankPanelSig={initial:'',final:''};const note=document.getElementById('draftSurveyTeachingNote');if(note)note.innerHTML='GREAT FORTUNE can be used as a source-backed validation case. Its workbook contains FWD/AFT draught, trim, displacement, TPC, MCT1cm and LCF; midship survey draught is not contained in the workbook. GREAT FORTUNE tank sounding conversion remains unavailable because the supplied workbook has no tank calibration/sounding table.';renderDraftSurveyResults();draftSurveyRenderTankPanels(true);renderDraftSurveyMissionPanel();
}
function updateDraftSurveyVesselBanner(){
 const box=document.getElementById('draftSurveyStatus');if(!box)return;const ctx=draftSurveyHydroContext(),p=ctx.pack,bulk=state.hullType==='bulk';
 const tc=draftSurveyTankContext();box.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2"><div><b class="text-cyan-300">${escapeHtml(state.companyName||'—')} · ${escapeHtml(state.vesselName||'Training vessel')}</b><br><span class="text-slate-500">${escapeHtml(vesselPresets[state.hullType]?.label||state.hullType)} · LBP ${Number(state.length||0).toFixed(2)} m · hydro table ${ctx.rows.length} rows · table density ${ctx.tableDensity.toFixed(4)}</span></div><span class="px-2 py-1 rounded-full border ${bulk&&ctx.rows.length?'border-emerald-500/30 text-emerald-300 bg-emerald-500/10':'border-amber-500/30 text-amber-300 bg-amber-500/10'} font-bold text-[8px]">${bulk&&ctx.rows.length?'BULK DRAUGHT SURVEY READY':ctx.rows.length?'NON-BULK · TRAINING USE':'HYDRO TABLE REQUIRED'}</span></div><div class="mt-1 text-[8px] text-slate-500">Hydro authority: ${escapeHtml(p.label||'Geometry model')} · Tank sounding: <span class="${tc.available?'text-cyan-300':'text-amber-300'}">${tc.available?escapeHtml(tc.authority):'NOT AVAILABLE'}</span>. Draught survey results are educational unless based on approved vessel hydrostatic and tank-calibration documents.</div>`;draftSurveyRenderTankPanels();
}
function draftSurveyRoleCard(role,label,tone){
 const pre=role==='initial'?'dsInitial':'dsFinal';const ded=DRAFT_SURVEY_DEDUCTIBLES.map(([k,nm])=>`<label class="text-[8px] text-slate-500">${nm}<input id="${pre}${k[0].toUpperCase()+k.slice(1)}" type="number" min="0" step="0.1" value="0" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[9px]"></label>`).join('');
 return `<div class="draft-survey-role-card rounded-xl border border-slate-800 bg-slate-950/55 p-3 space-y-3"><div class="flex items-center justify-between gap-2"><div class="font-black ${tone}">${label.toUpperCase()} SURVEY</div><button onclick="draftSurveyLoadCurrent('${role}')" class="px-2 py-1 rounded border border-cyan-700/40 text-cyan-300 text-[8px]">Use Current Condition</button></div><div class="draft-survey-reading-grid text-[8px]"><div class="text-slate-500">Station</div><div class="text-slate-500 text-center">PORT m</div><div class="text-slate-500 text-center">STARBOARD m</div>${[['FWD','Fwd'],['MID','Mid'],['AFT','Aft']].map(([nm,k])=>`<div class="font-bold text-slate-300">${nm}</div><input id="${pre}${k}P" type="number" step="0.001" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[9px]"><input id="${pre}${k}S" type="number" step="0.001" class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[9px]">`).join('')}</div><label class="block text-[8px] text-slate-500">Observed water density t/m³<input id="${pre}Density" type="number" min="0.95" max="1.05" step="0.0001" value="1.0250" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[9px]"></label><details class="rounded-lg border border-slate-800 p-2"><summary class="cursor-pointer text-[9px] font-bold text-amber-300">Deductibles</summary><div class="grid grid-cols-2 gap-2 mt-2">${ded}</div></details><details class="rounded-lg border border-cyan-900/40 p-2"><summary class="cursor-pointer text-[9px] font-bold text-cyan-300">Tank Sounding / Ullage Calculator</summary><div id="${role==='initial'?'dsInitialTankSoundingPanel':'dsFinalTankSoundingPanel'}" class="mt-2"></div></details><div id="${role==='initial'?'dsInitialResult':'dsFinalResult'}" class="text-[9px]"></div></div>`;
}
function draftSurveyPanelHTML(){
 return `<div class="clean-section-intro"><div><div class="clean-section-kicker">Cargo Operations</div><div class="clean-section-title">Bulk Carrier Draught Survey</div><div class="clean-section-copy">Six draught observations → mark corrections → M/M/M draught → hydrostatics → trim/density corrections → tank soundings/ullages + deductibles → cargo.</div></div></div>
 <div id="draftSurveyStatus" class="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-3 text-[9px]"></div>
 <div id="dsMissionPanel"></div>
 <div class="rounded-xl border border-amber-900/40 bg-amber-950/10 p-3 text-[9px]"><b class="text-amber-300">Method basis:</b> educational implementation of the UN/ECE Draught Survey Code workflow (ECE/ENERGY/19). Use approved ship hydrostatic/tank tables for operational surveys. The simulator uses the active vessel hydrostatic table and never invents missing source observations or tank calibration tables.<div id="draftSurveyTeachingNote" class="mt-1 text-slate-500">GREAT FORTUNE can be used as a source-backed validation case. Its workbook contains FWD/AFT draught, trim, displacement, TPC, MCT1cm and LCF; midship survey draught is not contained in the workbook. Its tank masses are source-backed for the supplied condition, but no tank sounding/ullage calibration table is supplied.</div></div>
 <div class="rounded-xl border border-slate-800 bg-slate-950/55 p-3"><div class="font-bold text-slate-200 mb-2">Draft-mark geometry</div><div class="grid grid-cols-2 md:grid-cols-4 gap-2"><label class="text-[8px] text-slate-500">FWD mark offset from FP, m<br><span class="text-slate-600">+ forward / − aft</span><input id="dsMarkFwdOffset" type="number" step="0.01" value="0" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label><label class="text-[8px] text-slate-500">MID mark offset, m<br><span class="text-slate-600">+ forward / − aft</span><input id="dsMarkMidOffset" type="number" step="0.01" value="0" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label><label class="text-[8px] text-slate-500">AFT mark offset from AP, m<br><span class="text-slate-600">+ forward / − aft</span><input id="dsMarkAftOffset" type="number" step="0.01" value="0" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label><label class="text-[8px] text-slate-500">Keel thickness correction, m<input id="dsKeelThickness" type="number" min="0" step="0.001" value="0" class="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"></label></div></div>
 <div class="draft-survey-pair-grid">${draftSurveyRoleCard('initial','Initial','text-cyan-300')}${draftSurveyRoleCard('final','Final','text-emerald-300')}</div>
 <details class="rounded-xl border border-cyan-900/50 bg-cyan-950/5 p-3"><summary class="cursor-pointer font-bold text-cyan-300">Formal Tank Measurement Report · Initial vs Final</summary><div id="dsTankMeasurementReport" class="mt-3"></div></details>
 <div class="grid md:grid-cols-[1fr_auto] gap-3"><div id="dsCargoResult" class="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-4 text-[9px]"><div class="text-slate-500">Complete both surveys to calculate cargo.</div></div><div class="grid grid-cols-2 md:grid-cols-1 gap-2"><button onclick="calculateDraftSurveyUI()" class="px-4 py-2 rounded bg-cyan-500 text-slate-950 font-black text-[9px]"><i class="fa-solid fa-calculator mr-1"></i>CALCULATE SURVEY</button><button onclick="draftSurveyLoadGreatFortuneValidation()" class="px-4 py-2 rounded border border-violet-500/40 text-violet-300 font-bold text-[9px]">GREAT FORTUNE VALIDATION</button><button onclick="printDraftSurveyReport()" class="px-4 py-2 rounded border border-slate-700 text-slate-300 text-[9px]"><i class="fa-solid fa-print mr-1"></i>PRINT DRAUGHT REPORT</button><button onclick="printTankMeasurementReport()" class="px-4 py-2 rounded border border-cyan-700/50 text-cyan-300 text-[9px]"><i class="fa-solid fa-file-lines mr-1"></i>PRINT TANK SHEET</button><button onclick="draftSurveyReset()" class="px-4 py-2 rounded border border-rose-800/50 text-rose-300 text-[9px]">RESET</button></div></div>
 <details class="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><summary class="cursor-pointer font-bold text-slate-300">Calculation method & signs</summary><div class="mt-2 text-[9px] text-slate-400 leading-relaxed"><b>M/M/M draught:</b> extreme mean = (F+A)/2; mean-of-means = (extreme mean + M)/2; M/M/M = (mean-of-means + M)/2 = (extreme mean + 3M)/4.<br><b>Hog/Sag:</b> M − extreme mean; positive = sag, negative = hog.<br><b>Trim:</b> AFT − FWD; positive = by stern.<br><b>First trim correction:</b> uses TPC, signed LCF (+forward in AMCOL), trim and LBP. <b>Second/Nemoto correction:</b> uses the MCT1cm difference at survey draught ±0.50 m and is only applied when both values are inside the hydrostatic table.<br><b>Density:</b> trim-corrected displacement × observed density / hydro-table density.</div></details>`;
}
function printDraftSurveyReport(){
 calculateDraftSurveyUI();const i=draftSurveyResults.initial,f=draftSurveyResults.final,c=AMCOLPhysics.draftSurvey.cargoDifference(i,f),w=window.open('','_blank','width=950,height=900');if(!w)return;const row=(name,a,b)=>`<tr><td>${name}</td><td>${a}</td><td>${b}</td></tr>`,fmt=(r,k,d=3)=>r?.valid&&Number.isFinite(Number(k(r)))?Number(k(r)).toFixed(d):'—';w.document.write(`<html><head><title>AMCOL Draught Survey Report</title><style>body{font-family:Arial;padding:24px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd4df;padding:7px;font-size:12px}th{background:#eef2f7}</style></head><body><h2>AMCOL Bulk Carrier Draught Survey</h2><p><b>Vessel:</b> ${escapeHtml(state.companyName||'—')} · ${escapeHtml(state.vesselName||'—')}</p><p><b>Educational report:</b> UN/ECE-style calculation workflow. Not a commercial survey certificate and not a substitute for approved hydrostatic/tank tables.</p><table><tr><th>Item</th><th>Initial</th><th>Final</th></tr>${row('Corrected FWD draught, m',fmt(i,x=>x.drafts.forward),fmt(f,x=>x.drafts.forward))}${row('Corrected MID draught, m',fmt(i,x=>x.drafts.midship),fmt(f,x=>x.drafts.midship))}${row('Corrected AFT draught, m',fmt(i,x=>x.drafts.aft),fmt(f,x=>x.drafts.aft))}${row('Trim AFT−FWD, m',fmt(i,x=>x.drafts.trimAft),fmt(f,x=>x.drafts.trimAft))}${row('Hog/Sag, m',fmt(i,x=>x.drafts.hogSag,4),fmt(f,x=>x.drafts.hogSag,4))}${row('M/M/M draught, m',fmt(i,x=>x.drafts.mouldedDraft,4),fmt(f,x=>x.drafts.mouldedDraft,4))}${row('Table displacement, t',fmt(i,x=>x.hydro.displacementTable,1),fmt(f,x=>x.hydro.displacementTable,1))}${row('First trim correction, t',fmt(i,x=>x.hydro.firstTrimCorrection,2),fmt(f,x=>x.hydro.firstTrimCorrection,2))}${row('Second trim correction, t',fmt(i,x=>x.hydro.secondTrimCorrection,2),fmt(f,x=>x.hydro.secondTrimCorrection,2))}${row('Corrected displacement, t',fmt(i,x=>x.correctedDisplacement,1),fmt(f,x=>x.correctedDisplacement,1))}${row('Ballast by sounding/ullage, t',draftSurveyTankTotals.initial?.validCount?draftSurveyTankTotals.initial.totalMassT.toFixed(1):'—',draftSurveyTankTotals.final?.validCount?draftSurveyTankTotals.final.totalMassT.toFixed(1):'—')}${row('Deductibles, t',fmt(i,x=>x.deductibles.total,1),fmt(f,x=>x.deductibles.total,1))}${row('Net displacement, t',fmt(i,x=>x.netDisplacement,1),fmt(f,x=>x.netDisplacement,1))}</table><p style="font-size:10px;color:#667085">Tank sounding/ullage quantities are educational unless based on the vessel’s approved tank calibration tables. GREAT FORTUNE sounding conversion is disabled because no tank calibration table was supplied.</p><h3>Cargo Result</h3><p style="font-size:24px;font-weight:bold">${c.valid?c.magnitude.toFixed(1)+' t '+c.direction:'Complete both surveys'}</p></body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
}


function initCleanUI(){
 document.body.classList.add('clean-ui','ui-basic');
 togglePresentationMode(localStorage.getItem('amcol_presentation_mode')==='1');
 const content=document.getElementById('tabVessel')?.parentElement;if(!content)return;
 let ops=document.getElementById('tabOperations');if(!ops){ops=document.createElement('section');ops.id='tabOperations';ops.className='space-y-3 hidden';content.appendChild(ops);}
 let data=document.getElementById('tabData');if(!data){data=document.createElement('section');data.id='tabData';data.className='space-y-3 hidden';content.appendChild(data);}
 let draftSurvey=document.getElementById('tabDraftSurvey');if(!draftSurvey){draftSurvey=document.createElement('section');draftSurvey.id='tabDraftSurvey';draftSurvey.className='space-y-3 hidden';draftSurvey.innerHTML=draftSurveyPanelHTML();content.appendChild(draftSurvey);}
 const vessel=document.getElementById('tabVessel'),loading=document.getElementById('tabCargoOps'),env=document.getElementById('tabEnvironment'),stability=document.getElementById('tabPhysics'),mission=document.getElementById('tabSimulate');
 if(vessel&&!vessel.querySelector('.clean-section-intro'))vessel.prepend(cleanIntro('Ship','Vessel & Particulars','Choose the ship, dimensions, reference vessel and lightship condition.'));
 if(loading&&!loading.querySelector('.clean-section-intro'))loading.prepend(cleanIntro('Loading','Cargo & Ballast','Build the loading condition with cargo, holds, ballast and free-surface effects.'));
 if(env&&!env.querySelector('.clean-section-intro'))env.prepend(cleanIntro('Environment','Weather & Sea','Apply wind, waves, current, water density, depth and visibility.'));
 if(stability&&!stability.querySelector('.clean-section-intro'))stability.prepend(cleanIntro('Stability','Equilibrium & Analysis','Check GM, list, trim, GZ behaviour, intact-stability criteria and roll response.','<button class="clean-quick-btn" onclick="findAndSetEquilibrium()"><i class="fa-solid fa-scale-balanced mr-1 text-amber-300"></i>Find equilibrium</button><button class="clean-quick-btn" onclick="showGZPanel()"><i class="fa-solid fa-chart-area mr-1 text-cyan-300"></i>Open GZ curve</button>'));
 ops.appendChild(cleanIntro('Operations','Special Operations','Crane lifts, suspended loads, flooding/damage and interactive 3D operational tools.','<button class="clean-quick-btn" onclick="setDisplayMode(\'3d\');setTimeout(()=>window.AMCOL3D?.toggleCleanTool(\'operations\'),120)"><i class="fa-solid fa-cube mr-1 text-violet-300"></i>3D operations</button><button class="clean-quick-btn" onclick="setDisplayMode(\'3d\');setTimeout(()=>window.AMCOL3D?.toggleCleanTool(\'ballast\'),120)"><i class="fa-solid fa-droplet mr-1 text-blue-300"></i>Ballast transfer lab</button>'));
 data.appendChild(cleanIntro('Data','Hydrostatic & Vessel Data','Inspect the active data source, hydrostatic table, KN/cross-curves and uploaded vessel data.','<button class="clean-quick-btn" onclick="openHydrostaticTableModal()"><i class="fa-solid fa-table mr-1 text-emerald-300"></i>Hydrostatic table</button><button class="clean-quick-btn" onclick="toggleGZDataDrawer();showGZPanel()"><i class="fa-solid fa-chart-area mr-1 text-amber-300"></i>GZ / KN data</button>'));
 if(mission&&!mission.querySelector('.clean-section-intro'))mission.prepend(cleanIntro('Mission','Ship Stability Mission','Free Customisation is the default. Select a training mission only when assessment guidance is needed.'));

 if(data&&!document.getElementById('dataCompletenessCard')){
  const authority=document.createElement('details');authority.id='dataAuthorityCard';authority.open=true;authority.className='rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-3';authority.innerHTML='<summary class="cursor-pointer font-bold text-cyan-300">Data Authority · What Is Real vs Modelled</summary><div id="dataAuthorityReadout" class="mt-3 space-y-2 text-[9px]"></div>';data.appendChild(authority);
  const train=document.createElement('details');train.id='amcolTrainingDataCard';train.className='rounded-xl border border-violet-900/60 bg-violet-950/15 p-3';train.innerHTML='<summary class="cursor-pointer font-bold text-violet-300">AMCOL Training Vessel Data Pack</summary><div id="amcolTrainingDataReadout" class="mt-3 text-[9px] text-slate-300"></div>';data.appendChild(train);
  const card=document.createElement('details');card.id='dataCompletenessCard';card.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3';card.innerHTML='<summary class="cursor-pointer font-bold text-cyan-300">Vessel Data Completeness</summary><div id="dataCompletenessReadout" class="mt-3 text-[9px]"></div>';data.appendChild(card);
  const hull=document.createElement('details');hull.id='hullEnvelopeCard';hull.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3 advanced-only';hull.innerHTML='<summary class="cursor-pointer font-bold text-cyan-300">Hull Station / Offset Envelope</summary><div id="hullEnvelopeStatus" class="mt-2 text-[9px]"></div><div class="mt-2 grid grid-cols-3 gap-2"><label class="col-span-2 px-2 py-1.5 rounded border border-cyan-700/40 text-cyan-300 text-center cursor-pointer">Import station CSV<input type="file" accept=".csv" class="hidden" onchange="importHullStationEnvelope(this.files);this.value=null"></label><button onclick="downloadHullStationTemplate()" class="px-2 py-1.5 rounded border border-slate-700 text-slate-300">Template</button><button onclick="clearHullStationEnvelope()" class="col-span-3 px-2 py-1 rounded border border-rose-800/40 text-rose-300">Clear imported hull envelope</button></div>';data.appendChild(hull);
  const vi=document.createElement('details');vi.id='vesselPackageImportCard';vi.className='rounded-xl border border-sky-900/50 bg-sky-950/10 p-3 advanced-only';vi.innerHTML='<summary class="cursor-pointer font-bold text-sky-300">Vessel Data Package · Import / Export</summary><div class="mt-2 text-[8px] text-slate-500">Import a complete instructor/user vessel JSON package containing particulars and at least a monotonic hydrostatic table. KN, tanks, tank calibration, station envelopes, conditions and structural limits are optional. Imported data are always labelled <b>USER IMPORTED</b> until independently verified.</div><div class="mt-2 grid grid-cols-3 gap-2"><label class="rounded border border-sky-700/40 text-sky-300 py-1.5 text-center cursor-pointer">Import vessel<input type="file" accept=".json" class="hidden" onchange="importVesselPackage(this.files);this.value=null"></label><button onclick="downloadVesselPackageTemplate()" class="rounded border border-slate-700 text-slate-300">Template</button><button onclick="exportActiveVesselPackage()" class="rounded border border-violet-700/40 text-violet-300">Export active</button></div>';data.appendChild(vi);
  const lib=document.createElement('details');lib.id='conditionLibraryCard';lib.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3';lib.innerHTML='<summary class="cursor-pointer font-bold text-cyan-300">Condition Library · Save / Compare / Transfer</summary><div class="mt-3 grid md:grid-cols-3 gap-2"><input id="conditionNameInput" placeholder="Condition name" class="md:col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200"><button onclick="saveCurrentCondition()" class="rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">Save Current</button><select id="conditionLibrarySelect" class="md:col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200"><option value="">Choose saved condition…</option></select><div id="conditionLibraryCount" class="text-right text-[8px] text-slate-500 self-center">0/12 saved</div><button onclick="loadSelectedCondition()" class="rounded border border-emerald-700/40 text-emerald-300 py-1.5">Load</button><button onclick="compareSelectedCondition()" class="rounded border border-amber-700/40 text-amber-300 py-1.5">Compare</button><button onclick="deleteSelectedCondition()" class="rounded border border-rose-800/40 text-rose-300 py-1.5">Delete</button><button onclick="exportCurrentConditionJSON()" class="rounded border border-cyan-700/40 text-cyan-300 py-1.5">Export Current</button><button onclick="exportConditionLibraryJSON()" class="rounded border border-violet-700/40 text-violet-300 py-1.5">Export Library</button><label class="rounded border border-emerald-700/40 text-emerald-300 py-1.5 text-center cursor-pointer">Import JSON<input id="conditionImportInput" type="file" accept=".json,.amcol-condition.json" class="hidden" onchange="importConditionJSON(this.files)"></label></div><div id="conditionCompareReadout" class="mt-3 text-[9px] text-slate-300"></div><div class="mt-2 text-[8px] text-slate-500">Condition exports include vessel state, cargo, ballast, operational limits and any custom station envelope. Derived hydro/strength results are recalculated when imported.</div>';data.appendChild(lib);
  const diag=document.createElement('details');diag.id='physicsValidationCard';diag.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3 advanced-only';diag.innerHTML='<summary class="cursor-pointer font-bold text-violet-300">Physics, Challenge & Release Diagnostics</summary><div class="mt-3 grid grid-cols-2 gap-2"><button onclick="runPhysicsValidationSuite()" class="py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-300 font-bold">Core Physics</button><button onclick="runVesselDataRegressionSuite()" class="py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">Vessel Data</button><button onclick="runChallengeRegressionSuite()" class="py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">25 Challenges</button><button onclick="runReleaseAcceptanceSuite()" class="py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">Classroom Acceptance</button></div><div id="physicsValidationReadout" class="mt-2 space-y-1 text-[9px] text-slate-300">Checks GREAT FORTUNE targets and transverse-force sign symmetry, then restores the current condition.</div><div id="vesselDataRegressionReadout" class="mt-2 space-y-1 text-[9px] text-slate-300">Checks every embedded vessel for hydro monotonicity, KN↔KMT consistency, loading mass closure and FWD/AFT trim closure.</div><div id="challengeRegressionReadout" class="mt-2 space-y-1 text-[9px] text-slate-300">Challenge regression loads each challenge, applies its reference solution and verifies the current PASS logic.</div><div id="releaseAcceptanceReadout" class="mt-2 space-y-1 text-[9px] text-slate-300">Run on the actual classroom PC to verify browser, storage, Worker, WebGL, 3D-module and frame-cadence readiness.</div>';data.appendChild(diag);
 }
 if(stability&&!document.getElementById('operationalLimitsCard')){
  const lim=document.createElement('details');lim.id='operationalLimitsCard';lim.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3 advanced-only';lim.innerHTML='<summary class="cursor-pointer font-bold text-amber-300">Operational Draft & Margin Advisories</summary><div id="operationalLimitsReadout" class="mt-3 text-[9px]"></div>';stability.appendChild(lim);
  const df=document.createElement('details');df.id='downfloodBasisCard';df.className='rounded-xl border border-slate-800 bg-slate-950/45 p-3';df.innerHTML='<summary class="cursor-pointer font-bold text-cyan-300">Downflooding / Deck-Edge Basis</summary><div id="downfloodBasisReadout" class="mt-3 text-[9px]"></div>';stability.appendChild(df);
  const sk=document.createElement('details');sk.id='seakeepingProxyCard';sk.className='rounded-xl border border-sky-900/50 bg-sky-950/10 p-3 advanced-only';sk.innerHTML='<summary class="cursor-pointer font-bold text-sky-300">Advanced Seakeeping Response Proxy</summary><div id="seakeepingProxyReadout" class="mt-3 text-[9px]"></div>';stability.appendChild(sk);
 }

 draftSurveyReset();updateDraftSurveyVesselBanner();

 // Re-home existing cards; IDs and event handlers remain unchanged.
 cleanMoveTopCard('checkCrane',ops);cleanMoveTopCard('checkDamage',ops);
 cleanMoveTopCard('hydroDataPackSelect',data);cleanMoveTopCard('hydroUploadInput',data);cleanMoveTopCard('physicsFidelityBadge',data);
 cleanMoveTopCard('hydroReference',data);
 const boundary=[...mission?.children||[]].find(n=>String(n.textContent||'').includes('Validation boundary'));if(boundary)data.appendChild(boundary);
 cleanMoveTopCard('imoOverall',stability);cleanMoveTopCard('grainOverall',stability);
 const auditLabel=[...mission?.children||[]].find(n=>String(n.textContent||'').trim()==='Audit & Special Stability');if(auditLabel)stability.appendChild(auditLabel);

 // Advanced disclosure: complex data/solver controls are hidden in Basic mode.
 ['hydroUploadInput','physicsFidelityBadge','coupledSolverBadge','runDynamicsBtn','grainOverall','hydroReference'].forEach(id=>{const el=document.getElementById(id);if(!el)return;let n=el;while(n.parentElement&&n.parentElement.tagName!=='SECTION')n=n.parentElement;n.classList.add('advanced-only');});

 // Top toolbar keeps view controls only; primary actions live in the persistent bottom bar.
 document.querySelectorAll('#simulatorMain .h-11 button').forEach(b=>{const oc=b.getAttribute('onclick')||'';if(/findAndSetEquilibrium|setHeel\(0\)|resetRollPhysics|testCurrentStability/.test(oc))b.classList.add('legacy-top-action');});
 const actionLabel=[...document.querySelectorAll('#simulatorMain .h-11 span')].find(s=>s.textContent.trim()==='Actions');actionLabel?.classList.add('legacy-top-action');

 setCleanControlMode(localStorage.getItem('amcol_clean_control_mode')||'basic');
 toggleCleanNavCompact(localStorage.getItem('amcol_clean_nav_compact')==='1');
 const remembered=localStorage.getItem('amcol_clean_active_section');if(remembered&&['vessel','cargoOps','environment','operations','physics','data','simulate'].includes(remembered))switchTab(remembered);else switchTab('vessel');
 content.querySelectorAll('section>details[open]').forEach(d=>d.open=false);
 loadConditionLibrary();renderOperationalLimitsCard();renderDataCompleteness();renderDataAuthority();renderAMCOLTrainingDataPanel();renderHullEnvelopeStatus();renderDownfloodBasis();
 bindCleanFeedback();
}
function togglePresentationMode(force=null){
 const next=force===null?!document.body.classList.contains('presentation-mode'):!!force;
 document.body.classList.toggle('presentation-mode',next);
 const b=document.getElementById('presentationModeBtn');if(b){b.classList.toggle('active',next);b.setAttribute('aria-pressed',String(next));b.title=next?'Exit Presentation / large-text mode':'Presentation / large-text mode';}
 try{localStorage.setItem('amcol_presentation_mode',next?'1':'0');}catch(e){}
 setTimeout(()=>{resizeCanvas();render();window.AMCOL3D?.resize?.();},30);
}
function setCleanControlMode(mode){
 cleanControlMode=mode==='advanced'?'advanced':'basic';document.body.classList.toggle('ui-basic',cleanControlMode==='basic');document.body.classList.toggle('ui-advanced',cleanControlMode==='advanced');
 document.getElementById('cleanBasicBtn')?.classList.toggle('active',cleanControlMode==='basic');document.getElementById('cleanAdvancedBtn')?.classList.toggle('active',cleanControlMode==='advanced');
 try{localStorage.setItem('amcol_clean_control_mode',cleanControlMode);}catch(e){}
}
function toggleCleanNavCompact(forceCompact=null){
 const wrap=document.getElementById('cleanNavWrap');if(!wrap)return;
 const compact=typeof forceCompact==='boolean'?forceCompact:!wrap.classList.contains('nav-compact');
 wrap.classList.toggle('nav-compact',compact);
 const btn=document.getElementById('cleanNavCollapseBtn');
 if(btn){btn.title=compact?'Expand navigation':'Compact navigation';btn.setAttribute('aria-label',btn.title);}
 try{localStorage.setItem('amcol_clean_nav_compact',compact?'1':'0');}catch(e){}
 setTimeout(()=>{resizeCanvas?.();window.AMCOL3D?.resize?.();},180);
}
function toggleStatusPanel(forceHide=null){
 const shell=document.getElementById('appShell');if(!shell)return;const hide=typeof forceHide==='boolean'?forceHide:!shell.classList.contains('status-collapsed');shell.classList.toggle('status-collapsed',hide);setTimeout(()=>{resizeCanvas();window.AMCOL3D?.resize?.();},230);
}
function showCleanFeedback(message){
 const box=document.getElementById('cleanChangeFeedback'),txt=document.getElementById('cleanChangeFeedbackText');if(!box||!txt)return;txt.textContent=message;box.classList.add('show');clearTimeout(cleanFeedbackTimer);cleanFeedbackTimer=setTimeout(()=>box.classList.remove('show'),2400);
}
function bindCleanFeedback(){
 const labels={inputHullType:'Vessel type changed — particulars and hull geometry recalculated.',inputLightshipKG:'Lightship KG changed — GM and GZ updated.',inputWaterDepth:'Water depth changed — UKC and finite-depth wave physics updated.',inputDensity:'Water density changed — draft and hydrostatics recalculated.',inputWindSpeed:'Wind speed changed — environmental heeling moment recalculated.',inputCurrentSpeed:'Current speed changed — transverse current load recalculated.',inputWaveHeight:'Wave height changed — sea state and roll forcing updated.',inputCraneMass:'Suspended load changed — KG/TCG and stability recalculated.',checkDamage:'Damage/flooding state changed — equilibrium recalculated.',checkFSE:'Free-surface setting changed — corrected KG and GM recalculated.'};
 Object.entries(labels).forEach(([id,msg])=>document.getElementById(id)?.addEventListener('change',()=>showCleanFeedback(msg)));
}
function setNavDot(id,kind){const el=document.getElementById(id);if(!el)return;el.className=`clean-nav-dot dot-${kind}`;}
function updateCleanLivePanel(){
 if(!state||!Number.isFinite(state.dispMass))return;
 const hp=typeof hydroPack==='function'?hydroPack():null;
 const vessel=state.vesselName||vesselPresets?.[state.hullType]?.label||'Training vessel';
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
 set('liveVesselName',vessel);set('liveDataSource',`${hp?.badge||'MODEL'} · ${hp?.label||'Geometry model'}`);
 set('liveDisp',`${state.dispMass.toFixed(0)} t`);set('liveDraft',`${state.eqDraft.toFixed(2)} m`);set('liveGM',`${state.gm.toFixed(3)} m`);set('liveKG',`${state.kgCorr.toFixed(3)} m`);
 const listMag=Math.abs(state.equilibrium||0),listSide=listMag<.05?'UPRIGHT':((state.equilibrium||0)<0?'PORT':'STBD');set('liveList',listMag<.05?'0.00°':`${listMag.toFixed(2)}° ${listSide}`);
 const trim=Math.abs((state.draftStern||0)-(state.draftBow||0)),trimDir=trim<.005?'EVEN':((state.draftStern||0)>(state.draftBow||0)?'AFT':'FWD');set('liveTrim',trim<.005?'EVEN':`${trim.toFixed(2)} m ${trimDir}`);
 set('liveFSC',`${state.fsc.toFixed(3)} m`);set('liveUKC',`${state.ukc.toFixed(2)} m`);set('liveEndDrafts',`${state.draftBow.toFixed(2)} / ${state.draftStern.toFixed(2)} m`);
 const status=document.getElementById('liveStabilityStatus'),reason=document.getElementById('liveStatusReason');let tone='good',label='STABLE';
 if(state.hydro?.invalid||!state.equilibriumValid||state.gm<=0){tone='bad';label='UNSAFE';}
 else if(state.gm<.30||Math.abs(state.equilibrium)>5||state.ukc<1){tone='warn';label='ATTENTION';}
 const opChecks=operationalLimitChecks(),opFail=opChecks.some(c=>!c.pass);if(opFail&&tone==='good'){tone='warn';label='ATTENTION';}
 if(status){status.className=`live-status-pill ${tone}`;status.textContent=label;}
 if(reason){reason.textContent=tone==='bad'?'The current condition has an invalid/unstable equilibrium. Review loading and stability.':opFail?'Equilibrium exists, but one or more enabled operational advisory limits are exceeded.':tone==='warn'?'Equilibrium exists, but one or more teaching margins need attention.':'Positive corrected GM and a valid equilibrium are available.';}
 renderOperationalLimitsCard();renderDataCompleteness();renderDownfloodBasis();
 const cargoMass=(cargoItems||[]).reduce((s,x)=>s+(+x.mass||0),0),envOn=!!(state.windEnabled||state.currentEnabled||state.waveEnabled),opsOn=!!(state.crane||state.damage),sourceBacked=hp&&hp.kind!=='geometry';
 setNavDot('navDotShip',state.length>0&&state.beam>0&&state.depth>0?'good':'bad');setNavDot('navDotLoading',cargoMass>0||state.ballastPlanEnabled?'info':'idle');setNavDot('navDotEnvironment',envOn?'info':'idle');setNavDot('navDotOperations',state.damage?'bad':opsOn?'warn':'idle');setNavDot('navDotStability',tone==='bad'?'bad':tone==='warn'?'warn':'good');setNavDot('navDotData',sourceBacked?'good':'idle');setNavDot('navDotDraftSurvey',state.hullType==='bulk'&&((hydroPack().rows||[]).length>1)?'good':'idle');setNavDot('navDotMission',unifiedMission?.active?'info':'idle');
}

function switchTab(name){
 const aliases={scenario:'simulate',mission:'simulate',imo:'physics',cargo:'cargoOps',loading:'cargoOps',ops:'operations',env:'environment',stability:'physics'};
 name=aliases[name]||name;
 const tabs={
  vessel:{panel:'tabVessel',button:'tabBtnVessel'},
  cargoOps:{panel:'tabCargoOps',button:'tabBtnCargoOps'},
  environment:{panel:'tabEnvironment',button:'tabBtnEnvironment'},
  operations:{panel:'tabOperations',button:'tabBtnOperations'},
  physics:{panel:'tabPhysics',button:'tabBtnPhysics'},
  data:{panel:'tabData',button:'tabBtnData'},
  draftSurvey:{panel:'tabDraftSurvey',button:'tabBtnDraftSurvey'},
  simulate:{panel:'tabSimulate',button:'tabBtnSimulate'}
 };
 if(!tabs[name])name='vessel';
 Object.entries(tabs).forEach(([key,cfg])=>{
  const panel=document.getElementById(cfg.panel),button=document.getElementById(cfg.button),active=key===name;
  panel?.classList.toggle('hidden',!active);
  if(button){button.setAttribute('aria-selected',String(active));button.classList.toggle('clean-active',active);}
 });
 try{localStorage.setItem('amcol_clean_active_section',name);}catch(e){}
 if(name==='simulate')renderScenario();
 if(name==='draftSurvey'){updateDraftSurveyVesselBanner();renderDraftSurveyResults();}
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}

function cloneMissionSnapshot(){
 return {
  state:{
   hullType:state.hullType,amcolTrainingVesselId:state.amcolTrainingVesselId,companyName:state.companyName,vesselName:state.vesselName,hydroDataKey:state.hydroDataKey,sourceConditionKey:state.sourceConditionKey,length:state.length,beam:state.beam,depth:state.depth,density:state.density,waterDepth:state.waterDepth,
   lightshipMass:state.lightshipMass,lightshipKG:state.lightshipKG,lightshipTCG:state.lightshipTCG,lightshipLCG:state.lightshipLCG,
   fse:state.fse,tankCount:state.tankCount,tankLength:state.tankLength,tankBreadth:state.tankBreadth,tankDensity:state.tankDensity,tankFill:state.tankFill,ballastPlanEnabled:state.ballastPlanEnabled,ballastPlanSource:state.ballastPlanSource,ballastPlanLabel:state.ballastPlanLabel,
   crane:state.crane,craneMass:state.craneMass,craneHeight:state.craneHeight,craneOutreach:state.craneOutreach,craneSide:state.craneSide,craneLCG:state.craneLCG,
   damage:state.damage,damageMode:state.damageMode,dmgMass:state.dmgMass,dmgVCG:state.dmgVCG,dmgTCG:state.dmgTCG,
   krRatio:state.krRatio,damping:state.damping,waveEnabled:state.waveEnabled,waveHeight:state.waveHeight,waveLength:state.waveLength,waveSpeed:state.waveSpeed,waveHeading:state.waveHeading,waveGain:state.waveGain,waveMoment:state.waveMoment,wavePeriod:state.wavePeriod,rollMode:state.rollMode,windEnabled:state.windEnabled,windSpeedKts:state.windSpeedKts,windDirection:state.windDirection,currentEnabled:state.currentEnabled,currentSpeedKts:state.currentSpeedKts,currentDirection:state.currentDirection
  },
  cargo:deepClonePlain(cargoItems),ballast:deepClonePlain(ballastTanks),customHull:deepClonePlain(window.AMCOL_CUSTOM_HULL_FORM),operationalLimits:deepClonePlain(operationalLimits)
 };
}
function restoreMissionSnapshot(snap){
 if(!snap)return;
 Object.assign(state,snap.state);cargoItems=deepClonePlain(snap.cargo||[]);ballastTanks=deepClonePlain(snap.ballast||[]);window.AMCOL_CUSTOM_HULL_FORM=deepClonePlain(snap.customHull);operationalLimits=deepClonePlain(snap.operationalLimits||operationalLimits);
 restoreAMCOLTrainingContextFromState();
 bumpSpaceLayoutRevision('mission-restore');syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();commitVesselVisualRefresh('mission-restore');
}
function startRandomStabilityMission(){
 let next=Math.floor(Math.random()*stabilityMissions.length);
 if(stabilityMissions.length>1&&next===stabilityMission.index)next=(next+1)%stabilityMissions.length;
 const mission=stabilityMissions[next];
 vesselVisualTransaction=true;try{mission.apply();ensureCurrentVesselSpaceLayout({force:true,render:false});syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll({curve:false});}finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh(`random-mission:${mission.key}`);
 stabilityMission={active:true,index:next,key:mission.key,attempts:0,hints:0,initial:null};
 stabilityMission.initial=cloneMissionSnapshot();
 document.getElementById('missionIdle').classList.add('hidden');
 document.getElementById('missionActive').classList.remove('hidden');
 document.getElementById('missionDiagnosis').value='';
 document.getElementById('missionBrief').textContent=mission.brief;
 document.getElementById('missionAllowedControls').textContent=mission.allowed;
 document.getElementById('missionTarget').textContent=mission.target;
 document.getElementById('missionNumber').textContent=`${next+1}/${stabilityMissions.length}`;
 document.getElementById('missionAttempts').textContent='0';
 document.getElementById('missionHints').textContent='0';
 document.getElementById('missionScore').textContent='100';
 document.getElementById('missionHintBox').classList.add('hidden');
 document.getElementById('missionFeedback').classList.add('hidden');
 switchTab('scenario');
 updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 updateGlobalStabilityBadge(false,false);hideGlobalTestToast();
 updateMissionMetrics();
}
function resetCurrentStabilityMission(){
 if(!stabilityMission.active||!stabilityMission.initial)return;
 restoreMissionSnapshot(stabilityMission.initial);
 stabilityMission.attempts=0;stabilityMission.hints=0;
 document.getElementById('missionDiagnosis').value='';
 document.getElementById('missionAttempts').textContent='0';
 document.getElementById('missionHints').textContent='0';
 document.getElementById('missionScore').textContent='100';
 document.getElementById('missionHintBox').classList.add('hidden');
 document.getElementById('missionFeedback').classList.add('hidden');
 updateMissionMetrics();
}
function missionScore(){
 return Math.max(20,100-stabilityMission.attempts*10-stabilityMission.hints*8);
}
function updateMissionMetrics(){
 if(!stabilityMission.active)return;
 calculateAll({curve:false});
 document.getElementById('missionMetricList').textContent=`${state.equilibrium>=0?'+':''}${state.equilibrium.toFixed(2)}°`;
 document.getElementById('missionMetricGM').textContent=`${state.gm.toFixed(3)} m`;
 document.getElementById('missionMetricFSC').textContent=`${state.fsc.toFixed(3)} m`;
 document.getElementById('missionScore').textContent=missionScore();
}
function showMissionHint(){
 if(!stabilityMission.active)return;
 const mission=stabilityMissions[stabilityMission.index];
 stabilityMission.hints=Math.min(mission.hints.length,stabilityMission.hints+1);
 const box=document.getElementById('missionHintBox');
 box.classList.remove('hidden');
 box.innerHTML=`<b>Hint ${stabilityMission.hints}/${mission.hints.length}:</b> ${mission.hints[stabilityMission.hints-1]}`;
 document.getElementById('missionHints').textContent=stabilityMission.hints;
 document.getElementById('missionScore').textContent=missionScore();
}
function submitStabilityMission(){
 if(!stabilityMission.active)return;
 calculateAll();
 const mission=stabilityMissions[stabilityMission.index];
 stabilityMission.attempts++;
 const diagnosis=document.getElementById('missionDiagnosis').value;
 const diagnosisCorrect=diagnosis===mission.diagnosis;
 const physicsCorrect=mission.check();
 const box=document.getElementById('missionFeedback');
 box.classList.remove('hidden','border-emerald-600','bg-emerald-950/30','text-emerald-100','border-rose-600','bg-rose-950/30','text-rose-100','border-amber-600','bg-amber-950/30','text-amber-100');
 document.getElementById('missionAttempts').textContent=stabilityMission.attempts;
 document.getElementById('missionScore').textContent=missionScore();
 updateMissionMetrics();
 if(diagnosisCorrect&&physicsCorrect){
  box.classList.add('border-emerald-600','bg-emerald-950/30','text-emerald-100');
  const imoPass=evaluateIMO().every(c=>c.pass);
  box.innerHTML=`<div class="font-bold text-emerald-300 mb-1"><i class="fa-solid fa-trophy mr-1"></i>MISSION PASSED · Score ${missionScore()}/100</div>
  Diagnosis correct. Final condition: equilibrium ${state.equilibrium.toFixed(2)}°, corrected GM ${state.gm.toFixed(3)} m, FSC ${state.fsc.toFixed(3)} m${imoPass?' · IMO teaching audit PASS':''}.`;
 }else if(!diagnosisCorrect&&physicsCorrect){
  box.classList.add('border-amber-600','bg-amber-950/30','text-amber-100');
  box.innerHTML='<b>The vessel condition is physically corrected, but your diagnosis is not correct yet.</b> Review what originally caused the unsafe condition, then submit again.';
 }else if(diagnosisCorrect&&!physicsCorrect){
  box.classList.add('border-amber-600','bg-amber-950/30','text-amber-100');
  box.innerHTML=`<b>Diagnosis correct, correction incomplete.</b> Current equilibrium ${state.equilibrium.toFixed(2)}°, GM ${state.gm.toFixed(3)} m and FSC ${state.fsc.toFixed(3)} m. Continue adjusting only the permitted controls.`;
 }else{
  box.classList.add('border-rose-600','bg-rose-950/30','text-rose-100');
  box.innerHTML=`<b>Not yet.</b> Reconsider both the cause and your corrective action. Current equilibrium ${state.equilibrium.toFixed(2)}°, GM ${state.gm.toFixed(3)} m and FSC ${state.fsc.toFixed(3)} m.`;
 }
}


let activeChallengeBriefingKey='';

function challengeBriefingData(key){
 const sc=scenarios[key],meta=challengeMeta[key];
 if(!sc||!meta)return null;
 return {
   key,
   title:String(sc.title||'Challenge').replace(/^Challenge\s*·\s*/i,''),
   situation:sc.brief||'',
   goal:sc.goal||'Complete the challenge target shown in the Scenario panel.',
   tasks:Array.isArray(sc.tasks)?sc.tasks:[],
   category:meta[0]||'Challenge',
   difficulty:meta[1]||''
 };
}
function showChallengeBriefing(key=null){
 const scenarioKey=key||activeScenarioKey();
 const data=challengeBriefingData(scenarioKey);
 if(!data)return false;
 activeChallengeBriefingKey=scenarioKey;

 const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
 set('challengeBriefingTitle',data.title);
 set('challengeBriefingCategory',data.category);
 set('challengeBriefingDifficulty',data.difficulty);
 set('challengeBriefingSituation',data.situation);
 set('challengeBriefingGoal',data.goal);

 const steps=document.getElementById('challengeBriefingSteps');
 if(steps){
   const taskList=data.tasks.length?data.tasks:['Review the situation and target.','Make a stability correction using the appropriate simulator controls.','Check the final condition against the target.'];
   steps.innerHTML=taskList.map((task,i)=>`
     <div class="brief-step">
       <div class="brief-step-num">${i+1}</div>
       <div class="text-[11px] leading-relaxed text-slate-200 pt-0.5">${task}</div>
     </div>`).join('');
 }
 document.getElementById('challengeBriefingBackdrop')?.classList.remove('hidden');
 document.body.style.overflow='hidden';
 setTimeout(()=>document.getElementById('challengeBriefingStartBtn')?.focus(),60);
 return true;
}
function closeChallengeBriefing(){
 document.getElementById('challengeBriefingBackdrop')?.classList.add('hidden');
 document.body.style.overflow='';
}
function maybeShowChallengeBriefing(key){
 // Ship Stability Mission presents the brief and tasks directly in the sidebar.
 // The popup remains available from the Instructions button when the student wants it.
 return !!challengeMeta[key];
}

function unifiedMissionHullLabel(){return (vesselPresets[state.hullType]?.label||String(state.hullType||'Vessel')).replace(/ ship$/i,' ship');}
function unifiedMissionSide(v){if(Math.abs(v)<.05)return 'UPRIGHT';return `${Math.abs(v).toFixed(2)}° ${v<0?'PORT':'STBD'}`;}
function captureUnifiedMissionCondition(){
 const p=hydroPack(),valid=physicsValidity();
 return {
  company:state.companyName||'',vessel:state.vesselName||'',hullType:state.hullType,hullLabel:unifiedMissionHullLabel(),length:state.length,beam:state.beam,depth:state.depth,
  sourceLabel:p.label||'Geometry model',sourceBadge:p.badge||'MODEL',sourceKind:p.kind||'geometry',hydroValid:!!valid.hydro,knValid:!!valid.kn,tankValid:!!valid.tank,
  disp:state.dispMass,draft:state.eqDraft,kg:state.kgCorr,gm:state.gm,equilibrium:state.equilibrium,fsc:state.fsc,trim:state.trimAngle,ukc:state.ukc,density:state.density,
  gz:restoringGZAt(state.equilibrium),instability:instabilityAssessment().label
 };
}
function compareMissionMetric(initial,current,unit='',digits=2,signed=false){
 if(!Number.isFinite(initial)||!Number.isFinite(current))return '—';
 const f=v=>`${signed&&v>0?'+':''}${v.toFixed(digits)}${unit}`;
 return Math.abs(current-initial)<Math.pow(10,-digits)*.5?f(current):`${f(initial)} → ${f(current)}`;
}
function missionFreeModeSelected(){return (document.getElementById('scenarioSelect')?.value||'free')==='free';}
function updateMissionSelectorUI(){
 const selected=document.getElementById('scenarioSelect')?.value||'free',btn=document.getElementById('loadScenarioBtn'),loaded=activeMissionLoaded(),same=loaded&&selected===unifiedMission.key;
 if(!btn)return;
 if(selected==='free')btn.innerHTML=loaded?'<i class="fa-solid fa-door-open mr-1"></i>Exit Mission → Free Mode':'<i class="fa-solid fa-sliders mr-1"></i>Use Free Mode';
 else if(same)btn.innerHTML='<i class="fa-solid fa-rotate-left mr-1"></i>Restart Loaded Mission';
 else btn.innerHTML=loaded?'<i class="fa-solid fa-arrow-right-to-bracket mr-1"></i>Load Selected Mission':'<i class="fa-solid fa-play mr-1"></i>Load Mission';
 btn.title=loaded&&!same?`Active mission remains ${scenarios[unifiedMission.key]?.title||unifiedMission.key} until this button is pressed.`:'';
}
function setMissionOnlyControlsVisible(visible){
 ['missionRestartBtn','missionTaskDetails','missionSubmitBtn','missionInstructorSupport','missionTargetBlock'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle('hidden',!visible);});
}
function renderUnifiedMissionPanel(){
 const free=!activeMissionLoaded();
 const cur=captureUnifiedMissionCondition(),p=hydroPack();
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
 setMissionOnlyControlsVisible(!free);
 if(free){
  set('activeMissionTitle','Free Customisation · No Mission');
  const identity=cur.vessel?`${cur.company?cur.company+' · ':''}${cur.vessel}`:`${cur.hullLabel} · custom condition`;
  set('missionVesselIdentity',identity);set('missionVesselType',cur.hullLabel);set('missionDimensions',`${cur.length.toFixed(2)} × ${cur.beam.toFixed(2)} × ${cur.depth.toFixed(2)} m`);
  set('missionHydroSource',`${cur.sourceBadge} · ${cur.sourceLabel}${cur.knValid?' · KN/GZ source available':' · large-angle GZ may use model geometry'}`);
  const conf=document.getElementById('missionDataConfidenceBadge');if(conf){const high=cur.hydroValid&&cur.knValid,hybrid=cur.hydroValid||cur.knValid;conf.textContent=high?'VESSEL DATA':hybrid?'HYBRID':'TEACHING MODEL';conf.className=`px-2 py-1 rounded-full border text-[8px] font-black ${high?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300':hybrid?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-slate-700 bg-slate-900 text-slate-400'}`;}
  set('missionCompareDisp',`${cur.disp.toFixed(0)} t`);set('missionCompareDraft',`${cur.draft.toFixed(2)} m`);set('missionCompareKG',`${cur.kg.toFixed(3)} m`);set('missionCompareGM',`${cur.gm>=0?'+':''}${cur.gm.toFixed(3)} m`);set('missionCompareList',unifiedMissionSide(cur.equilibrium));set('missionCompareFSC',`${cur.fsc.toFixed(3)} m`);set('missionCompareTrim',`${cur.trim>=0?'+':''}${cur.trim.toFixed(2)}°`);set('missionCompareUKC',`${cur.ukc.toFixed(2)} m`);
  const ia=document.getElementById('missionInitialAssessment');if(ia)ia.innerHTML=`<b class="text-cyan-200">Free simulation:</b> ${cur.instability} · Δ ${cur.disp.toFixed(0)} t · Draft ${cur.draft.toFixed(2)} m · KGc ${cur.kg.toFixed(3)} m · GM ${cur.gm.toFixed(3)} m · ${unifiedMissionSide(cur.equilibrium)}<br><span class="text-slate-500">No mission scoring is active. Configure any vessel, cargo, ballast, environment, damage or physics setting, then run Equilibrium or Test Stability.</span>`;
  const auto=document.getElementById('missionAutoTestState');if(auto)auto.textContent='Free mode · live condition monitor';
  const st=document.getElementById('unifiedMissionStatus');if(st){st.textContent='FREE MODE';st.className='px-2 py-1 rounded-full text-[8px] font-black border border-cyan-500/30 bg-cyan-500/10 text-cyan-300';}
  return;
 }
 const sc=scenarios[unifiedMission.key]||scenarios.baseline,init=unifiedMission.initial;
 set('activeMissionTitle',sc.title||'Stability Mission');
 const identity=init?.vessel?`${init.company?init.company+' · ':''}${init.vessel}`:`${init?.hullLabel||cur.hullLabel} · scenario teaching vessel`;
 set('missionVesselIdentity',identity);set('missionVesselType',init?.hullLabel||cur.hullLabel);set('missionDimensions',`${(init?.length||cur.length).toFixed(2)} × ${(init?.beam||cur.beam).toFixed(2)} × ${(init?.depth||cur.depth).toFixed(2)} m`);
 set('missionHydroSource',`${init?.sourceBadge||cur.sourceBadge} · ${init?.sourceLabel||cur.sourceLabel}${init?.knValid?' · KN/GZ source available':' · large-angle GZ may use model geometry'}`);
 const conf=document.getElementById('missionDataConfidenceBadge');if(conf){const high=!!init?.hydroValid&&!!init?.knValid;const hybrid=!!init?.hydroValid||!!init?.knValid;conf.textContent=high?'VESSEL DATA':hybrid?'HYBRID':'TEACHING MODEL';conf.className=`px-2 py-1 rounded-full border text-[8px] font-black ${high?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300':hybrid?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-slate-700 bg-slate-900 text-slate-400'}`;}
 set('missionCompareDisp',compareMissionMetric(init?.disp,cur.disp,' t',0));set('missionCompareDraft',compareMissionMetric(init?.draft,cur.draft,' m',2));set('missionCompareKG',compareMissionMetric(init?.kg,cur.kg,' m',3));set('missionCompareGM',compareMissionMetric(init?.gm,cur.gm,' m',3,true));set('missionCompareList',init?`${unifiedMissionSide(init.equilibrium)}${Math.abs(cur.equilibrium-init.equilibrium)>.05?' → '+unifiedMissionSide(cur.equilibrium):''}`:'—');set('missionCompareFSC',compareMissionMetric(init?.fsc,cur.fsc,' m',3));set('missionCompareTrim',compareMissionMetric(init?.trim,cur.trim,'°',2,true));set('missionCompareUKC',compareMissionMetric(init?.ukc,cur.ukc,' m',2));
 const ia=document.getElementById('missionInitialAssessment');if(ia&&init){const r=unifiedMission.initialEvaluation;ia.innerHTML=`<b class="text-slate-200">Loaded condition:</b> ${init.instability} · Δ ${init.disp.toFixed(0)} t · Draft ${init.draft.toFixed(2)} m · KGc ${init.kg.toFixed(3)} m · GM ${init.gm.toFixed(3)} m · ${unifiedMissionSide(init.equilibrium)}${r?`<br><span class="${r.pass?'text-emerald-300':'text-rose-300'} font-bold">Initial assessment: ${r.pass?'physical/target screen passed':'correction required'}</span>`:''}`;}
 const auto=document.getElementById('missionAutoTestState');if(auto)auto.textContent=unifiedMission.autoTesting?'Initial physics animation running…':unifiedMission.pendingSubmit?'Final verification animation running…':`Attempts ${unifiedMission.attempts} · Live status: ${cur.instability}`;
 const st=document.getElementById('unifiedMissionStatus');if(st){let text='CORRECT VESSEL',cls='border-amber-500/30 bg-amber-500/10 text-amber-300';if(unifiedMission.autoTesting){text='INITIAL TEST RUNNING';cls='border-cyan-500/30 bg-cyan-500/10 text-cyan-300';}else if(unifiedMission.pendingSubmit){text='FINAL TEST RUNNING';cls='border-violet-500/30 bg-violet-500/10 text-violet-300';}else if(unifiedMission.lastResult?.pass){text='MISSION PASSED';cls='border-emerald-500/30 bg-emerald-500/10 text-emerald-300';}else if(unifiedMission.lastResult){text='NOT YET';cls='border-rose-500/30 bg-rose-500/10 text-rose-300';}st.textContent=text;st.className=`px-2 py-1 rounded-full text-[8px] font-black border ${cls}`;}
}
function enterFreeCustomisation(switchToSim=true){
 if(stabilityTestRuntime.active){stabilityTestRuntime.active=false;dynamicsRunning=false;dynOmega=0;setTestingUI(false);}
 stabilityMission.active=false;closeChallengeBriefing();hideReferenceSolution();hideGlobalTestToast();challengeBaselineSnapshot=null;
 const sel=document.getElementById('scenarioSelect');if(sel)sel.value='free';
 unifiedMission={active:false,key:'free',attempts:0,initial:null,initialEvaluation:null,autoTesting:false,pendingSubmit:false,lastResult:null};
 calculateAll();renderScenario();renderUnifiedMissionPanel();updateGlobalStabilityBadge(false,false);updateMissionSelectorUI();
 if(switchToSim)switchTab('simulate');
}
function reloadUnifiedMission(){if(!unifiedMission.active||unifiedMission.key==='free'){enterFreeCustomisation(true);return;}const key=unifiedMission.key||document.getElementById('scenarioSelect')?.value||'baseline';loadScenario(key);}
function runUnifiedMissionTest(){
 if(!activeMissionLoaded()){
  calculateAll();findAndSetEquilibrium();calculateAll();renderUnifiedMissionPanel();testCurrentStability(true);return;
 }
 findAndSetEquilibrium();unifiedMission.pendingSubmit=false;unifiedMission.autoTesting=false;renderUnifiedMissionPanel();testCurrentStability(true);
}
function submitUnifiedMission(){
 if(!unifiedMission.active){runUnifiedMissionTest();return;}
 if(stabilityTestRuntime.active)return;
 unifiedMission.attempts++;unifiedMission.pendingSubmit=true;unifiedMission.lastResult=null;findAndSetEquilibrium();renderUnifiedMissionPanel();
 const started=testCurrentStability(false);if(started===false){unifiedMission.pendingSubmit=false;finalizeUnifiedMissionSubmission();}
}
function finalizeUnifiedMissionSubmission(){
 if(!unifiedMission.active)return;
 const r=evaluateCurrentStability();unifiedMission.lastResult=r;unifiedMission.pendingSubmit=false;
 const box=document.getElementById('challengeResult');if(box){box.classList.remove('hidden','border-emerald-600','bg-emerald-950/30','text-emerald-200','border-rose-600','bg-rose-950/30','text-rose-200','border-amber-600','bg-amber-950/30','text-amber-200','border-slate-700','bg-slate-900','text-slate-300');box.classList.add(r.pass?'border-emerald-600':'border-rose-600',r.pass?'bg-emerald-950/30':'bg-rose-950/30',r.pass?'text-emerald-200':'text-rose-200');box.innerHTML=`<div class="font-black mb-1"><i class="fa-solid fa-${r.pass?'trophy':'triangle-exclamation'} mr-1"></i>${r.pass?'MISSION PASSED':'CORRECTION REQUIRED'} · Attempt ${unifiedMission.attempts}</div>${r.details}<div class="mt-1 text-[9px] opacity-75">${r.basis}</div>`;}
 updateGlobalStabilityBadge(r.pass,true);renderUnifiedMissionPanel();showGlobalTestToast(r.pass,r.title,r.details,r.basis);
}

function renderScenario(){
 const key=activeScenarioKey();
 const instructionsBtn=document.getElementById('challengeInstructionsBtn');
 if(key==='free'){
  if(instructionsBtn)instructionsBtn.classList.add('hidden');
  const brief=document.getElementById('scenarioBrief');if(brief)brief.innerHTML='<div class="font-bold text-cyan-300 mb-1">Free Customisation</div>No mission is active. Build any loading condition you want using the Vessel, Cargo & Ops, Environment and Physics controls.';
  const tasks=document.getElementById('scenarioTasks');if(tasks)tasks.innerHTML='';
  const goal=document.getElementById('challengeGoal');if(goal)goal.textContent='No fixed mission target. Use Equilibrium and Test Stability to evaluate your customised vessel condition.';
  const result=document.getElementById('challengeResult');if(result){result.classList.add('hidden');result.textContent='';}
  hideReferenceSolution();const showBtn=document.getElementById('showReferenceSolutionBtn');if(showBtn)showBtn.classList.add('hidden');
  const cards=document.getElementById('scenarioCards');if(cards){cards.innerHTML='';Object.entries(scenarios).forEach(([k,v])=>{const b=document.createElement('button'),meta=challengeMeta[k];b.className='text-left p-2 rounded-lg border text-xs border-slate-800 bg-slate-950/70 hover:bg-slate-800/50';b.innerHTML=`<div class="flex items-start justify-between gap-2"><div class="font-semibold text-slate-200">${v.title}</div>${meta?`<span class="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">${meta[1]}</span>`:''}</div><div class="tiny text-slate-500 mt-0.5">${v.brief.slice(0,105)}…</div>${meta?`<div class="text-[8px] text-cyan-500 mt-1">${meta[0]}</div>`:''}`;b.onclick=()=>{document.getElementById('scenarioSelect').value=k;updateMissionSelectorUI();loadScenario(k)};cards.appendChild(b);});}
  renderUnifiedMissionPanel();return;
 }
 const sc=scenarios[key]||scenarios.baseline;
 if(instructionsBtn)instructionsBtn.classList.toggle('hidden',!challengeMeta[key]);
 document.getElementById('scenarioBrief').innerHTML=`<div class="font-bold text-amber-300 mb-1">${sc.title}</div>${sc.brief}`;
 document.getElementById('scenarioTasks').innerHTML=sc.tasks.map(t=>`<li>${t}</li>`).join('');
 document.getElementById('challengeGoal').textContent=sc.goal||'Investigation scenario: complete the student tasks and explain the physical changes shown by the simulator.';
 const result=document.getElementById('challengeResult');result.classList.add('hidden');result.textContent='';
 hideReferenceSolution();
 const showBtn=document.getElementById('showReferenceSolutionBtn');if(showBtn)showBtn.classList.toggle('hidden',!scenarioReferenceSolutions[key]&&typeof sc.check!=='function');
 const cards=document.getElementById('scenarioCards');cards.innerHTML='';
 Object.entries(scenarios).forEach(([k,v])=>{
  const b=document.createElement('button');const meta=challengeMeta[k];
  b.className=`text-left p-2 rounded-lg border text-xs ${k===key?'border-amber-500/50 bg-amber-500/10 scenario-active':'border-slate-800 bg-slate-950/70 hover:bg-slate-800/50'}`;
  b.innerHTML=`<div class="flex items-start justify-between gap-2"><div class="font-semibold text-slate-200">${v.title}</div>${meta?`<span class="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">${meta[1]}</span>`:''}</div><div class="tiny text-slate-500 mt-0.5">${v.brief.slice(0,105)}…</div>${meta?`<div class="text-[8px] text-cyan-500 mt-1">${meta[0]}</div>`:''}`;
  b.onclick=()=>{document.getElementById('scenarioSelect').value=k;updateMissionSelectorUI();loadScenario(k)};cards.appendChild(b);
 });
 renderUnifiedMissionPanel();
}


function currentGenericStabilityAssessment(){
 calculateAll();const eq=hydroAtAngle(state.equilibrium),imo=evaluateIMO(),reasons=[],advisories=[],p=hydroPack();
 const sourceHyd=!!hydroTableAtCurrentDisplacement();
 const sourceGZ=(p.kind==='gzReference'||p.kind==='knReference')?Number.isFinite(textbookReferenceGZAt(state.equilibrium)):(p.kind==='uploadedBundle'&&p.knRows?.length&&Number.isFinite(uploadedOperationalGZAt(state.equilibrium)));
 if(state.hydro?.invalid&&!sourceHyd&&!sourceGZ)reasons.push('hydrostatic condition invalid');
 if(state.physicsIntegrity&&!state.physicsIntegrity.pass)reasons.push(`physics integrity monitor reports ${state.physicsIntegrity.hardFailures} hard numerical failure(s)`);
 if(state.hydro?.invalid&&(sourceHyd||sourceGZ))advisories.push('generic hull section is outside its visual buoyancy envelope; source stability data remain active');
 if(!state.equilibriumValid)reasons.push('no stable equilibrium root found in the modelled heel range');
 if(state.gm<.15)reasons.push(`GM ${state.gm.toFixed(3)} m < 0.150 m`);
 if(Math.abs(state.equilibrium)>5)reasons.push(`${state.windEnabled||state.currentEnabled?'environmental':'static'} equilibrium list ${state.equilibrium.toFixed(2)}° exceeds ±5° teaching limit`);
 if(eq&&!eq.invalid&&eq.deckEdgeImmersed)reasons.push('deck edge immersed at equilibrium');
 if(Math.abs(state.trimAngle)>2)reasons.push(`static trim ${state.trimAngle.toFixed(2)}° exceeds ±2.0° teaching caution level`);
 if(state.draftBow>=state.depth||state.draftStern>=state.depth)reasons.push('bow or stern model draft reaches/exceeds moulded depth');
 if(Math.abs(state.environmentHeelingArm)>.20)reasons.push(`environmental heeling arm ${Math.abs(state.environmentHeelingArm).toFixed(3)} m exceeds 0.200 m teaching caution level`);
 if(!imo.every(c=>c.pass))advisories.push('IMO teaching audit has failed or model-limited criteria; review the IMO panel separately');
 return {pass:reasons.length===0,reasons,advisories,imo};
}
function showGlobalTestToast(pass,title,details,basis){
 const toast=document.getElementById('globalTestToast'),t=document.getElementById('globalTestToastTitle'),b=document.getElementById('globalTestToastBody');
 if(!toast||!t||!b)return;
 toast.classList.remove('hidden-toast');
 const pending=!pass&&title.includes('PHYSICALLY STABLE');
 toast.className=`status-toast fixed right-4 bottom-4 lg:bottom-5 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border backdrop-blur shadow-2xl p-3 ${pass?'border-emerald-600 bg-emerald-950/95':pending?'border-amber-600 bg-amber-950/95':'border-rose-600 bg-rose-950/95'}`;
 t.className=`text-xs font-extrabold ${pass?'text-emerald-300':pending?'text-amber-300':'text-rose-300'}`;
 t.textContent=title;
 b.innerHTML=`<div>${details}</div><div class="mt-1.5 text-[9px] opacity-75">${basis}</div>`;
}
function hideGlobalTestToast(){
 const toast=document.getElementById('globalTestToast');if(toast)toast.classList.add('hidden-toast');
}
function updateGlobalStabilityBadge(pass,tested=true){
 const badge=document.getElementById('globalStabilityBadge');if(!badge)return;
 if(!tested){badge.className='hidden md:inline-flex px-2 py-1 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700';badge.textContent='NOT TESTED';return;}
 badge.className=`hidden md:inline-flex px-2 py-1 rounded-full text-[9px] font-bold ${pass?'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30':'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`;
 const free=!activeMissionLoaded();
 badge.textContent=free?(pass?'STABLE':'UNSAFE'):(pass?'TARGET PASS':'TARGET FAIL');
}
function stabilityCalculationProvenance(){
 const p=hydroPack(),hr=hydroTableAtCurrentDisplacement(),km=Number(state.upright?.KM),kgc=Number(state.kgCorr),gm=Number(state.gm);
 const kmSource=hr?'source hydrostatic interpolation':(p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length))?'active source GZ/KN initial slope':'procedural upright hydrostatics';
 const gzSource=(p.kind==='gzReference'||p.kind==='knReference'||(p.kind==='uploadedBundle'&&p.knRows?.length))?'source/reference KN or GZ ordinates':'nonlinear procedural geometry';
 return `<span class="font-bold text-cyan-200">Calculation trace:</span> GM = KM − KGc = ${Number.isFinite(km)?km.toFixed(3):'—'} − ${Number.isFinite(kgc)?kgc.toFixed(3):'—'} = <b>${Number.isFinite(gm)?gm.toFixed(3):'—'} m</b> · KM basis: ${escapeHtml(kmSource)} · FSC ${Number(state.fsc||0).toFixed(3)} m · finite-angle GZ basis: ${escapeHtml(gzSource)}.`;
}
function evaluateCurrentStability(){
 calculateAll();let pass=false,details='',basis='',title='';const physical=currentGenericStabilityAssessment();
 if(stabilityMission.active){const m=stabilityMissions[stabilityMission.index],targetPass=!!m.check(),changed=missionCorrectionDetected();pass=physical.pass&&targetPass&&changed;title=pass?'MISSION SOLVED · STABILITY TARGET ACHIEVED':!physical.pass?'UNSAFE / NOT STABLE':'PHYSICALLY STABLE · MISSION NOT SOLVED';details=`Physical screen: ${physical.pass?'PASS':'FAIL'} · Mission target: ${targetPass?'PASS':'NOT YET'} · Correction detected: ${changed?'YES':'NO'}<br>Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m · FSC ${state.fsc.toFixed(3)} m${physical.reasons.length?'<br>'+physical.reasons.join(' · '):''}`;basis=`Mission criteria: ${m.target}`;}
 else{const key=activeScenarioKey(),sc=scenarios[key];if(challengeMeta[key]&&sc&&typeof sc.check==='function'){const o=challengeOutcome(key);pass=o.pass;title=pass?'CHALLENGE SOLVED · STABILITY TARGET ACHIEVED':!o.physical.pass?'UNSAFE / NOT STABLE':'PHYSICALLY STABLE · CHALLENGE NOT SOLVED';details=`Physical screen: ${o.physical.pass?'PASS':'FAIL'} · Challenge target: ${o.target.pass?'PASS':'NOT YET'} · Required correction detected: ${o.changed?'YES':'NO'}<br>${o.target.message||''}${o.physical.reasons.length?'<br>'+o.physical.reasons.join(' · '):''}`;basis=sc.goal||'Challenge criteria';}
 else if(sc&&typeof sc.check==='function'){const r=sc.check();pass=physical.pass&&!!r.pass;title=pass?'SCENARIO TARGET ACHIEVED':!physical.pass?'UNSAFE / NOT STABLE':'PHYSICALLY STABLE · SCENARIO TARGET NOT ACHIEVED';details=`Physical screen: ${physical.pass?'PASS':'FAIL'} · Scenario target: ${r.pass?'PASS':'NOT YET'}<br>${r.message||''}${physical.reasons.length?'<br>'+physical.reasons.join(' · '):''}`;basis=sc.goal||'Scenario criteria';}
 else{pass=physical.pass;title=pass?'PHYSICALLY STABLE':'UNSAFE / NOT STABLE';basis='Core physical teaching screen. IMO teaching audit is reported separately.';details=physical.reasons.length?physical.reasons.join(' · '):`Equilibrium ${state.equilibrium.toFixed(2)}° · GM ${state.gm.toFixed(3)} m · core physical checks satisfied.${physical.advisories.length?'<br><span class="text-amber-300">Advisory: '+physical.advisories.join(' · ')+'</span>':''}`;}}
 basis=`${basis}<br>${stabilityCalculationProvenance()}`;return {pass,details,basis,title,physical};
}
function setTestingUI(active){
 const btns=[document.getElementById('globalTestBtn'),...document.querySelectorAll('button[onclick*="testCurrentStability"],button[onclick*="runUnifiedMissionTest"],button[onclick*="runOperationalPhysicsTest"]')];
 btns.forEach(b=>{if(!b)return;b.disabled=active;b.classList.toggle('opacity-60',active);});
 const badge=document.getElementById('globalStabilityBadge');
 if(active&&badge){badge.className='hidden md:inline-flex px-2 py-1 rounded-full text-[9px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';badge.textContent='PHYSICS TEST...';}
}
function testCurrentStabilityCore(showToast=true){
 if(stabilityTestRuntime.active){if(showToast)showGlobalTestToast(true,'PHYSICS TEST ALREADY RUNNING','Wait for the current stability animation to finish before starting another test.','Only one stability-test runtime can be active at a time.');return null;}
 calculateAll();
 let eq=findEquilibriumRoot();
 if(!Number.isFinite(eq))eq=Number.isFinite(state.equilibrium)?state.equilibrium:NaN;
 if(Number.isFinite(eq))state.equilibrium=eq;
 const sourceGZAvailable=Number.isFinite(operationalGZAt(Number.isFinite(eq)?eq:0));
 if(state.hydro?.invalid&&!sourceGZAvailable){
  const r=evaluateCurrentStability();updateGlobalStabilityBadge(false,true);if(showToast)showGlobalTestToast(false,r.title,r.details,r.basis);return false;
 }
 if(!Number.isFinite(eq)){
  updateGlobalStabilityBadge(false,true);if(showToast)showGlobalTestToast(false,'NO STABLE EQUILIBRIUM','The active stability model could not find a finite equilibrium heel angle for this condition.','Review displacement, KG/GM, loading, damage and the active hydrostatic/GZ data source.');return false;
 }
 state.equilibrium=eq;
 // 3D is a visual client of the physics engine. A failed visual preflight cannot cancel this test.
 if(displayMode==='3d'){const ok=safeSync3D({hard:pendingHard3DReload,reason:'stability-test-preflight'});if(ok)pendingHard3DReload=false;}
 const kick=state.gm<0?3:Math.max(5,Math.min(10,Math.abs(eq)<10?8:5));
 const direction=eq>0?-1:1;
 stabilityTestRuntime={active:true,endAt:performance.now()+6500,showToast,originalHeel:state.heel};
 state.heel=Math.max(-70,Math.min(70,eq+direction*kick));
 dynPhi=state.heel*Math.PI/180;dynOmega=0;dynTime=0;lastFrameTime=null;dynamicsRunning=true;
 ensureAnimationLoopRunning();
 setControlValues();const kickedHydro=hydroAtAngle(state.heel);if(!kickedHydro.invalid)state.hydro=kickedHydro;updateUI();setTestingUI(true);
 if(showToast)showGlobalTestToast(true,'PHYSICS TEST RUNNING',`The vessel has been displaced ${kick.toFixed(0)}° from its equilibrium condition. Watch the roll response${state.waveEnabled?' with the active wave forcing':''}.`,'The final stability result will be issued after the animated test.');
 return null;
}
function testCurrentStability(showToast=true){
 try{
   return testCurrentStabilityCore(showToast);
 }catch(err){
   console.error('AMCOL stability-test start error:',err);
   stabilityTestRuntime={active:false,endAt:0,showToast:true,originalHeel:Number.isFinite(state?.heel)?state.heel:0};
   dynamicsRunning=false;dynOmega=0;lastFrameTime=null;
   try{setTestingUI(false);}catch(e){}
   try{calculateAll({curve:false});}catch(e){console.error('AMCOL stability-test recovery calculation error:',e);}
   if(showToast){
     try{showGlobalTestToast(false,'STABILITY TEST ERROR','The stability test could not start because an internal calculation or view-state error was detected. The vessel condition was preserved and the test runtime was reset.','Check the current loading/hydrostatic inputs, then run Equilibrium and Test Stability again.');}catch(e){}
   }
   return false;
 }
}

function finishAnimatedStabilityTest(){
 if(!stabilityTestRuntime.active)return;
 stabilityTestRuntime.active=false;dynamicsRunning=false;dynOmega=0;
 const r=evaluateCurrentStability();
 state.heel=state.equilibrium;setControlValues();calculateAll({curve:false});setTestingUI(false);
 updateGlobalStabilityBadge(r.pass,true);
 if(unifiedMission.active&&unifiedMission.autoTesting){
  unifiedMission.autoTesting=false;unifiedMission.lastResult=null;renderUnifiedMissionPanel();
 }else if(unifiedMission.active&&unifiedMission.pendingSubmit){
  finalizeUnifiedMissionSubmission();return;
 }
 if(stabilityTestRuntime.showToast)showGlobalTestToast(r.pass,r.title,`${r.details}<br><span class="text-slate-400">Animated roll test completed.</span>`,r.basis);
}

function checkScenarioChallenge(){
 const key=activeScenarioKey(),sc=scenarios[key],box=document.getElementById('challengeResult');
 if(unifiedMission.active)unifiedMission.attempts++;
 box.classList.remove('hidden','border-emerald-600','bg-emerald-950/30','text-emerald-200','border-rose-600','bg-rose-950/30','text-rose-200','border-amber-600','bg-amber-950/30','text-amber-200','border-slate-700','bg-slate-900','text-slate-300');
 if(!sc||typeof sc.check!=='function'){box.classList.add('border-slate-700','bg-slate-900','text-slate-300');box.textContent='This is an investigation scenario rather than an auto-graded challenge.';return;}
 calculateAll();if(challengeMeta[key]){const o=challengeOutcome(key);if(o.pass){box.classList.add('border-emerald-600','bg-emerald-950/30','text-emerald-200');box.innerHTML=`<b>PASS:</b> Challenge solved. ${o.target.message}`;}else if(o.physical.pass){box.classList.add('border-amber-600','bg-amber-950/30','text-amber-200');box.innerHTML=`<b>NOT YET:</b> Vessel is physically stable, but the challenge is not solved. Required correction detected: ${o.changed?'YES':'NO'}. ${o.target.message}`;}else{box.classList.add('border-rose-600','bg-rose-950/30','text-rose-200');box.innerHTML=`<b>UNSAFE / NOT YET:</b> ${o.physical.reasons.join(' · ')}<br>${o.target.message}`;}return;}
 const r=sc.check(),physical=currentGenericStabilityAssessment();if(r.pass&&physical.pass){box.classList.add('border-emerald-600','bg-emerald-950/30','text-emerald-200');box.innerHTML=`<b>PASS:</b> ${r.message}`;}else{box.classList.add('border-rose-600','bg-rose-950/30','text-rose-200');box.innerHTML=`<b>NOT YET:</b> ${r.message}${physical.reasons.length?'<br>'+physical.reasons.join(' · '):''}`;}
}

function loadScenario(key){
 if(key==='free'){enterFreeCustomisation(true);return;}
 if(stabilityTestRuntime.active){stabilityTestRuntime.active=false;dynamicsRunning=false;dynOmega=0;setTestingUI(false);}
 stabilityMission.active=false;closeChallengeBriefing();hideReferenceSolution();hideGlobalTestToast();
 const sc=scenarios[key]||scenarios.baseline;key=scenarios[key]?key:'baseline';
 vesselVisualTransaction=true;
 try{
   sc.apply();ensureCurrentVesselSpaceLayout({force:true,render:false});syncFormFromState();renderCargoTable();renderBallastPlan();calculateAll();findAndSetEquilibrium();calculateAll();
 }finally{vesselVisualTransaction=false;}
 commitVesselVisualRefresh(`scenario-load:${key}`);
 challengeBaselineSnapshot=challengeMeta[key]?captureChallengeSnapshot():null;
 document.getElementById('scenarioSelect').value=key;updateMissionSelectorUI();
 unifiedMission={active:true,key,attempts:0,initial:null,initialEvaluation:null,autoTesting:true,pendingSubmit:false,lastResult:null};
 unifiedMission.initial=captureUnifiedMissionCondition();
 unifiedMission.initialEvaluation=evaluateCurrentStability();
 renderScenario();switchTab('simulate');updateGlobalStabilityBadge(false,false);
 const briefingBtn=document.getElementById('challengeBriefingStartBtn');if(briefingBtn)briefingBtn.innerHTML='<i class="fa-solid fa-play mr-1"></i>Close Instructions';
 renderUnifiedMissionPanel();
 setTimeout(()=>{if(!unifiedMission.active||unifiedMission.key!==key||stabilityTestRuntime.active)return;findAndSetEquilibrium();renderUnifiedMissionPanel();const started=testCurrentStability(false);if(started===false){unifiedMission.autoTesting=false;renderUnifiedMissionPanel();}},220);
}
function syncFormFromState(){
 if(state.waveModel==='manual')state.wavePeriod=state.waveLength/Math.max(.1,state.waveSpeed);else applyPhysicalWaveFromPeriod(false);
 const map={inputHullType:'hullType',inputDensity:'density',inputLength:'length',inputBeam:'beam',inputDepth:'depth',inputWaterDepth:'waterDepth',inputLightshipMass:'lightshipMass',inputLightshipKG:'lightshipKG',inputLightshipTCG:'lightshipTCG',inputLightshipLCG:'lightshipLCG',inputTankCount:'tankCount',inputTankLength:'tankLength',inputTankBreadth:'tankBreadth',inputTankDensity:'tankDensity',inputTankFill:'tankFill',inputGrainMoment:'grainMoment',inputCraneMass:'craneMass',inputCraneHeight:'craneHeight',inputCraneOutreach:'craneOutreach',inputCraneSide:'craneSide',inputCraneLCG:'craneLCG',damageMode:'damageMode',inputDmgMass:'dmgMass',inputDmgVCG:'dmgVCG',inputDmgTCG:'dmgTCG',inputDmgLCG:'dmgLCG',inputDamageSide:'damageSide',inputDamageWidth:'damageWidth',inputDamageHeight:'damageHeight',inputDamageLengthPct:'damageLengthPct',inputDamageLCG:'damageLCG',inputDamagePerm:'damagePerm',inputKrRatio:'krRatio',inputDamping:'damping',inputWaveMoment:'waveMoment',inputWavePeriod:'wavePeriod',inputWaveHeight:'waveHeight',inputWaveLength:'waveLength',inputWaveSpeed:'waveSpeed',inputWaveHeading:'waveHeading',inputWaveGain:'waveGain',inputRollMode:'rollMode',inputShipSpeed:'shipSpeedKts',inputParametricVariation:'parametricVariation',inputQuadraticDamping:'quadraticDamping',inputPhysicsFidelity:'physicsFidelity',inputWaveModel:'waveModel'};Object.entries(map).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.value=state[k]});document.getElementById('checkFSE').checked=state.fse;const grainCheck=document.getElementById('checkGrainStability');if(grainCheck)grainCheck.checked=state.grainEnabled;document.getElementById('checkCrane').checked=state.crane;document.getElementById('checkDamage').checked=state.damage;document.getElementById('checkWaveEnabled').checked=state.waveEnabled;
 const ci=document.getElementById('inputCompanyName'),vi=document.getElementById('inputVesselName');if(ci)ci.value=state.companyName||'';if(vi)vi.value=state.vesselName||'';
 const hpSel=document.getElementById('hydroDataPackSelect');if(hpSel)hpSel.value=state.hydroDataKey||'geometry';updateHydroDataPackInfo();syncEnvironmentForm();setControlValues();toggleDamageInputs();updateWaveInputMode();updateWaveReadout();updateDynamicsButton();}
function setControlValues(){document.getElementById('sliderHeel').value=state.heel;document.getElementById('heelLabel').textContent=`${state.heel.toFixed(1)}°`;}



const staticStabilityAnnotationPlugin={
 id:'staticStabilityAnnotations',
 beforeDatasetsDraw(chart){
   const dfs=[downfloodAngle,downfloodAnglePort].filter(Number.isFinite);if(!dfs.length)return;const df=Math.min(...dfs),{ctx,scales}=chart,x=scales.x,y=scales.y;if(df>=x.max)return;
   const left=x.getPixelForValue(Math.max(x.min,df));ctx.save();ctx.fillStyle='rgba(244,63,94,.075)';ctx.fillRect(left,y.top,x.right-left,y.bottom-y.top);
   ctx.fillStyle='rgba(253,164,175,.82)';ctx.font='700 8px Arial';ctx.textAlign='center';ctx.fillText('POST-DOWNFLOODING · NOT CREDITED',left+(x.right-left)/2,y.top+12);ctx.restore();
 },
 afterDatasetsDraw(chart){
   if(state.grainEnabled)return; // grain mode has its own denser annotation set
   const r=state.staticGZResult;if(!r)return;
   const {ctx,scales}=chart,x=scales.x,y=scales.y;
   const px=v=>x.getPixelForValue(v),py=v=>y.getPixelForValue(v);
   const label=(txt,xv,yv,color='#e2e8f0',align='left',dx=5,dy=-7)=>{
     if(!Number.isFinite(xv)||!Number.isFinite(yv))return;
     ctx.save();ctx.font='700 9px Arial';ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';
     ctx.shadowColor='rgba(2,6,23,.95)';ctx.shadowBlur=4;
     ctx.fillText(txt,px(xv)+dx,py(yv)+dy);ctx.restore();
   };
   const dashedV=(xv,color='#64748b')=>{
     if(!Number.isFinite(xv))return;
     ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([4,4]);
     ctx.beginPath();ctx.moveTo(px(xv),y.top);ctx.lineTo(px(xv),y.bottom);ctx.stroke();ctx.restore();
   };

   dashedV(r.maxAngle,'rgba(52,211,153,.55)');
   if(state.gzShowConstruction)dashedV(r.contraflexureAngle,'rgba(56,189,248,.50)');
   dashedV(r.avs,'rgba(244,63,94,.65)');
   if(state.gzShowConstruction)dashedV(57.3,'rgba(148,163,184,.45)');

   label(`Maximum GZ ${r.maxGZ.toFixed(3)} m`,r.maxAngle,r.maxGZ,'#34d399','center',0,-12);
   if(state.gzShowConstruction&&Number.isFinite(r.contraflexureAngle))
     label(`Contraflexure ${r.contraflexureAngle.toFixed(1)}°`,r.contraflexureAngle,r.contraflexureGZ,'#38bdf8','left',6,10);
   if(Number.isFinite(r.avs))
     label(`AVS ${r.avs.toFixed(1)}°`,r.avs,0,'#fb7185','right',-6,-10);

   // Concept labels inside the shaded stability regions.
   ctx.save();ctx.font='700 9px Arial';ctx.textAlign='center';
   const posMid=Number.isFinite(r.avs)?Math.max(12,r.avs*.52):45;
   ctx.fillStyle='#86efac';ctx.fillText('POSITIVE RANGE OF STABILITY',px(posMid),y.bottom-12);
   if(Number.isFinite(r.avs)&&r.avs<89){
     const negMid=(r.avs+90)/2;
     ctx.fillStyle='#fda4af';ctx.fillText('NEGATIVE STABILITY',px(negMid),y.bottom-12);
   }
   if(state.gzShowConstruction){ctx.fillStyle='#94a3b8';ctx.fillText('57.3° = 1 rad',px(57.3),y.top+11);}
   ctx.restore();
 }
};

const grainChartAnnotationPlugin={
 id:'grainChartAnnotations',
 afterDatasetsDraw(chart){
   if(!state.grainEnabled||!state.grainResult)return;
   const r=state.grainResult,{ctx,scales}=chart,x=scales.x,y=scales.y;
   const label=(txt,xv,yv,color='#e2e8f0',dx=5,dy=-6)=>{
     if(!Number.isFinite(xv)||!Number.isFinite(yv))return;
     ctx.save();ctx.font='700 9px Arial';ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';
     ctx.shadowColor='rgba(2,6,23,.9)';ctx.shadowBlur=3;ctx.fillText(txt,x.getPixelForValue(xv)+dx,y.getPixelForValue(yv)+dy);ctx.restore();
   };
   label(`A  λ₀ ${r.lambda0.toFixed(3)} m`,0,r.lambda0,'#fbbf24',7,-8);
   label(`B  λ₄₀ ${r.lambda40.toFixed(3)} m`,40,r.lambda40,'#fbbf24',5,10);
   if(Number.isFinite(r.listAngle))label(`List ${r.listAngle.toFixed(1)}°`,r.listAngle,curveGZAt(r.listAngle),'#c4b5fd',7,-10);
   if(Number.isFinite(r.gzMaxAngle))label(`GZmax`,r.gzMaxAngle,r.gzMax,'#34d399',5,-9);
   ctx.save();ctx.font='700 8px Arial';ctx.fillStyle='#94a3b8';ctx.textAlign='center';
   ctx.fillText('57.3° = 1 rad',x.getPixelForValue(57.3),y.top+10);
   if(Number.isFinite(r.residualArea)&&Number.isFinite(r.listAngle)){
     const mx=(r.listAngle+r.limitAngle)/2,my=(curveGZAt(mx)+grainHeelingArmAt(mx,r.lambda0))/2;
     ctx.fillStyle='#86efac';ctx.fillText(`Residual area ${r.residualArea.toFixed(3)} m·rad`,x.getPixelForValue(mx),y.getPixelForValue(my));
   }
   ctx.restore();
 }
};

function initChart(){
 const canvasEl=document.getElementById('gzChart');
 if(!canvasEl)return false;
 if(typeof window.Chart!=='function'){
  gzChart=null;const wrap=document.getElementById('gzChartWrap');if(wrap&&!document.getElementById('gzChartDependencyWarning')){const w=document.createElement('div');w.id='gzChartDependencyWarning';w.className='absolute inset-3 z-20 rounded-xl border border-amber-700/40 bg-slate-950/95 p-4 text-[10px] text-amber-100';w.innerHTML='<b class="text-amber-300">GZ CHART LIBRARY UNAVAILABLE</b><br>Core stability calculations remain available in 2D, but the Chart.js visual cannot be drawn. Check the simulator network/vendor assets and reload.';wrap.appendChild(w);}console.error('AMCOL: Chart.js is unavailable; continuing without chart visualisation.');return false;
 }
 const c=canvasEl.getContext('2d');
 gzChart=new Chart(c,{
  type:'line',
  plugins:[staticStabilityAnnotationPlugin,grainChartAnnotationPlugin],
  data:{datasets:[
   {label:'Static GZ',data:[],borderColor:'#facc15',backgroundColor:'transparent',fill:false,borderWidth:2.5,pointRadius:0,tension:.22,order:1},
   {label:'Active',data:[],borderColor:'#10b981',backgroundColor:'#10b981',showLine:false,pointRadius:6,order:0},
   {label:'Downflooding',data:[],borderColor:'#ef4444',borderDash:[5,5],pointRadius:0,borderWidth:1.2,order:2},
   {label:'Environmental heeling arm',data:[],borderColor:'#22d3ee',borderDash:[3,3],pointRadius:0,borderWidth:1.5,order:2},

   {label:'Grain heeling arm A–B',data:[],borderColor:'#a78bfa',borderDash:[8,4],pointRadius:0,borderWidth:2,fill:false,tension:0,order:1},
   {label:'Residual dynamic stability',data:[],borderColor:'rgba(34,197,94,0)',backgroundColor:'rgba(34,197,94,.18)',pointRadius:0,borderWidth:0,fill:{target:4,above:'rgba(34,197,94,.18)',below:'rgba(244,63,94,.12)'},tension:.18,order:4},
   {label:'Grain list',data:[],borderColor:'#c4b5fd',backgroundColor:'#c4b5fd',showLine:false,pointRadius:5,order:0},
   {label:'Grain GZmax',data:[],borderColor:'#34d399',backgroundColor:'#34d399',showLine:false,pointRadius:5,order:0},
   {label:'Grain GM tangent',data:[],borderColor:'#64748b',borderDash:[4,4],pointRadius:0,borderWidth:1.2,fill:false,order:3},
   {label:'40° grain limit',data:[],borderColor:'#fbbf24',borderDash:[2,4],pointRadius:0,borderWidth:1,order:3},
   {label:'57.3° = 1 rad',data:[],borderColor:'#475569',borderDash:[2,5],pointRadius:0,borderWidth:1,order:3},
   {label:'A / B',data:[],borderColor:'#fbbf24',backgroundColor:'#fbbf24',showLine:false,pointRadius:4,order:0},

   {label:'Positive stability',data:[],borderColor:'rgba(34,197,94,0)',backgroundColor:'rgba(34,197,94,.13)',pointRadius:0,borderWidth:0,fill:'origin',tension:.22,order:5},
   {label:'Negative stability',data:[],borderColor:'rgba(244,63,94,0)',backgroundColor:'rgba(244,63,94,.23)',pointRadius:0,borderWidth:0,fill:'origin',tension:.22,order:5},
   {label:'Maximum GZ',data:[],borderColor:'#34d399',backgroundColor:'#34d399',showLine:false,pointRadius:5,order:0},
   {label:'Angle of contraflexure',data:[],borderColor:'#38bdf8',backgroundColor:'#38bdf8',showLine:false,pointRadius:4.5,order:0},
   {label:'Angle of vanishing stability',data:[],borderColor:'#fb7185',backgroundColor:'#fb7185',showLine:false,pointRadius:5,order:0},
   {label:'Initial GM tangent',data:[],borderColor:'#f97316',borderDash:[],pointRadius:0,borderWidth:1.8,fill:false,order:2},
   {label:'Zero stability axis',data:[],borderColor:'#94a3b8',pointRadius:0,borderWidth:1,order:4},
   {label:'Righting moment',data:[],borderColor:'#60a5fa',borderDash:[7,3],pointRadius:0,borderWidth:1.5,fill:false,yAxisID:'yMoment',order:2},
   {label:'Port GZ',data:[],borderColor:'#22d3ee',backgroundColor:'transparent',borderDash:[7,4],fill:false,borderWidth:2,pointRadius:0,tension:.22,order:1},
   {label:'Port downflooding',data:[],borderColor:'#fb7185',borderDash:[2,5],pointRadius:0,borderWidth:1.1,order:2}
  ]},
  options:{
   responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
   plugins:{
    legend:{display:false},
    tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number.isFinite(c.parsed.y)?c.parsed.y.toFixed(3):'—'} ${c.dataset.yAxisID==='yMoment'?'MN·m':'m'} @ ${c.parsed.x.toFixed(1)}°`}}
   },
   scales:{
    x:{type:'linear',min:0,max:90,title:{display:true,text:'Heel angle magnitude (deg)',color:'#94a3b8'},grid:{color:'rgba(51,65,85,.30)'},ticks:{color:'#94a3b8',stepSize:10}},
    y:{position:'left',title:{display:true,text:'GZ / righting arm (m)',color:'#94a3b8'},grid:{color:'rgba(51,65,85,.30)'},ticks:{color:'#94a3b8'}},
    yMoment:{position:'right',display:false,title:{display:true,text:'Righting moment (MN·m)',color:'#60a5fa'},grid:{drawOnChartArea:false},ticks:{color:'#60a5fa'}}
   }
  }
 });
 return true;
}
function updateChart(){
 if(!gzChart)return;
 const ds=gzChart.data.datasets;
 const staticPts=sideCurvePoints('starboard').map(p=>({x:p.angle,y:p.gz}));
 const portPts=sideCurvePoints('port').map(p=>({x:p.angle,y:p.gz}));
 ds[0].label='Starboard GZ';ds[0].data=staticPts;ds[20].data=portPts;

 const d=downfloodAngle,dp=downfloodAnglePort;ds[2].data=[];ds[21].data=[];
 const env=state.windEnabled||state.currentEnabled?state.environmentHeelingArm:0;
 ds[3].data=(state.windEnabled||state.currentEnabled)?[{x:0,y:env},{x:90,y:env}]:[];

 const sr=state.staticGZResult;
 const visibleYs=[...staticPts,...portPts].map(p=>p.y).filter(Number.isFinite);
 const baseHigh=Math.max(.10,...visibleYs,state.gm||0);
 const baseLow=Math.min(0,...visibleYs,-.03);
 const pad=Math.max(.04,(baseHigh-baseLow)*.09),vMin=baseLow-pad,vMax=baseHigh+pad;
 if(d)ds[2].data=[{x:d,y:vMin},{x:d,y:vMax}];
 if(dp)ds[21].data=[{x:dp,y:vMin},{x:dp,y:vMax}];

 // Static stability concept datasets.
 if(sr){
   const avs=Number.isFinite(sr.avs)?Math.max(0,Math.min(90,sr.avs)):90;
   const pos=[];
   for(const p of staticPts){
     if(p.x<=avs+1e-6)pos.push({x:p.x,y:Math.max(0,p.y)});
   }
   if(Number.isFinite(sr.avs)&&!pos.some(p=>Math.abs(p.x-sr.avs)<.05))pos.push({x:sr.avs,y:0});
   ds[12].data=pos;

   const neg=[];
   if(Number.isFinite(sr.avs)){
     neg.push({x:sr.avs,y:0});
     for(const p of staticPts){
       if(p.x>sr.avs)neg.push({x:p.x,y:Math.min(0,p.y)});
     }
   }
   ds[13].data=neg;
   ds[14].data=[{x:sr.maxAngle,y:sr.maxGZ}];
   ds[15].data=Number.isFinite(sr.contraflexureAngle)?[{x:sr.contraflexureAngle,y:sr.contraflexureGZ}]:[];
   ds[16].data=Number.isFinite(sr.avs)?[{x:sr.avs,y:0}]:[];
   ds[17].data=[{x:0,y:0},{x:57.3,y:state.gm}];
   ds[18].data=[{x:0,y:0},{x:90,y:0}];
 }else{
   for(let i=12;i<=18;i++)ds[i].data=[];
 }
 // Textbook construction can be hidden without changing the solved GZ curve.
 ds[17].hidden=!state.gzShowConstruction;
 ds[15].hidden=!state.gzShowConstruction;
 // Righting moment uses the same GZ curve and current displacement: RM = Δ·g·GZ.
 ds[19].data=state.gzShowMoment?staticPts.map(p=>({x:p.x,y:state.dispMass*G*p.y/1000})):[];
 gzChart.options.scales.yMoment.display=!!state.gzShowMoment;

 const r=state.grainEnabled?state.grainResult:null;
 if(r){
   const arm=[];for(let a=0;a<=40;a+=1)arm.push({x:a,y:grainHeelingArmAt(a,r.lambda0)});
   ds[4].data=arm;
   if(Number.isFinite(r.listAngle)&&r.limitAngle>r.listAngle){
     const residual=[{x:r.listAngle,y:curveGZAt(r.listAngle)}];
     for(let a=Math.ceil(r.listAngle);a<r.limitAngle;a+=1)residual.push({x:a,y:curveGZAt(a)});
     residual.push({x:r.limitAngle,y:curveGZAt(r.limitAngle)});
     ds[5].data=residual;ds[6].data=[{x:r.listAngle,y:curveGZAt(r.listAngle)}];
   }else{ds[5].data=[];ds[6].data=[];}
   ds[7].data=Number.isFinite(r.gzMaxAngle)?[{x:r.gzMaxAngle,y:r.gzMax}]:[];
   ds[8].data=[{x:0,y:0},{x:57.3,y:state.gm}];
   ds[9].data=[{x:40,y:vMin},{x:40,y:vMax}];
   ds[10].data=[{x:57.3,y:vMin},{x:57.3,y:vMax}];
   ds[11].data=[{x:0,y:r.lambda0},{x:40,y:r.lambda40}];
   gzChart.options.scales.x.min=0;gzChart.options.scales.x.max=60;
   gzChart.options.scales.x.title.text='Heel angle magnitude (deg) · Grain stability overlay';
   gzChart.options.scales.y.title.text='GZ / heeling arm (m)';
 }else{
   for(let i=4;i<=11;i++)ds[i].data=[];
   gzChart.options.scales.x.min=0;gzChart.options.scales.x.max=90;
   gzChart.options.scales.x.title.text='Heel angle magnitude (deg) · STBD / PORT';
   gzChart.options.scales.y.title.text='GZ / righting arm (m)';
 }

 // Keep the tangent visible without letting it distort the vertical scale excessively.
 gzChart.options.scales.y.suggestedMin=vMin;
 gzChart.options.scales.y.suggestedMax=vMax;

 updateActivePoint(false);
 updateStaticGZFeatureLabel();updateGZMetricStrip();updateGZSourceBadge();updateGZDataDrawer();
 gzChart.update('none');
}
function updateStaticGZFeatureLabel(){
 const el=document.getElementById('gzFeatureLabel'),sR=state.staticGZResult,pR=state.staticGZPortResult;if(!el)return;
 if(!sR&&!pR){el.textContent='STBD — | PORT —';return;}
 const fmt=(r)=>r?`GZmax ${r.maxGZ.toFixed(3)}m @ ${r.maxAngle.toFixed(0)}° · AVS ${Number.isFinite(r.avs)?r.avs.toFixed(1)+'°':'>90°'}`:'N/A';
 el.textContent=`STBD ${fmt(sR)}  |  PORT ${fmt(pR)}`;
}

function updateActivePoint(render=true){
 if(!gzChart||!state.hydro||state.hydro.invalid)return;
 const a=state.heel,gz=restoringGZAt(a),side=a<0?'PORT':'STBD',sense=stabilitySenseAt(a);
 gzChart.data.datasets[1].data=(Math.abs(a)<=90&&Number.isFinite(gz))?[{x:Math.abs(a),y:gz}]:[];
 const sign=Number.isFinite(gz)&&gz>0?'+':'';
 document.getElementById('activePointLabel').textContent=`${side} · GZ ${Number.isFinite(gz)?sign+gz.toFixed(3):'—'} m · ${sense} @ ${Math.abs(a).toFixed(1)}°`;
 if(render)gzChart.update('none');
}


function toggleGZMomentOverlay(){state.gzShowMoment=!state.gzShowMoment;document.getElementById('gzMomentBtn')?.classList.toggle('active',state.gzShowMoment);updateChart();}
function toggleGZConstruction(){state.gzShowConstruction=!state.gzShowConstruction;document.getElementById('gzConstructionBtn')?.classList.toggle('active',state.gzShowConstruction);updateChart();}
function toggleGZDataDrawer(){state.gzDataDrawer=!state.gzDataDrawer;document.getElementById('gzDataBtn')?.classList.toggle('active',state.gzDataDrawer);updateGZDataDrawer();setTimeout(()=>gzChart?.resize(),60);}
function updateGZSourceBadge(){
 const el=document.getElementById('gzSourceBadge');if(!el)return;const p=hydroPack();el.textContent=p.badge||'MODEL';
 el.title=p.source||p.note||'';
 const title=document.getElementById('gzPanelTitle');if(title)title.textContent=(p.kind==='gzReference'||p.kind==='knReference')?'Textbook-sourced Static Stability':'Operational Static Stability';
 updateHydroDataPackInfo();
}
function updateGZMetricStrip(){
 const sr=state.staticGZResult,pr=state.staticGZPortResult;if(!sr&&!pr)return;const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
 const pair=(fn)=>`S ${sr?fn(sr):'—'} / P ${pr?fn(pr):'—'}`;
 set('gzMetricGM',`${state.gm.toFixed(3)} m`);set('gzMetricMax',pair(r=>`${r.maxGZ.toFixed(3)}m@${r.maxAngle.toFixed(0)}°`));set('gzMetricAVS',pair(r=>Number.isFinite(r.avs)?`${r.avs.toFixed(1)}°`:'>90°'));set('gzMetricArea30',pair(r=>Number.isFinite(r.area30)?r.area30.toFixed(3):'N/A'));set('gzMetricArea40',pair(r=>Number.isFinite(r.area40)?r.area40.toFixed(3):'N/A'));set('gzMetricRM',pair(r=>`${r.maxRM.toFixed(2)}MN·m`));
}

function updateGZDataDrawer(){
 const d=document.getElementById('gzDataDrawer');if(!d)return;d.classList.toggle('hidden',!state.gzDataDrawer);if(!state.gzDataDrawer)return;const p=hydroPack();
 if(p.kind==='geometry'){
   d.innerHTML='<div class="text-slate-400"><b class="text-cyan-300">Geometry model.</b> GZ is solved from the procedural transverse section at constant displacement. Select a Barrass data pack in Vessel → Textbook hydrostatic / GZ data pack to compare source-backed values.</div>';return;
 }
 if(p.kind==='hydroTable'){
   const r=hydroTableAtCurrentDisplacement();const rows=p.rows.map(x=>`<tr class="${r&&Math.abs(x.draft-r.draft)<.55?'text-amber-200':''}"><td>${sourceFieldFmt(x.draft,1)}</td><td>${sourceFieldFmt(x.disp,0)}</td><td>${sourceFieldFmt(x.tpc,2)}</td><td>${sourceFieldFmt(x.kb,2)}</td><td>${sourceFieldFmt(x.kmt,2)}</td><td>${sourceFieldFmt(x.kml,1)}</td><td>${sourceFieldFmt(x.mctc,1)}</td><td>${Number.isFinite(Number(x.lcf))?(x.lcf>=0?'+':'')+sourceFieldFmt(x.lcf,2):'—'}</td><td>${Number.isFinite(Number(x.lcb))?(x.lcb>=0?'+':'')+sourceFieldFmt(x.lcb,2):'—'}</td></tr>`).join('');
   const interp=r?`<div class="mb-1 text-emerald-300">Current Δ ${state.dispMass.toFixed(0)} t → interpolated draft <b>${sourceFieldFmt(r.draft,2)} m</b>, KMT <b>${sourceFieldFmt(r.kmt,2)}</b>${Number.isFinite(Number(r.kmt))?` · GMcorr <b>${(Number(r.kmt)-state.kgCorr).toFixed(2)} m</b>`:''}.</div>`:'<div class="mb-1 text-amber-300">Current displacement is outside this published table range; no extrapolation is performed.</div>';
   d.innerHTML=`${interp}<div class="text-slate-500 mb-1">${p.source}. LCF/LCB signs: + forward, − aft of amidships.</div><table><thead><tr><th>Draft</th><th>Δ t</th><th>TPC</th><th>KB</th><th>KMT</th><th>KML</th><th>MCTC</th><th>LCF</th><th>LCB</th></tr></thead><tbody>${rows}</tbody></table>`;return;
 }
 if(p.kind==='uploadedBundle'){
   const r=hydroTableAtCurrentDisplacement(),eqDisp=sourceEquivalentDisplacement(p);
   const interp=r?`<div class="mb-1 text-emerald-300">Current source-equivalent Δ ${sourceFieldFmt(eqDisp,0)} t → draft <b>${sourceFieldFmt(r.draft,3)} m</b>${Number.isFinite(Number(r.kmt))?` · KMT <b>${sourceFieldFmt(r.kmt,3)} m</b> · GMcorr <b>${(Number(r.kmt)-state.kgCorr).toFixed(3)} m</b>`:''}.</div>`:'<div class="mb-1 text-amber-300">Current source-equivalent displacement is outside the uploaded hydrostatic range.</div>';
   const hydRows=(p.rows||[]).slice(0,180).map(x=>`<tr><td>${sourceFieldFmt(x.draft,2)}</td><td>${sourceFieldFmt(x.disp,0)}</td><td>${sourceFieldFmt(x.tpc,2)}</td><td>${sourceFieldFmt(x.kb,2)}</td><td>${sourceFieldFmt(x.kmt,2)}</td><td>${sourceFieldFmt(x.kml,1)}</td><td>${sourceFieldFmt(x.mctc,1)}</td><td>${sourceFieldFmt(x.lcf,2)}</td><td>${sourceFieldFmt(x.lcb,2)}</td></tr>`).join('');
   d.innerHTML=`${interp}<div class="text-slate-500 mb-1">${p.source||''}${p.badge==='WORKBOOK SOURCE'?' · KB/KML are not tabulated in this workbook and are shown as — rather than fabricated.':''}</div><table><thead><tr><th>Draft</th><th>Δ t</th><th>TPC</th><th>KB</th><th>KMT</th><th>KML</th><th>MCTC</th><th>LCF</th><th>LCB</th></tr></thead><tbody>${hydRows}</tbody></table>`;return;
 }
 const pts=(p.kind==='gzReference'?p.gz:p.kn)||[],head=p.kind==='gzReference'?'GZ ref.':'KN',rows=pts.map(x=>{const gz=textbookReferenceGZAt(x.a);return `<tr><td>${x.a.toFixed(0)}°</td><td>${x.v.toFixed(3)}</td><td>${Number.isFinite(gz)?gz.toFixed(3):'—'}</td><td>${Number.isFinite(gz)?(state.dispMass*G*gz/1000).toFixed(2):'—'}</td></tr>`}).join('');
 const valid=p.referenceDisp?100*(state.dispMass-p.referenceDisp)/p.referenceDisp:0;
 d.innerHTML=`<div class="mb-1 ${Math.abs(valid)<=2?'text-emerald-300':'text-amber-300'}"><b>${p.label}</b> · current Δ ${state.dispMass.toFixed(0)} t vs reference ${p.referenceDisp.toFixed(0)} t (${valid>=0?'+':''}${valid.toFixed(1)}%).</div><div class="text-slate-500 mb-1">${p.note}</div><table><thead><tr><th>Heel</th><th>${head} (m)</th><th>GZ @ KGcorr (m)</th><th>RM (MN·m)</th></tr></thead><tbody>${rows}</tbody></table>`;
}


function updateCoupledHydroUI(){
 const box=document.getElementById('coupledHydroReadout'),badge=document.getElementById('coupledSolverBadge');
 if(badge){
   badge.textContent=state.coupledMode==='source-anchored'?'SOURCE EQUILIBRIUM':state.coupledMode==='gz-loll-branch'?'GZ LOLL + TRIM':(state.coupledValid?'COUPLED SOLVED':'COUPLED CHECK');
   badge.className=`text-[8px] px-2 py-1 rounded-full border ${state.coupledValid?'border-emerald-500/40 text-emerald-300 bg-emerald-500/10':'border-amber-500/40 text-amber-300 bg-amber-500/10'}`;
 }
 if(box){
   const d=[
    ['Heel eq.',`${state.coupledHeel>=0?'+':''}${state.coupledHeel.toFixed(2)}°`],
    ['Trim',`${state.trimMeters>=0?'+':''}${state.trimMeters.toFixed(2)} m`],
    ['Sinkage',`${(-state.coupledSinkage).toFixed(2)} m`],
    ['B (TCB/LCB)',`${state.coupledTCB.toFixed(2)} / ${state.coupledLCB.toFixed(2)} m`],
    ['Δ residual',`${Number(state.coupledResidualMass||0).toFixed(3)} t`],
    ['T moment residual',`${Number(state.coupledResidualTMoment||0).toFixed(1)} t·m`],
    ['L moment residual',`${Number(state.coupledResidualLMoment||0).toFixed(1)} t·m`],
    ['Convergence',`${state.coupledIterations||0} iter · ${state.coupledConvergenceQuality||'—'}`]
   ];
   box.innerHTML=d.map(([a,b])=>`<div class="bg-slate-900 rounded p-1.5"><div class="text-slate-500">${a}</div><div class="font-mono text-slate-200">${b}</div></div>`).join('');
 }
 const s=state.strength;
 const sf=document.getElementById('strengthSF'),bm=document.getElementById('strengthBM'),idx=document.getElementById('strengthIndex');
 if(sf)sf.textContent=s?`${s.maxSF.toFixed(0)} kN`:'—';
 if(bm)bm.textContent=s?`${(s.maxBM/1000).toFixed(1)} MN·m`:'—';
 if(idx){
   const pct=s?.envelope?.valid?s.envelope.maxUtil*100:(s?s.concentration*100:0),isEnvelope=!!s?.envelope?.valid;
   idx.textContent=s?`${pct.toFixed(1)}% ${isEnvelope?'limit':'index'}`:'—';idx.className=`font-mono ${pct<85?'text-emerald-300':pct<=100?'text-amber-300':'text-rose-300'}`;
 }
 if(box&&s){box.insertAdjacentHTML('beforeend',`<div class="bg-slate-900 rounded p-1.5"><div class="text-slate-500">Sagging +BM</div><div class="font-mono text-amber-200">${(s.maxSaggingBM/1000).toFixed(1)} MN·m @ ${(s.saggingX/state.length*100).toFixed(0)}%L</div></div><div class="bg-slate-900 rounded p-1.5"><div class="text-slate-500">Hogging −BM</div><div class="font-mono text-violet-200">${(s.maxHoggingBM/1000).toFixed(1)} MN·m @ ${(s.hoggingX/state.length*100).toFixed(0)}%L</div></div>`);if(s.envelope?.valid){const g=s.envelope.governing;box.insertAdjacentHTML('beforeend',`<div class="bg-slate-900 rounded p-1.5 col-span-2"><div class="text-slate-500">Allowable-envelope utilisation</div><div class="font-mono ${s.envelope.maxUtil<=.85?'text-emerald-300':s.envelope.maxUtil<=1?'text-amber-300':'text-rose-300'}">${(s.envelope.maxUtil*100).toFixed(1)}% · ${escapeHtml(g?.mode||'—')} @ ${((g?.x||0)/state.length*100).toFixed(0)}%L · ${escapeHtml(s.envelope.status)}</div><div class="text-[8px] text-slate-500">Envelope authority: ${activeAMCOLTrainingVessel()?.realSourceCalibrated?'AMCOL-derived training limit':'AMCOL training limit'} unless an approved loading manual is supplied.</div></div>`);}}
 updateStrengthChart();
}
function updateStrengthChart(){
 const c=document.getElementById('strengthChart'),s=state.strength;if(!c||!window.Chart||!s)return;
 const labels=s.xs.map(x=>(x/state.length*200).toFixed(0));
 const sf=s.shear.map(v=>v/Math.max(1,state.dispMass*G)*100);
 const bm=s.moment.map(v=>v/Math.max(1,state.dispMass*G*state.length)*100);
 if(!strengthChart){
   strengthChart=new Chart(c.getContext('2d'),{
     type:'line',
     data:{labels,datasets:[
       {label:'Shear / Δg (%)',data:sf,borderColor:'#22d3ee',pointRadius:0,borderWidth:1.6,yAxisID:'y'},
       {label:'BM / ΔgL (%)',data:bm,borderColor:'#fbbf24',pointRadius:0,borderWidth:1.6,yAxisID:'y'}
     ]},
     options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:'#94a3b8',boxWidth:10,font:{size:8}}}},scales:{
       x:{ticks:{color:'#64748b',maxTicksLimit:7,font:{size:8}},grid:{color:'rgba(51,65,85,.25)'},title:{display:true,text:'Aft  ←  %L  →  Bow',color:'#64748b',font:{size:8}}},
       y:{ticks:{color:'#64748b',font:{size:8}},grid:{color:'rgba(51,65,85,.25)'}}
     }}
   });
 }else{
   strengthChart.data.labels=labels;strengthChart.data.datasets[0].data=sf;strengthChart.data.datasets[1].data=bm;strengthChart.update('none');
 }
}


function updateGrainUI(){
 const enabled=!!state.grainEnabled,r=state.grainResult;
 const lambda=document.getElementById('grainLambdaReadout'),summary=document.getElementById('grainSummaryReadout'),list=document.getElementById('grainCriteriaList');
 const quick=document.getElementById('grainGZQuickBtn'),title=document.getElementById('gzPanelTitle');
 if(quick){
   quick.className=`rounded border ${enabled?'border-amber-500/50 text-amber-300 bg-amber-500/10':'border-slate-700 text-slate-400'} hover:bg-slate-800`;
 }
 if(title)title.textContent=enabled?'Static Stability GZ · Grain Overlay':'Static Stability GZ Curve';
 if(lambda)lambda.textContent=r?`λ₀ ${r.lambda0.toFixed(3)} m · λ₄₀ ${r.lambda40.toFixed(3)} m (0.80 λ₀)`:'λ₀ — · λ₄₀ —';
 if(!enabled||!r){
   if(summary)summary.innerHTML='<div class="col-span-2 rounded bg-slate-900 p-2 text-slate-500">Enable Grain Shift Stability to construct the grain heeling-arm line.</div>';
   if(list)list.innerHTML='';
   const overall=document.getElementById('grainOverall');
   if(overall){overall.className='tiny px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700';overall.textContent='OFF';}
   return;
 }
 const values=[
  ['Grain list',Number.isFinite(r.listAngle)?`${r.listAngle.toFixed(2)}°`:'No intersection'],
  ['Residual area',Number.isFinite(r.residualArea)?`${r.residualArea.toFixed(3)} m·rad`:'N/A'],
  ['GZmax',Number.isFinite(r.gzMax)?`${r.gzMax.toFixed(3)} m @ ${r.gzMaxAngle.toFixed(0)}°`:'N/A'],
  ['Integration limit',`${r.limitAngle.toFixed(1)}°`]
 ];
 if(summary)summary.innerHTML=values.map(([a,b])=>`<div class="rounded bg-slate-900 border border-slate-800 p-1.5"><div class="text-slate-500">${a}</div><div class="text-slate-200">${b}</div></div>`).join('');
 const c=grainCriteria();
 if(list)list.innerHTML=c.map(x=>`<div class="p-2 rounded border ${x.pass?'border-emerald-900/50 bg-emerald-950/15':'border-rose-900/50 bg-rose-950/15'} flex justify-between gap-2"><div><div class="text-[10px] font-semibold">${x.name}</div><div class="text-[9px] text-slate-500">${x.req}</div></div><div class="text-right"><div class="text-[10px] font-mono ${x.pass?'text-emerald-400':'text-rose-400'}">${x.fmt(x.actual)}</div><div class="text-[9px] font-bold ${x.pass?'text-emerald-400':'text-rose-400'}">${x.pass?'PASS':'FAIL'}</div></div></div>`).join('');
 const overall=document.getElementById('grainOverall');
 if(overall){
   const pass=r.pass;
   overall.className=`tiny px-2 py-1 rounded font-bold border ${pass?'bg-emerald-500/15 text-emerald-400 border-emerald-500/30':'bg-rose-500/15 text-rose-400 border-rose-500/30'}`;
   overall.textContent=pass?'PASS':'FAIL';
 }
}


function waveEncounterAngleDeg(){
 return ({head:0,beam:90,quartering:135,following:180})[state.waveHeading] ?? 90;
}
function calculateEncounterPeriod(){
 const Tw=Math.max(.1,Number(state.wavePeriod)||.1),lambda=Math.max(.1,Number(state.waveLength)||.1);
 const V=Math.max(0,Number(state.shipSpeedKts)||0)*0.514444;
 const alpha=waveEncounterAngleDeg()*Math.PI/180;
 // Regular-wave teaching approximation: 1/Te = |1/Tw + V cos(alpha)/lambda|.
 // alpha follows IMO MSC.1/Circ.1228 convention approximately: 0° head, 90° beam, 180° following.
 const fe=(1/Tw)+(V*Math.cos(alpha)/lambda);
 if(Math.abs(fe)<1e-5)return Infinity;
 return 1/Math.abs(fe);
}
function proximity(value,target){
 if(!Number.isFinite(value)||!Number.isFinite(target)||target<=0)return Infinity;
 return Math.abs(value-target)/target;
}
function dynamicStabilityAssessment(){
 const Tr=state.naturalPeriod,Te=calculateEncounterPeriod();state.encounterPeriod=Te;
 const sync=proximity(Te,Tr),param11=sync,param05=proximity(Te,Number.isFinite(Tr)?0.5*Tr:NaN),param=Math.min(param11,param05);
 const highSync=state.waveEnabled&&Number.isFinite(Tr)&&Number.isFinite(Te)&&sync<=.10;
 const watchSync=state.waveEnabled&&Number.isFinite(Tr)&&Number.isFinite(Te)&&sync>.10&&sync<=.20;
 const highParam=state.waveEnabled&&Number.isFinite(Tr)&&Number.isFinite(Te)&&param<=.10;
 const watchParam=state.waveEnabled&&Number.isFinite(Tr)&&Number.isFinite(Te)&&param>.10&&param<=.20;
 const longHighWave=state.waveEnabled&&state.length>0&&state.waveLength>0.8*state.length&&state.waveHeight>0.04*state.length;
 const result={Tr,Te,sync,param11,param05,param,highSync,watchSync,highParam,watchParam,longHighWave};state.dynamicRisk=result;return result;
}
function instabilityAssessment(){
 const dyn=dynamicStabilityAssessment();
 const eq=Math.abs(Number(state.equilibrium)||0),gm=Number(state.gm)||0;
 const dfCandidates=[downfloodAngle,downfloodAnglePort].filter(Number.isFinite),earliestDF=dfCandidates.length?Math.min(...dfCandidates):NaN;
 const sr=state.staticGZResult;
 let key='stable',label='STABLE UPRIGHT',tone='emerald';
 if(gm<0){key='loll';label=eq>1?'ANGLE OF LOLL':'NEGATIVE GM · UPRIGHT UNSTABLE';tone='rose';}
 else if(state.hydro?.deckEdgeImmersed||(Number.isFinite(earliestDF)&&Math.abs(state.heel)>=earliestDF)){key='downflood';label='DOWNFLOODING / DECK EDGE LIMIT';tone='rose';}
 else if(eq>1){key='list';label='LIST / FORCED HEEL';tone='amber';}
 else if(gm<.15){key='tender';label='TENDER · LOW INITIAL GM';tone='amber';}
 else if(state.beam>0&&gm/state.beam>=.06){key='stiff';label='STIFF · HIGH GM/B (TEACHING)';tone='cyan';}
 if(dyn.highParam&&state.rollMode==='parametric'){key='parametric';label='PARAMETRIC ROLL RISK';tone='rose';}
 else if(dyn.highSync&&state.rollMode==='forced'){key='dynamic';label='SYNCHRONOUS ROLL RISK';tone='rose';}
 const contributors=[];
 if(state.fsc>.02)contributors.push(`Free surface −${state.fsc.toFixed(3)} m GM`);
 if(Math.abs(state.tcg)>.05)contributors.push(`TCG ${state.tcg>=0?'+':''}${state.tcg.toFixed(2)} m`);
 if(state.crane)contributors.push('Suspended load active');
 if(state.damage)contributors.push('Damage / flooding active');
 if(Math.abs(state.environmentHeelingArm)>.003)contributors.push(`Environmental arm ${state.environmentHeelingArm>=0?'+':''}${state.environmentHeelingArm.toFixed(3)} m`);
 if(sr&&Number.isFinite(sr.avs)&&sr.avs<40)contributors.push(`Reduced AVS ${sr.avs.toFixed(1)}°`);
 if(Number.isFinite(earliestDF))contributors.push(`Downflooding ≈${earliestDF.toFixed(0)}°`);
 if(dyn.highSync)contributors.push('Te ≈ Tr'); else if(dyn.watchSync)contributors.push('Te near Tr');
 if(dyn.highParam)contributors.push(dyn.param05<dyn.param11?'Te ≈ 0.5Tr':'Te ≈ Tr (parametric)');
 if(dyn.longHighWave)contributors.push('Long/high-wave regime');
 state.instabilityClass=key;
 return {key,label,tone,gm,eq,dyn,contributors,earliestDF};
}
function updateInstabilityMonitor(){
 const a=instabilityAssessment();
 const tone={emerald:['border-emerald-500/30','bg-emerald-500/10','text-emerald-300'],amber:['border-amber-500/30','bg-amber-500/10','text-amber-300'],rose:['border-rose-500/40','bg-rose-500/12','text-rose-300'],cyan:['border-cyan-500/30','bg-cyan-500/10','text-cyan-300']}[a.tone]||[];
 const badge=document.getElementById('instabilityStatusBadge');if(badge){badge.className=`text-[8px] px-2 py-1 rounded-full border font-black ${tone.join(' ')}`;badge.textContent=a.label;}
 const primary=document.getElementById('instabilityPrimary');if(primary){
  let explanation='Positive initial stability with equilibrium close to upright.';
  if(a.key==='loll')explanation='Negative corrected GM makes the upright position unstable. The stable non-zero equilibrium is an angle of loll, not an ordinary transverse list.';
  else if(a.key==='list')explanation='Corrected GM is positive, but a transverse or external heeling moment moves the vessel to a non-zero equilibrium: this is list/forced heel rather than angle of loll.';
  else if(a.key==='tender')explanation='Corrected GM is small. Initial restoring tendency is weak and the natural roll period becomes longer.';
  else if(a.key==='stiff')explanation='High GM relative to beam gives strong initial restoring tendency and comparatively short roll response. This label is a teaching heuristic, not a statutory limit.';
  else if(a.key==='dynamic')explanation='The encounter period is very close to the natural roll period while Forced/Synchronous mode is selected.';
  else if(a.key==='parametric')explanation='The encounter timing is close to a parametric-roll region while Simplified Parametric mode is selected; restoring stability is being varied periodically.';
  else if(a.key==='downflood')explanation='The current heel has reached a deck-edge/downflooding boundary. Stability beyond this point is not credited by the teaching monitor.';
  primary.className=`rounded-lg border px-2.5 py-2 text-[10px] font-bold ${tone.join(' ')}`;primary.innerHTML=`<div>${a.label}</div><div class="mt-1 text-[9px] font-normal text-slate-300">${explanation}</div>`;
 }
 const set=(id,v,c='text-slate-100')=>{const e=document.getElementById(id);if(e){e.textContent=v;e.className=`v ${c}`;}};
 set('instabilityGM',`${a.gm.toFixed(3)} m`,a.gm<0?'text-rose-300':a.gm<.15?'text-amber-300':'text-emerald-300');
 set('instabilityEQ',`${state.equilibrium>=0?'+':''}${state.equilibrium.toFixed(2)}°`,Math.abs(state.equilibrium)>1?'text-amber-300':'text-slate-100');
 set('instabilityTR',Number.isFinite(a.dyn.Tr)?`${a.dyn.Tr.toFixed(2)} s`:'UNSTABLE',Number.isFinite(a.dyn.Tr)?'text-cyan-300':'text-rose-300');
 set('instabilityTE',Number.isFinite(a.dyn.Te)?`${a.dyn.Te.toFixed(2)} s`:a.dyn.Te===Infinity?'∞':'—','text-violet-300');
 const dr=document.getElementById('instabilityDynamicReadout');if(dr){
  const syncTxt=Number.isFinite(a.dyn.sync)?`${(a.dyn.sync*100).toFixed(1)}% from Tᵣ`:'N/A';
  const pTarget=a.dyn.param05<a.dyn.param11?'0.5 Tᵣ':'Tᵣ';const pErr=Number.isFinite(a.dyn.param)?`${(a.dyn.param*100).toFixed(1)}%`:'N/A';
  const risk=(a.dyn.highSync||a.dyn.highParam)?'HIGH TIMING PROXIMITY':(a.dyn.watchSync||a.dyn.watchParam)?'WATCH':'CLEAR OF TEACHING PROXIMITY BAND';
  const riskCls=(a.dyn.highSync||a.dyn.highParam)?'text-rose-300 border-rose-900/50 bg-rose-950/20':(a.dyn.watchSync||a.dyn.watchParam)?'text-amber-300 border-amber-900/50 bg-amber-950/20':'text-slate-300 border-slate-800 bg-slate-950/65';
  dr.className=`text-[9px] rounded-lg border p-2 ${riskCls}`;
  dr.innerHTML=`<div class="flex justify-between gap-2"><b>${risk}</b><span>${state.rollMode.toUpperCase()}</span></div><div class="mt-1 text-slate-400">Forced/synchronous: ${syncTxt} · Parametric nearest ${pTarget}: ${pErr}. Ship speed ${state.shipSpeedKts.toFixed(1)} kn · encounter angle ${waveEncounterAngleDeg()}°.</div>`;
 }
 const chips=document.getElementById('instabilityContributors');if(chips)chips.innerHTML=(a.contributors.length?a.contributors:['No major instability contributor detected']).map(x=>`<span class="px-1.5 py-1 rounded border border-slate-700 bg-slate-900 text-[8px] text-slate-300">${escapeHtml(x)}</span>`).join('');
 updateEncounterReadout(a.dyn);
 return a;
}
function updateEncounterReadout(dyn=null){
 dyn=dyn||dynamicStabilityAssessment();const el=document.getElementById('encounterReadout');if(!el)return;
 const te=Number.isFinite(dyn.Te)?dyn.Te.toFixed(2)+' s':dyn.Te===Infinity?'∞':'—';const tr=Number.isFinite(dyn.Tr)?dyn.Tr.toFixed(2)+' s':'unstable';
 const pv=document.getElementById('parametricVariationLabel');if(pv)pv.textContent=`${Math.round(state.parametricVariation*100)}%`;
 el.innerHTML=`T<sub>W</sub> ${state.wavePeriod.toFixed(2)} s · V ${state.shipSpeedKts.toFixed(1)} kn · α ${waveEncounterAngleDeg()}° · <b>T<sub>E</sub> ${te}</b> · T<sub>R</sub> ${tr}`;
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hydroFmt(v,d=2){return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';}
function hydroCell(label,value){return `<div class="rounded bg-slate-900 border border-slate-800 p-1.5"><div class="text-[7px] uppercase text-slate-500">${escapeHtml(label)}</div><div class="text-[10px] font-mono font-bold text-slate-200">${escapeHtml(value)}</div></div>`;}
function activeHydroSourceRows(){const p=hydroPack();return Array.isArray(p.rows)?p.rows:[];}
function renderHydrostaticTableModal(){
 const p=hydroPack(),rows=activeHydroSourceRows(),hr=hydroTableAtCurrentDisplacement(),vessel=state.vesselName||p.metadata?.name||'Training vessel';
 const title=document.getElementById('hydroTableModalTitle'),sub=document.getElementById('hydroTableModalSubtitle'),current=document.getElementById('hydroTableCurrentPoint'),note=document.getElementById('hydroTableSourceNote'),scroll=document.getElementById('hydroTableScroll');if(!title||!scroll)return;
 title.textContent=`${vessel} · Hydrostatic Table`;sub.textContent=`${p.badge||'MODEL'} · ${p.label||'Active data source'}`;
 const point=[['Δ',`${state.dispMass.toFixed(1)} t`],['Draft',`${state.eqDraft.toFixed(3)} m`],['KB',`${state.upright?state.upright.KB.toFixed(3):'—'} m`],['KMT',`${state.upright?state.upright.KM.toFixed(3):'—'} m`],['KGc',`${state.kgCorr.toFixed(3)} m`],['GM',`${state.gm.toFixed(3)} m`],['TPC',`${state.tpc.toFixed(3)} t/cm`],['MCT 1 cm',`${state.mct1cm.toFixed(2)} t·m/cm`]];
 current.innerHTML=point.map(([a,b])=>hydroCell(a,b)).join('');
 note.innerHTML=`<b class="text-emerald-300">${escapeHtml(p.source||'Simulator geometry model')}</b>${p.note?` · ${escapeHtml(p.note)}`:''}${hr?`<div class="mt-1 text-amber-200">Current source interpolation: draft ${hr.draft.toFixed(3)} m at source-equivalent Δ ${(p.kind==='uploadedBundle'?sourceEquivalentDisplacement(p):state.dispMass).toFixed(1)} t.</div>`:''}`;
 if(rows.length){
  const cols=[['draft','Draft m',3],['disp','Δ t',1],['tpc','TPC t/cm',2],['kb','KB m',3],['kmt','KMT m',3],['kml','KML m',2],['mctc','MCT 1cm',2],['lcf','LCF m',3],['lcb','LCB m',3]];
  const target=p.kind==='uploadedBundle'?sourceEquivalentDisplacement(p):state.dispMass;let nearest=0,min=Infinity;rows.forEach((r,i)=>{const d=Math.abs((Number(r.disp)||0)-target);if(d<min){min=d;nearest=i;}});
  scroll.innerHTML=`<div class="mb-2 flex items-center justify-between gap-2"><div class="text-[9px] font-bold text-emerald-300">Source-backed hydrostatic rows (${rows.length})</div><div class="text-[8px] text-slate-500">Amber row = nearest published anchor to current displacement</div></div><table><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${i===nearest?'hydro-nearest':''}">${cols.map(([k,l,d])=>`<td>${hydroFmt(r[k],d)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if(p.kind==='uploadedBundle'&&p.knRows?.length){
   const groups=[...new Set(p.knRows.map(r=>r.disp))].sort((a,b)=>a-b);scroll.innerHTML+=`<div class="mt-5 mb-2 text-[9px] font-bold text-violet-300">Uploaded KN cross-curves · ${p.knRows.length} ordinates · ${groups.length} displacement level(s)</div><table><thead><tr><th>Δ t</th><th>Angle °</th><th>KN m</th><th>Side</th></tr></thead><tbody>${p.knRows.map(r=>`<tr><td>${hydroFmt(r.disp,1)}</td><td>${hydroFmt(r.angle,1)}</td><td>${hydroFmt(r.kn,3)}</td><td>${escapeHtml(r.side||'both')}</td></tr>`).join('')}</tbody></table>`;
  }
 }else if(p.kind==='gzReference'&&p.gz?.length){
  scroll.innerHTML=`<div class="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-[10px] text-amber-100 mb-3">This active pack contains a source GZ reference rather than an upright hydrostatic table.</div><table><thead><tr><th>Heel angle °</th><th>Reference GZ m</th></tr></thead><tbody>${p.gz.map(r=>`<tr><td>${hydroFmt(r.a,1)}</td><td>${hydroFmt(r.v,3)}</td></tr>`).join('')}</tbody></table>`;
 }else if(p.kind==='knReference'&&p.kn?.length){
  scroll.innerHTML=`<div class="rounded-xl border border-violet-800/40 bg-violet-950/20 p-3 text-[10px] text-violet-100 mb-3">This active pack contains KN cross-curve ordinates rather than an upright hydrostatic table.</div><table><thead><tr><th>Heel angle °</th><th>KN m</th></tr></thead><tbody>${p.kn.map(r=>`<tr><td>${hydroFmt(r.a,1)}</td><td>${hydroFmt(r.v,3)}</td></tr>`).join('')}</tbody></table>`;
 }else{
  scroll.innerHTML=`<div class="max-w-2xl mx-auto mt-8 rounded-xl border border-slate-700 bg-slate-900/70 p-5 text-center"><div class="text-emerald-300 text-xl mb-2"><i class="fa-solid fa-table"></i></div><div class="font-bold text-slate-100">No source-backed hydrostatic table is loaded for this vessel.</div><div class="mt-2 text-[10px] text-slate-400 leading-relaxed">The values above are the simulator's current computed geometry-model point. Select a source hydrostatic pack or upload vessel hydrostatic data to display a real tabulated dataset. The simulator will not fabricate a table from public dimensions alone.</div></div>`;
 }
}
function openHydrostaticTableModal(){renderHydrostaticTableModal();document.getElementById('hydroTableBackdrop')?.classList.remove('hidden');document.body.classList.add('hydro-table-open');}
function closeHydrostaticTableModal(){document.getElementById('hydroTableBackdrop')?.classList.add('hidden');document.body.classList.remove('hydro-table-open');}
function downloadActiveHydrostaticTableCSV(){
 const p=hydroPack(),rows=activeHydroSourceRows();let csv='';
 if(rows.length){const cols=['draft','disp','tpc','kb','kmt','kml','mctc','lcf','lcb'];csv=cols.join(',')+'\n'+rows.map(r=>cols.map(k=>Number.isFinite(Number(r[k]))?Number(r[k]):'').join(',')).join('\n');}
 else if(p.kind==='gzReference'&&p.gz?.length)csv='angle_deg,gz_m\n'+p.gz.map(r=>`${r.a},${r.v}`).join('\n');
 else if(p.kind==='knReference'&&p.kn?.length)csv='angle_deg,kn_m\n'+p.kn.map(r=>`${r.a},${r.v}`).join('\n');
 else {csv='parameter,value\n'+[['vessel',state.vesselName||'Training vessel'],['displacement_t',state.dispMass],['draft_m',state.eqDraft],['KB_m',state.upright?.KB],['KMT_m',state.upright?.KM],['KG_corrected_m',state.kgCorr],['GM_corrected_m',state.gm],['TPC_t_per_cm',state.tpc],['MCT1cm_t_m_per_cm',state.mct1cm]].map(r=>r.join(',')).join('\n');}
 const safe=(state.vesselName||'vessel').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');downloadText(`${safe||'vessel'}_hydrostatic_data.csv`,csv,'text/csv');
}

function updateUI(){
 setControlValues();const warn=document.getElementById('canvasWarning');if(state.hydro?.invalid){warn.textContent=state.hydro.reason;warn.classList.remove('hidden');return}else warn.classList.add('hidden');
 const h=state.hydro,u=state.upright;document.getElementById('hudDisp').textContent=`${state.dispMass.toFixed(0)} t`;document.getElementById('hudDraft').textContent=`${state.eqDraft.toFixed(2)} m`;document.getElementById('hudGM').textContent=`${state.gm.toFixed(3)} m`;document.getElementById('hudUKC').textContent=`${state.ukc.toFixed(2)} m`;
 const ogz=restoringGZAt(state.heel),sense=stabilitySenseAt(state.heel);document.getElementById('hudHeel').textContent=`${Math.abs(state.heel).toFixed(1)}° ${state.heel<0?'PORT':'STBD'}`;document.getElementById('hudGZ').textContent=`${ogz>0?'+':''}${ogz.toFixed(3)} m · ${sense}`;document.getElementById('hudRM').textContent=`${state.dispMass*G*ogz>=0?'+':''}${(state.dispMass*G*ogz).toFixed(0)} kN·m`;document.getElementById('hudKG').textContent=`${state.kgCorr.toFixed(3)} m`;const gmCalcEl=document.getElementById('hudGMCalc');if(gmCalcEl){gmCalcEl.textContent=`${u.KM.toFixed(3)} − ${state.kgCorr.toFixed(3)} = ${state.gm.toFixed(3)} m`;gmCalcEl.className=`font-bold text-right ${state.gm<0?'text-rose-400':state.gm<.15?'text-amber-300':'text-emerald-300'}`;}document.getElementById('hudKBKM').textContent=`${u.KB.toFixed(2)} / ${u.BM.toFixed(2)} / ${u.KM.toFixed(2)} m`;document.getElementById('hudFreeboard').textContent=`${h.portFreeboard.toFixed(2)} / ${h.stbdFreeboard.toFixed(2)} m`;document.getElementById('hudTPCFWA').textContent=`${state.tpc.toFixed(2)} t/cm / ${state.fwa.toFixed(0)} mm`;document.getElementById('hudTrim').textContent=`${state.trimAngle>=0?'+':''}${state.trimAngle.toFixed(2)}°`;document.getElementById('hudEndDrafts').textContent=`${state.draftBow.toFixed(2)} / ${state.draftStern.toFixed(2)} m`;
 const inst=instabilityAssessment();const badge=document.getElementById('stateBadge');const cls=inst.tone==='rose'?'text-rose-400':inst.tone==='amber'?'text-amber-400':inst.tone==='cyan'?'text-cyan-300':'text-emerald-400';badge.className=`font-bold ${cls}`;badge.textContent=inst.label;
 const envOn=state.windEnabled||state.currentEnabled;
 document.getElementById('equilibriumReadout').innerHTML=`${envOn?'Environmental':'Static'} equilibrium: <b class="text-amber-300">${state.equilibrium.toFixed(1)}°</b> · Corrected GM: <b>${state.gm.toFixed(3)} m</b> · Natural roll: <b>${state.naturalPeriod?state.naturalPeriod.toFixed(1)+' s':'unstable'}</b>${envOn?` · Env. arm <b>${state.environmentHeelingArm>=0?'+':''}${state.environmentHeelingArm.toFixed(3)} m</b>`:''}`;
 const criteria=evaluateIMO(),list=document.getElementById('imoCriteriaList');list.innerHTML=criteria.map(c=>`<div class="p-2 rounded border ${c.pass?'border-emerald-900/50 bg-emerald-950/15':'border-rose-900/50 bg-rose-950/15'} flex justify-between gap-2"><div><div class="text-[10px] font-semibold">${c.name}</div><div class="text-[9px] text-slate-500">${c.req}</div></div><div class="text-right"><div class="text-[10px] font-mono ${c.pass?'text-emerald-400':'text-rose-400'}">${c.fmt(c.actual)}</div><div class="text-[9px] font-bold ${c.pass?'text-emerald-400':'text-rose-400'}">${c.pass?'PASS':'FAIL'}</div></div></div>`).join('');const all=criteria.every(c=>c.pass),io=document.getElementById('imoOverall');io.className=`tiny px-2 py-1 rounded font-bold ${all?'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30':'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`;io.textContent=all?'PASS':'FAIL';
 const ref=document.getElementById('hydroReference');const hp=hydroPack(),hr=hydroTableAtCurrentDisplacement();const data=[['Data source',`${hp.badge} · ${hp.label}`],['Reference validity',hp.referenceDisp?`${(100*(state.dispMass-hp.referenceDisp)/hp.referenceDisp).toFixed(1)}% from reference Δ`:hr?`${hp.kind==='uploadedBundle'?'uploaded':'table'} interpolation at ${hr.draft.toFixed(2)} m`:'model only'],['Displacement',`${state.dispMass.toFixed(1)} t`],['Volume',`${(state.dispMass/state.density).toFixed(1)} m³`],['Coupled equilibrium',state.coupledValid?`${state.coupledHeel.toFixed(2)}° heel / ${state.coupledTrim.toFixed(2)}° trim`:'CHECK'],['Coupled B (TCB/LCB)',`${state.coupledTCB.toFixed(2)} / ${state.coupledLCB.toFixed(2)} m`],['Equivalent draft',`${state.eqDraft.toFixed(3)} m`],['BWL upright',`${u.bwl.toFixed(3)} m`],['KB',`${u.KB.toFixed(3)} m`],['BM',`${u.BM.toFixed(3)} m`],['KM',`${u.KM.toFixed(3)} m`],['KG corrected',`${state.kgCorr.toFixed(3)} m`],['GM corrected',`${state.gm.toFixed(3)} m`],['LCG',`${state.lcg>=0?'+':''}${state.lcg.toFixed(3)} m`],['LCF',`${state.lcf>=0?'+':''}${state.lcf.toFixed(3)} m`],['Longitudinal GM',`${state.gmLong.toFixed(2)} m`],['MCT 1 cm',`${state.mct1cm.toFixed(2)} t·m/cm`],['Trim F−A',`${state.trimMeters>=0?'+':''}${state.trimMeters.toFixed(3)} m`],['Static trim',`${state.trimAngle>=0?'+':''}${state.trimAngle.toFixed(3)}°`],['Draft F / A',`${state.draftBow.toFixed(3)} / ${state.draftStern.toFixed(3)} m`],['TPC',`${state.tpc.toFixed(3)} t/cm`],['FWA (SW ref.)',`${state.fwa.toFixed(1)} mm`],['Downflood opening',Number.isFinite(downfloodAngle)?`≈ ${downfloodAngle.toFixed(1)}° · ${state.downfloodBasisStarboard||'basis unavailable'}`:'>80°'],['Deck-edge immersion',Number.isFinite(deckEdgeAngle)?`≈ ${deckEdgeAngle.toFixed(1)}°`:'>80°']];ref.innerHTML=data.map(([a,b])=>`<div class="bg-slate-900 rounded p-1.5"><div class="text-slate-500">${a}</div><div class="text-slate-200">${b}</div></div>`).join('');
 updateHydroDataPackInfo();updateUploadedHydroStatus();if(state.sourceConditionKey==='great_fortune_workbook')showSelectedReferenceVesselInfo();updateWaveReadout();updateEnvironmentReadout();updateCoupledHydroUI();updateGrainUI();updateInstabilityMonitor();renderCargoArrangementSchematic();renderSpaceFillMonitor();renderAMCOLTrainingDataPanel();if(!document.getElementById('hydroTableBackdrop')?.classList.contains('hidden'))renderHydrostaticTableModal();
 if(stabilityMission.active){
  const ml=document.getElementById('missionMetricList'),mg=document.getElementById('missionMetricGM'),mf=document.getElementById('missionMetricFSC');
  if(ml)ml.textContent=`${state.equilibrium>=0?'+':''}${state.equilibrium.toFixed(2)}°`;
  if(mg)mg.textContent=`${state.gm.toFixed(3)} m`;
  if(mf)mf.textContent=`${state.fsc.toFixed(3)} m`;
 }
 renderUnifiedMissionPanel();
 updateCleanLivePanel();
 updateActivePoint();
 // Visual errors must never escape into the mass/hydrostatic/roll physics path.
 if(displayMode==='3d'&&!vesselVisualTransaction){if(dynamicsRunning||stabilityTestRuntime.active)safeSync3DPose('roll-pose-sync');else safeSync3D({hard:false,reason:'physics-ui-sync'});}
}


function waveHeadingFactor(){return ({beam:1,quartering:0.65,head:0.22,following:0.15})[state.waveHeading]||1;}
function estimatedWaveMomentAmplitude(){if(!state.waveEnabled)return 0;const H=Math.max(0,state.waveHeight),L=Math.max(5,state.waveLength);const slope=(Math.PI*H)/L;return (state.dispMass*1000)*G*(state.beam*0.45)*slope*waveHeadingFactor()*state.waveGain;}
function updateWaveReadout(){const el=document.getElementById('waveReadout');if(!el)return;const amp=estimatedWaveMomentAmplitude()/1000;const mode=state.waveEnabled?'ON':'OFF';const period=Math.max(.1,state.wavePeriod).toFixed(2),Te=calculateEncounterPeriod();const teTxt=Number.isFinite(Te)?Te.toFixed(2)+' s':Te===Infinity?'∞':'—';const wr=state.waveModel==='physical'?solveWaveDispersion(state.wavePeriod,state.waterDepth):null;el.textContent=`Wave field ${mode} · ${state.waveModel==='physical'?'DISPERSION '+(wr?.regime||''):'MANUAL'} · H ${state.waveHeight.toFixed(1)} m · λ ${state.waveLength.toFixed(0)} m · c ${state.waveSpeed.toFixed(2)} m/s · TW ${period} s · TE ${teTxt} · ${state.waveHeading} · est. forced-roll moment ±${amp.toFixed(0)} kN·m`;updateEncounterReadout();}
function rectBody(x,y,w,h){return [[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];}
function screenPtsFromBody(poly,phi,sink,scale,cx,waterY){return poly.map(([x,y])=>worldToScreen(...bodyToWorld(x,y,phi,sink),scale,cx,waterY));}
function drawScreenPolygon(pts,fill,stroke='#e2e8f0',width=1){if(!pts.length)return;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function drawBodyShape(poly,phi,sink,scale,cx,waterY,fill,stroke='#e2e8f0',width=1){drawScreenPolygon(screenPtsFromBody(poly,phi,sink,scale,cx,waterY),fill,stroke,width);}
function drawBodyLine(a,b,phi,sink,scale,cx,waterY,stroke='#e2e8f0',width=1,dash=[]){const p1=worldToScreen(...bodyToWorld(a[0],a[1],phi,sink),scale,cx,waterY),p2=worldToScreen(...bodyToWorld(b[0],b[1],phi,sink),scale,cx,waterY);ctx.save();ctx.setLineDash(dash);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();ctx.restore();}
function drawWindowStrip(y,width,count,phi,sink,scale,cx,waterY,height=.22,color='#93c5fd'){const gap=width/(count+1);for(let i=0;i<count;i++){const x=-width/2+gap*(i+1);drawBodyShape(rectBody(x,y,.24,height),phi,sink,scale,cx,waterY,color,'rgba(255,255,255,.35)',.6);}}
function drawBodyCapsule(x,y,w,h,phi,sink,scale,cx,waterY,fill='#f97316',stroke='#fff'){
 const [sx,sy]=worldToScreen(...bodyToWorld(x,y,phi,sink),scale,cx,waterY);ctx.save();ctx.translate(sx,sy);ctx.rotate(transverseScreenSign()*phi);
 const rr=Math.min(w,h)*scale*.46;ctx.beginPath();ctx.moveTo(-w*scale*.38,-h*scale*.5);ctx.lineTo(w*scale*.26,-h*scale*.5);ctx.quadraticCurveTo(w*scale*.56,0,w*scale*.26,h*scale*.5);ctx.lineTo(-w*scale*.38,h*scale*.5);ctx.quadraticCurveTo(-w*scale*.62,0,-w*scale*.38,-h*scale*.5);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.moveTo(-w*scale*.18,-h*scale*.18);ctx.lineTo(w*scale*.18,-h*scale*.18);ctx.stroke();ctx.restore();
}
function transversePropellerCount(type){return (type==='roro'||type==='ferry'||type==='osv')?2:(type==='box'?0:1)}
function drawTransverseExternalDetails(phi,sink,scale,cx,waterY){
 const B=state.beam,D=state.depth,type=state.hullType||'general';
 const lifeboatY=(type==='roro'||type==='ferry')?D+1.52:(type==='osv'?D+1.62:D+1.42);
 if(type!=='box'){drawBodyCapsule(-B*.38,lifeboatY,B*.12,D*.10,phi,sink,scale,cx,waterY,'#f97316');drawBodyCapsule(B*.38,lifeboatY,B*.12,D*.10,phi,sink,scale,cx,waterY,'#f97316');}
 if(state.viewMode==='bow'){
  for(const side of [-1,1]){const [sx,sy]=worldToScreen(...bodyToWorld(side*B*.38,D*.56,phi,sink),scale,cx,waterY);ctx.save();ctx.translate(sx,sy);ctx.rotate(transverseScreenSign()*phi);ctx.strokeStyle='#94a3b8';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,B*.024*scale,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-D*.085*scale);ctx.lineTo(0,D*.08*scale);ctx.moveTo(0,D*.04*scale);ctx.lineTo(-side*B*.03*scale,D*.11*scale);ctx.moveTo(0,D*.04*scale);ctx.lineTo(side*B*.03*scale,D*.11*scale);ctx.stroke();ctx.restore();}
 }
 if(state.viewMode==='stern'){
  const n=transversePropellerCount(type),xs=n===2?[-B*.16,B*.16]:[0];
  xs.forEach((x,i)=>{const [sx,sy]=worldToScreen(...bodyToWorld(x,D*.10+i*D*.03,phi,sink),scale,cx,waterY);ctx.save();ctx.translate(sx,sy);ctx.rotate(transverseScreenSign()*phi+dynTime*(1.6+i*.3));ctx.strokeStyle='#fbbf24';ctx.fillStyle='rgba(251,191,36,.22)';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,Math.max(5,B*.032*scale),0,Math.PI*2);ctx.fill();ctx.stroke();for(let b=0;b<3;b++){ctx.rotate((Math.PI*2)/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(B*.04*scale,0);ctx.lineTo(B*.015*scale,B*.018*scale);ctx.closePath();ctx.fill();ctx.stroke();}ctx.restore();});
  drawBodyLine([0,D*.06],[0,D*.42],phi,sink,scale,cx,waterY,'#cbd5e1',2);
 }
}
function drawShipOutfit(phi,sink,scale,cx,waterY){
 const B=state.beam,D=state.depth;
 drawBodyLine([-0.46*B,D-.1],[0.46*B,D-.1],phi,sink,scale,cx,waterY,'rgba(255,255,255,.6)',1.1,[4,3]);

 if(state.hullType==='container'){
  for(let row=0;row<4;row++){const y=D+.32+row*.58,cols=row>2?4:5,span=B*(row>2?.42:.62);for(let i=0;i<cols;i++){const x=-span/2+i*span/(cols-1);drawBodyShape(rectBody(x,y,Math.max(.8,B*.07),.44),phi,sink,scale,cx,waterY,['#1d4ed8','#475569','#2563eb','#7c3aed','#0f766e'][i%5],'rgba(255,255,255,.4)',.7);}}
  drawBodyShape(rectBody(0,D+3.05,B*.30,.95),phi,sink,scale,cx,waterY,'#e2e8f0','#fff',1);drawWindowStrip(D+3.08,B*.21,5,phi,sink,scale,cx,waterY,.17,'#0f172a');
 }
 else if(state.hullType==='bulk'){
  for(let x of [-B*.28,-B*.09,B*.09,B*.28])drawBodyShape(rectBody(x,D+.18,B*.13,.28),phi,sink,scale,cx,waterY,'#64748b','#cbd5e1',.8);
  for(let x of [-B*.20,0,B*.20]){drawBodyLine([x,D+.35],[x,D+2.2],phi,sink,scale,cx,waterY,'#94a3b8',2);drawBodyLine([x,D+2.15],[x+B*.10,D+1.2],phi,sink,scale,cx,waterY,'#94a3b8',1.5);}
  drawBodyShape(rectBody(0,D+2.65,B*.24,.85),phi,sink,scale,cx,waterY,'#e5e7eb','#fff',1);drawWindowStrip(D+2.67,B*.16,4,phi,sink,scale,cx,waterY,.15,'#0f172a');
 }
 else if(state.hullType==='roro'||state.hullType==='ferry'){
  drawBodyShape(rectBody(0,D+.85,B*.82,.82),phi,sink,scale,cx,waterY,'#dbeafe','#fff',1);
  drawBodyShape(rectBody(0,D+1.7,B*.70,.72),phi,sink,scale,cx,waterY,'#eff6ff','#fff',1);
  drawBodyShape(rectBody(0,D+2.45,B*.52,.62),phi,sink,scale,cx,waterY,'#f8fafc','#fff',1);
  drawWindowStrip(D+.84,B*.68,10,phi,sink,scale,cx,waterY,.16,'#0f172a');
  drawWindowStrip(D+1.70,B*.55,8,phi,sink,scale,cx,waterY,.16,'#1e293b');
  drawWindowStrip(D+2.45,B*.35,6,phi,sink,scale,cx,waterY,.15,'#1e3a8a');
 }
 else if(state.hullType==='tanker'||state.hullType==='chemical'){
  for(let y of [D+.18,D+.36])drawBodyLine([-B*.36,y],[B*.36,y],phi,sink,scale,cx,waterY,'#f59e0b',1.3);
  for(let x of [-B*.26,-B*.13,0,B*.13,B*.26])drawBodyShape(rectBody(x,D+.25,B*.035,.35),phi,sink,scale,cx,waterY,'#94a3b8','#cbd5e1',.6);
  drawBodyShape(rectBody(0,D+1.25,B*.30,.80),phi,sink,scale,cx,waterY,'#e2e8f0','#fff',1);drawWindowStrip(D+1.27,B*.20,5,phi,sink,scale,cx,waterY,.15,'#0f172a');
  drawBodyLine([-B*.18,D+.60],[B*.18,D+.60],phi,sink,scale,cx,waterY,'#fb923c',2);
 }
 else if(state.hullType==='lng'){
  for(let x of [-B*.24,-B*.08,B*.08,B*.24]){const c=bodyToWorld(x,D+.90,phi,sink),[sx,sy]=worldToScreen(c[0],c[1],scale,cx,waterY);ctx.save();ctx.translate(sx,sy);ctx.rotate(transverseScreenSign()*phi);ctx.fillStyle='#dbeafe';ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,B*.07*scale,D*.12*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  drawBodyShape(rectBody(0,D+2.35,B*.26,.75),phi,sink,scale,cx,waterY,'#f8fafc','#fff',1);drawWindowStrip(D+2.36,B*.17,4,phi,sink,scale,cx,waterY,.14,'#0f172a');
 }
 else if(state.hullType==='osv'){
  drawBodyShape(rectBody(0,D+.70,B*.62,.65),phi,sink,scale,cx,waterY,'#f8fafc','#fff',1);
  drawBodyShape(rectBody(0,D+1.45,B*.42,.65),phi,sink,scale,cx,waterY,'#dbeafe','#fff',1);
  drawWindowStrip(D+1.46,B*.28,5,phi,sink,scale,cx,waterY,.15,'#0f172a');
  drawBodyLine([-B*.34,D+.22],[B*.34,D+.22],phi,sink,scale,cx,waterY,'#f59e0b',2);
 }
 else if(state.hullType==='box'){
  drawBodyShape(rectBody(0,D+.52,B*.65,.50),phi,sink,scale,cx,waterY,'#cbd5e1','#f8fafc',1);
  drawBodyShape(rectBody(0,D+1.20,B*.24,.75),phi,sink,scale,cx,waterY,'#f1f5f9','#fff',1);drawWindowStrip(D+1.22,B*.14,3,phi,sink,scale,cx,waterY,.14,'#0f172a');
 }
 else{
  drawBodyShape(rectBody(0,D+.55,B*.44,.64),phi,sink,scale,cx,waterY,'#dbeafe','#fff',1);
  drawBodyShape(rectBody(0,D+1.28,B*.28,.56),phi,sink,scale,cx,waterY,'#eff6ff','#fff',1);
  drawWindowStrip(D+1.27,B*.18,4,phi,sink,scale,cx,waterY,.14,'#0f172a');
  for(let x of [-B*.22,0,B*.22])drawBodyShape(rectBody(x,D+.18,B*.08,.22),phi,sink,scale,cx,waterY,'#64748b','rgba(255,255,255,.35)',.6);
 }
 drawTransverseExternalDetails(phi,sink,scale,cx,waterY);
 if(state.crane){
  drawBodyLine([0,D+.45],[state.craneSide*state.craneOutreach*.55,D+2.0],phi,sink,scale,cx,waterY,'#c084fc',2.2);
  drawBodyLine([state.craneSide*state.craneOutreach*.55,D+2.0],[state.craneSide*state.craneOutreach*.55,D+1.0],phi,sink,scale,cx,waterY,'#c084fc',1.5);
 }
}



function setDisplayMode(mode){
 displayMode=mode==='3d'?'3d':'2d';
 const is3D=displayMode==='3d';
 const shipCanvas=document.getElementById('shipCanvas'),three=document.getElementById('threeDContainer'),tools=document.getElementById('canvas2DTools'),overlay=document.getElementById('viewOrientationOverlay'),stateHud=document.getElementById('stateHud');
 if(stateHud){stateHud.classList.toggle('left-3',!is3D);stateHud.classList.toggle('right-3',is3D);}
 document.getElementById('display2DBtn')?.classList.toggle('active',!is3D);document.getElementById('display3DBtn')?.classList.toggle('active',is3D);document.getElementById('view3DPerspectiveBtn')?.classList.toggle('hidden',!is3D);document.getElementById('view3DTopBtn')?.classList.toggle('hidden',!is3D);
 if(shipCanvas){shipCanvas.classList.toggle('invisible',is3D);shipCanvas.style.visibility=is3D?'hidden':'visible';shipCanvas.style.opacity=is3D?'0':'1';shipCanvas.style.pointerEvents=is3D?'none':'auto';shipCanvas.style.zIndex=is3D?'0':'1';}
 if(three){three.classList.toggle('opacity-0',!is3D);three.classList.toggle('pointer-events-none',!is3D);three.style.opacity=is3D?'1':'0';three.style.visibility=is3D?'visible':'hidden';three.style.pointerEvents=is3D?'auto':'none';three.style.zIndex=is3D?'2':'0';three.setAttribute('aria-hidden',String(!is3D));}
 if(tools)tools.classList.toggle('hidden',is3D);if(overlay)overlay.classList.toggle('hidden',is3D);
 try{window.AMCOL3D?.setViewActive?.(is3D);}catch(err){report3DVisualError(err,'view activation');}
 if(is3D){
   // Entering 3D always starts from one complete vessel snapshot. No stale family spaces can survive this boundary.
   const ok=safeSync3D({hard:true,reason:'enter-3d'});if(ok)pendingHard3DReload=false;
   try{window.AMCOL3D?.resize?.();}catch(err){report3DVisualError(err,'enter-3d');}
 }else{
   schedule2DVisualPaint('enter-2d');
 }
 render();
}


function updateWorkspaceFocusButtons(){
 const visualBtn=document.getElementById('visualFocusBtn');
 const controlsBtn=document.getElementById('controlsFocusBtn');
 visualBtn?.classList.toggle('active',sidebarCollapsed);
 controlsBtn?.classList.toggle('active',controlsMaximized);
 visualBtn?.setAttribute('aria-pressed',String(sidebarCollapsed));
 controlsBtn?.setAttribute('aria-pressed',String(controlsMaximized));
}
function refreshWorkspaceAfterFocusChange(){
 setTimeout(()=>{resizeCanvas();gzChart?.resize?.();strengthChart?.resize?.();window.AMCOL3D?.resize?.();},240);
}
function toggleControlSidebar(force){
 const next=typeof force==='boolean'?force:!sidebarCollapsed;
 if(next){controlsMaximized=false;}
 sidebarCollapsed=next;
 const shell=document.getElementById('appShell');
 shell?.classList.toggle('sidebar-collapsed',sidebarCollapsed);
 shell?.classList.toggle('controls-maximized',controlsMaximized);
 updateWorkspaceFocusButtons();
 refreshWorkspaceAfterFocusChange();
}
function toggleControlsFocus(force){
 const next=typeof force==='boolean'?force:!controlsMaximized;
 if(next){sidebarCollapsed=false;}
 controlsMaximized=next;
 const shell=document.getElementById('appShell');
 shell?.classList.toggle('sidebar-collapsed',sidebarCollapsed);
 shell?.classList.toggle('controls-maximized',controlsMaximized);
 updateWorkspaceFocusButtons();
 refreshWorkspaceAfterFocusChange();
}
function resetWorkspaceSplit(){
 sidebarCollapsed=false;
 controlsMaximized=false;
 const shell=document.getElementById('appShell');
 shell?.classList.remove('sidebar-collapsed','controls-maximized');
 updateWorkspaceFocusButtons();
 refreshWorkspaceAfterFocusChange();
}
function showGZPanel(){
 const p=document.getElementById('gzFloatingPanel');if(!p)return;
 p.classList.remove('gz-hidden');document.getElementById('gzRestoreBtn')?.classList.remove('visible');
 setTimeout(()=>gzChart?.resize?.(),30);
}
function hideGZPanel(){
 document.getElementById('gzFloatingPanel')?.classList.add('gz-hidden');
 document.getElementById('gzRestoreBtn')?.classList.add('visible');
}
function toggleGZExpanded(){
 const p=document.getElementById('gzFloatingPanel');if(!p)return;
 gzPanelExpanded=!gzPanelExpanded;gzPanelCollapsed=false;
 p.classList.toggle('gz-expanded',gzPanelExpanded);p.classList.remove('gz-collapsed');
 setTimeout(()=>gzChart?.resize?.(),210);
}
function toggleGZCollapsed(){
 const p=document.getElementById('gzFloatingPanel');if(!p)return;
 gzPanelCollapsed=!gzPanelCollapsed;p.classList.toggle('gz-collapsed',gzPanelCollapsed);
 if(gzPanelCollapsed){gzPanelExpanded=false;p.classList.remove('gz-expanded');}
 setTimeout(()=>gzChart?.resize?.(),210);
}
function setupGZPanelDrag(){
 const panel=document.getElementById('gzFloatingPanel'),head=document.getElementById('gzFloatingHeader'),viewport=document.getElementById('simulatorViewport');
 if(!panel||!head||!viewport)return;
 head.addEventListener('pointerdown',e=>{
  if(e.target.closest('button'))return;
  const pr=panel.getBoundingClientRect(),vr=viewport.getBoundingClientRect();
  gzDragState={dx:e.clientX-pr.left,dy:e.clientY-pr.top,vr};
  panel.style.right='auto';panel.style.bottom='auto';panel.style.left=(pr.left-vr.left)+'px';panel.style.top=(pr.top-vr.top)+'px';
  head.setPointerCapture?.(e.pointerId);
 });
 head.addEventListener('pointermove',e=>{
  if(!gzDragState)return;const {vr,dx,dy}=gzDragState;
  const maxX=Math.max(0,vr.width-panel.offsetWidth),maxY=Math.max(0,vr.height-panel.offsetHeight);
  panel.style.left=Math.max(0,Math.min(maxX,e.clientX-vr.left-dx))+'px';
  panel.style.top=Math.max(0,Math.min(maxY,e.clientY-vr.top-dy))+'px';
 });
 const stop=()=>{gzDragState=null};head.addEventListener('pointerup',stop);head.addEventListener('pointercancel',stop);
}

function cameraBaseAnchor(){
 if(!canvas)return {x:0,y:0};
 const dpr=window.devicePixelRatio||1,W=canvas.width/dpr,H=canvas.height/dpr;
 return {x:W/2,y:(state.viewMode==='starboard'||state.viewMode==='port')?H*.61:H*.58};
}
function updateCameraZoomUI(){
 const label=document.getElementById('cameraZoomLabel');
 if(label)label.textContent=`${Math.round(cameraZoom*100)}%`;
 const panBtn=document.getElementById('cameraPanBtn');
 if(panBtn)panBtn.classList.toggle('active',cameraPanMode);
 if(canvas){
  const side=state.viewMode==='starboard'||state.viewMode==='port';
  canvas.classList.toggle('pan-active',cameraPanMode||(side&&cameraZoom>1.001));
  if(!cameraPanMode&&!side)canvas.style.cursor='grab';
  else canvas.style.cursor='';
 }
}
function setCameraZoom(value,focusX=null,focusY=null){
 const old=cameraZoom;
 const next=Math.max(CAMERA_ZOOM_MIN,Math.min(CAMERA_ZOOM_MAX,Number(value)||1));
 if(Math.abs(next-old)<1e-9)return;
 if(canvas&&focusX!==null&&focusY!==null){
  const rect=canvas.getBoundingClientRect(),fx=focusX-rect.left,fy=focusY-rect.top;
  const base=cameraBaseAnchor(),ratio=next/old;
  cameraPanX=fx-base.x-ratio*(fx-base.x-cameraPanX);
  cameraPanY=fy-base.y-ratio*(fy-base.y-cameraPanY);
 }
 cameraZoom=next;
 updateCameraZoomUI();
 render();
}
function zoomCamera(delta){setCameraZoom(cameraZoom+delta);}
function fitCameraView(){
 cameraZoom=1;cameraPanX=0;cameraPanY=0;
 updateCameraZoomUI();render();
}
function toggleCameraPanMode(){
 cameraPanMode=!cameraPanMode;
 updateCameraZoomUI();
}
function panCamera(dx,dy){
 cameraPanX+=dx;cameraPanY+=dy;render();
}

function viewOrientationHTML(mode){
 if(mode==='stern')return '<span class="text-rose-300">← PORT</span><span class="text-slate-500 mx-2">STERN VIEW</span><span class="text-cyan-300">STARBOARD →</span>';
 if(mode==='starboard')return '<span class="text-slate-400">AFT ←</span><span class="text-cyan-300 mx-2">STARBOARD SIDE · BOW →</span>';
 if(mode==='port')return '<span class="text-rose-300">← BOW · PORT SIDE</span><span class="text-slate-400 ml-2">→ AFT</span>';
 return '<span class="text-cyan-300">← STARBOARD</span><span class="text-slate-500 mx-2">BOW VIEW</span><span class="text-rose-300">PORT →</span>';
}
function setViewMode(mode){
 if(!['bow','stern','starboard','port'].includes(mode))mode='bow';
 state.viewMode=mode;
 const label=document.getElementById('viewOrientationLabel');if(label)label.innerHTML=viewOrientationHTML(mode);
 document.querySelectorAll('.view-mode-btn').forEach(b=>{
  const active=b.dataset.viewMode===mode;
  b.classList.toggle('bg-cyan-500/15',active);b.classList.toggle('border-cyan-500/30',active);b.classList.toggle('text-cyan-300',active);
  b.classList.toggle('border-transparent',!active);b.classList.toggle('text-slate-400',!active);
 });
 cameraPanX=0;cameraPanY=0;
 updateCameraZoomUI();
 if(displayMode==='3d')window.AMCOL3D?.setCameraPreset?.(mode);
 render();
}
function transverseScreenSign(){return state.viewMode==='stern'?1:-1;}
function sideMirrorSign(){return state.viewMode==='port'?-1:1;}

function sideWaveHeadingFactor(){
 if(!state.waveEnabled)return 0;
 if(state.waveHeading==='head'||state.waveHeading==='following')return 1;
 if(state.waveHeading==='quartering')return .65;
 return .10;
}
function sideWaveElevationAt(x){
 if(!state.waveEnabled)return 0;
 const A=Math.max(0,state.waveHeight/2),k=2*Math.PI/Math.max(5,state.waveLength),omega=2*Math.PI/Math.max(.1,state.wavePeriod);
 const dir=state.waveHeading==='following'?-1:1;
 const hf=sideWaveHeadingFactor();
 return A*hf*Math.sin(k*x-dir*omega*dynTime);
}
function sideViewMotion(){
 const L=Math.max(1,state.length),hf=sideWaveHeadingFactor();
 const bowWave=sideWaveElevationAt(L/2),sternWave=sideWaveElevationAt(-L/2);
 const waveHeave=.55*(bowWave+sternWave)/2;
 const wavePitch=Math.atan2(.70*(sternWave-bowWave),L)*180/Math.PI;
 return {heave:waveHeave,pitchDeg:state.trimAngle+wavePitch,wavePitchDeg:wavePitch};
}
function sideToScreen(x,y,scaleX,scaleY,cx,waterY,motion){
 const mirror=sideMirrorSign(),pitch=motion.pitchDeg*Math.PI/180;
 const z=-state.eqDraft+y+motion.heave-x*Math.tan(pitch);
 return [cx+mirror*x*scaleX,waterY-z*scaleY];
}

function setupCanvas(){
 canvas=document.getElementById('shipCanvas');ctx=canvas?.getContext?.('2d');if(!canvas||!ctx)return;resizeCanvas();updateCameraZoomUI();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('hydroTableBackdrop')?.classList.contains('hidden'))closeHydrostaticTableModal();});
 window.addEventListener('resize',()=>{if(displayMode==='2d')schedule2DVisualPaint('window-resize');else try{window.AMCOL3D?.resize?.();}catch(e){}});
 if(window.ResizeObserver){
   simulatorResizeObserver=new ResizeObserver(()=>{if(displayMode==='2d')schedule2DVisualPaint('canvas-container-resize');else try{window.AMCOL3D?.resize?.();}catch(e){}});
   if(canvas.parentElement)simulatorResizeObserver.observe(canvas.parentElement);
 }
 canvas.addEventListener('wheel',e=>{e.preventDefault();const step=e.deltaY<0?.20:-.20;setCameraZoom(cameraZoom+step,e.clientX,e.clientY);},{passive:false});
 canvas.addEventListener('dblclick',()=>fitCameraView());
 canvas.addEventListener('pointerdown',e=>{lastPointerX=e.clientX;lastPointerY=e.clientY;const side=state.viewMode==='starboard'||state.viewMode==='port';const wantsPan=cameraPanMode||e.button===1||(side&&cameraZoom>1.001);if(wantsPan){cameraPanning=true;dragging=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';return;}if(state.viewMode!=='bow'&&state.viewMode!=='stern')return;dragging=true;cameraPanning=false;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{const dx=e.clientX-lastPointerX,dy=e.clientY-lastPointerY;lastPointerX=e.clientX;lastPointerY=e.clientY;if(cameraPanning){panCamera(dx,dy);return;}if(!dragging)return;setHeel(state.heel+dx*.25);});
 const endPointer=()=>{dragging=false;cameraPanning=false;updateCameraZoomUI();};canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('pointerleave',()=>{if(!dragging&&!cameraPanning)updateCameraZoomUI();});
}
function resizeCanvas(){
 if(!canvas||!ctx||!canvas.parentElement)return false;const p=canvas.parentElement,r=p.getBoundingClientRect?.(),w=Math.round(p.clientWidth||r?.width||0),h=Math.round(p.clientHeight||r?.height||0);if(w<4||h<4)return false;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);return true;
}
function worldToScreen(x,y,scale,cx,wy){return[cx+transverseScreenSign()*x*scale,wy-y*scale]}
function renderTransverseView(){if(!ctx||!state.hydro||state.hydro.invalid)return;const dpr=window.devicePixelRatio||1,W=canvas.width/dpr,H=canvas.height/dpr;ctx.clearRect(0,0,W,H);const h=state.hydro;const baseScale=Math.min(W/(state.beam*2.1),H/(state.depth*2.7)),scale=baseScale*cameraZoom,cx=W/2+cameraPanX,waterY=H*.58+cameraPanY;
 const waveAmp=state.waveEnabled?Math.max(4,Math.min(22,state.waveHeight*scale*.18)):2.5;const waveLenPx=state.waveEnabled?Math.max(90,state.waveLength*scale*.5):180;const waveOmega=2*Math.PI/Math.max(.1,state.wavePeriod);const waveDir=state.waveHeading==='head'?-1:1;const waveY=(x,offset=0)=>waterY + waveAmp*Math.sin((x/waveLenPx)*2*Math.PI-waveDir*waveOmega*dynTime+offset) + waveAmp*.32*Math.sin((x/(waveLenPx*.52))*2*Math.PI-waveDir*waveOmega*dynTime*1.35+offset*1.7);
 const drySunny=(+state.rainIntensity||0)<=.015;
 let sky=ctx.createLinearGradient(0,0,0,waterY);sky.addColorStop(0,drySunny?'#48aee8':'#020617');sky.addColorStop(.55,drySunny?'#8ed5f6':'#0f172a');sky.addColorStop(1,drySunny?'#d8f4ff':'#102a43');ctx.fillStyle=sky;ctx.fillRect(0,0,W,waterY+8);
 if(drySunny){ctx.save();ctx.fillStyle='rgba(255,234,143,.96)';ctx.shadowColor='rgba(255,222,120,.55)';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(W*.16,H*.13,Math.max(15,Math.min(27,W*.028)),0,Math.PI*2);ctx.fill();ctx.restore();}
 const weatherShade=Math.min(.46,state.rainIntensity*.38);
 if(weatherShade>0){ctx.fillStyle=`rgba(15,23,42,${weatherShade})`;ctx.fillRect(0,0,W,waterY+8);}
 ctx.fillStyle='rgba(255,255,255,.06)';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(W*(.2+i*.28),waterY*.18+i*6,65+i*12,14+i*3,0,0,Math.PI*2);ctx.fill();}
 ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,waveY(0));for(let x=0;x<=W;x+=8)ctx.lineTo(x,waveY(x));ctx.lineTo(W,H);ctx.closePath();let sea=ctx.createLinearGradient(0,waterY,0,H);sea.addColorStop(0,drySunny?'#38bdf8':'#0ea5e9');sea.addColorStop(.35,drySunny?'#0e7490':'#0b5f88');sea.addColorStop(1,'#082f49');ctx.fillStyle=sea;ctx.fill();
 ctx.strokeStyle='rgba(186,230,253,.85)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,waveY(0));for(let x=0;x<=W;x+=8)ctx.lineTo(x,waveY(x));ctx.stroke();ctx.strokeStyle='rgba(125,211,252,.35)';ctx.lineWidth=1;for(let j=1;j<=2;j++){ctx.beginPath();ctx.moveTo(0,waveY(0,j*.9)+j*12);for(let x=0;x<=W;x+=14)ctx.lineTo(x,waveY(x,j*.9)+j*12);ctx.stroke();}
 const seabed=waterY+state.waterDepth*scale;if(seabed<H){ctx.fillStyle='#292524';ctx.fillRect(0,seabed,W,H-seabed);ctx.strokeStyle='#92400e';ctx.beginPath();ctx.moveTo(0,seabed);ctx.lineTo(W,seabed);ctx.stroke();}
 const drawPoly=(poly,fill,stroke,w=2)=>{if(!poly.length)return;ctx.beginPath();poly.forEach((p,i)=>{const [sx,sy]=worldToScreen(p[0],p[1],scale,cx,waterY);i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy)});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.stroke()};
 const hullScreen=h.hull.map(p=>worldToScreen(p[0],p[1],scale,cx,waterY));ctx.save();ctx.beginPath();hullScreen.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const hullGrad=ctx.createLinearGradient(0,waterY-state.depth*scale,0,waterY+10);hullGrad.addColorStop(0,'#4c566a');hullGrad.addColorStop(.28,'#243447');hullGrad.addColorStop(.72,'#102235');hullGrad.addColorStop(1,'#0b1220');ctx.fillStyle=hullGrad;ctx.fill();ctx.clip();const antiTop=worldToScreen(0,state.depth*.28,scale,cx,waterY)[1];const antiBot=worldToScreen(0,-.2,scale,cx,waterY)[1];const antiGrad=ctx.createLinearGradient(0,antiTop,0,antiBot);antiGrad.addColorStop(0,'rgba(185,28,28,.88)');antiGrad.addColorStop(1,'rgba(127,29,29,.96)');ctx.fillStyle=antiGrad;ctx.fillRect(0,antiTop,W,antiBot-antiTop+4);ctx.fillStyle='rgba(255,255,255,.05)';for(let i=0;i<8;i++)ctx.fillRect(cx-state.beam*scale*.55+i*14,waterY-state.depth*scale,6,state.depth*scale*1.2);ctx.restore();drawPoly(h.hull,null,'#dbeafe',2.4);drawPoly(h.sub,'rgba(16,185,129,.12)','rgba(16,185,129,.45)',1);
 if(state.damage&&state.damageMode==='lost'&&h.damagedSub.length)drawPoly(h.damagedSub,'rgba(244,63,94,.25)','#fb7185',1.5);
 const phi=h.phi,sink=h.sink;drawShipOutfit(phi,sink,scale,cx,waterY);
 const stbdEdge=worldToScreen(...bodyToWorld(state.beam*.48,state.depth+.15,phi,sink),scale,cx,waterY);
 const portEdge=worldToScreen(...bodyToWorld(-state.beam*.48,state.depth+.15,phi,sink),scale,cx,waterY);
 ctx.font='bold 9px sans-serif';ctx.textAlign='center';
 ctx.fillStyle='#67e8f9';ctx.fillText('STBD',stbdEdge[0],stbdEdge[1]-5);
 ctx.fillStyle='#fda4af';ctx.fillText('PORT',portEdge[0],portEdge[1]-5);
 const drawBodyBox=(x,y,w,hh,color,label)=>{const pts=[[x-w/2,y-hh/2],[x+w/2,y-hh/2],[x+w/2,y+hh/2],[x-w/2,y+hh/2]].map(p=>bodyToWorld(p[0],p[1],phi,sink));drawPoly(pts,color,'#f8fafc',Math.min(2,1+.18*cameraZoom));const [sx,sy]=worldToScreen(...bodyToWorld(x,y,phi,sink),scale,cx,waterY);ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(Math.min(14,9+cameraZoom))}px monospace`;ctx.textAlign='center';ctx.fillText(label,sx,sy+3)};
 cargoItems.forEach(it=>drawBodyBox(it.tcg,it.vcg,2.3,1.3,it.tcg>0?'#06b6d4':it.tcg<0?'#f43f5e':'#2563eb',`${it.mass}t`));
 if(state.crane){const base=bodyToWorld(0,state.depth+1.0,phi,sink),hook=bodyToWorld(state.craneSide*state.craneOutreach,state.craneHeight,phi,sink);const [bx,by]=worldToScreen(...base,scale,cx,waterY),[hx,hy]=worldToScreen(...hook,scale,cx,waterY);ctx.strokeStyle='#c084fc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(hx,hy);ctx.stroke();ctx.fillStyle='#c084fc';ctx.beginPath();ctx.arc(hx,hy,5,0,Math.PI*2);ctx.fill();}
 if(state.damage&&state.damageMode==='added'){drawBodyBox(state.dmgTCG,state.dmgVCG,2,1.4,'#e11d48','FLOOD')}
 const indicatorScale=Math.min(1.75,.90+.28*cameraZoom);
 const point=(x,y,color,label,ox=8,oy=-7)=>{const [sx,sy]=worldToScreen(x,y,scale,cx,waterY);ctx.fillStyle=color;ctx.beginPath();ctx.arc(sx,sy,5*indicatorScale,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5*indicatorScale;ctx.stroke();ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(11*indicatorScale)}px sans-serif`;ctx.textAlign=ox<0?'right':'left';ctx.fillText(label,sx+ox*indicatorScale,sy+oy*indicatorScale)};
 const K=bodyToWorld(0,0,phi,sink),Gpt=bodyToWorld(state.tcg,state.kgCorr,phi,sink);point(...K,'#94a3b8','K',-8,12);point(h.bx,h.by,'#22c55e','B',8,10);point(...Gpt,'#ef4444','G',8,-8);
 if(showVectors){const [gx,gy]=worldToScreen(...Gpt,scale,cx,waterY),[bx,by]=worldToScreen(h.bx,h.by,scale,cx,waterY),vec=Math.min(1.8,Math.sqrt(cameraZoom));ctx.setLineDash([5*vec,4*vec]);ctx.lineWidth=1.4*vec;ctx.strokeStyle='#ef4444';ctx.beginPath();ctx.moveTo(gx,gy-70*vec);ctx.lineTo(gx,gy+90*vec);ctx.stroke();ctx.strokeStyle='#22c55e';ctx.beginPath();ctx.moveTo(bx,by+80*vec);ctx.lineTo(bx,by-100*vec);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#f59e0b';ctx.lineWidth=2*vec;ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(bx,gy);ctx.stroke();ctx.fillStyle='#fbbf24';ctx.font=`bold ${Math.round(10*indicatorScale)}px sans-serif`;ctx.textAlign='center';ctx.fillText(`GZ ${restoringGZAt(state.heel).toFixed(3)} m ${stabilitySenseAt(state.heel)}`,(gx+bx)/2,gy-7*indicatorScale)}
 if(state.waveEnabled){ctx.fillStyle='rgba(186,230,253,.9)';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(`waves: H ${state.waveHeight.toFixed(1)} m · λ ${state.waveLength.toFixed(0)} m · ${state.waveHeading}`,12,16)}
 if(state.windEnabled&&Math.abs(directionFactor(state.windDirection))>0){
  const physicalDir=Math.sign(directionFactor(state.windDirection)),dir=physicalDir*transverseScreenSign(),y=48,x1=dir>0?W*.28:W*.72,x2=dir>0?W*.72:W*.28;
  ctx.strokeStyle='rgba(103,232,249,.90)';ctx.fillStyle='rgba(103,232,249,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y);ctx.lineTo(x2+(dir>0?10:-10),y-6);ctx.lineTo(x2+(dir>0?10:-10),y+6);ctx.closePath();ctx.fill();
  ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(`WIND ${state.windSpeedKts.toFixed(0)} kn`,W/2,y-8);
 }
 if(state.currentEnabled&&Math.abs(directionFactor(state.currentDirection))>0){
  const physicalDir=Math.sign(directionFactor(state.currentDirection)),dir=physicalDir*transverseScreenSign(),y=Math.min(H-38,waterY+45),x1=dir>0?W*.28:W*.72,x2=dir>0?W*.72:W*.28;
  ctx.strokeStyle='rgba(96,165,250,.90)';ctx.fillStyle='rgba(96,165,250,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y);ctx.lineTo(x2+(dir>0?10:-10),y-6);ctx.lineTo(x2+(dir>0?10:-10),y+6);ctx.closePath();ctx.fill();
  ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(`CURRENT ${state.currentSpeedKts.toFixed(1)} kn`,W/2,y-8);
 }
 if(state.rainIntensity>0){
  const count=Math.floor(20+state.rainIntensity*95);ctx.strokeStyle=`rgba(186,230,253,${.18+.45*state.rainIntensity})`;ctx.lineWidth=1;
  for(let i=0;i<count;i++){const rx=((i*73+Math.floor(dynTime*180))%Math.max(1,W)),ry=((i*41+Math.floor(dynTime*260))%Math.max(1,waterY));ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-5-state.rainIntensity*5,ry+10+state.rainIntensity*7);ctx.stroke();}
 }
 ctx.fillStyle='#94a3b8';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(`${state.viewMode==='stern'?'STERN':'BOW'} POV · ρ ${state.density.toFixed(3)} t/m³ · mean draft ${state.eqDraft.toFixed(2)} m · UKC ${state.ukc.toFixed(2)} m · visibility ${state.visibilityNm.toFixed(1)} nm`,12,H-12);
}
function toggleVectors(){showVectors=!showVectors}
function mainInternalSideBox(item={},kind='cargo'){
 const L=Math.max(20,+state.length||80),D=Math.max(3,+state.depth||10),lcg=Math.max(-L*.47,Math.min(L*.47,+item.lcg||0));
 const xn=Math.max(-1,Math.min(1,lcg/(L*.5))),env=mainHullStationEnvelopeAt(xn,state.hullType);
 const keel=Math.max(0,D*(env?.keelRiseRatio||0)),deck=D+D*(env?.sheerRatio||0);
 let length=Math.max(L*.018,Math.min(L*(kind==='ballast'?.18:.72),+item.length||L*(kind==='ballast'?.07:.10)));
 let height=Math.max(D*.045,Math.min(D*.82,+item.height||D*(kind==='ballast'?.18:.35)));
 let bottom=Math.max(keel+D*.01,+item.bottom||0);
 if(kind==='ballast'){
   const k=`${item.type||''} ${item.name||''}`.toLowerCase();
   if(k.includes('double bottom')||/\bdb\b/.test(k)){height=Math.min(height,D*.16);bottom=keel+D*.025;}
   else if(k.includes('hopper')){height=Math.min(height,D*.26);bottom=keel+D*.18;}
   else if(k.includes('topside')||k.includes('top side')){height=Math.min(height,D*.20);bottom=Math.max(keel+D*.58,deck-height-D*.04);}
   else if(k.includes('wing')||k.includes('wbt')||k.includes('sbt')){height=Math.min(height,D*.36);bottom=Math.max(bottom,keel+D*.12);}
   else if(k.includes('peak')){height=Math.min(height,D*.34);bottom=keel+D*.04;}
 }
 const maxH=Math.max(D*.04,deck-bottom-D*.015);height=Math.min(height,maxH);
 bottom=Math.max(keel,Math.min(deck-height,bottom));
 return {x:lcg,y:bottom,w:length,h:Math.max(D*.025,height),keel,deck};
}
function drawSideInternalArrangement(scaleX,scaleY,cx,waterY,motion,rectSide,lineSide){
 if(!showInternalArrangement)return;
 const tanks=visualBallastTanks(),er=engineRoomArrangement(),cargoSpaces=cargoSpacesWithFill();
 const filledColor=(color,alpha=.62)=>{
   if(/^#/.test(String(color))){const hex=String(color).slice(1),n=parseInt(hex.length===3?hex.split('').map(c=>c+c).join(''):hex,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;}
   return color;
 };
 const drawFilledSpace=(x,y,w,h,raw,color,stroke)=>{
   const pct=Math.max(0,Math.min(100,Number(raw)||0));
   rectSide(x,y,w,h,filledColor(color,.16),stroke);
   if(pct>0){const fh=Math.max(.02,h*(pct/100));rectSide(x,y,Math.max(.04,w*.94),fh,filledColor(color,.66),stroke);}
 };
 ctx.save();
 const seenCargo=new Set();
 cargoSpaces.forEach(sp=>{
   const key=`${Math.round((+sp.lcg||0)*10)}|${sp.type}|${Math.round((+sp.bottom||0)*10)}`;
   if((sp.side==='port'||sp.side==='starboard')&&seenCargo.has(key))return;
   seenCargo.add(key);
   const box=mainInternalSideBox(sp,'cargo'),pct=Number(sp.fillRawPercent)||0,color=cargoSpaceColor(sp.type);
   drawFilledSpace(box.x,box.y,box.w,box.h,pct,color,'rgba(251,191,36,.82)');
   if(cameraZoom>.90){const p=sideToScreen(box.x,box.y+box.h*.50,scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#f8fafc';ctx.font='bold 6.6px monospace';ctx.textAlign='center';ctx.fillText(cargoSpaceShortName(sp.name),p[0],p[1]-2);ctx.fillStyle=pct>100.05?'#fda4af':'#67e8f9';ctx.fillText(fillPercentLabel(pct),p[0],p[1]+7);}
 });
 const seenTank=new Set();
 tanks.forEach(t=>{
   const key=`${Math.round((+t.lcg||0)*10)}|${t.type}`;
   if(t.side!=='centre'&&seenTank.has(key))return;
   seenTank.add(key);
   const box=mainInternalSideBox(t,'ballast'),pct=Math.max(0,Math.min(100,Number(t.fill)||0)),color=arrangementTankColor(t.type);
   drawFilledSpace(box.x,box.y,box.w,box.h,pct,color,'rgba(186,230,253,.92)');
   if(cameraZoom>.84){const p=sideToScreen(box.x,box.y+box.h*.50,scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#e0f2fe';ctx.font='bold 6.8px monospace';ctx.textAlign='center';ctx.fillText(arrangementShortName(t.name).replace(/ [PS]$/,''),p[0],p[1]-2);ctx.fillStyle='#67e8f9';ctx.fillText(fillPercentLabel(pct),p[0],p[1]+7);}
 });
 const mbox=mainInternalSideBox(er,'machinery');
 rectSide(mbox.x,mbox.y,mbox.w,mbox.h,'rgba(251,146,60,.70)','rgba(253,186,116,.95)');
 const ep=sideToScreen(mbox.x,mbox.y+mbox.h*.52,scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#fed7aa';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText(er.label.toUpperCase(),ep[0],ep[1]+2);
 ctx.restore();
}

function rollModeTitle(){return state.rollMode==='forced'?'Forced / Synchronous Roll':state.rollMode==='parametric'?'Simplified Parametric Roll':'Free Roll';}
function updateDynamicsButton(){const b=document.getElementById('runDynamicsBtn');if(!b)return;b.innerHTML=dynamicsRunning?'<i class="fa-solid fa-stop mr-1"></i>Stop dynamics':`<i class="fa-solid fa-play mr-1"></i>Start ${rollModeTitle()}`;}
function toggleDynamics(){
 dynamicsRunning=!dynamicsRunning;updateDynamicsButton();
 if(dynamicsRunning){
   dynPhi=state.heel*Math.PI/180;
   if(state.rollMode==='parametric'&&Math.abs(dynPhi)<.002)dynPhi=.5*Math.PI/180; // small seed disturbance for the teaching oscillator
   dynOmega=0;dynTime=0;lastFrameTime=null;
 }
}
function resetRollPhysics(){
 stabilityTestRuntime.active=false;setTestingUI(false);dynamicsRunning=false;dynPhi=0;dynOmega=0;dynTime=0;lastFrameTime=null;state.heel=0;updateDynamicsButton();setControlValues();calculateAll({curve:false});updateWaveReadout();render();
}
function dynamicsStep(dt){
 if(!dynamicsRunning)return;
 const m=state.dispMass*1000,k=Math.max(.1,state.krRatio*state.beam),I=m*k*k;const angle=dynPhi*180/Math.PI;const h=hydroAtAngle(angle),gzRestore=operationalGZAt(angle);if(h.invalid&&!Number.isFinite(gzRestore)){dynamicsRunning=false;updateDynamicsButton();return;}
 const omegaRef=Math.sqrt(G*Math.max(Math.abs(state.gm),0.05))/k,c=2*state.damping*I*omegaRef;const nonlinearDamping=(state.physicsFidelity==='teaching'?0:Math.max(0,Number(state.quadraticDamping)||0)*I*Math.abs(dynOmega)*dynOmega);
 const Te=calculateEncounterPeriod(),forcingPeriod=Number.isFinite(Te)?Math.max(.1,Te):Math.max(.1,state.wavePeriod);
 let restoringFactor=1;
 if(state.rollMode==='parametric'&&state.waveEnabled){restoringFactor=Math.max(.15,Math.min(1.85,1+state.parametricVariation*Math.cos(2*Math.PI*dynTime/forcingPeriod)));}
 const restoring=m*G*(Number.isFinite(gzRestore)?gzRestore:h.gz)*restoringFactor;
 const forcedMode=state.rollMode==='forced';
 const manualForcing=forcedMode?state.waveMoment*1000*Math.sin(2*Math.PI*dynTime/forcingPeriod):0;
 const autoForcing=forcedMode&&state.waveEnabled?estimatedWaveMomentAmplitude()*Math.sin(2*Math.PI*dynTime/forcingPeriod):0;
 const environmentalForcing=environmentalHeelingMomentN(angle),forcing=manualForcing+autoForcing+environmentalForcing;
 // Adaptive semi-implicit integration: retain the stable symplectic update, but subdivide long frames
 // so high-GM/stiff conditions cannot acquire artificial energy from a browser frame-rate spike.
 const maxStep=Math.max(.004,Math.min(.02,(state.naturalPeriod||4)/180)),sub=Math.max(1,Math.min(10,Math.ceil(dt/maxStep))),hdt=dt/sub;
 for(let si=0;si<sub;si++){
  const aDeg=dynPhi*180/Math.PI,gzNow=operationalGZAt(aDeg),envNow=environmentalHeelingMomentN(aDeg),tNow=dynTime;
  let rf=1;if(state.rollMode==='parametric'&&state.waveEnabled)rf=Math.max(.15,Math.min(1.85,1+state.parametricVariation*Math.cos(2*Math.PI*tNow/forcingPeriod)));
  const rest=m*G*(Number.isFinite(gzNow)?gzNow:0)*rf,manual=forcedMode?state.waveMoment*1000*Math.sin(2*Math.PI*tNow/forcingPeriod):0,auto=forcedMode&&state.waveEnabled?estimatedWaveMomentAmplitude()*Math.sin(2*Math.PI*tNow/forcingPeriod):0,qd=(state.physicsFidelity==='teaching'?0:Math.max(0,Number(state.quadraticDamping)||0)*I*Math.abs(dynOmega)*dynOmega),acc=(-rest-c*dynOmega-qd+manual+auto+envNow)/I;
  dynOmega+=acc*hdt;dynPhi+=dynOmega*hdt;dynTime+=hdt;
 }
 if(Math.abs(dynPhi)>85*Math.PI/180){dynPhi=Math.sign(dynPhi)*85*Math.PI/180;dynOmega=0;dynamicsRunning=false;updateDynamicsButton();}
 state.heel=dynPhi*180/Math.PI;const liveHydro=hydroAtAngle(state.heel);if(!liveHydro.invalid)state.hydro=liveHydro;state.operationalGZ=operationalGZAt(state.heel);state.operationalRM=state.dispMass*G*state.operationalGZ;updateUI();
}

function renderSideView(){
 if(!ctx||!state.hydro||state.hydro.invalid)return;
 const dpr=window.devicePixelRatio||1,W=canvas.width/dpr,H=canvas.height/dpr;
 ctx.clearRect(0,0,W,H);
 const L=state.length,D=state.depth,motion=sideViewMotion(),waterY=H*.61+cameraPanY;
 const baseScaleX=Math.min((W*.88)/Math.max(10,L),(H*.68)/Math.max(4,D)*.72);
 const baseScaleY=Math.min((H*.62)/Math.max(4,D+Math.max(4,D*.45)),baseScaleX*2.2);
 const scaleX=baseScaleX*cameraZoom,scaleY=baseScaleY*cameraZoom;
 const cx=W/2+cameraPanX,mirror=sideMirrorSign();

 // Sky
 const drySunny=(+state.rainIntensity||0)<=.015;
 let sky=ctx.createLinearGradient(0,0,0,waterY);sky.addColorStop(0,drySunny?'#48aee8':'#020617');sky.addColorStop(.55,drySunny?'#8ed5f6':'#0f172a');sky.addColorStop(1,drySunny?'#d8f4ff':'#12304a');ctx.fillStyle=sky;ctx.fillRect(0,0,W,waterY+5);
 if(drySunny){ctx.save();ctx.fillStyle='rgba(255,234,143,.96)';ctx.shadowColor='rgba(255,222,120,.55)';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(W*.15,H*.12,Math.max(15,Math.min(27,W*.028)),0,Math.PI*2);ctx.fill();ctx.restore();}
 const shade=Math.min(.46,state.rainIntensity*.38);if(shade){ctx.fillStyle=`rgba(15,23,42,${shade})`;ctx.fillRect(0,0,W,waterY+5);}
 ctx.fillStyle='rgba(255,255,255,.055)';for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(W*(.12+i*.25),H*.12+i*4,70+i*10,14+i*2,0,0,Math.PI*2);ctx.fill();}

 // Longitudinal wave field.
 const screenWaveY=(sx)=>{
  const x=((sx-cx)/(mirror*scaleX||1));
  return waterY-sideWaveElevationAt(x)*scaleY;
 };
 ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,screenWaveY(0));for(let sx=0;sx<=W;sx+=6)ctx.lineTo(sx,screenWaveY(sx));ctx.lineTo(W,H);ctx.closePath();
 let sea=ctx.createLinearGradient(0,waterY,0,H);sea.addColorStop(0,drySunny?'#38bdf8':'#0ea5e9');sea.addColorStop(.32,drySunny?'#0e7490':'#075985');sea.addColorStop(1,'#082f49');ctx.fillStyle=sea;ctx.fill();
 ctx.strokeStyle='rgba(186,230,253,.88)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,screenWaveY(0));for(let sx=0;sx<=W;sx+=6)ctx.lineTo(sx,screenWaveY(sx));ctx.stroke();

 const seabed=waterY+state.waterDepth*scaleY;if(seabed<H){ctx.fillStyle='#292524';ctx.fillRect(0,seabed,W,H-seabed);ctx.strokeStyle='#92400e';ctx.beginPath();ctx.moveTo(0,seabed);ctx.lineTo(W,seabed);ctx.stroke();}

 const pathSide=(pts,fill,stroke='#dbeafe',lw=2)=>{
  if(!pts.length)return;ctx.beginPath();pts.forEach((p,i)=>{const [sx,sy]=sideToScreen(p[0],p[1],scaleX,scaleY,cx,waterY,motion);i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy)});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();
 };
 const lineSide=(a,b,stroke='#cbd5e1',lw=1)=>{
  const p1=sideToScreen(a[0],a[1],scaleX,scaleY,cx,waterY,motion),p2=sideToScreen(b[0],b[1],scaleX,scaleY,cx,waterY,motion);ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(...p1);ctx.lineTo(...p2);ctx.stroke();
 };
 const rectSide=(x,y,w,h,fill,stroke='#f8fafc')=>pathSide([[x-w/2,y],[x+w/2,y],[x+w/2,y+h],[x-w/2,y+h]],fill,stroke,1);
 const drawLifeboatSide=(x,y,w=L*.05,h=D*.075,color='#f97316')=>{pathSide([[x-w*.42,y+h*.10],[x+w*.18,y+h*.10],[x+w*.34,y+h*.48],[x-w*.36,y+h*.48]],color,'#fff',1);lineSide([x-w*.22,y+h*.22],[x+w*.10,y+h*.22],'rgba(255,255,255,.55)',1);};
 const drawAnchorSide=(x,y)=>{const [sx,sy]=sideToScreen(x,y,scaleX,scaleY,cx,waterY,motion);ctx.save();ctx.translate(sx,sy);ctx.strokeStyle='#94a3b8';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,Math.max(4,B*.018*scaleX),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-D*.07*scaleY);ctx.lineTo(0,D*.08*scaleY);ctx.moveTo(0,D*.03*scaleY);ctx.lineTo(-B*.03*scaleX,D*.10*scaleY);ctx.moveTo(0,D*.03*scaleY);ctx.lineTo(B*.03*scaleX,D*.10*scaleY);ctx.stroke();ctx.restore();};
 const drawPropellerSide=(x,y,count=1)=>{for(let i=0;i<count;i++){const yy=y+(i-(count-1)/2)*D*.07;const [sx,sy]=sideToScreen(x,yy,scaleX,scaleY,cx,waterY,motion);ctx.save();ctx.translate(sx,sy);ctx.rotate(dynTime*(1.8+i*.25));ctx.strokeStyle='#fbbf24';ctx.fillStyle='rgba(251,191,36,.24)';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,Math.max(5,D*.045*scaleY),0,Math.PI*2);ctx.fill();ctx.stroke();for(let b=0;b<3;b++){ctx.rotate((Math.PI*2)/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(D*.055*scaleY,0);ctx.lineTo(D*.02*scaleY,D*.02*scaleY);ctx.closePath();ctx.fill();ctx.stroke();}ctx.restore();}};
 const drawRudderSide=(x,y,w=L*.010,h=D*.24)=>rectSide(x,y,w,h,'#cbd5e1','#f8fafc');

 // Longitudinal hull silhouette, physical x positive forward.
 const hull=[
  [-L*.50,D*.28],[-L*.49,D*.10],[-L*.43,D*.025],[L*.34,0],
  [L*.45,D*.06],[L*.50,D*.32],[L*.47,D*.72],[L*.39,D],
  [-L*.46,D]
 ];
 pathSide(hull,'#172b3d','#e2e8f0',2.2);
 // Anti-fouling lower hull.
 const anti=[
  [-L*.49,D*.10],[-L*.43,D*.025],[L*.34,0],[L*.45,D*.06],[L*.49,D*.25],
  [L*.41,D*.34],[-L*.48,D*.34]
 ];
 pathSide(anti,'rgba(153,27,27,.90)','rgba(248,113,113,.55)',1);

 // Deck line.
 lineSide([-L*.46,D],[L*.39,D],'rgba(255,255,255,.65)',1.2);

 // User-supplied schematic concept: internal ballast arrangement and aft machinery space.
 drawSideInternalArrangement(scaleX,scaleY,cx,waterY,motion,rectSide,lineSide);

 // Type-specific longitudinal outfit.
 if(state.hullType==='container'){
  for(let row=0;row<4;row++){for(let i=0;i<10;i++){const x=-L*.29+i*L*.062,y=D+.15+row*D*.055;rectSide(x,y,L*.052,D*.045,['#1d4ed8','#475569','#0f766e','#7c3aed','#b45309'][i%5],'rgba(255,255,255,.3)');}}
  rectSide(-L*.39,D,L*.12,D*.22,'#e5e7eb','#fff');rectSide(-L*.40,D+D*.22,L*.09,D*.10,'#cbd5e1','#fff');
 }else if(state.hullType==='bulk'){
  for(let i=0;i<5;i++){const x=-L*.20+i*L*.105;rectSide(x,D+.04,L*.085,D*.035,'#64748b','#cbd5e1');}
  rectSide(-L*.40,D,L*.11,D*.23,'#e5e7eb','#fff');
  for(let i=0;i<3;i++){const x=-L*.12+i*L*.17;lineSide([x,D],[x,D+D*.18],'#94a3b8',2);lineSide([x,D+D*.18],[x+L*.06,D+D*.10],'#94a3b8',1.4);}
 }else if(state.hullType==='roro'||state.hullType==='ferry'){
  rectSide(-L*.06,D,L*.72,D*.16,'#dbeafe','#fff');rectSide(-L*.10,D+D*.16,L*.60,D*.13,'#eff6ff','#fff');rectSide(-L*.16,D+D*.29,L*.34,D*.10,'#f8fafc','#fff');
 }else if(state.hullType==='tanker'||state.hullType==='chemical'){
  lineSide([-L*.32,D+D*.035],[L*.30,D+D*.035],'#fb923c',2);lineSide([-L*.32,D+D*.075],[L*.30,D+D*.075],'#f59e0b',1);
  rectSide(-L*.40,D,L*.12,D*.22,'#e5e7eb','#fff');
  for(let i=0;i<7;i++){const x=-L*.25+i*L*.085;rectSide(x,D+.02,L*.016,D*.045,'#94a3b8','#cbd5e1');}
 }else if(state.hullType==='lng'){
  for(let i=0;i<4;i++){const x=-L*.18+i*L*.12;const c=sideToScreen(x,D+D*.09,scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#dbeafe';ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(c[0],c[1],L*.045*scaleX,D*.11*scaleY,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  rectSide(-L*.40,D,L*.10,D*.21,'#f8fafc','#fff');
 }else if(state.hullType==='osv'){
  rectSide(L*.27,D,L*.18,D*.25,'#eff6ff','#fff');rectSide(L*.30,D+D*.25,L*.12,D*.11,'#dbeafe','#fff');
  lineSide([-L*.40,D+D*.03],[L*.12,D+D*.03],'#f59e0b',2);
 }else if(state.hullType==='box'){
  pathSide([[-L*.49,0],[L*.49,0],[L*.49,D],[-L*.49,D]],'#1f2937','#e2e8f0',2);
  rectSide(-L*.32,D,L*.12,D*.20,'#e5e7eb','#fff');
 }else{
  rectSide(-L*.38,D,L*.12,D*.22,'#e5e7eb','#fff');for(let i=0;i<4;i++){rectSide(-L*.12+i*L*.12,D+.03,L*.08,D*.05,'#64748b','#cbd5e1');}
 }

 // External fittings: anchors, lifeboats, propeller(s) and rudder.
 const propCount=(state.hullType==='roro'||state.hullType==='ferry'||state.hullType==='osv')?2:(state.hullType==='box'?0:1);
 const lifeXs=state.hullType==='roro'||state.hullType==='ferry'?[-L*.18,0,L*.18]:state.hullType==='osv'?[L*.27]:(state.hullType==='box'?[]:[-L*.38]);
 const lifeY=state.hullType==='roro'||state.hullType==='ferry'?D*1.58:state.hullType==='osv'?D*1.60:D*1.42;
 lifeXs.forEach(x=>drawLifeboatSide(x,lifeY,L*.05,D*.075));
 drawAnchorSide(L*.445,D*.55);
 if(propCount>0){drawRudderSide(-L*.486,D*.12,L*.010,D*.26);drawPropellerSide(-L*.505,D*.13,propCount);}

 // Cargo positions: actual LCG and VCG.
 cargoItems.forEach((it,i)=>{
  const x=Math.max(-L*.47,Math.min(L*.47,Number(it.lcg)||0)),y=Math.max(.2,Number(it.vcg)||0);
  rectSide(x,y,Math.max(3,L*.035),Math.max(.5,D*.07),it.tcg>0?'#06b6d4':it.tcg<0?'#f43f5e':'#2563eb','#f8fafc');
  const p=sideToScreen(x,y+D*.035,scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(Math.min(14,8+cameraZoom*1.2))}px monospace`;ctx.textAlign='center';ctx.fillText(`${it.mass}t`,p[0],p[1]+3);
 });

 // Crane and hook at crane LCG.
 if(state.crane){
  const x=Math.max(-L*.45,Math.min(L*.45,state.craneLCG||0)),base=[x,D],boom=[x+L*.055,D+D*.23],hook=[x+L*.055,Math.max(D*.45,state.craneHeight)];
  lineSide(base,boom,'#c084fc',3);lineSide(boom,hook,'#c084fc',1.5);const hp=sideToScreen(hook[0],hook[1],scaleX,scaleY,cx,waterY,motion);ctx.fillStyle='#c084fc';ctx.beginPath();ctx.arc(hp[0],hp[1],5,0,Math.PI*2);ctx.fill();
 }

 // Added-weight damage cue at midships.
 if(state.damage){rectSide(0,Math.max(.2,state.dmgVCG||1),L*.035,D*.10,'rgba(225,29,72,.75)','#fb7185');}

 // Bow/stern and draft markers.
 ctx.font=`bold ${Math.round(Math.min(15,9+cameraZoom))}px sans-serif`;ctx.textAlign='center';
 const bow=sideToScreen(L*.48,D+D*.04,scaleX,scaleY,cx,waterY,motion),stern=sideToScreen(-L*.48,D+D*.04,scaleX,scaleY,cx,waterY,motion);
 ctx.fillStyle='#fbbf24';ctx.fillText('BOW',bow[0],bow[1]-5);ctx.fillStyle='#94a3b8';ctx.fillText('STERN',stern[0],stern[1]-5);

 // End-draft vertical gauges based on static trim model.
 const drawDraftGauge=(x,draft,label)=>{
  const keel=sideToScreen(x,0,scaleX,scaleY,cx,waterY,{heave:0,pitchDeg:state.trimAngle}),wl=sideToScreen(x,draft,scaleX,scaleY,cx,waterY,{heave:0,pitchDeg:state.trimAngle});
  ctx.strokeStyle='rgba(251,191,36,.75)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(keel[0],keel[1]);ctx.lineTo(wl[0],wl[1]);ctx.stroke();ctx.fillStyle='#fbbf24';ctx.font='8px monospace';ctx.fillText(`${label} ${draft.toFixed(2)}m`,wl[0],wl[1]-5);
 };
 drawDraftGauge(L*.46,state.draftBow,'F');drawDraftGauge(-L*.46,state.draftStern,'A');

 // Roll inset: side profile cannot directly display roll.
 const rollX=W-55,rollY=70,r=28;ctx.strokeStyle='rgba(148,163,184,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(rollX,rollY,r,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(rollX,rollY);ctx.rotate(state.heel*Math.PI/180);ctx.strokeStyle='#f59e0b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(20,0);ctx.stroke();ctx.restore();ctx.fillStyle='#cbd5e1';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText(`ROLL ${state.heel.toFixed(1)}°`,rollX,rollY+r+12);

 // Wind/current annotation.
 ctx.font='bold 9px monospace';
 if(state.windEnabled){
  ctx.fillStyle='#67e8f9';ctx.textAlign='left';
  const longitudinal=['head','following'].includes(state.windDirection);
  ctx.fillText(longitudinal?`WIND ${state.windDirection.toUpperCase()} ${state.windSpeedKts.toFixed(0)} kn`:`CROSSWIND ${state.windSpeedKts.toFixed(0)} kn · ${state.windDirection.replaceAll('_','→').toUpperCase()}`,12,20);
 }
 if(state.currentEnabled){
  ctx.fillStyle='#60a5fa';ctx.textAlign='left';ctx.fillText(`CURRENT ${state.currentSpeedKts.toFixed(1)} kn · ${state.currentDirection.replaceAll('_','→').toUpperCase()}`,12,34);
 }

 // Rain/spray.
 if(state.rainIntensity>0){const count=Math.floor(20+state.rainIntensity*90);ctx.strokeStyle=`rgba(186,230,253,${.18+.45*state.rainIntensity})`;ctx.lineWidth=1;for(let i=0;i<count;i++){const rx=((i*73+Math.floor(dynTime*180))%Math.max(1,W)),ry=((i*41+Math.floor(dynTime*260))%Math.max(1,waterY));ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-6,ry+13);ctx.stroke();}}

 // Physics/status footer.
 ctx.fillStyle='rgba(2,6,23,.82)';ctx.fillRect(8,H-45,W-16,33);ctx.fillStyle='#cbd5e1';ctx.font='9px monospace';ctx.textAlign='left';
 ctx.fillText(`Static trim ${state.trimAngle>=0?'+':''}${state.trimAngle.toFixed(2)}° · wave pitch cue ${motion.wavePitchDeg>=0?'+':''}${motion.wavePitchDeg.toFixed(2)}° · heave cue ${motion.heave>=0?'+':''}${motion.heave.toFixed(2)} m`,16,H-29);
 ctx.fillStyle='#64748b';ctx.fillText(`LCG ${state.lcg>=0?'+':''}${state.lcg.toFixed(2)} m · LCF ${state.lcf>=0?'+':''}${state.lcf.toFixed(2)} m · MCT1cm ${state.mct1cm.toFixed(1)} t·m/cm · F/A drafts ${state.draftBow.toFixed(2)} / ${state.draftStern.toFixed(2)} m`,16,H-17);
}

function reportRenderError(err){
 const msg=String(err?.message||err||'Unknown render error');
 renderErrorCount++;
 if(msg!==lastRenderErrorMessage||renderErrorCount<=2){console.error('AMCOL render error:',err);lastRenderErrorMessage=msg;}
 const status=document.getElementById('threeDLoading');
 if(displayMode==='3d'&&status&&renderErrorCount===1){status.classList.remove('hidden');status.innerHTML='<div class="text-amber-300 text-xs font-bold">3D VIEW RECOVERING</div><div class="text-[9px] text-slate-400 mt-1">The stability physics is still running. Switch to 2D if this view does not recover.</div>';}
}
function render(){
 try{
  if(displayMode==='3d'){
   // Three.js owns its own requestAnimationFrame loop. Do not rebuild/synchronise the 3D scene here.
   return;
  }
  if(state.viewMode==='starboard'||state.viewMode==='port')renderSideView();
  else renderTransverseView();
  renderErrorCount=0;lastRenderErrorMessage='';
 }catch(err){reportRenderError(err);}
}
function ensureAnimationLoopRunning(){
 if(!animationLoopHeartbeat||performance.now()-animationLoopHeartbeat>500)requestAnimationFrame(animationLoop);
}
function animationLoop(ts){
 animationLoopHeartbeat=performance.now();
 // Queue the next frame before any rendering work so a view-layer exception can never stop the physics clock.
 requestAnimationFrame(animationLoop);
 try{
  if(lastFrameTime===null)lastFrameTime=ts;
  const dt=Math.min(.04,Math.max(0,(ts-lastFrameTime)/1000));lastFrameTime=ts;
  dynamicsStep(dt);
  if(stabilityTestRuntime.active&&performance.now()>=stabilityTestRuntime.endAt)finishAnimatedStabilityTest();
 }catch(err){console.error('AMCOL physics animation error:',err);dynamicsRunning=false;dynOmega=0;if(stabilityTestRuntime.active){stabilityTestRuntime.active=false;setTestingUI(false);showGlobalTestToast(false,'PHYSICS TEST INTERRUPTED','The stability animation encountered an internal calculation error. The vessel condition has been preserved.','Reload the vessel condition or switch to 2D and test again.');}}
 const visualDynamic=!!(dynamicsRunning||stabilityTestRuntime.active||state.waveEnabled||state.rainIntensity>0||state.currentEnabled||state.windEnabled);
 if(displayMode==='2d'&&(visualDynamic||!animationLoop._lastStaticPaint||ts-animationLoop._lastStaticPaint>=125)){render();animationLoop._lastStaticPaint=ts;}
}

function printReport(){const cr=evaluateIMO(),h=state.hydro,u=state.upright,w=window.open('','_blank','width=900,height=900');w.document.write(`<html><head><title>AMCOL Stability Teaching Report</title><style>body{font-family:Arial;padding:24px;color:#172033}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccd4df;padding:7px;font-size:12px}th{background:#eef2f7}.pass{color:green;font-weight:bold}.fail{color:#b91c1c;font-weight:bold}</style></head><body><h2>AMCOL Advanced Ship Stability Simulator</h2><p><b>Educational geometry-based stability report</b> — not an approved loading-computer certificate.</p><p><b>Vessel:</b> ${escapeHtml(state.vesselName||'Training vessel')} &nbsp; <b>Company:</b> ${escapeHtml(state.companyName||'—')} &nbsp; <b>Type:</b> ${escapeHtml(vesselPresets[state.hullType]?.label||state.hullType)}</p><p><small>${Object.values(referenceVesselPresets).find(r=>r.vesselName===state.vesselName)?.source?'Reference dimensions source: '+escapeHtml(Object.values(referenceVesselPresets).find(r=>r.vesselName===state.vesselName).source)+' · Published dimensions are reference data; model KG/lightship may still require approved vessel data.':''}</small></p><p><b>Principal dimensions:</b> L ${state.length.toFixed(1)} m · B ${state.beam.toFixed(1)} m · D ${state.depth.toFixed(1)} m</p>${state.sourceConditionKey==='great_fortune_workbook'?`<p><b>Workbook source condition:</b> ${escapeHtml(GREAT_FORTUNE_WORKBOOK_DATA.sourceFile)} · target Δ ${GREAT_FORTUNE_WORKBOOK_DATA.target.disp.toFixed(0)} t · target mean draft ${GREAT_FORTUNE_WORKBOOK_DATA.target.draft.toFixed(3)} m · target trim ${GREAT_FORTUNE_WORKBOOK_DATA.target.trimByStern.toFixed(3)} m by stern.</p>`:''}<p><b>Longitudinal teaching model:</b> LCG ${state.lcg.toFixed(2)} m · LCF ${state.lcf.toFixed(2)} m · GM<sub>L</sub> ${state.gmLong.toFixed(2)} m · MCT 1 cm ${state.mct1cm.toFixed(2)} t·m/cm · Trim ${state.trimMeters.toFixed(2)} m (${state.trimAngle.toFixed(2)}°) · Draft F/A ${state.draftBow.toFixed(2)} / ${state.draftStern.toFixed(2)} m</p><p><b>3D hydro distribution:</b> ${state.coupledMode==='source-anchored'?'SOURCE-ANCHORED':(state.coupledValid?'SOLVED':'CHECK')} · heel ${state.coupledHeel.toFixed(2)}° · trim ${state.coupledTrim.toFixed(2)}° · TCB/LCB ${state.coupledTCB.toFixed(2)} / ${state.coupledLCB.toFixed(2)} m · residuals ${state.coupledResidualT.toFixed(4)} / ${state.coupledResidualL.toFixed(4)} m</p><p><b>Longitudinal strength teaching model:</b> Max |SF| ${state.strength?state.strength.maxSF.toFixed(0):'—'} kN · Max |BM| ${state.strength?(state.strength.maxBM/1000).toFixed(1):'—'} MN·m · concentration index ${state.strength?(state.strength.concentration*100).toFixed(1):'—'}% (not an approved utilisation ratio)</p><p><b>Free surface:</b> Generic FSM ${state.fsmGeneric.toFixed(0)} t·m · Individual ballast FSM ${state.fsmIndividual.toFixed(0)} t·m · FSC ${state.fsc.toFixed(3)} m</p><p><b>Environment:</b> Wind ${state.windEnabled?state.windSpeedKts.toFixed(0)+' kn · '+state.windDirection:'OFF'} · Current ${state.currentEnabled?state.currentSpeedKts.toFixed(1)+' kn · '+state.currentDirection:'OFF'} · Visibility ${state.visibilityNm.toFixed(1)} nm · Environmental heeling moment ${(state.environmentMoment/1000).toFixed(0)} kN·m</p><table><tr><th>Displacement</th><td>${state.dispMass.toFixed(1)} t</td><th>Equivalent draft</th><td>${state.eqDraft.toFixed(3)} m</td></tr><tr><th>KG corrected</th><td>${state.kgCorr.toFixed(3)} m</td><th>KM / GM</th><td>${u.KM.toFixed(3)} / ${state.gm.toFixed(3)} m</td></tr><tr><th>Heel / GZ</th><td>${Math.abs(state.heel).toFixed(2)}° ${state.heel<0?'PORT':'STBD'} / ${restoringGZAt(state.heel).toFixed(3)} m ${stabilitySenseAt(state.heel)}</td><th>Equilibrium</th><td>${state.equilibrium.toFixed(2)}°</td></tr><tr><th>TPC</th><td>${state.tpc.toFixed(3)} t/cm</td><th>FWA approx.</th><td>${state.fwa.toFixed(1)} mm</td></tr></table>${state.staticGZResult?`<h3>Static Stability GZ Characteristics</h3><p>Initial corrected GM ${state.staticGZResult.gm.toFixed(3)} m · Maximum GZ ${state.staticGZResult.maxGZ.toFixed(3)} m at ${state.staticGZResult.maxAngle.toFixed(1)}° · Contraflexure ${Number.isFinite(state.staticGZResult.contraflexureAngle)?state.staticGZResult.contraflexureAngle.toFixed(1)+'°':'N/A'} · Angle of Vanishing Stability ${Number.isFinite(state.staticGZResult.avs)?state.staticGZResult.avs.toFixed(1)+'°':'>90°'} · Positive range ${Number.isFinite(state.staticGZResult.rangeOfStability)?state.staticGZResult.rangeOfStability.toFixed(1)+'°':'>90°'}</p>`:''}<h3>General intact-stability teaching audit</h3><table><tr><th>Criterion</th><th>Actual</th><th>Requirement</th><th>Status</th></tr>${cr.map(c=>`<tr><td>${c.name}</td><td>${c.fmt(c.actual)}</td><td>${c.req}</td><td class="${c.pass?'pass':'fail'}">${c.pass?'PASS':'FAIL'}</td></tr>`).join('')}</table>${state.grainEnabled&&state.grainResult?`<h3>Grain shift stability teaching audit</h3><p>Assumed grain heeling moment ${state.grainMoment.toFixed(1)} t·m · λ₀ ${state.grainResult.lambda0.toFixed(3)} m · λ₄₀ ${state.grainResult.lambda40.toFixed(3)} m · list ${Number.isFinite(state.grainResult.listAngle)?state.grainResult.listAngle.toFixed(2)+'°':'N/A'} · residual area ${Number.isFinite(state.grainResult.residualArea)?state.grainResult.residualArea.toFixed(3)+' m·rad':'N/A'}</p><table><tr><th>Criterion</th><th>Actual</th><th>Requirement</th><th>Status</th></tr>${grainCriteria().map(c=>`<tr><td>${c.name}</td><td>${c.fmt(c.actual)}</td><td>${c.req}</td><td class="${c.pass?'pass':'fail'}">${c.pass?'PASS':'FAIL'}</td></tr>`).join('')}</table>`:''}<p><small>Operational decisions require the vessel's approved stability booklet/loading instrument, actual tank data and applicable flag/class/company requirements.</small></p>


</body></html>`);w.document.close();w.print();}

window.addEventListener('DOMContentLoaded',()=>{
 loadPersistedImportedVessels();loadDraftSurveyCustomMissions();
 installAMCOLScenarioFleetOverrides();
 initCleanUI();setupCanvas();initChart();setupGZPanelDrag();bindControls();syncFormFromState();populateReferenceVesselSelect();populateAMCOLTrainingHydroOptions();restoreUploadedHydroBundle();updateHydroDataPackInfo();refreshSavedVesselProfiles();enterFreeCustomisation(false);
 vesselVisualTransaction=true;
 try{
   if(!cargoItems.length)initialiseEmptyCargoTemplate();if(!restoreBallastPlanLocal())initialiseEmptyBallastTemplate();
   if(!Number(state.spaceLayoutRevision))bumpSpaceLayoutRevision('startup');
   renderCargoTable();renderBallastPlan();calculateAll();updatePhysicsValidity();renderScenario();setViewMode('bow');
 }finally{vesselVisualTransaction=false;}
 setDisplayMode('2d');schedule2DVisualPaint('startup');pendingHard3DReload=true;
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('challengeBriefingBackdrop')?.classList.contains('hidden')){closeChallengeBriefing();e.preventDefault();}});
 window.addEventListener('keydown',e=>{if(e.target&&['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='1')setViewMode('bow');if(e.key==='2')setViewMode('stern');if(e.key==='3')setViewMode('starboard');if(e.key==='4')setViewMode('port');if(e.key==='+'||e.key==='='){e.preventDefault();zoomCamera(.25)}if(e.key==='-'||e.key==='_'){e.preventDefault();zoomCamera(-.25)}if(e.key==='0'){e.preventDefault();fitCameraView()}if(e.key.toLowerCase()==='p'){e.preventDefault();toggleCameraPanMode()}if(e.key.toLowerCase()==='d'){e.preventDefault();setDisplayMode(displayMode==='3d'?'2d':'3d')}if(displayMode==='3d'){const k=e.key.toLowerCase();if(k==='i')window.AMCOL3D?.setInteractionMode('inspect');if(k==='c')window.AMCOL3D?.setInteractionMode('cargo');if(k==='r')window.AMCOL3D?.setInteractionMode('crane');if(k==='x')window.AMCOL3D?.setInteractionAxis('x');if(k==='y')window.AMCOL3D?.setInteractionAxis('y');if(k==='z')window.AMCOL3D?.setInteractionAxis('z')}});
 try{window.dispatchEvent(new CustomEvent('amcol:simulator-ready',{detail:{hullType:state.hullType}}));}catch(e){}
 requestAnimationFrame(animationLoop);
});
