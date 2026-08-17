import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const container = document.getElementById('threeDContainer');
const loading = document.getElementById('threeDLoading');
const statusEl = document.getElementById('threeDStatus');

let renderer, scene, camera, controls;
let shipRoot, shipVisual, water, seabed, waterlineMarker;
let hydroGroup, hydroPointsGroup, hydroForcesGroup, hydroGZGroup, hydroReferenceGroup, hydroLabelsGroup;
let hydroMarkers={}, hydroLabels={}, hydroLines={}, weightArrow=null, buoyancyArrow=null, sectionPlane=null;
let operationsGroup, cargo3DGroup, cargoSpaces3DGroup, tanks3DGroup, machinery3DGroup, crane3DGroup, damage3DGroup, operationsLabelsGroup;
let operationPickables=[], tankLiquidPivots=[], operationSignature='', internalLayoutIdentity='';
let environmentGroup, windVectorGroup, currentVectorGroup, environmentForceGroup;
let waterEffectsGroup=null,waterEffectMeshes=[],waterEffectSignature='',animatedPropellers=[],visualLayerPreset='full';
let rainPoints=null, rainPositions=null, rainSeeds=[], skyDome=null, envHeelingArrow=null;
let envHemi=null, envSun=null, envFill=null, sunSprite=null;
let hydroRaycaster=new THREE.Raycaster(), hydroPointer=new THREE.Vector2(), hydroPointerDown=null;
let latestState = null, latestRuntime = null;
let vesselSignature = '', hydroSignature='';
let currentPreset = 'perspective';
let sceneReady = false, threeDViewActive=false;
const hydroOptions={master:true,points:true,forces:true,gz:true,references:true,labels:true,sectionPlane:false,xray:false};
let internalArrangementView=false;
const operationOptions={master:true,cargo:true,cargoSpaces:true,tanks:true,machinery:true,crane:true,damage:true,labels:true};
const environmentOptions={master:true,sea:true,wind:true,current:true,atmosphere:true,lighting:true,heelingArm:true};
let detailQuality='balanced';
const DETAIL_LEVEL={performance:0,balanced:1,high:2};
const inspectionOptions={autoFocus:true,challengeCamera:false};
let cameraTween=null,cutawayMode='none',selectedInspectionObject=null,lastChallengeCameraScenario='';
let transformControls=null,interactionMode='inspect',interactionAxis='x',interactionSnap=.25;
let interactiveObject=null,interactiveOriginal=null,interactionDragging=false,interactionCommitPending=false;
let ballastLabGroup=null,ballastTankGroup=null,ballastPipeGroup=null,ballastLabelGroup=null;
let ballastTankVisuals={},ballastFlowParticles=[],ballastFlowCurve=null;
let ballastLab={active:false,running:false,paused:false,tanks:{},source:'',destination:'',targetMass:0,transferred:0,rate:50,timeScale:10,originalSnapshot:null,lastCommit:0,status:'Vessel tanks not synced',scenarioKey:'',planSignature:'',valueSignature:''};
let operationalMission={
  active:false,finished:false,key:'',title:'',brief:'',goal:'',tasks:[],category:'',difficulty:'',
  startedAt:0,endedAt:0,timeLimit:480,expired:false,attempts:0,hints:0,actions:[],
  lastSnapshot:null,lastPollAt:0,lastActionAt:0,result:null,student:'',className:''
};
let cleanToolOpen='';
let teacherUnlocked=false;
let teacherState={examMode:false,leaderboard:false,activeAssignment:'',assignmentSets:{},results:[]};
const TEACHER_STORE_KEY='amcol_teacher_dashboard_v1';
const TEACHER_PIN_KEY='amcol_teacher_pin_v1';
const cutawayPlaneWorld=new THREE.Plane(new THREE.Vector3(1,0,0),0);
let cutawayLocalPlane=null;
const clock = new THREE.Clock();

function disposeObject(obj){
  obj.traverse?.(child=>{
    if(child.geometry) child.geometry.dispose?.();
    if(child.material){
      const mats=Array.isArray(child.material)?child.material:[child.material];
      mats.forEach(m=>m.dispose?.());
    }
  });
}

function makeMaterial(color, extra={}){
  return new THREE.MeshStandardMaterial({
    color, roughness:.58, metalness:.08, ...extra
  });
}

function vessel3DHullProfile(type){
  const profiles={
    // Family-specific station envelopes. xNorm: -1 stern, +1 bow.
    // These are fair representative commercial-ship forms, not approved vessel offsets.
    container:{label:'Fine flared merchant bow / bulbous',form:'raked',flare:.087,stemRake:.23,sternFull:.705,bulb:{w:.047,h:.037,l:.039,y:.095},bowCurve:[[.35,1,.72,0,0],[.58,.995,.70,.012,.004],[.72,.965,.63,.030,.014],[.84,.86,.52,.060,.038],[.92,.66,.38,.100,.075],[.97,.38,.21,.135,.120],[1,.055,.065,.155,.155]]},
    bulk:{label:'Full rounded raked merchant bow / bulbous',form:'raked',flare:.068,stemRake:.18,sternFull:.76,bulb:{w:.060,h:.050,l:.046,y:.105},bowCurve:[[.42,1,.74,0,0],[.64,.998,.72,.010,.003],[.78,.975,.67,.025,.012],[.88,.90,.57,.052,.030],[.95,.66,.39,.090,.070],[.985,.31,.19,.122,.115],[1,.065,.075,.140,.145]]},
    general:{label:'Conventional rounded raked cargo bow / bulbous',form:'raked',flare:.076,stemRake:.21,sternFull:.73,bulb:{w:.040,h:.034,l:.030,y:.096},bowCurve:[[.38,1,.72,0,0],[.60,.995,.70,.012,.004],[.75,.965,.62,.032,.016],[.86,.84,.49,.066,.043],[.94,.59,.33,.105,.085],[.98,.30,.17,.135,.128],[1,.055,.065,.150,.150]]},
    roro:{label:'High-freeboard conventional Ro-Ro bow',form:'vertical',flare:.048,stemRake:.016,sternFull:.885,bulb:null,bowCurve:[[.48,1,.76,0,0],[.70,.998,.74,.008,.002],[.84,.955,.64,.024,.010],[.93,.76,.45,.050,.030],[.98,.40,.23,.072,.060],[1,.085,.085,.082,.078]]},
    ferry:{label:'High-freeboard conventional ferry bow',form:'vertical',flare:.055,stemRake:.018,sternFull:.86,bulb:null,bowCurve:[[.48,1,.76,0,0],[.70,.998,.74,.010,.002],[.84,.96,.64,.028,.012],[.93,.78,.46,.058,.034],[.98,.42,.24,.080,.065],[1,.085,.085,.092,.084]]},
    tanker:{label:'Full rounded tanker bow / bulbous',form:'full',flare:.048,stemRake:.125,sternFull:.895,bulb:{w:.068,h:.058,l:.048,y:.108},bowCurve:[[.50,1,.78,0,0],[.70,1,.77,.008,.002],[.83,.975,.71,.020,.009],[.91,.88,.59,.045,.025],[.96,.66,.42,.070,.050],[.99,.30,.21,.090,.082],[1,.075,.085,.100,.100]]},
    chemical:{label:'Full rounded chemical-tanker bow / bulbous',form:'full',flare:.054,stemRake:.14,sternFull:.86,bulb:{w:.064,h:.055,l:.044,y:.108},bowCurve:[[.48,1,.77,0,0],[.69,1,.76,.009,.002],[.82,.97,.69,.022,.010],[.91,.86,.57,.048,.028],[.96,.63,.40,.075,.055],[.99,.29,.20,.096,.088],[1,.07,.08,.108,.108]]},
    lng:{label:'Full rounded gas-carrier bow / bulbous',form:'full',flare:.046,stemRake:.125,sternFull:.91,bulb:{w:.068,h:.058,l:.049,y:.108},bowCurve:[[.50,1,.79,0,0],[.71,1,.77,.008,.002],[.84,.98,.71,.021,.010],[.92,.88,.58,.047,.027],[.97,.62,.39,.074,.054],[.99,.29,.20,.096,.088],[1,.075,.085,.108,.108]]},
    osv:{label:'Conventional offshore flared bow',form:'raked',flare:.045,stemRake:.16,sternFull:.70,bulb:null,bowCurve:[[.36,1,.70,0,0],[.58,.995,.68,.016,.005],[.73,.96,.60,.040,.020],[.84,.84,.48,.078,.050],[.93,.61,.32,.118,.095],[.98,.30,.17,.150,.140],[1,.055,.065,.165,.165]]},
    box:{label:'Box / pontoon bow',form:'box',flare:.010,stemRake:0,sternFull:.97,bulb:null,bowCurve:[[.72,1,.90,0,0],[.88,.96,.86,.005,.003],[.96,.90,.80,.012,.010],[1,.84,.78,.020,.015]]},
    axe:{label:'Specialised Axe / flareless bow',form:'axe',flare:.008,stemRake:0,sternFull:.70,bulb:null,bowCurve:[[.30,1,.68,0,0],[.58,.92,.60,.020,.015],[.76,.72,.48,.050,.050],[.90,.44,.30,.090,.105],[1,.055,.07,.115,.170]]}
  };
  const shared=window.AMCOL_HULL_STATION_ENVELOPES||{};Object.keys(profiles).forEach(k=>{if(shared[k])profiles[k].bowCurve=shared[k];});
  return profiles[type]||profiles.general;
}
function smooth01(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
function interpolateHullStations(points,x){
  if(!points?.length)return null;if(x<=points[0][0])return points[0];if(x>=points[points.length-1][0])return points[points.length-1];
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=smooth01((x-a[0])/Math.max(1e-6,b[0]-a[0]));return [x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t,a[4]+(b[4]-a[4])*t];}
  return points[points.length-1];
}
function customHullStationAt(xNorm,D,type){
  const c=window.AMCOL_CUSTOM_HULL_FORM;if(!c?.enabled||!Array.isArray(c.stations)||c.stations.length<5)return null;
  if(c.vesselName&&latestState?.vesselName&&c.vesselName!==latestState.vesselName)return null;if(c.hullType&&type&&c.hullType!==type&&c.vesselName)return null;
  const pts=c.stations.map(s=>[+s.xNorm,+s.beamFactor,+s.bottomFactor,+s.sheerRatio||0,+s.keelRiseRatio||0]).filter(a=>a.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);
  const r=interpolateHullStations(pts,xNorm);if(!r)return null;return {beamFactor:r[1],bottomFactor:r[2],sheer:D*r[3],keelRise:D*r[4],custom:true};
}
function visualHullStationAtZ(z,L,B,D,type){
  const p=vessel3DHullProfile(type),xNorm=Math.max(-1,Math.min(1,-2*z/Math.max(.001,L)));
  const custom=customHullStationAt(xNorm,D,type);if(custom)return {...custom,xNorm,fore:Math.max(0,(xNorm-.35)/.65)};
  let beamFactor=1,bottomFactor=.72,sheer=0,keelRise=0;
  if(xNorm<-.70){const u=Math.min(1,Math.max(0,(xNorm+1)/.30));beamFactor=p.sternFull+(1-p.sternFull)*Math.sin(u*Math.PI/2);bottomFactor=.45+.27*u;sheer=D*.010*(1-u);}
  const first=p.bowCurve?.[0]?.[0]??.40;
  if(xNorm>=first){const r=interpolateHullStations(p.bowCurve,xNorm);beamFactor=r[1];bottomFactor=r[2];sheer=D*r[3];keelRise=D*r[4];}
  const fore=Math.max(0,Math.min(1,(xNorm-first)/Math.max(.001,1-first)));
  return {beamFactor,bottomFactor,sheer,keelRise,xNorm,fore};
}
function createHullGeometry(L,B,D,type){
  // Visual hull only. Coordinates: +X Starboard, +Y Up, bow = -Z, stern = +Z.
  // Every vessel family now uses a fair station-envelope curve. Axe form is a specialised explicit family only.
  const q=DETAIL_LEVEL[detailQuality]??1,p=vessel3DHullProfile(type),n=q===0?17:(q===1?31:45),stations=[];
  for(let i=0;i<n;i++){const t=i/(n-1),te=0.5-0.5*Math.cos(Math.PI*t),z=L*.50-te*L;stations.push({z,...visualHullStationAtZ(z,L,B,D,type)});}
  const ringCount=q===0?9:(q===1?13:17),verts=[],indices=[],rings=[];
  stations.forEach(st=>{const hd=B*.5*st.beamFactor,hb=B*.5*st.bottomFactor,ring=[];for(let j=0;j<ringCount;j++){const f=j/(ringCount-1),side=(f-.5)*2,abs=Math.abs(side);let y,x;if(abs<.13){x=side/.13*hb*.16*(1-st.fore*.08);y=st.keelRise;}else{const u=(abs-.13)/.87,flareBoost=1+p.flare*Math.pow(u,1.18)*Math.pow(st.fore,1.12),width=(hb*.16+(hd-hb*.16)*Math.pow(Math.sin(u*Math.PI/2),.76))*flareBoost;x=Math.sign(side)*width;y=st.keelRise+D*Math.pow(u,.80)+st.sheer;if(u>.70)x*=1+.026*((u-.70)/.30)+p.flare*.15*Math.pow(st.fore,1.05);}const verticalFrac=Math.max(0,Math.min(1,(y-st.keelRise)/Math.max(.001,D+st.sheer)));let zv=st.z;if(st.fore>0&&!st.custom){if(p.form==='raked'||p.form==='full')zv+=p.stemRake*D*Math.pow(st.fore,1.7)*(1-verticalFrac);else if(p.form==='vertical')zv+=p.stemRake*D*Math.pow(st.fore,2)*(1-verticalFrac*.35);else if(p.form==='axe')zv+=(p.axeBack||.18)*D*Math.pow(st.fore,1.75)*Math.pow(verticalFrac,1.25);}ring.push(verts.length/3);verts.push(x,y,zv);}rings.push(ring);});
  for(let i=0;i<rings.length-1;i++){const a=rings[i],b=rings[i+1];for(let j=0;j<ringCount-1;j++)indices.push(a[j],b[j],a[j+1],a[j+1],b[j],b[j+1]);indices.push(a[0],a[ringCount-1],b[0],a[ringCount-1],b[ringCount-1],b[0]);}
  const capRing=(ring,reverse=false)=>{const centre=verts.length/3;let sx=0,sy=0,sz=0;ring.forEach(id=>{sx+=verts[id*3];sy+=verts[id*3+1];sz+=verts[id*3+2];});verts.push(sx/ring.length,sy/ring.length,sz/ring.length);for(let j=0;j<ring.length-1;j++)reverse?indices.push(centre,ring[j+1],ring[j]):indices.push(centre,ring[j],ring[j+1]);reverse?indices.push(centre,ring[0],ring[ring.length-1]):indices.push(centre,ring[ring.length-1],ring[0]);};
  capRing(rings[0],false);capRing(rings[rings.length-1],true);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function visualHullHalfBreadthAtDraft(y,z,L,B,D,type){
  const st=visualHullStationAtZ(z,L,B,D,type),p=vessel3DHullProfile(type);
  const hd=B*.5*st.beamFactor,hb=B*.5*st.bottomFactor;
  const localY=Math.max(0,Math.min(D,Number(y)-st.keelRise-st.sheer));
  const frac=Math.max(0,Math.min(1,localY/Math.max(.001,D)));
  const u=Math.pow(frac,1/.78);
  let width=hb*.16+(hd-hb*.16)*Math.pow(Math.sin(u*Math.PI/2),.78);
  const flareBoost=1+p.flare*Math.pow(u,1.15)*Math.pow(st.fore,1.15);
  width*=flareBoost;
  if(u>.70)width*=1+.028*((u-.70)/.30)+p.flare*.16*Math.pow(st.fore,1.08);
  return Math.max(B*.012,width);
}

function addBox(group,size,pos,color,opts={}){
  const m=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),makeMaterial(color,opts));
  m.position.set(pos[0],pos[1],pos[2]);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
function addCylinder(group,r,h,pos,color,rotZ=0){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),makeMaterial(color));
  m.position.set(...pos);m.rotation.z=rotZ;m.castShadow=true;group.add(m);return m;
}


function detailLevel(){return DETAIL_LEVEL[detailQuality]??1;}
function addRoundedBox(group,size,pos,color,opts={}){
  // BoxGeometry remains lightweight; bevel-like realism is created by edge trim and material response.
  const m=addBox(group,size,pos,color,opts);
  if(detailLevel()>=2){
    const edges=new THREE.LineSegments(
      new THREE.EdgesGeometry(m.geometry,28),
      new THREE.LineBasicMaterial({color:opts.edgeColor??0x738397,transparent:true,opacity:opts.edgeOpacity??.25})
    );
    edges.renderOrder=5;m.add(edges);
  }
  return m;
}
function addDeckCamberCrown(group,B,D,L,type='general'){
  if(detailLevel()===0||type==='box')return;
  const crownH=Math.max(D*.008,B*.005),mainL=(type==='roro'||type==='ferry')?L*.68:L*.60;
  addRoundedBox(group,[B*.34,crownH,mainL],[0,D+crownH*.60,L*.04],0xb7c1ca,{roughness:.72,metalness:.06,edgeOpacity:.08});
  if(detailLevel()>=2){
    addRoundedBox(group,[B*.08,crownH*.55,mainL*.98],[-B*.25,D+crownH*.95,L*.04],0x9faab4,{roughness:.78,metalness:.04,edgeOpacity:.05});
    addRoundedBox(group,[B*.08,crownH*.55,mainL*.98],[ B*.25,D+crownH*.95,L*.04],0x9faab4,{roughness:.78,metalness:.04,edgeOpacity:.05});
  }
}
function addHullPaintBand(group,B,D,L,type,yMid,height,color,opts={}){
  if(type==='box')return;
  const seg=opts.segments||(detailLevel()>=2?24:16),z0=opts.z0??(-L*.43),z1=opts.z1??(L*.43),offset=opts.offset??(B*.0018),yLow=Math.max(0,yMid-height*.5),yHigh=Math.min(D*1.04,yMid+height*.5),positions=[],indices=[];
  for(const side of [-1,1]){
    const baseIndex=positions.length/3;
    for(let i=0;i<=seg;i++){
      const t=i/seg,z=z0+(z1-z0)*t;
      const xLow=side*(visualHullHalfBreadthAtDraft(yLow,z,L,B,D,type)+offset);
      const xHigh=side*(visualHullHalfBreadthAtDraft(yHigh,z,L,B,D,type)+offset*1.15);
      positions.push(xLow,yLow,z,xHigh,yHigh,z);
    }
    for(let i=0;i<seg;i++){
      const a=baseIndex+i*2,b=a+1,c=a+2,d=a+3;
      if(side>0)indices.push(a,c,b,b,c,d); else indices.push(a,b,c,b,d,c);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();
  const m=makeMaterial(color,{roughness:opts.roughness??.78,metalness:opts.metalness??.02,transparent:!!opts.transparent,opacity:opts.opacity??1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,m);mesh.renderOrder=4;mesh.userData.visualRole=opts.visualRole||'hullPaint';group.add(mesh);return mesh;
}
function visualReferenceWaterlineDraft(s,D){const d=Number(s?.visualReferenceDraft),eq=Number(s?.eqDraft);const raw=Number.isFinite(d)&&d>0?d:(Number.isFinite(eq)&&eq>0?eq:D*.50);return Math.max(D*.10,Math.min(D*.92,raw));}
function addBootTopBands(group,B,D,L,type='general'){
  if(type==='box')return;
  // Reference paint line follows vessel-specific design/published draft where available. Actual sea level still follows the current calculated draft.
  const refDraft=visualReferenceWaterlineDraft(latestState,D),bootH=Math.max(.10,Math.min(.55,D*.025));
  addHullPaintBand(group,B,D,L,type,refDraft,bootH,0x171a21,{segments:detailLevel()>=2?30:20,offset:B*.0012,roughness:.68,metalness:.05,visualRole:'bootTopBand'});
}
function addRestrainedWeathering(group,B,D,L,type='general'){
  if(detailLevel()<2||type==='box')return;
  const z=-L*.425,y=D*.37;
  for(const side of [-1,1]){
    const x=side*(visualHullHalfBreadthAtDraft(y,z,L,B,D,type)+B*.006);
    addRoundedBox(group,[B*.008,D*.12,L*.012],[x,y-D*.035,z+L*.010],0x7c3f2b,{transparent:true,opacity:.18,roughness:.86,metalness:0,edgeOpacity:0});
    addRoundedBox(group,[B*.007,D*.07,L*.008],[x,y-D*.12,z+L*.016],0x5b3428,{transparent:true,opacity:.12,roughness:.90,metalness:0,edgeOpacity:0});
  }
}
function addSternMooringDetails(group,B,D,L,type='general'){
  if(detailLevel()===0||type==='box')return;
  const z=L*.39,y=D*1.045,half=localDeckEdgeHalfBreadth(z,B,D,L,type,B*.035),x=Math.min(B*.25,half*.62);
  for(const side of [-1,1]){
    addCylinder(group,B*.016,D*.085,[side*x,y,z],0x374151);
    addCylinder(group,B*.016,D*.085,[side*(x+B*.035),y,z],0x374151);
    addRoundedBox(group,[B*.095,D*.045,L*.026],[side*x,y+D*.035,z-L*.028],0x64748b,{roughness:.68,metalness:.16});
  }
  addRoundedBox(group,[B*.18,D*.05,L*.035],[0,y+D*.035,z],0x475569,{roughness:.68,metalness:.18});
}
function addLngTankArchitecture(group,s,spec){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const {x,z,r,d,visualCentreY,topY,bottom}=spec,deckY=D*1.015;
  const collarR=Math.max(B*.11,r*.80),tube=Math.max(B*.007,r*.024);
  const opening=new THREE.Mesh(new THREE.CircleGeometry(collarR*.92,detailLevel()>=2?40:24),new THREE.MeshBasicMaterial({color:0x111827,transparent:true,opacity:.60,side:THREE.DoubleSide,depthWrite:false}));opening.rotation.x=-Math.PI/2;opening.position.set(x,deckY+D*.012,z);opening.scale.z=.88;group.add(opening);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(collarR,tube,8,detailLevel()>=2?40:24),makeMaterial(0xc8d2dc,{roughness:.58,metalness:.12}));
  collar.rotation.x=Math.PI/2;collar.scale.z=.88;collar.position.set(x,deckY+D*.020,z);group.add(collar);
  const platform=new THREE.Mesh(new THREE.RingGeometry(r*.24,r*.38,detailLevel()>=2?32:22),makeMaterial(0xb8c5d1,{roughness:.65,metalness:.12,side:THREE.DoubleSide}));
  platform.rotation.x=-Math.PI/2;platform.position.set(x,Math.min(topY+D*.035,D*1.58),z);group.add(platform);
  const towerY=Math.min(topY+D*.07,D*1.58),towerH=Math.max(D*.18,r*.38);
  for(const dx of [-r*.16,r*.16]){
    group.add(cylinderBetween(new THREE.Vector3(x+dx,towerY,z-r*.10),new THREE.Vector3(x+dx,towerY+towerH,z-r*.10),Math.max(B*.004,r*.018),0xcbd5e1,.95));
  }
  for(let j=0;j<4;j++){const yy=towerY+towerH*(.18+j*.20);group.add(cylinderBetween(new THREE.Vector3(x-r*.18,yy,z-r*.10),new THREE.Vector3(x+r*.18,yy,z-r*.10),Math.max(B*.003,r*.011),0x94a3b8,.9));}
  const ladderX=x-r*.27,ladderBottom=Math.max(deckY,bottom+r*.54),ladderTop=Math.min(topY+D*.015,D*1.54);
  group.add(cylinderBetween(new THREE.Vector3(ladderX,ladderBottom,z+r*.10),new THREE.Vector3(ladderX,ladderTop,z+r*.10),Math.max(B*.003,r*.010),0xe2e8f0,.9));
  group.add(cylinderBetween(new THREE.Vector3(ladderX+r*.08,ladderBottom,z+r*.10),new THREE.Vector3(ladderX+r*.08,ladderTop,z+r*.10),Math.max(B*.003,r*.010),0xe2e8f0,.9));
  const rungN=Math.max(4,Math.min(12,Math.floor((ladderTop-ladderBottom)/Math.max(.4,D*.08))));
  for(let j=0;j<=rungN;j++){const yy=ladderBottom+(ladderTop-ladderBottom)*j/Math.max(1,rungN);group.add(cylinderBetween(new THREE.Vector3(ladderX,yy,z+r*.10),new THREE.Vector3(ladderX+r*.08,yy,z+r*.10),Math.max(B*.0025,r*.0075),0xe2e8f0,.86));}
  addPipeRun(group,[B*.25,D*1.10,z],[x+r*.16,Math.min(topY+D*.05,D*1.56),z],Math.max(B*.005,r*.018),0xeab308);
  addPipeRun(group,[-B*.25,D*1.10,z],[x-r*.16,Math.min(topY+D*.05,D*1.56),z],Math.max(B*.0045,r*.015),0x38bdf8);
  addCylinder(group,Math.max(B*.008,r*.038),Math.max(D*.16,r*.36),[x,towerY+towerH+D*.08,z-r*.10],0xd5dee8);
}

function addWindow(group,pos,size=[.4,.28,.08],emissive=false){
  const mat=makeMaterial(emissive?0x8dd8ff:0x0f2842,{
    roughness:.12,metalness:.18,
    emissive:emissive?0x1d6688:0x06131f,
    emissiveIntensity:emissive?.55:.12
  });
  const w=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);w.position.set(...pos);group.add(w);return w;
}
function addWindowBand(group,B,D,L,z,y,widthFrac=.52,rows=1){
  const q=detailLevel();
  if(q===0){
    addBox(group,[B*widthFrac,D*.055,L*.012],[0,y,z],0x10283f,{roughness:.18,metalness:.12,emissive:0x06131f,emissiveIntensity:.15});
    return;
  }
  const count=q===1?6:10;
  const span=B*widthFrac;
  for(let r=0;r<rows;r++){
    for(let i=0;i<count;i++){
      const x=-span*.45+i*(span*.90/(count-1));
      addWindow(group,[x,y+r*D*.07,z],[B*.055,D*.045,L*.008],q===2&&r===0);
    }
  }
}
function addRailingLine(group,a,b,height,color=0xcbd5e1){
  if(detailLevel()===0)return;
  const railY=a[1]+height;
  const r=Math.max(.012,(latestState?.beam||16)*.0022);
  group.add(cylinderBetween(new THREE.Vector3(a[0],railY,a[2]),new THREE.Vector3(b[0],railY,b[2]),r,color,.72));
  if(detailLevel()>=2){
    const len=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
    const posts=Math.max(2,Math.min(18,Math.floor(len/Math.max(2,(latestState?.length||80)*.03))));
    for(let i=0;i<=posts;i++){
      const t=i/posts;
      const p=new THREE.Vector3(a[0],a[1],a[2]).lerp(new THREE.Vector3(b[0],b[1],b[2]),t);
      group.add(cylinderBetween(p,new THREE.Vector3(p.x,p.y+height,p.z),r*.75,color,.58));
    }
  }
}
function addLifeboat(group,x,y,z,L,B,color=0xf97316){
  const DD=(latestState?.depth)||Math.max(3,B*.55);
  const boat=new THREE.Mesh(new THREE.CapsuleGeometry(Math.max(.12,B*.045),Math.max(.25,L*.018),6,10),makeMaterial(color,{roughness:.38}));
  boat.rotation.z=Math.PI/2;boat.position.set(x,y,z);boat.castShadow=true;group.add(boat);
  if(detailLevel()>=1){
    group.add(cylinderBetween(new THREE.Vector3(x,y-DD*.02,z),new THREE.Vector3(x-Math.sign(x||1)*B*.07,y+DD*.10,z+L*.010),B*.004,0xe2e8f0,.82));
    group.add(cylinderBetween(new THREE.Vector3(x,y-DD*.02,z),new THREE.Vector3(x-Math.sign(x||1)*B*.07,y+DD*.10,z-L*.010),B*.004,0xe2e8f0,.82));
  }
  return boat;
}
function addFunnel(group,x,y,z,B,D,body=0x334155,cap=0x111827){
  const f=addCylinder(group,Math.max(.12,B*.055),Math.max(.5,D*.38),[x,y,z],body);
  const c=addCylinder(group,Math.max(.13,B*.060),Math.max(.08,D*.055),[x,y+D*.20,z],cap);
  return {f,c};
}
function addRadarMast(group,x,y,z,B,D){
  const mast=addCylinder(group,Math.max(.018,B*.008),Math.max(.6,D*.62),[x,y,z],0xcbd5e1);
  const topY=y+D*.32;
  addBox(group,[B*.26,D*.018,B*.018],[x,topY,z],0xe2e8f0,{metalness:.32,roughness:.34});
  if(detailLevel()>=2){
    addBox(group,[B*.10,D*.012,B*.012],[x,topY+D*.10,z],0xf8fafc,{emissive:0xe2e8f0,emissiveIntensity:.18});
    addCylinder(group,Math.max(.015,B*.006),D*.20,[x,topY+D*.10,z],0x94a3b8);
  }
  return mast;
}
function addHatchCover(group,x,y,z,w,l,D,color=0x596778){
  const h=addRoundedBox(group,[w,Math.max(.08,D*.035),l],[x,y,z],color,{roughness:.60,metalness:.10,edgeColor:0x9aa6b2,edgeOpacity:.18});
  return h;
}
function addBlendedMainDeck(group,B,D,L,type,color=0x9ca9b5){
  const deckT=Math.max(.025,D*.015);
  if(type==='box'){
    return addRoundedBox(group,[B*.94,deckT,L*.90],[0,D+deckT*.5,0],color,{roughness:.76,metalness:.08,edgeOpacity:.16});
  }
  // Parallel midbody deck
  addRoundedBox(group,[B*.90,deckT,L*.66],[0,D+deckT*.5,L*.07],color,{roughness:.76,metalness:.08,edgeOpacity:.16});
  // Foredeck strips progressively narrowed to follow the bow planform and sheer.
  const strips=10, zStart=-L*.425, zEnd=-L*.08;
  for(let i=0;i<strips;i++){
    const t=i/(strips-1), z=zStart+(zEnd-zStart)*t;
    const nextZ=i<strips-1?zStart+(zEnd-zStart)*((i+1)/(strips-1)):z;
    const len=Math.max(L*.03,Math.abs(nextZ-z)*1.10);
    const st=visualHullStationAtZ(z,L,B,D,type);
    const deckY=D+st.sheer+st.keelRise;
    const half=visualHullHalfBreadthAtDraft(deckY,z,L,B,D,type);
    const roRoBoost=(type==='roro'||type==='ferry')?Math.max(B*.05,(1-t)*B*.04):0;
    const width=Math.max(B*.12,Math.min(B*.90,half*2-B*.018+roRoBoost));
    const y=deckY+deckT*.5;
    addRoundedBox(group,[width,deckT,len],[0,y,z],color,{roughness:.76,metalness:.08,edgeOpacity:.12});
  }
}
function addHelipad(group,x,y,z,B,D,L,diam=Math.min(B*.36,L*.12)){
  const padT=Math.max(.012,D*.005);
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(diam*.5,diam*.5,padT,30),makeMaterial(0x7c3a14,{roughness:.86,metalness:.03}));
  pad.position.set(x,y+padT*.5,z);pad.castShadow=true;pad.receiveShadow=true;group.add(pad);
  const markY=y+padT+Math.max(.002,D*.0012);
  const ring=new THREE.Mesh(new THREE.RingGeometry(diam*.31,diam*.42,36),makeMaterial(0xfacc15,{roughness:.58,metalness:.04,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.set(x,markY,z);group.add(ring);
  const legW=diam*.06,legH=Math.max(.008,D*.0035),legL=diam*.32,crossL=diam*.22;
  const left=addBox(group,[legW,legH,legL],[x-diam*.10,markY+legH*.5,z],0xfef08a,{roughness:.66,metalness:.02});
  const right=addBox(group,[legW,legH,legL],[x+diam*.10,markY+legH*.5,z],0xfef08a,{roughness:.66,metalness:.02});
  const cross=addBox(group,[crossL,legH,legW],[x,markY+legH*.5,z],0xfef08a,{roughness:.66,metalness:.02});
  return pad;
}
function addRaisedCatwalk(group,x,y,zStart,zEnd,B,D,color=0xe5e7eb){
  const span=Math.abs(zEnd-zStart);const z=(zStart+zEnd)/2;
  addRoundedBox(group,[B*.10,Math.max(.03,D*.018),span],[x,y,z],color,{roughness:.58,metalness:.18,edgeOpacity:.15});
  if(detailLevel()>=1){
    const posts=Math.max(3,Math.min(12,Math.round(span/Math.max(4,(latestState?.length||100)*.06))));
    for(let i=0;i<=posts;i++){
      const zz=zStart+(zEnd-zStart)*(i/posts);
      group.add(cylinderBetween(new THREE.Vector3(x,y-D*.16,zz),new THREE.Vector3(x,y,zz),B*.004,0x94a3b8,.88));
    }
    addRailingLine(group,[x-B*.05,y,-span/2+z],[x-B*.05,y,span/2+z],D*.05,0xe5e7eb);
    addRailingLine(group,[x+B*.05,y,-span/2+z],[x+B*.05,y,span/2+z],D*.05,0xe5e7eb);
  }
}
function addRoroRamp(group,B,D,L){
  addRoundedBox(group,[B*.60,D*.045,L*.095],[0,D*1.01,L*.435],0xd6dde4,{roughness:.70,metalness:.10});
  if(detailLevel()>=1){
    addRoundedBox(group,[B*.18,D*.16,L*.018],[0,D*.93,L*.395],0xbfc8d1,{roughness:.72});
  }
}
function addHullNameSprite(group,text,x,y,z,scaleX=4,scaleY=1.4){
  const sp=makeLabelSprite(text,'#ffffff','rgba(0,0,0,.0)');sp.scale.set(scaleX,scaleY,1);sp.position.set(x,y,z);group.add(sp);return sp;
}
function addDeckCrane(group,x,y,z,B,D,L,reachX=.30,reachZ=.05){
  const base=addCylinder(group,B*.016,D*.48,[x,y+D*.24,z],0x8c98a5);
  const top=new THREE.Vector3(x,y+D*.48,z);
  const boomEnd=new THREE.Vector3(x+B*reachX,y+D*.34,z-L*reachZ);
  group.add(cylinderBetween(top,boomEnd,B*.011,0xe2e8f0));
  if(detailLevel()>=1){
    group.add(cylinderBetween(new THREE.Vector3(x,y+D*.44,z),new THREE.Vector3(x-B*.18,y+D*.18,z+L*.025),B*.005,0x64748b,.75));
  }
  return base;
}
function addGreatFortuneDeckCrane(group,x,y,z,B,D,L,sideSwing=1){
  const tower=addCylinder(group,B*.017,D*.58,[x,y+D*.29,z],0x8d97a2);
  addRoundedBox(group,[B*.055,D*.10,L*.030],[x,y+D*.48,z],0x9ea8b2,{roughness:.58,metalness:.12});
  addRoundedBox(group,[B*.028,D*.06,L*.024],[x-sideSwing*B*.018,y+D*.57,z],0xa1abb5,{roughness:.52,metalness:.14});
  const top=new THREE.Vector3(x,y+D*.59,z);
  const boomFwd=new THREE.Vector3(x+sideSwing*B*.21,y+D*.46,z-L*.058);
  const boomAft=new THREE.Vector3(x-sideSwing*B*.19,y+D*.45,z+L*.050);
  group.add(cylinderBetween(top,boomFwd,B*.010,0xcfd6dd,.98));
  group.add(cylinderBetween(top,boomAft,B*.008,0xb9c3cd,.98));
  if(detailLevel()>=1){
    group.add(cylinderBetween(new THREE.Vector3(x,y+D*.53,z),new THREE.Vector3(x+sideSwing*B*.12,y+D*.43,z-L*.020),B*.0034,0x4b5563,.78));
    group.add(cylinderBetween(new THREE.Vector3(x,y+D*.53,z),new THREE.Vector3(x-sideSwing*B*.11,y+D*.42,z+L*.018),B*.0030,0x4b5563,.78));
    addRoundedBox(group,[B*.030,D*.050,L*.020],[x+sideSwing*B*.010,y+D*.44,z],0x8b1e1e,{roughness:.68,metalness:.06});
  }
  return tower;
}
function localDeckEdgeHalfBreadth(z,B,D,L,type='general',margin=B*.018){
  const st=visualHullStationAtZ(z,L,B,D,type);
  const deckY=D+st.sheer+st.keelRise;
  const half=visualHullHalfBreadthAtDraft(deckY,z,L,B,D,type);
  return Math.max(B*.08,half-margin);
}
function addBreakwater(group,B,D,L,type='general',z=-L*.33,y=D*1.08){
  const half=localDeckEdgeHalfBreadth(z,B,D,L,type,B*.022);
  const wallW=Math.max(B*.20,Math.min(B*.56,half*1.55));
  const wall=addRoundedBox(group,[wallW,D*.12,L*.022],[0,y+D*.06,z],0xb7c4d0,{roughness:.70,metalness:.08});
  if(detailLevel()>=1){
    addRoundedBox(group,[wallW*.36,D*.08,L*.018],[-wallW*.24,y+D*.11,z-L*.010],0x9aa8b4,{roughness:.72});
    addRoundedBox(group,[wallW*.36,D*.08,L*.018],[ wallW*.24,y+D*.11,z-L*.010],0x9aa8b4,{roughness:.72});
  }
  return wall;
}
function addForeMooringGear(group,B,D,L,type='general',z=-L*.39,y=D*1.04){
  if(detailLevel()===0)return;
  const half=localDeckEdgeHalfBreadth(z,B,D,L,type,B*.030);
  const bittX=Math.min(B*.20,half*.55);
  for(const x of [-bittX,bittX]){
    addCylinder(group,B*.018,D*.08,[x,y,z],0x374151);
    addCylinder(group,B*.018,D*.08,[x+B*.03*Math.sign(x),y,z],0x374151);
    addRoundedBox(group,[B*.06,D*.03,L*.018],[x,y+D*.05,z-L*.03],0x64748b,{roughness:.72});
  }
  const fairleadX=Math.min(B*.33,half*.92);
  for(const side of [-1,1]){
    addRoundedBox(group,[B*.06,D*.025,L*.020],[side*fairleadX,y+D*.02,z-L*.02],0x8a98a6,{roughness:.70});
  }
}
function addDeckPerimeterRail(group,B,D,L,type='general'){
  if(detailLevel()===0)return;
  const zPts=[-L*.36,-L*.30,-L*.24,-L*.18,-L*.10,0,L*.12,L*.24,L*.30];
  const edgePts=zPts.map(z=>{const st=visualHullStationAtZ(z,L,B,D,type);const deckY=D+st.sheer+st.keelRise;const half=Math.max(B*.10,visualHullHalfBreadthAtDraft(deckY,z,L,B,D,type)-B*.025);return {z,y:deckY,half};});
  for(const side of [-1,1]){
    for(let i=0;i<edgePts.length-1;i++){
      const a=edgePts[i],b=edgePts[i+1];
      addRailingLine(group,[side*a.half,a.y,a.z],[side*b.half,b.y,b.z],D*.10);
    }
  }
  const bow=edgePts[0], stern=edgePts[edgePts.length-1];
  addRailingLine(group,[-bow.half,bow.y,bow.z],[bow.half,bow.y,bow.z],D*.10);
  addRailingLine(group,[-stern.half,stern.y,stern.z],[stern.half,stern.y,stern.z],D*.10);
}
function addPlimsollMark(group,B,D,L,type='general'){
  if(detailLevel()===0)return;
  for(const side of [-1,1]){
    const x=side*(B*.505), y=D*.52, z=0;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(B*.028,B*.004,8,18),makeMaterial(0xf8fafc,{roughness:.42,metalness:.12}));
    ring.rotation.y=Math.PI/2; ring.position.set(x,y,z); group.add(ring);
    addBox(group,[B*.11,D*.008,L*.008],[x,y,z],0xf8fafc,{roughness:.44});
  }
}
function addPipeRun(group,a,b,r,color=0xd97706){
  if(detailLevel()===0)return;
  group.add(cylinderBetween(new THREE.Vector3(...a),new THREE.Vector3(...b),r,color,.95));
}
function addAnchor(group,side,B,D,L,type='general'){
  if(detailLevel()===0)return;
  const z=-L*.425, y=D*.44;
  const shellX=visualHullHalfBreadthAtDraft(y,z,L,B,D,type);
  const mouthX=side*(shellX+B*.006);
  const outX=mouthX+side*B*.040;
  const metal=makeMaterial(0x4b5563,{metalness:.46,roughness:.42});
  // Hawse pipe through the shell plating.
  const hawse=new THREE.Mesh(new THREE.CylinderGeometry(B*.018,B*.018,B*.030,14),makeMaterial(0x111827,{roughness:.48,metalness:.18}));
  hawse.rotation.z=Math.PI/2;hawse.position.set(side*(shellX-B*.002),y,z);group.add(hawse);
  // Short chain/stock linkage to visually attach the anchor to the hull.
  group.add(cylinderBetween(new THREE.Vector3(mouthX,y,z),new THREE.Vector3(outX,y-D*.03,z),B*.004,0x94a3b8,.9));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(B*.018,B*.005,10,16),metal);
  ring.position.set(outX,y-D*.02,z);ring.rotation.y=Math.PI/2;group.add(ring);
  group.add(cylinderBetween(new THREE.Vector3(outX,y-D*.10,z),new THREE.Vector3(outX,y+D*.04,z),B*.006,0x4b5563));
  group.add(cylinderBetween(new THREE.Vector3(outX,y-D*.03,z),new THREE.Vector3(outX-side*B*.025,y-D*.10,z),B*.0045,0x4b5563));
  group.add(cylinderBetween(new THREE.Vector3(outX,y-D*.03,z),new THREE.Vector3(outX+side*B*.025,y-D*.10,z),B*.0045,0x4b5563));
  if(detailLevel()>=2){
    group.add(cylinderBetween(new THREE.Vector3(mouthX+side*B*.003,y+D*.01,z),new THREE.Vector3(outX,y+D*.04,z),B*.003,0xe2e8f0,.85));
  }
}
function propellerRadiusForType(type,B,D){
  if(type==='roro'||type==='ferry') return Math.max(B*.060,D*.115);
  if(type==='osv') return Math.max(B*.050,D*.095);
  return Math.max(B*.095,D*.175);
}
function addPropellerAssembly(group,x,y,z,r,blades=4){
  const rotor=new THREE.Group();rotor.position.set(x,y,z);rotor.userData.propellerRotor=true;
  const hub=new THREE.Mesh(new THREE.SphereGeometry(r*.32,16,14),makeMaterial(0xcaa13b,{metalness:.72,roughness:.24}));
  hub.castShadow=true;rotor.add(hub);
  for(let i=0;i<blades;i++){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(r*.18,r*.05,r*1.04),makeMaterial(0xd9b64d,{metalness:.62,roughness:.31}));
    blade.rotation.x=Math.PI/2;blade.rotation.z=i*(Math.PI*2/blades)+Math.PI/7;blade.rotation.y=(i%2?-.42:.42);rotor.add(blade);
  }
  group.add(rotor);animatedPropellers.push(rotor);return rotor;
}
function addSternAppendages(group,B,D,L,type='general'){
  if(type==='box')return;
  const twin=(type==='roro'||type==='ferry'||type==='osv');
  const propXs=twin?[-B*.14,B*.14]:[0];
  const r=propellerRadiusForType(type,B,D);
  const propY=Math.max(r*1.05,D*.18);
  const propZ=L*.500;
  propXs.forEach((x)=>{
    const shaftStart=new THREE.Vector3(x*.42,Math.max(propY+r*.25,D*.28),L*.430);
    const shaftEnd=new THREE.Vector3(x,propY,propZ-r*.20);
    group.add(cylinderBetween(shaftStart,shaftEnd,Math.max(B*.005,r*.08),0x94a3b8,.92));
    addPropellerAssembly(group,x,propY,propZ,r,4);
  });
  const rudderXs=twin?[-B*.14,B*.14]:[0];
  const rudderW=Math.max(B*.030,r*.52), rudderH=Math.max(D*.20,r*2.10), rudderL=Math.max(L*.010,r*.30);
  rudderXs.forEach(x=>addRoundedBox(group,[rudderW,rudderH,rudderL],[x,propY+rudderH*.58,L*.468],0xcbd5e1,{roughness:.52,metalness:.24,edgeOpacity:.18}));
  if(!twin){addBox(group,[B*.12,D*.034,L*.028],[0,propY+rudderH*.98,L*.452],0x64748b,{roughness:.58,metalness:.18});}
  else {rudderXs.forEach(x=>addBox(group,[B*.050,D*.026,L*.022],[x,propY+rudderH*.98,L*.452],0x64748b,{roughness:.58,metalness:.18}));}
}
function addVisualBowFormDetails(group,B,D,L,type,s=null){
  const p=vessel3DHullProfile(type);
  if(!p?.bulb)return;
  // One integrated ellipsoidal merchant-ship bulb.
  // Visual cue only — not used by the hydrostatic solver.
  // THREE.SphereGeometry is scaled independently in X/Y/Z:
  // X = transverse breadth, Y = vertical height, Z = fore-aft projection.
  const q=detailLevel();
  const bulbMat=makeMaterial(0x8b1e18,{roughness:.60,metalness:.06});

  const draftRaw=+(s?.eqDraft||latestState?.eqDraft||0);
  const designDraft=(Number.isFinite(draftRaw)&&draftRaw>0.5)?draftRaw:D*.55;

  // Representative full dimensions. The factors vary by vessel family so a tanker/LNG bulb
  // is fuller than a fine container/general-cargo bulb, without becoming an oversized sphere.
  const family={
    container:{w:.115,h:.225,l:.043},
    bulk:{w:.135,h:.255,l:.048},
    general:{w:.105,h:.215,l:.040},
    tanker:{w:.155,h:.285,l:.052},
    chemical:{w:.145,h:.270,l:.049},
    lng:{w:.150,h:.280,l:.052}
  }[type]||{w:.115,h:.230,l:.043};

  let bulbW=Math.max(B*.085,Math.min(B*.18,B*family.w));
  let bulbH=Math.max(D*.16,Math.min(D*.32,D*family.h));
  let bulbL=Math.max(B*.14,Math.min(L*.060,L*family.l));

  // Avoid the flat/pancake look: keep height and breadth in a plausible relationship,
  // and do not let the fore-aft projection dominate the cross-section excessively.
  bulbH=Math.max(bulbH,bulbW*.72);
  bulbW=Math.max(bulbW,bulbH*.72);
  bulbL=Math.min(bulbL,Math.max(bulbW,bulbH)*1.65);

  const bulb=new THREE.Mesh(
    new THREE.SphereGeometry(1,q===0?16:(q===1?24:32),q===0?12:(q===1?18:24)),
    bulbMat
  );
  bulb.scale.set(bulbW*.5,bulbH*.5,bulbL*.5);

  // Aft half is deliberately buried into the forefoot so the bulb reads as part of the hull.
  const centreY=Math.max(bulbH*.54,Math.min(designDraft*.44,D*.27));
  const centreZ=-L*.485 + bulbL*.22;
  bulb.position.set(0,centreY,centreZ);
  bulb.castShadow=true;
  bulb.receiveShadow=true;
  group.add(bulb);
  return bulb;
}

function addMooringBits(group,B,D,L,type='general'){
  if(detailLevel()<1)return;
  for(const z of [-L*.37,L*.34]){
    const half=localDeckEdgeHalfBreadth(z,B,D,L,type,B*.032);
    const xMag=Math.min(B*.34,half*.86);
    for(const x of [-xMag,xMag]){
      addCylinder(group,B*.012,D*.12,[x,D*1.07,z],0x1f2937);
      addCylinder(group,B*.012,D*.12,[x+B*.025*Math.sign(x),D*1.07,z],0x1f2937);
    }
  }
}
function addAccommodation(group,B,D,L,z,height=.68,width=.62,length=.09,levels=3){
  addRoundedBox(group,[B*width,D*height,L*length],[0,D*(1+height*.50),z],0xe6edf3,{roughness:.62,metalness:.04,edgeColor:0xcbd5e1});
  const levelH=D*height/Math.max(1,levels);
  for(let r=0;r<levels;r++)addWindowBand(group,B,D,L,z-L*length*.505,D*1.10+r*levelH,width*.78,1);
  if(detailLevel()>=1){
    addRoundedBox(group,[B*.78,D*.09,L*length*.25],[0,D*(1+height*.78),z-L*length*.10],0xdce6ee,{roughness:.55});
    // Bridge wings extending toward maximum beam.
    const wingY=D*(1+height*.70);
    addRoundedBox(group,[B*.16,D*.035,L*length*.38],[-B*(width*.50+.06),wingY,z-L*length*.22],0xeaf1f6,{roughness:.56});
    addRoundedBox(group,[B*.16,D*.035,L*length*.38],[ B*(width*.50+.06),wingY,z-L*length*.22],0xeaf1f6,{roughness:.56});
  }
}
function addDeckSafetyDetails(group,B,D,L,type='general'){
  if(detailLevel()===0)return;
  addDeckPerimeterRail(group,B,D,L,type);
  addMooringBits(group,B,D,L,type);
  addAnchor(group,-1,B,D,L,type);addAnchor(group,1,B,D,L,type);
  addPlimsollMark(group,B,D,L,type);
}
function addNavLights(group,B,D,L,z){
  if(detailLevel()===0)return;
  const mastY=D*1.82;
  const port=new THREE.PointLight(0xff3344,.34,Math.max(4,B*.55));port.position.set(-B*.20,mastY,z);group.add(port);
  const stbd=new THREE.PointLight(0x22ff88,.34,Math.max(4,B*.55));stbd.position.set(B*.20,mastY,z);group.add(stbd);
}

const draftTextTextureCache=new Map();
function makeDraftTextTexture(label){
  const key=String(label);
  if(draftTextTextureCache.has(key))return draftTextTextureCache.get(key);
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const g=c.getContext('2d');g.clearRect(0,0,128,128);
  g.font='900 76px Arial';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=10;g.strokeStyle='rgba(0,0,0,.82)';g.strokeText(key,64,66);
  g.fillStyle='#f8fafc';g.fillText(key,64,66);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  draftTextTextureCache.set(key,tex);return tex;
}
function addDraftNumberPlane(group,label,side,x,y,z,B,D,L){
  const h=Math.max(.16,Math.min(.34,D*.030)),chars=Math.max(1,String(label).length),w=h*.62*chars;
  const mat=new THREE.MeshBasicMaterial({map:makeDraftTextTexture(label),transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);p.position.set(side*x,y,z);p.rotation.y=side>0?Math.PI/2:-Math.PI/2;p.renderOrder=16;p.userData.draftMark=true;group.add(p);return p;
}
function addDraftTick(group,side,x,y,z,B,D,L,major=false){
  const tickLen=Math.max(.16,Math.min(.55,L*(major?.006:.0035))),tickH=Math.max(.014,D*(major?.0024:.00155));
  const tick=addBox(group,[Math.max(.012,B*.0012),tickH,tickLen],[side*x,y,z],0xf8fafc,{roughness:.45,metalness:.02,emissive:0x475569,emissiveIntensity:.16});
  tick.renderOrder=15;tick.userData.draftMark=true;return tick;
}
function addOneDraftScale(group,B,D,L,type,z,side,stationLabel){
  const g=new THREE.Group();g.name=`DraftMarks_${stationLabel}_${side>0?'Starboard':'Port'}`;group.add(g);
  const top=Math.max(1,Math.floor((D*.94)*5)/5),bottom=Math.max(.2,Math.ceil(Math.min(.6,top*.18)*5)/5),step=.2,count=Math.max(1,Math.floor((top-bottom)/step)+1);
  for(let i=0;i<count;i++){
    const draft=+(bottom+i*step).toFixed(1);if(draft>top+.001)break;
    const major=Math.abs(draft-Math.round(draft))<.025,half=Math.abs((draft*2)-Math.round(draft*2))<.025;
    if(detailLevel()===0&&!major&&!half)continue;
    const hullX=visualHullHalfBreadthAtDraft(draft,z,L,B,D,type),outside=hullX+Math.max(.018,B*.003);
    addDraftTick(g,side,outside,draft,z,B,D,L,major);
    if(major){const numberOffset=(stationLabel==='FWD'?-1:1)*Math.max(.18,L*.007);addDraftNumberPlane(g,Math.round(draft),side,outside+Math.max(.006,B*.001),draft,z+numberOffset,B,D,L);}
  }
  g.userData.draftStation=stationLabel;g.userData.draftSide=side>0?'Starboard':'Port';return g;
}
function addVesselDraftMarks(group,B,D,L,type){
  const draftGroup=new THREE.Group();draftGroup.name='MetricDraftMarks';draftGroup.userData.teachingVisual=true;group.add(draftGroup);
  const zBow=-L*.425,zStern=L*.425;
  addOneDraftScale(draftGroup,B,D,L,type,zBow,-1,'FWD');addOneDraftScale(draftGroup,B,D,L,type,zBow,1,'FWD');
  // Bulk-carrier draught survey training requires six observations: FWD/MID/AFT on both sides.
  if(type==='bulk'){
    addOneDraftScale(draftGroup,B,D,L,type,0,-1,'MID');addOneDraftScale(draftGroup,B,D,L,type,0,1,'MID');
  }
  addOneDraftScale(draftGroup,B,D,L,type,zStern,-1,'AFT');addOneDraftScale(draftGroup,B,D,L,type,zStern,1,'AFT');
  return draftGroup;
}

function addContainerBay(group,B,D,L,z,tiers=3,rows=4,colorSeed=0){
  const colors=[0x1d4ed8,0x0f766e,0xb45309,0x7c3aed,0x475569,0xb91c1c];
  const q=detailLevel();
  const across=q===0?2:(q===1?4:5);
  const cW=B*.76/across,cL=L*.036,cH=D*.105;
  if(q>=1){
    for(let j=0;j<=across;j++){
      const gx=-B*.38+j*cW;
      addCylinder(group,B*.004,tiers*cH+D*.02,[gx,D*1.07+(tiers*cH+D*.02)/2,z],0x8a98a6);
    }
  }
  for(let tier=0;tier<tiers;tier++){
    for(let j=0;j<across;j++){
      const x=-B*.38+cW*.5+j*cW;
      const c=addRoundedBox(group,[cW*.91,cH,cL],[x,D*1.07+cH*.5+tier*cH,z],colors[(colorSeed+j+tier)%colors.length],{roughness:.57,metalness:.08,edgeOpacity:.32});
      if(q>=2){
        for(const off of [-.28,-.09,.09,.28]) addBox(c,[cW*.012,cH*.82,cL*.018],[off*cW,0,-cL*.51],0xcbd5e1,{roughness:.8,metalness:.12});
      }
    }
  }
}
function addVent(group,x,y,z,B,D){
  if(detailLevel()===0)return;
  const stem=addCylinder(group,B*.014,D*.10,[x,y,z],0x94a3b8);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(B*.023,10,7,0,Math.PI*2,0,Math.PI*.55),makeMaterial(0xcbd5e1));
  cap.position.set(x,y+D*.06,z);group.add(cap);
}
function setDetailQuality(value){
  detailQuality=['performance','balanced','high'].includes(value)?value:'balanced';
  try{localStorage.setItem('amcol_3d_detail_quality',detailQuality);}catch(e){}
  const sel=document.getElementById('threeDDetailQuality');if(sel&&sel.value!==detailQuality)sel.value=detailQuality;
  vesselSignature='';hydroSignature='';operationSignature='';
  if(latestState)syncFromSimulator(latestState,latestRuntime);
}


function makeOverlayMaterial(color,opacity=1){
  const m=new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false});
  return m;
}
function makeLineMaterial(color,opacity=1,dashed=false){
  const common={color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false};
  return dashed?new THREE.LineDashedMaterial({...common,dashSize:.55,gapSize:.38}):new THREE.LineBasicMaterial(common);
}
function makeLabelSprite(text,color='#ffffff',bg='rgba(2,6,23,.88)'){
  const c=document.createElement('canvas');c.width=512;c.height=160;
  const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
  g.fillStyle=bg;g.beginPath();
  const r=28,x=10,y=18,w=492,h=124;
  g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();g.fill();
  g.strokeStyle=color;g.lineWidth=4;g.stroke();
  g.fillStyle=color;g.font='900 62px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,80);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});
  const sp=new THREE.Sprite(mat);sp.scale.set(5.4,1.7,1);sp.renderOrder=220;return sp;
}

function makeHydroLabelSprite(text,color='#ffffff'){
  const c=document.createElement('canvas');c.width=256;c.height=96;
  const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
  g.fillStyle='rgba(2,6,23,.80)';
  const x=6,y=8,w=244,h=80,r=19;
  g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();g.fill();
  g.strokeStyle=color;g.lineWidth=3;g.stroke();
  g.fillStyle=color;g.font='900 42px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,128,48);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});
  const sp=new THREE.Sprite(mat);sp.renderOrder=222;sp.userData.hydroCompactLabel=true;return sp;
}
function hydroWorldPerPixel(point){
  if(!camera||!renderer)return .02;
  const dist=Math.max(.1,camera.position.distanceTo(point));
  const h=Math.max(1,renderer.domElement.clientHeight||renderer.domElement.height||600);
  return 2*dist*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/h;
}
function hydroScreenOffset(point,px,py){
  if(!camera)return point.clone();
  camera.updateMatrixWorld(true);
  const wpp=hydroWorldPerPixel(point);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize();
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();
  return point.clone().addScaledVector(right,px*wpp).addScaledVector(up,py*wpp);
}
function updateHydroMarkerPresentation(){
  if(!camera||!renderer)return;
  const markerPixels=10;
  Object.entries(hydroMarkers).forEach(([key,marker])=>{
    if(!marker)return;
    const pos=marker.getWorldPosition(new THREE.Vector3());
    const wpp=hydroWorldPerPixel(pos);
    const scale=THREE.MathUtils.clamp((markerPixels*wpp)/.44,.42,1.35);
    marker.scale.setScalar(scale);
  });
  const labelLayout={K:[-42,-20],B:[42,-18],G:[-44,22],M:[44,24]};
  Object.entries(labelLayout).forEach(([key,[px,py]])=>{
    const marker=hydroMarkers[key],label=hydroLabels[key];if(!marker||!label)return;
    const p=marker.position.clone();
    label.position.copy(hydroScreenOffset(p,px,py));
    const wpp=hydroWorldPerPixel(p);
    label.scale.set(48*wpp,18*wpp,1);
  });
}

function makeHydroMarker(key,color,label){
  const geo=new THREE.SphereGeometry(.22,18,12);
  const mat=makeOverlayMaterial(color,.96);
  const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=210;mesh.userData.hydroKey=key;mesh.userData.hydroLabel=label;
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.34,14,9),makeOverlayMaterial(color,.10));glow.renderOrder=209;mesh.add(glow);
  return mesh;
}
function setLinePoints(line,pts){
  line.geometry.dispose?.();
  line.geometry=new THREE.BufferGeometry().setFromPoints(pts);
  if(line.material?.isLineDashedMaterial)line.computeLineDistances();
}
function bodyTransversePoint(s,x,y){
  const h=s?.hydro;if(!h||h.invalid)return new THREE.Vector3();
  const c=Math.cos(h.phi||0),sn=Math.sin(h.phi||0);
  return new THREE.Vector3(x*c+y*sn,-x*sn+y*c+(h.sink||0),0);
}
function createArrow(color){
  const a=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),1,color,.45,.25);
  a.line.material.depthTest=false;a.line.material.depthWrite=false;a.line.renderOrder=205;
  a.cone.material.depthTest=false;a.cone.material.depthWrite=false;a.cone.renderOrder=205;
  return a;
}
function setArrow(a,origin,dir,length){
  a.position.copy(origin);a.setDirection(dir.clone().normalize());
  const head=Math.max(.16,Math.min(length*.12,.62));
  a.setLength(Math.max(.25,length),head,head*.48);
}
function buildHydroOverlay(s){
  if(hydroGroup){scene.remove(hydroGroup);disposeObject(hydroGroup);}
  hydroGroup=new THREE.Group();hydroGroup.name='HydrostaticTeachingOverlay';scene.add(hydroGroup);
  hydroPointsGroup=new THREE.Group();hydroForcesGroup=new THREE.Group();hydroGZGroup=new THREE.Group();hydroReferenceGroup=new THREE.Group();hydroLabelsGroup=new THREE.Group();
  hydroGroup.add(hydroReferenceGroup,hydroGZGroup,hydroForcesGroup,hydroPointsGroup,hydroLabelsGroup);

  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);

  // Markers
  const specs={
    K:[0x94a3b8,'K'],B:[0x22c55e,'B'],G:[0xef4444,'G'],M:[0xa855f7,'M₀']
  };
  hydroMarkers={};hydroLabels={};
  Object.entries(specs).forEach(([key,[color,label]])=>{
    const marker=makeHydroMarker(key,color,label);hydroMarkers[key]=marker;hydroPointsGroup.add(marker);
    const sp=makeHydroLabelSprite(label,`#${color.toString(16).padStart(6,'0')}`);hydroLabels[key]=sp;hydroLabelsGroup.add(sp);
  });
  // GZ remains a line plus numeric readout/chart; no extra text tag on the vessel.
  hydroLabels.GZ=null;

  // GZ line + projections
  hydroLines.gz=new THREE.Line(new THREE.BufferGeometry(),makeLineMaterial(0xf59e0b,1));hydroLines.gz.renderOrder=202;hydroGZGroup.add(hydroLines.gz);
  hydroLines.gVertical=new THREE.Line(new THREE.BufferGeometry(),makeLineMaterial(0xef4444,.70,true));hydroLines.gVertical.renderOrder=198;hydroGZGroup.add(hydroLines.gVertical);
  hydroLines.bVertical=new THREE.Line(new THREE.BufferGeometry(),makeLineMaterial(0x22c55e,.70,true));hydroLines.bVertical.renderOrder=198;hydroGZGroup.add(hydroLines.bVertical);

  // References: mean waterline + deck line + optional cross-section plane
  hydroLines.meanWaterline=new THREE.Line(new THREE.BufferGeometry(),makeLineMaterial(0x22d3ee,.95));hydroLines.meanWaterline.renderOrder=195;hydroReferenceGroup.add(hydroLines.meanWaterline);
  // Vertical centreline teaching stick removed from normal 3D presentation.
  hydroLines.centerline=null;
  hydroLines.deckLine=new THREE.Line(new THREE.BufferGeometry(),makeLineMaterial(0xe2e8f0,.38));hydroLines.deckLine.renderOrder=193;hydroReferenceGroup.add(hydroLines.deckLine);

  const planeGeo=new THREE.PlaneGeometry(B*1.45,D*2.15);
  const planeMat=new THREE.MeshBasicMaterial({color:0x0ea5e9,transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false});
  sectionPlane=new THREE.Mesh(planeGeo,planeMat);sectionPlane.renderOrder=20;hydroGroup.add(sectionPlane);sectionPlane.visible=!!hydroOptions.sectionPlane;

  weightArrow=createArrow(0xef4444);buoyancyArrow=createArrow(0x22c55e);
  hydroForcesGroup.add(weightArrow,buoyancyArrow);

  hydroSignature=`${(s.hullType||'general')}|${L.toFixed(2)}|${B.toFixed(2)}|${D.toFixed(2)}`;
  updateHydroVisibility();
}
function setVesselXRay(enabled){
  if(!shipVisual)return;
  shipVisual.traverse(obj=>{
    if(!obj.isMesh||obj===waterlineMarker)return;
    const isHull=obj.userData?.visualRole==='hullShell'||obj.name==='MainHullShell';
    const targetOpacity=isHull?(internalArrangementView?.17:.23):(internalArrangementView?.36:.44);
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    mats.forEach(m=>{
      if(m.userData.originalOpacity===undefined)m.userData.originalOpacity=m.opacity??1;
      if(m.userData.originalTransparent===undefined)m.userData.originalTransparent=!!m.transparent;
      m.transparent=enabled?true:m.userData.originalTransparent;
      m.opacity=enabled?Math.min(targetOpacity,m.userData.originalOpacity):m.userData.originalOpacity;
      m.depthWrite=!enabled;
      m.needsUpdate=true;
    });
  });
}
function updateHydroVisibility(){
  if(!hydroGroup)return;
  hydroGroup.visible=!!hydroOptions.master;
  if(hydroPointsGroup)hydroPointsGroup.visible=!!hydroOptions.points;
  if(hydroForcesGroup)hydroForcesGroup.visible=!!hydroOptions.forces;
  if(hydroGZGroup)hydroGZGroup.visible=!!hydroOptions.gz;
  if(hydroReferenceGroup)hydroReferenceGroup.visible=!!hydroOptions.references;
  if(hydroLabelsGroup)hydroLabelsGroup.visible=!!hydroOptions.labels;
  if(sectionPlane)sectionPlane.visible=!!hydroOptions.master&&!!hydroOptions.sectionPlane;
  setVesselXRay(!!hydroOptions.xray);
}
function setHydroOption(key,value){
  if(!(key in hydroOptions))return;
  hydroOptions[key]=!!value;
  if(key==='xray'){
    internalArrangementView=!!value;
    const ib=document.getElementById('internal3DViewBtn'),eb=document.getElementById('exterior3DViewBtn');
    if(ib){ib.classList.toggle('bg-violet-500/15',internalArrangementView);ib.classList.toggle('border-violet-400/40',internalArrangementView);ib.classList.toggle('bg-slate-900',!internalArrangementView);ib.classList.toggle('border-slate-700',!internalArrangementView);}
    if(eb){eb.classList.toggle('bg-cyan-500/15',!internalArrangementView);eb.classList.toggle('border-cyan-400/40',!internalArrangementView);eb.classList.toggle('bg-slate-900',internalArrangementView);eb.classList.toggle('border-slate-700',internalArrangementView);}
  }
  updateHydroVisibility();
}
function hydroPointWorld(key){
  const obj=hydroMarkers[key];if(!obj)return null;
  return obj.getWorldPosition(new THREE.Vector3());
}
function focusHydroPoint(key){
  const p=hydroPointWorld(key);if(!p||!camera||!controls||!latestState)return;
  const D=Math.max(3,+latestState.depth||10),B=Math.max(4,+latestState.beam||16);
  let dir=camera.position.clone().sub(controls.target);if(dir.lengthSq()<.01)dir.set(1,.4,1);dir.normalize();
  cameraTransitionTo(p.clone().add(dir.multiplyScalar(Math.max(D*2.8,B*2.2))),p,new THREE.Vector3(0,1,0),720);
  selectedInspectionObject=hydroMarkers[key]||null;showHydroInspector(key);
}
function resetOperationHighlights(){
  Object.values(ballastTankVisuals||{}).forEach(v=>{
    if(v.shell?.material){v.shell.material.opacity=.08;v.shell.material.needsUpdate=true;}
    if(v.outline?.material){v.outline.material.opacity=.90;v.outline.material.needsUpdate=true;}
  });
}
function highlightLngAdjacentBallast(d){
  if(!d)return [];const near=[];const span=Math.max((+d.length||0)*.62,(+latestState?.length||80)*.07);
  Object.values(ballastTankVisuals||{}).forEach(v=>{const od=v.operationData||{};if(Math.abs((+od.lcg||0)-(+d.lcg||0))<=span){near.push(od.name||od.id||v.key);if(v.shell?.material){v.shell.material.opacity=.24;v.shell.material.needsUpdate=true;}if(v.outline?.material){v.outline.material.opacity=.95;v.outline.material.needsUpdate=true;}}});
  return near.slice(0,8);
}
function closeInspector(){resetOperationHighlights();const p=document.getElementById('threeDInspector');if(p)p.classList.add('hidden');}
function showHydroInspector(key){
  const s=latestState,h=s?.hydro,u=s?.upright;if(!s||!h||h.invalid)return;
  const title=document.getElementById('threeDInspectorTitle'),body=document.getElementById('threeDInspectorBody'),panel=document.getElementById('threeDInspector');
  if(!title||!body||!panel)return;
  const info={
    K:['K · Keel Reference',`Reference point for vertical heights. In the current transverse section, K follows the vessel attitude. Current mean-waterline vertical position: ${bodyTransversePoint(s,0,0).y.toFixed(3)} m.`],
    B:['B · Centre of Buoyancy',`Current transverse centre of the submerged polygon. B moves as underwater geometry changes with heel. Current B: x ${h.bx.toFixed(3)} m · y ${h.by.toFixed(3)} m relative to mean waterline.`],
    G:['G · Corrected Centre of Gravity',`Combined weight centre using corrected KG and TCG. KGcorr ${s.kgCorr.toFixed(3)} m · TCG ${s.tcg>=0?'+':''}${s.tcg.toFixed(3)} m. Free-surface correction is included when enabled.`],
    M:['M₀ · Initial Transverse Metacentre',`Initial metacentre from upright KM ${u?.KM?.toFixed?.(3)??'—'} m. GM = KM − KG = ${s.gm.toFixed(3)} m. M₀ is an initial-stability reference, not a substitute for the finite-angle GZ curve.`]
  }[key];
  if(!info)return;
  if(cleanToolOpen)toggleCleanTool(cleanToolOpen);
  title.textContent=info[0];body.innerHTML=info[1];panel.classList.remove('hidden');
}
function updateHydroReadout(s){
  const el=document.getElementById('threeDHydroReadout');if(!el||!s?.hydro||s.hydro.invalid)return;
  const h=s.hydro,u=s.upright,ang=+s.heel||0,raw=Number.isFinite(s.operationalGZ)?s.operationalGZ:h.gz,gz=Math.abs(ang)<1e-9?0:Math.sign(ang)*raw,rm=(s.dispMass*9.81*gz)/1000,sense=Math.abs(ang)<.05||Math.abs(gz)<1e-5?'NEUTRAL':gz>0?'RIGHTING':'OVERTURNING';
  el.innerHTML=`Heel <b>${Math.abs(ang).toFixed(1)}° ${ang<0?'PORT':'STBD'}</b> · GM <b>${(+s.gm||0).toFixed(3)} m</b><br>`+
    `KG <b>${(+s.kgCorr||0).toFixed(3)}</b> · KB₀ <b>${u?.KB?.toFixed?.(3)??'—'}</b> · KM₀ <b>${u?.KM?.toFixed?.(3)??'—'} m</b><br>`+
    `GZ <b class="${gz>=0?'text-emerald-300':'text-rose-300'}">${gz>0?'+':''}${gz.toFixed(3)} m · ${sense}</b> · RM <b>${rm>=0?'+':''}${rm.toFixed(0)} MN·m</b>`;
}
function updateHydroOverlay(s){
  if(!s?.hydro||s.hydro.invalid||!s.upright)return;
  const sig=`${s.hullType||'general'}|${(+s.length||80).toFixed(2)}|${(+s.beam||16).toFixed(2)}|${(+s.depth||10).toFixed(2)}`;
  if(sig!==hydroSignature)buildHydroOverlay(s);
  const h=s.hydro,u=s.upright,Bm=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  const K=bodyTransversePoint(s,0,0);
  const Gp=new THREE.Vector3(h.gx,h.gy,0);
  const Bp=new THREE.Vector3(h.bx,h.by,0);
  const Mp=bodyTransversePoint(s,0,u.KM);
  const Q=new THREE.Vector3(h.bx,h.gy,0);

  hydroMarkers.K.position.copy(K);hydroMarkers.B.position.copy(Bp);hydroMarkers.G.position.copy(Gp);hydroMarkers.M.position.copy(Mp);

  // Labels are laid out in screen space so they remain separated as the camera moves.
  updateHydroMarkerPresentation();

  setLinePoints(hydroLines.gz,[Gp,Q]);
  const verticalSpan=Math.max(D*1.35,5);
  setLinePoints(hydroLines.gVertical,[new THREE.Vector3(Gp.x,Gp.y-verticalSpan*.55,0),new THREE.Vector3(Gp.x,Gp.y+verticalSpan*.75,0)]);
  setLinePoints(hydroLines.bVertical,[new THREE.Vector3(Bp.x,Bp.y-verticalSpan*.55,0),new THREE.Vector3(Bp.x,Bp.y+verticalSpan*.90,0)]);
  setLinePoints(hydroLines.meanWaterline,[new THREE.Vector3(-Bm*.82,0,0),new THREE.Vector3(Bm*.82,0,0)]);
  if(hydroLines.centerline)setLinePoints(hydroLines.centerline,[bodyTransversePoint(s,0,-D*.22),bodyTransversePoint(s,0,D*1.42)]);
  setLinePoints(hydroLines.deckLine,[bodyTransversePoint(s,-Bm*.50,D),bodyTransversePoint(s,Bm*.50,D)]);

  // Plane follows the ship's transverse section; it is only a visual reference.
  const mid=bodyTransversePoint(s,0,D*.55);
  sectionPlane.position.copy(mid);
  sectionPlane.rotation.set(0,0,-(+s.heel||0)*Math.PI/180);

  setArrow(weightArrow,Gp,new THREE.Vector3(0,-1,0),Math.max(D*.62,2.8));
  setArrow(buoyancyArrow,Bp,new THREE.Vector3(0,1,0),Math.max(D*.62,2.8));

  updateHydroReadout(s);
  updateHydroVisibility();
}
function installHydroPicking(){
  if(!renderer?.domElement)return;
  renderer.domElement.addEventListener('pointerdown',e=>{hydroPointerDown={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!hydroOptions.master||!hydroOptions.points||!hydroPointerDown)return;
    const moved=Math.hypot(e.clientX-hydroPointerDown.x,e.clientY-hydroPointerDown.y);hydroPointerDown=null;
    if(moved>5)return;
    const rect=renderer.domElement.getBoundingClientRect();
    hydroPointer.x=((e.clientX-rect.left)/rect.width)*2-1;
    hydroPointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
    hydroRaycaster.setFromCamera(hydroPointer,camera);
    const hydroHits=hydroOptions.master&&hydroOptions.points?hydroRaycaster.intersectObjects(Object.values(hydroMarkers),false):[];
    const opHits=operationOptions.master?hydroRaycaster.intersectObjects(operationPickables,false):[];
    const firstHydro=hydroHits[0],firstOp=opHits[0];

    if(interactionMode!=='inspect'){
      if(firstOp&&selectInteractiveObject(firstOp.object))return;
      return;
    }

    if(firstHydro&&(!firstOp||firstHydro.distance<=firstOp.distance)){
      const key=firstHydro.object.userData.hydroKey;
      if(inspectionOptions.autoFocus)focusHydroPoint(key);else showHydroInspector(key);
      return;
    }
    if(firstOp){showOperationInspector(firstOp.object);}
  });
}


function operationColor(name=''){
  const n=String(name).toLowerCase();
  if(n.includes('ballast'))return 0x0ea5e9;
  if(n.includes('passenger'))return 0xfacc15;
  if(n.includes('vehicle'))return 0xf97316;
  if(n.includes('container'))return 0x2563eb;
  if(n.includes('ore'))return 0x475569;
  if(n.includes('liquid')||n.includes('lng')||n.includes('cargo remaining'))return 0x0d9488;
  if(n.includes('flood'))return 0xe11d48;
  if(n.includes('machinery')||n.includes('project'))return 0x7c3aed;
  return 0x3b82f6;
}
function operationSprite(text,color='#ffffff',scale=1){
  const sp=makeLabelSprite(text,color,'rgba(2,6,23,.86)');
  sp.scale.multiplyScalar(scale);sp.userData.baseOperationScale=sp.scale.clone();
  sp.renderOrder=230;
  return sp;
}
function updateOperationLabelPresentation(){
  if(!camera||!operationsLabelsGroup)return;
  operationsLabelsGroup.children.forEach(sp=>{if(!sp.isSprite)return;const base=sp.userData.baseOperationScale;if(!base)return;const dist=camera.position.distanceTo(sp.getWorldPosition(new THREE.Vector3())),f=Math.max(.90,Math.min(1.18,dist/Math.max(34,(+latestState?.beam||16)*4.6)));sp.scale.copy(base).multiplyScalar(f);if(sp.material){sp.material.opacity=Math.max(.64,Math.min(1,1.12-dist/1200));}});
}
function operationMassSize(item,s){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const ratio=Math.max(0,Number(item.mass)||0)/Math.max(1,+s.dispMass||1);
  const f=Math.max(.65,Math.min(1.75,.65+Math.cbrt(ratio*18)));
  return {
    x:Math.min(B*.26,Math.max(B*.10,B*.12*f)),
    y:Math.min(D*.18,Math.max(D*.065,D*.075*f)),
    z:Math.min(L*.07,Math.max(L*.025,L*.032*f))
  };
}
function makeWireBox(size,color=0x38bdf8,opacity=.52){
  const g=new THREE.BoxGeometry(size.x,size.y,size.z);
  const e=new THREE.EdgesGeometry(g);
  const l=new THREE.LineSegments(e,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false}));
  l.renderOrder=170;return l;
}
function cylinderBetween(a,b,r,color,opacity=1){
  const mid=a.clone().add(b).multiplyScalar(.5);
  const len=a.distanceTo(b);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,16),makeMaterial(color,{transparent:opacity<1,opacity}));
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  mesh.castShadow=true;return mesh;
}
function clearOperations(){
  if(interactiveObject){try{deselectInteractiveObject(false);}catch(e){interactiveObject=null;}}
  // Remove every previous internal-arrangement group, not only the object currently
  // stored in operationsGroup. This prevents an orphaned General Cargo layout from
  // surviving a later Bulk/Tanker/Ro-Ro/etc. vessel change.
  if(shipRoot){
    const stale=shipRoot.children.filter(ch=>ch===operationsGroup||ch?.name==='3DOperations');
    stale.forEach(ch=>{try{shipRoot.remove(ch);disposeObject(ch);}catch(e){console.warn('AMCOL 3D stale space cleanup:',e);}});
  }
  operationsGroup=new THREE.Group();operationsGroup.name='3DOperations';
  cargo3DGroup=new THREE.Group();cargo3DGroup.name='CargoLoads3D';
  cargoSpaces3DGroup=new THREE.Group();cargoSpaces3DGroup.name='CargoSpaces3D';
  tanks3DGroup=new THREE.Group();tanks3DGroup.name='BallastSpaces3D';
  machinery3DGroup=new THREE.Group();machinery3DGroup.name='MachinerySpaces3D';
  crane3DGroup=new THREE.Group();damage3DGroup=new THREE.Group();operationsLabelsGroup=new THREE.Group();
  operationsGroup.add(cargoSpaces3DGroup,cargo3DGroup,tanks3DGroup,machinery3DGroup,crane3DGroup,damage3DGroup,operationsLabelsGroup);
  shipRoot?.add(operationsGroup);
  operationPickables=[];tankLiquidPivots=[];ballastTankVisuals={};
}
function hullVisualLimitsAt(s,z){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),type=s.hullType||'general';
  const zz=Math.max(-L*.485,Math.min(L*.485,z));
  const st=visualHullStationAtZ(zz,L,B,D,type);
  const keel=Math.max(0,st.keelRise||0);
  const deck=D+(st.sheer||0)+(st.keelRise||0);
  return {B,D,L,type,z:zz,st,keel,deck};
}
function fitVisualBoxToHull(s,box={},opts={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),type=s.hullType||'general';
  let w=Math.max(.12,+box.w||B*.20),h=Math.max(.08,+box.h||D*.20),l=Math.max(.20,+box.l||L*.08);
  let z=Math.max(-L*.465,Math.min(L*.465,+box.z||0));
  l=Math.min(l,L*.88);
  const zs=[z-Math.min(l*.42,L*.06),z,z+Math.min(l*.42,L*.06)].map(v=>Math.max(-L*.465,Math.min(L*.465,v)));
  const lims=zs.map(zz=>hullVisualLimitsAt(s,zz));
  const keel=Math.max(...lims.map(v=>v.keel));
  const deck=Math.min(...lims.map(v=>v.deck));
  const clearance=Math.max(.015*D,+opts.clearance||0);
  if(opts.openDeck){
    h=Math.min(h,D*.22);
    const deckY=Math.max(...lims.map(v=>v.deck));
    const y=deckY+h*.5+Math.max(.008*D,clearance*.35);
    let minHalf=Math.min(...zs.map(zz=>visualHullHalfBreadthAtDraft(hullVisualLimitsAt(s,zz).deck,zz,L,B,D,type)));
    minHalf=Math.max(B*.08,minHalf-clearance*.45);
    w=Math.min(w,Math.max(B*.08,minHalf*2));
    let x=Number.isFinite(+box.x)?+box.x:0;
    const maxX=Math.max(0,minHalf-w*.5);
    x=Math.max(-maxX,Math.min(maxX,x));
    return {x,y,z,w,h,l,keel,deck:deckY,openDeck:true};
  }
  const maxH=Math.max(D*.08,deck-keel-clearance*2);
  h=Math.min(h,maxH);
  let y=Number.isFinite(+box.y)?+box.y:keel+h*.5+clearance;
  y=Math.max(keel+h*.5+clearance,Math.min(deck-h*.5-clearance,y));
  const ySamples=[y-h*.42,y,y+h*.42];
  let minHalf=Infinity;
  zs.forEach(zz=>ySamples.forEach(yy=>{minHalf=Math.min(minHalf,visualHullHalfBreadthAtDraft(yy,zz,L,B,D,type));}));
  if(!Number.isFinite(minHalf))minHalf=B*.30;
  minHalf=Math.max(B*.06,minHalf-clearance);
  w=Math.min(w,Math.max(B*.08,minHalf*2));
  let x=Number.isFinite(+box.x)?+box.x:0;
  const maxX=Math.max(0,minHalf-w*.5);
  x=Math.max(-maxX,Math.min(maxX,x));
  return {x,y,z,w,h,l,keel,deck,openDeck:false};
}
function cargoSpaceVisualBox(s,sp={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const l=Math.max(.4,Math.min(L*.72,+sp.length||L*.10));
  let w=Math.max(.3,Math.min(B*.90,+sp.breadth||B*.55));
  const h=Math.max(.12,Math.min(D*.86,+sp.height||D*.45));
  const z=Math.max(-L*.46,Math.min(L*.46,-(+sp.lcg||0)));
  const openDeck=!!sp.openDeck||/deck cargo|open cargo/i.test(String(sp.type||''));
  const y=(+sp.bottom||0)+h*.5;
  if(sp.superstructure){
    // Enclosed Ro-Ro/PCC vehicle decks sit above the moulded hull deck inside the side shell.
    // Do not clamp these spaces back below D as the generic hull-envelope fitter would do.
    w=Math.min(w,B*.86);
    const xMax=Math.max(0,B*.43-w*.5),x=Math.max(-xMax,Math.min(xMax,+sp.tcg||0));
    return {x,y,z,w,h,l,keel:0,deck:D*1.82,openDeck:false,superstructure:true};
  }
  if(sp.ramp&&sp.superstructure){
    w=Math.min(w,B*.70);return {x:+sp.tcg||0,y,z,w,h,l,keel:0,deck:D*1.82,openDeck:false,superstructure:true};
  }
  return fitVisualBoxToHull(s,{x:+sp.tcg||0,y,z,w,h,l},{openDeck,clearance:D*.012});
}
function tankVisualClass(t={}){
  const k=`${t.type||''} ${t.name||''}`.toLowerCase();
  if(k.includes('peak'))return 'peak';
  if(k.includes('topside')||k.includes('top side'))return 'topside';
  if(k.includes('hopper'))return 'hopper';
  if(k.includes('double bottom')||/\bdb\b/.test(k))return 'doubleBottom';
  if(k.includes('wing')||k.includes('wbt')||k.includes('sbt'))return 'wing';
  if(k.includes('deep'))return 'deep';
  return 'custom';
}
function ballastTankVisualBox(s,t={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  let w=Math.max(.25,Math.min(B*.46,+t.breadth||B*.16));
  let l=Math.max(.4,Math.min(L*.18,+t.length||L*.08));
  let h=Math.max(.18,Math.min(D*.80,+t.height||D*.18));
  let x=+t.tcg||0,z=Math.max(-L*.46,Math.min(L*.46,-(+t.lcg||0))),bottom=+t.bottom||0;
  const cls=tankVisualClass(t),rep=String(t.source||'').toLowerCase().includes('representative')||String(t.id||'').startsWith('rep_');
  if(rep){
    const sign=t.side==='port'?-1:t.side==='starboard'?1:(x<0?-1:x>0?1:0);
    const lim=hullVisualLimitsAt(s,z);
    if(cls==='doubleBottom'){
      h=Math.min(h,D*.14);bottom=lim.keel+D*.025;x=sign*Math.max(Math.abs(x),B*.20);
    }else if(cls==='wing'){
      h=Math.min(h,D*.40);bottom=lim.keel+D*.18;x=sign*Math.max(Math.abs(x),B*.42);
    }else if(cls==='hopper'){
      h=Math.min(h,D*.22);bottom=lim.keel+D*.18;x=sign*Math.max(Math.abs(x),B*.35);
    }else if(cls==='topside'){
      h=Math.min(h,D*.18);bottom=Math.max(lim.keel+D*.66,lim.deck-h-D*.05);x=sign*Math.max(Math.abs(x),B*.35);
    }else if(cls==='deep'){
      h=Math.min(h,D*.40);bottom=lim.keel+D*.10;x=sign*Math.max(Math.abs(x),B*.27);
    }else if(cls==='peak'){
      h=Math.min(h,D*.34);bottom=lim.keel+D*.04;x=0;w=Math.min(w,B*.68);
    }
  }
  return fitVisualBoxToHull(s,{x,y:bottom+h*.5,z,w,h,l},{clearance:D*.010});
}
function machineryVisualBox(s,er={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const z=Math.max(-L*.445,Math.min(L*.445,-(+er.lcg||0)));
  const w=Math.min(B*.84,Math.max(B*.42,+er.breadth||B*.72));
  const h=Math.min(D*.72,Math.max(D*.24,+er.height||D*.56));
  const l=Math.min(L*.24,Math.max(L*.08,+er.length||L*.17));
  const lim=hullVisualLimitsAt(s,z);
  const bottom=Math.max(lim.keel+D*.04,+er.bottom||D*.06);
  return fitVisualBoxToHull(s,{x:0,y:bottom+h*.5,z,w,h,l},{clearance:D*.014});
}
function prismGeometryFromSection(points,length){
  if(!Array.isArray(points)||points.length<3)return new THREE.BoxGeometry(1,1,Math.max(.1,length||1));
  const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);
  shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.05,length),bevelEnabled:false,steps:1,curveSegments:1});
  g.translate(0,0,-Math.max(.05,length)/2);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function clipSectionBelow(points,yMax){
  if(!Array.isArray(points)||points.length<3)return [];
  const out=[];const inside=p=>p[1]<=yMax+1e-8;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],ia=inside(a),ib=inside(b);
    if(ia)out.push(a.slice());
    if(ia!==ib){const den=b[1]-a[1],t=Math.abs(den)<1e-9?0:(yMax-a[1])/den;out.push([a[0]+(b[0]-a[0])*t,yMax]);}
  }
  return out;
}
function sectionBounds(points){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
function cargoCompartmentSectionWorld(s,sp,v){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),type=s.hullType||'general',t=String(sp.type||'').toLowerCase();
  if(sp.superstructure||v.openDeck){
    const w=v.w,h=v.h,pts=t.includes('vehicle')||t.includes('ramp')?[[-w*.50,-h*.50],[w*.50,-h*.50],[w*.50,h*.50],[-w*.50,h*.50]]:t.includes('barge')||sp.hopper?[[-w*.30,-h*.50],[w*.30,-h*.50],[w*.50,h*.50],[-w*.50,h*.50]]:[[-w*.48,-h*.50],[w*.48,-h*.50],[w*.50,h*.50],[-w*.50,h*.50]];
    return {x:v.x,y:v.y,z:v.z,points:pts,length:v.l,height:v.h};
  }
  const z=v.z,lim=hullVisualLimitsAt(s,z),clear=D*.020,y0=Math.max(lim.keel+clear,+sp.bottom||lim.keel+clear),y1=Math.min(lim.deck-clear,y0+Math.max(D*.05,+sp.height||D*.45));
  const h=Math.max(D*.05,y1-y0),ym0=y0,ym1=y0+h*.22,ym2=y0+h*.70,yt=y1;
  const hb=y=>Math.max(B*.035,visualHullHalfBreadthAtDraft(y,z,L,B,D,type)-clear);
  const targetHalf=Math.max(B*.04,Math.min(B*.46,(+sp.breadth||B*.60)*.5));
  const sign=sp.side==='port'?-1:sp.side==='starboard'?1:(+sp.tcg<0?-1:+sp.tcg>0?1:0);
  let world=[];
  if(sign!==0&&(t.includes('tank')||t.includes('liquid')||t.includes('oil')||t.includes('chemical')||sp.underDeck)){
    // Paired cargo tanks retain the centreline bulkhead while the outer boundary follows hull fullness.
    const inner=sign*B*.015;
    const outer=y=>sign*Math.min(hb(y),Math.max(B*.14,Math.abs(+sp.tcg||B*.18)+targetHalf));
    world=[[inner,ym0],[outer(ym0),ym0],[outer(ym1),ym1],[outer(ym2),ym2],[outer(yt),yt],[inner,yt]];
  }else{
    // Centre holds/bays widen naturally with the hull instead of being globally shrunk by the lowest section.
    const half=y=>Math.min(targetHalf,hb(y));
    let b0=half(ym0),b1=half(ym1),b2=half(ym2),bt=half(yt);
    if(t.includes('bulk')){b0=Math.min(b0,targetHalf*.68);b1=Math.min(b1,targetHalf*.92);bt=Math.min(bt,targetHalf*.86);}
    if(t.includes('container'))b0=Math.min(b0,targetHalf*.82);
    if(t.includes('barge')||sp.hopper)b0=Math.min(b0,targetHalf*.60);
    world=[[-b0,ym0],[b0,ym0],[b1,ym1],[b2,ym2],[bt,yt],[-bt,yt],[-b2,ym2],[-b1,ym1]];
  }
  const cx=world.reduce((a,p)=>a+p[0],0)/world.length,cy=(ym0+yt)/2;
  return {x:cx,y:cy,z,points:world.map(p=>[p[0]-cx,p[1]-cy]),length:v.l,height:h};
}
function shellTankSection(s,t,v){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),type=s.hullType||'general',cls=tankVisualClass(t),sign=t.side==='port'?-1:t.side==='starboard'?1:(v.x<0?-1:v.x>0?1:0);
  const z=v.z,y0=v.y-v.h*.5,y1=v.y+v.h*.5,clear=D*.018,hb=y=>Math.max(B*.035,visualHullHalfBreadthAtDraft(y,z,L,B,D,type)-clear);
  if(cls==='doubleBottom'&&sign!==0){
    const inner=sign*B*.012,ob=sign*hb(y0),ot=sign*hb(y1),world=[[inner,y0],[ob,y0],[ot,y1],[inner,y1]],cx=world.reduce((a,p)=>a+p[0],0)/4,cy=(y0+y1)/2;
    return {x:cx,y:cy,z,points:world.map(p=>[p[0]-cx,p[1]-cy]),length:v.l};
  }
  if((cls==='wing'||cls==='hopper'||cls==='topside')&&sign!==0){
    const ob=sign*hb(y0),ot=sign*hb(y1),thick=Math.min(Math.max(B*.055,v.w),B*(cls==='wing'?.16:.14));
    const ib=ob-sign*thick*(cls==='hopper'?.70:.92),it=ot-sign*thick*(cls==='topside'?.70:.94),world=[[ib,y0],[ob,y0],[ot,y1],[it,y1]],cx=world.reduce((a,p)=>a+p[0],0)/4,cy=(y0+y1)/2;
    return {x:cx,y:cy,z,points:world.map(p=>[p[0]-cx,p[1]-cy]),length:v.l};
  }
  if(cls==='peak'){
    const wb=Math.max(B*.08,hb(y0)*1.72),wt=Math.max(B*.06,hb(y1)*1.72),cy=(y0+y1)/2;
    return {x:0,y:cy,z,points:[[-wb*.5,y0-cy],[wb*.5,y0-cy],[wt*.5,y1-cy],[-wt*.5,y1-cy]],length:v.l};
  }
  const cy=v.y;return {x:v.x,y:cy,z,points:[[-v.w*.50,-v.h*.50],[v.w*.50,-v.h*.50],[v.w*.50,v.h*.50],[-v.w*.50,v.h*.50]],length:v.l};
}
function makeCompartmentMesh(points,length,color,opacity=.14){
  const geo=prismGeometryFromSection(points,length),mesh=new THREE.Mesh(geo,makeMaterial(color,{transparent:true,opacity,roughness:.48,metalness:.02,depthWrite:false,side:THREE.DoubleSide}));mesh.renderOrder=38;return mesh;
}
function makeCompartmentEdges(points,length,color,opacity=.82){
  const geo=prismGeometryFromSection(points,length),edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false}));edge.renderOrder=176;return edge;
}
function makeFillMesh(points,length,fill,color,opacity=.48){
  const b=sectionBounds(points),pct=Math.max(0,Math.min(1,fill));if(pct<=.001)return null;
  const clipped=clipSectionBelow(points,b.minY+(b.maxY-b.minY)*pct);if(clipped.length<3)return null;
  const mesh=new THREE.Mesh(prismGeometryFromSection(clipped,Math.max(.03,length*.94)),makeMaterial(color,{transparent:true,opacity,roughness:.24,metalness:0,depthWrite:false,side:THREE.DoubleSide}));mesh.renderOrder=52;return mesh;
}
function lngTankVisualSpec(s,sp={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const rawD=Number(sp.diameter)||Math.min((Math.max(0,Number(sp.length)||0)||B*.72),(Math.max(0,Number(sp.breadth)||0)||B*.72),(Math.max(0,Number(sp.height)||0)||0)||B*.72);
  const d=Math.max(B*.18,Math.min(rawD||B*.72,B*.78,L*.18,D*1.72));
  const bottom=Number.isFinite(+sp.bottom)?+sp.bottom:Math.max(D*.04,D*.82-d*.5);
  const x=Number.isFinite(+sp.tcg)?+sp.tcg:0;
  const z=Math.max(-L*.46,Math.min(L*.46,-(+sp.lcg||0)));
  const centreY=Math.max(bottom+d*.5,D*.30);
  return {x,z,d,r:d*.5,bottom,centreY,top:centreY+d*.5};
}
function lngCargoSphereSpaces(spaces=[]){
  return (Array.isArray(spaces)?spaces:[]).filter(sp=>{
    if(!sp)return false;
    const type=String(sp.type||'').toLowerCase();
    return !!(sp.moss||sp.shape==='sphere'||(sp.containment&&type.includes('gas'))||type.includes('lng'));
  }).sort((a,b)=>(+a.lcg||0)-(+b.lcg||0));
}
function loadedLngCargoSphereSpaces(){
  const runtimeSpaces=Array.isArray(latestRuntime?.cargoSpaces)?latestRuntime.cargoSpaces:[];
  const runtimeLng=lngCargoSphereSpaces(runtimeSpaces);
  if(runtimeLng.length)return runtimeLng;
  return lngCargoSphereSpaces(cargoSpacesWithFill());
}
function lngExteriorTankVisualSpec(s,sp={}){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  const base=lngTankVisualSpec(s,sp),r=base.r;
  const scaleX=1.0,scaleY=.90,scaleZ=1.06;
  const visualCentreY=Math.max(base.bottom+base.d*.585,base.centreY+base.d*.055,D*.90);
  const visibleBottom=visualCentreY-r*scaleY;
  const supportTop=Math.max(base.bottom+D*.012,visibleBottom+D*.020);
  const topY=visualCentreY+r*scaleY;
  return {...base,scaleX,scaleY,scaleZ,visualCentreY,visibleBottom,supportTop,topY};
}
function buildCargoSpaces3D(s,spaces=[]){
  if(!Array.isArray(spaces)||!cargoSpaces3DGroup)return;
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  spaces.forEach((sp,i)=>{
    const color=(()=>{const t=String(sp.type||'').toLowerCase();if(t.includes('vehicle'))return 0x8b5cf6;if(t.includes('container'))return 0x3b82f6;if(t.includes('chemical'))return 0xd946ef;if(t.includes('oil')||t.includes('liquid'))return 0x14b8a6;if(t.includes('gas'))return 0x60a5fa;if(t.includes('deck'))return 0xf59e0b;if(t.includes('bulk'))return 0xa8a29e;return 0xf59e0b;})();
    const raw=Math.max(0,Number(sp.fillRawPercent)||0),fill=Math.min(1,raw/100);
    if(sp.moss||sp.shape==='sphere'){
      const spec=lngTankVisualSpec(s,sp),d=spec.d,centreY=spec.centreY,z=spec.z,x=spec.x;
      const room=new THREE.Mesh(new THREE.SphereGeometry(d*.5,28,20),makeMaterial(color,{transparent:true,opacity:.13,roughness:.54,metalness:.03,depthWrite:false,side:THREE.DoubleSide}));
      room.position.set(x,centreY,z);room.renderOrder=35;room.userData.operationType='cargoSpace';room.userData.operationData={...sp,visualConstrained:true,visualShape:'Moss sphere'};cargoSpaces3DGroup.add(room);operationPickables.push(room);
      const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(d*.5,16,12)),makeLineMaterial(color,.68));edge.position.copy(room.position);edge.material.depthTest=false;edge.renderOrder=176;edge.userData.operationType='cargoSpace';edge.userData.operationData=room.userData.operationData;cargoSpaces3DGroup.add(edge);operationPickables.push(edge);
      if(fill>0){const fd=d*Math.max(.16,Math.cbrt(fill))*.88,inner=new THREE.Mesh(new THREE.SphereGeometry(fd*.5,22,16),makeMaterial(color,{transparent:true,opacity:.34,depthWrite:false}));inner.position.set(x,centreY-d*.18*(1-fill),z);inner.renderOrder=52;cargoSpaces3DGroup.add(inner);}
      if(i<18){const lbl=operationSprite(
                `${sp.name||'Moss tank'} · ${fillPercentLabel(raw)}`,raw>100.05?'#fda4af':'#bfdbfe',Math.max(.38,Math.min(.60,B/34))
      );lbl.position.set(x,centreY+d*.58,z);operationsLabelsGroup.add(lbl);}return;
    }
    const v=cargoSpaceVisualBox(s,sp),sec=cargoCompartmentSectionWorld(s,sp,v),points=sec.points;
    const room=makeCompartmentMesh(points,sec.length,color,.12);room.position.set(sec.x,sec.y,sec.z);room.userData.operationType='cargoSpace';room.userData.operationData={...sp,visualConstrained:true,visualShape:sp.superstructure?'enclosed deck compartment':'hull-conforming compartment'};cargoSpaces3DGroup.add(room);operationPickables.push(room);
    const edge=makeCompartmentEdges(points,sec.length,color,.82);edge.position.copy(room.position);edge.userData.operationType='cargoSpace';edge.userData.operationData=room.userData.operationData;cargoSpaces3DGroup.add(edge);operationPickables.push(edge);
    const filled=makeFillMesh(points,sec.length,fill,color,.34);if(filled){filled.position.copy(room.position);cargoSpaces3DGroup.add(filled);}
    const sb=sectionBounds(points);if(i<20){const lbl=operationSprite(`${sp.name||'Cargo space'} · ${fillPercentLabel(raw)}`,raw>100.05?'#fda4af':'#fde68a',Math.max(.40,Math.min(.64,B/32)));lbl.position.set(sec.x,sec.y+sb.maxY+D*.06,sec.z);operationsLabelsGroup.add(lbl);}
  });
}
function buildCargo3D(s,cargoItems,spaces=[]){
  if(!Array.isArray(cargoItems))return;
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),spaceMap=new Map((Array.isArray(spaces)?spaces:[]).map(sp=>[String(sp.id),sp]));
  cargoItems.forEach((item,i)=>{
    if(String(item.id||'').startsWith('ballast_lab_')||item.hide3D||String(item.cargoKey||'').toLowerCase()==='empty')return;
    const mass=Math.max(0,+item.mass||0),enteredFill=Math.max(0,+item.fill||0);if(mass<=.001&&enteredFill<=.001)return;
    const color=operationColor(item.name),assigned=spaceMap.get(String(item.spaceId||'')),cls=String(item.physicsClass||'').toLowerCase();
    // Volumetric cargo is already shown as the correctly clipped fill body inside its compartment.
    if(assigned&&['bulk','grain','liquefiable','liquid','gas'].includes(cls))return;
    let size=operationMassSize(item,s),v;const fill=Math.max(.02,Math.min(1,enteredFill/100));
    if(assigned){
      if(assigned.moss||assigned.shape==='sphere')return;
      const sv=cargoSpaceVisualBox(s,assigned),desiredY=Number.isFinite(+item.vcg)?+item.vcg:sv.y;
      v=assigned.superstructure?{x:sv.x,y:desiredY,z:sv.z,w:Math.min(size.x,sv.w*.72),h:Math.min(size.y,sv.h*.70),l:Math.min(size.z,sv.l*.55),openDeck:false}:fitVisualBoxToHull(s,{x:sv.x,y:desiredY,z:sv.z,w:Math.min(size.x,sv.w*.75),h:Math.min(size.y,sv.h*.70),l:Math.min(size.z,sv.l*.65)},{openDeck:sv.openDeck,clearance:D*.012});
    }else{
      const z=Math.max(-L*.46,Math.min(L*.46,-(+item.lcg||0))),lim=hullVisualLimitsAt(s,z),openDeck=(+item.vcg||0)>lim.deck+D*.02;
      v=fitVisualBoxToHull(s,{x:+item.tcg||0,y:+item.vcg||size.y*.5,z,w:size.x,h:size.y,l:size.z},{openDeck,clearance:D*.012});
    }
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(v.w,v.h,v.l),makeMaterial(color,{roughness:.48,metalness:.05,transparent:true,opacity:.90}));mesh.position.set(v.x,v.y,v.z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.operationType='cargo';mesh.userData.operationData={...item,visualConstrained:true};cargo3DGroup.add(mesh);operationPickables.push(mesh);
    const holdFill=assigned?fillPercentLabel(Number(assigned.fillRawPercent)||0):'';const sp=operationSprite(`${item.name||'Cargo'} · ${Math.round(mass)}t${holdFill?' · '+holdFill:''}`,`#${color.toString(16).padStart(6,'0')}`,Math.max(.55,Math.min(1.0,B/24)));sp.position.set(v.x,v.y+v.h*.80,v.z);operationsLabelsGroup.add(sp);
  });
}
function buildTank3D(s,plan=[]){
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),tanks=Array.isArray(plan)&&plan.length?plan:[];
  tanks.forEach((t,i)=>{
    const key=String(t.id||t.key||`tank_${i}`),v=ballastTankVisualBox(s,t),sec=shellTankSection(s,t,v),fillPct=Math.max(0,Math.min(100,+t.fill||0)),fill=fillPct/100;
    const pivot=new THREE.Group();pivot.position.set(sec.x,sec.y,sec.z);pivot.name=`VesselBallastTank:${key}`;tanks3DGroup.add(pivot);
    const operationData={id:key,index:i+1,name:t.name,type:t.type,fill:fillPct,length:sec.length,breadth:v.w,height:v.h,density:+t.density||1.025,lcg:+t.lcg||0,tcg:+t.tcg||0,capacity:+t.capacity||0,visualConstrained:true,visualShape:tankVisualClass(t)};
    const shell=makeCompartmentMesh(sec.points,sec.length,0x0ea5e9,.08);shell.userData.operationType='tank';shell.userData.operationData=operationData;pivot.add(shell);operationPickables.push(shell);
    const outline=makeCompartmentEdges(sec.points,sec.length,0x38bdf8,.90);outline.userData.operationType='tank';outline.userData.operationData=operationData;pivot.add(outline);operationPickables.push(outline);
    const liquidPivot=new THREE.Group();liquidPivot.name=`VesselBallastLiquid:${key}`;pivot.add(liquidPivot);
    let liquid=null;
    if(fill>0){liquid=makeFillMesh(sec.points,sec.length,fill,0x0284c7,.48);if(liquid){liquid.userData.operationType='tank';liquid.userData.operationData=operationData;liquidPivot.add(liquid);operationPickables.push(liquid);}}
    const fsEntry={pivot:liquidPivot,slack:fill>0&&fill<1,index:i,breadth:v.w};tankLiquidPivots.push(fsEntry);
    let label=null;
    if(i<22){label=operationSprite(`${t.name||'Ballast tank'} · ${fillPercentLabel(fillPct)}`,'#7dd3fc',Math.max(.42,Math.min(.68,B/31)));const b=sectionBounds(sec.points);label.position.set(sec.x,sec.y+b.maxY+D*.07,sec.z);operationsLabelsGroup.add(label);}
    ballastTankVisuals[key]={key,pivot,shell,outline,liquidPivot,liquid,label,sectionPoints:sec.points.map(p=>[p[0],p[1]]),length:sec.length,breadth:v.w,freeSurfaceEntry:fsEntry,operationData,lastFill:fill};
  });
}
function buildMachinery3D(s,er=null){
  if(!er)return;
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80),v=machineryVisualBox(s,er),z=v.z,clear=D*.018,y0=v.y-v.h*.5,y1=v.y+v.h*.5;
  const half=y=>Math.min((+er.breadth||B*.70)*.5,Math.max(B*.05,visualHullHalfBreadthAtDraft(y,z,L,B,D,s.hullType||'general')-clear));
  const ym=y0+(y1-y0)*.28,b0=half(y0),bm=half(ym),bt=half(y1),cy=(y0+y1)/2,pts=[[-b0,y0-cy],[b0,y0-cy],[bm,ym-cy],[bt,y1-cy],[-bt,y1-cy],[-bm,ym-cy]];
  const room=makeCompartmentMesh(pts,v.l,0xf97316,.24);room.position.set(0,cy,z);room.renderOrder=52;room.userData.operationType='machinery';room.userData.operationData={label:er.label||'Engine Room',lcg:+er.lcg||0,length:v.l,breadth:Math.max(b0,bm,bt)*2,height:y1-y0,source:er.source||'representative',visualConstrained:true,visualShape:'hull-conforming machinery space'};machinery3DGroup.add(room);operationPickables.push(room);
  const edge=makeCompartmentEdges(pts,v.l,0xfb923c,.96);edge.position.copy(room.position);edge.userData.operationType='machinery';edge.userData.operationData=room.userData.operationData;machinery3DGroup.add(edge);operationPickables.push(edge);
  const sp=operationSprite(er.label||'Engine Room','#fdba74',Math.max(.58,Math.min(.92,B/25)));sp.position.set(0,y1+D*.07,z);operationsLabelsGroup.add(sp);
}
function buildCrane3D(s){
  if(!s.crane)return;
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  const z=Math.max(-L*.42,Math.min(L*.42,-(+s.craneLCG||0)));
  const side=(+s.craneSide||0),out=Math.max(0,+s.craneOutreach||0)*side;
  const deckY=hullVisualLimitsAt(s,z).deck;
  const hookH=Math.max(deckY+D*.30,+s.craneHeight||D*1.5);
  const base=new THREE.Vector3(0,deckY+D*.015,z);
  const elbow=new THREE.Vector3(out*.32,deckY+D*.36,z);
  const hook=new THREE.Vector3(out,hookH,z);

  const mast=cylinderBetween(base,elbow,Math.max(.08,B*.025),0x8b5cf6);crane3DGroup.add(mast);
  const boom=cylinderBetween(elbow,hook,Math.max(.07,B*.020),0xc084fc);crane3DGroup.add(boom);

  const hookMarker=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.13,B*.035),18,12),makeOverlayMaterial(0xf0abfc,.98));
  hookMarker.position.copy(hook);hookMarker.userData.operationType='crane';hookMarker.userData.operationRole='hook';hookMarker.userData.operationData={mass:+s.craneMass||0,height:+s.craneHeight||0,outreach:+s.craneOutreach||0,side:+s.craneSide||0,lcg:+s.craneLCG||0};
  crane3DGroup.add(hookMarker);operationPickables.push(hookMarker);

  const cableBottom=hook.clone().add(new THREE.Vector3(0,-Math.max(.7,D*.30),0));
  const cable=cylinderBetween(hook,cableBottom,Math.max(.02,B*.006),0xe2e8f0,.85);crane3DGroup.add(cable);
  const loadSize=Math.max(.45,Math.min(B*.18,B*.07+Math.cbrt(Math.max(1,+s.craneMass||1))*.035));
  const load=new THREE.Mesh(new THREE.BoxGeometry(loadSize,loadSize*.65,loadSize),makeMaterial(0x7c3aed,{roughness:.46}));
  load.position.copy(cableBottom);load.castShadow=true;
  load.userData.operationType='crane';load.userData.operationRole='load';load.userData.operationData=hookMarker.userData.operationData;
  crane3DGroup.add(load);operationPickables.push(load);

  const sp=operationSprite(`Suspended ${Math.round(+s.craneMass||0)}t · hook ${(+s.craneHeight||0).toFixed(1)}m`,'#e9d5ff',Math.max(.58,Math.min(.9,B/24)));
  sp.position.copy(hook.clone().add(new THREE.Vector3(0,D*.22,0)));operationsLabelsGroup.add(sp);
}
function buildDamage3D(s){
  if(!s.damage)return;
  const B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10),L=Math.max(20,+s.length||80);
  let x=0,y=D*.25,z=0,w=B*.20,h=D*.35,l=L*.20;
  if(s.damageMode==='added'){
    x=Math.max(-B*.46,Math.min(B*.46,+s.dmgTCG||0));
    y=Math.max(h*.5,Math.min(D*.88,+s.dmgVCG||D*.25));
  }else{
    const sign=(+s.damageSide||1)>=0?1:-1;
    w=Math.max(B*.08,B*Math.max(.05,(+s.damageWidth||20)/100));
    h=Math.max(D*.12,D*Math.max(.10,(+s.damageHeight||50)/100));
    x=sign*(B*.5-w*.5);
    y=h*.5;
  }

  const flood=new THREE.Mesh(
    new THREE.BoxGeometry(w,h,l),
    makeMaterial(0xe11d48,{transparent:true,opacity:.28,roughness:.25,emissive:0x4c0519,emissiveIntensity:.55})
  );
  flood.position.set(x,y,z);flood.renderOrder=60;
  flood.userData.operationType='damage';
  flood.userData.operationData={
    mode:s.damageMode, mass:+s.dmgMass||0, vcg:+s.dmgVCG||0, tcg:+s.dmgTCG||0,
    side:+s.damageSide||1,width:+s.damageWidth||0,height:+s.damageHeight||0,permeability:+s.damagePerm||0
  };
  damage3DGroup.add(flood);operationPickables.push(flood);

  const edge=makeWireBox(new THREE.Vector3(w,h,l),0xfb7185,.90);edge.position.copy(flood.position);
  edge.userData.operationType='damage';edge.userData.operationData=flood.userData.operationData;
  damage3DGroup.add(edge);operationPickables.push(edge);

  const label=s.damageMode==='added'?`Added floodwater · ${Math.round(+s.dmgMass||0)}t`:`Lost buoyancy · ${((+s.damageWidth||0)).toFixed(0)}% side width`;
  const sp=operationSprite(label,'#fda4af',Math.max(.58,Math.min(.95,B/24)));sp.position.set(x,y+h*.68,z);operationsLabelsGroup.add(sp);
}
function operationStateSignature(s,cargoItems,ballastPlan=[],engineRoom=null,cargoSpaces=[]){
  const cargo=(Array.isArray(cargoItems)?cargoItems:[]).filter(it=>!String(it.id||'').startsWith('ballast_lab_')).map(it=>[it.id,it.name,+it.mass||0,+it.vcg||0,+it.tcg||0,+it.lcg||0,+it.fill||0,it.spaceId||'',+it.quantity||0,+it.density||0].join(':')).join('|');
  const tanks=(Array.isArray(ballastPlan)?ballastPlan:[]).map(t=>[t.id,t.name,t.type,+t.capacity||0,+t.fill||0,+t.lcg||0,+t.tcg||0,+t.bottom||0,+t.length||0,+t.breadth||0,+t.height||0].join(':')).join('|');
  const spaces=(Array.isArray(cargoSpaces)?cargoSpaces:[]).map(sp=>[sp.id,sp.name,sp.type,+sp.lcg||0,+sp.tcg||0,+sp.bottom||0,+sp.length||0,+sp.breadth||0,+sp.height||0,+sp.fillRawPercent||0].join(':')).join('|');
  const er=engineRoom?[engineRoom.label,+engineRoom.lcg||0,+engineRoom.length||0,+engineRoom.breadth||0,+engineRoom.height||0].join(':'):'';
  return [s.hullType,s.spaceLayoutRevision||0,s.spaceLayoutFamily||s.hullType,s.length,s.beam,s.depth,s.ballastPlanSource||'',cargo,tanks,spaces,er,s.crane,s.craneMass,s.craneHeight,s.craneOutreach,s.craneSide,s.craneLCG,s.damage,s.damageMode,s.dmgMass,s.dmgVCG,s.dmgTCG,s.damageSide,s.damageWidth,s.damageHeight,s.damagePerm].join('~');
}
function buildOperations(s,cargoItems=[],ballastPlan=[],engineRoom=null,cargoSpaces=[]){
  clearOperations();buildCargoSpaces3D(s,cargoSpaces);buildCargo3D(s,cargoItems,cargoSpaces);buildTank3D(s,ballastPlan);buildMachinery3D(s,engineRoom);buildCrane3D(s);buildDamage3D(s);operationSignature=operationStateSignature(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);updateOperationVisibility();updateOperationsReadout(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);if(ballastLab.active)buildBallastLabVisuals();
}
function updateOperationVisibility(){
  if(!operationsGroup)return;
  operationsGroup.visible=!!operationOptions.master;
  cargo3DGroup.visible=!!operationOptions.cargo;
  if(cargoSpaces3DGroup)cargoSpaces3DGroup.visible=!!operationOptions.cargoSpaces;
  tanks3DGroup.visible=!!operationOptions.tanks;
  if(ballastLabGroup)ballastLabGroup.visible=!!operationOptions.tanks;
  if(machinery3DGroup)machinery3DGroup.visible=!!operationOptions.machinery;
  crane3DGroup.visible=!!operationOptions.crane;
  damage3DGroup.visible=!!operationOptions.damage;
  operationsLabelsGroup.visible=!!operationOptions.labels;
}
function setOperationOption(key,value){
  if(!(key in operationOptions))return;
  operationOptions[key]=!!value;updateOperationVisibility();
}
function applyVisualLayerPreset(name='full'){
  visualLayerPreset=['clean','stability','loading','internal','full'].includes(name)?name:'full';
  const setOps=(master,cargo,cargoSpaces,tanks,machinery,crane,damage,labels)=>Object.assign(operationOptions,{master,cargo,cargoSpaces,tanks,machinery,crane,damage,labels});
  if(visualLayerPreset==='clean'){
    Object.assign(hydroOptions,{master:false,xray:false});setOps(false,false,false,false,false,false,false,false);internalArrangementView=false;
  }else if(visualLayerPreset==='stability'){
    Object.assign(hydroOptions,{master:true,points:true,forces:true,gz:true,references:true,labels:true,sectionPlane:false,xray:false});setOps(false,false,false,false,false,false,false,false);internalArrangementView=false;
  }else if(visualLayerPreset==='loading'){
    Object.assign(hydroOptions,{master:false,xray:true});setOps(true,true,true,true,false,false,false,true);internalArrangementView=true;
  }else if(visualLayerPreset==='internal'){
    Object.assign(hydroOptions,{master:false,xray:true});setOps(true,true,true,true,true,true,true,true);internalArrangementView=true;
  }else{
    Object.assign(hydroOptions,{master:true,points:true,forces:true,gz:true,references:true,labels:true,sectionPlane:false,xray:false});setOps(true,true,true,true,true,true,true,true);internalArrangementView=false;
  }
  const hm=document.getElementById('hydroMasterToggle');if(hm)hm.checked=hydroOptions.master;
  const om=document.getElementById('operationsMasterToggle');if(om)om.checked=operationOptions.master;
  const xr=document.getElementById('hydroXRayToggle');if(xr)xr.checked=hydroOptions.xray;
  const st=document.getElementById('threeDVisualLayerStatus');if(st)st.textContent=({clean:'CLEAN VESSEL',stability:'BASIC STABILITY',loading:'LOADING',internal:'INTERNAL',full:'FULL TEACHING'})[visualLayerPreset];
  updateOperationVisibility();updateHydroVisibility();setVesselXRay(hydroOptions.xray);updateOperations._readoutSig='';
  if(latestState)updateOperationsReadout(latestState,latestRuntime?.cargoItems||[],latestRuntime?.ballastTanks||[],latestRuntime?.engineRoom||null,latestRuntime?.cargoSpaces||[]);
}

function setInternalArrangementView(enabled=true){
  internalArrangementView=!!enabled;
  hydroOptions.xray=internalArrangementView;
  operationOptions.master=true;operationOptions.cargoSpaces=true;operationOptions.tanks=true;operationOptions.machinery=true;operationOptions.labels=true;
  const xr=document.getElementById('hydroXRayToggle');if(xr)xr.checked=hydroOptions.xray;
  const ib=document.getElementById('internal3DViewBtn'),eb=document.getElementById('exterior3DViewBtn');
  if(ib){ib.classList.toggle('bg-violet-500/15',internalArrangementView);ib.classList.toggle('border-violet-400/40',internalArrangementView);ib.classList.toggle('bg-slate-900',!internalArrangementView);ib.classList.toggle('border-slate-700',!internalArrangementView);}
  if(eb){eb.classList.toggle('bg-cyan-500/15',!internalArrangementView);eb.classList.toggle('border-cyan-400/40',!internalArrangementView);eb.classList.toggle('bg-slate-900',internalArrangementView);eb.classList.toggle('border-slate-700',internalArrangementView);}
  updateOperationVisibility();updateHydroVisibility();updateOperations._readoutSig='';
  if(latestState){updateOperations(latestState,latestRuntime);setCameraPreset('starboard');}
}
function updateTankFreeSurface(s){
  if(!tankLiquidPivots.length)return;
  const heel=THREE.MathUtils.degToRad(+s.heel||0);
  const trim=THREE.MathUtils.degToRad(+s.trimAngle||0);
  const T=Math.max(.25,+s.wavePeriod||5),H=s.waveEnabled?Math.max(0,+s.waveHeight||0):0;
  const wavePitch=THREE.MathUtils.degToRad(H*.22*((s.waveHeading==='head'||s.waveHeading==='following')?1:(s.waveHeading==='quartering'?.62:.08))*Math.sin(2*Math.PI*clock.elapsedTime/T+Math.PI*.5));
  tankLiquidPivots.forEach((entry,i)=>{
    if(entry.slack){
      // Parent vessel rotates -heel and (-trim + wavePitch); inverse rotation keeps the liquid surface approximately earth-horizontal.
      entry.pivot.rotation.z=heel;
      entry.pivot.rotation.x=trim-wavePitch;
      entry.pivot.position.x=Math.sin(heel)*Math.min((+entry.breadth||+s.tankBreadth||4)*.08,.45);
    }else{
      entry.pivot.rotation.set(0,0,0);entry.pivot.position.x=0;
    }
  });
}
function updateOperationsReadout(s,cargoItems=[],ballastPlan=[],engineRoom=null,cargoSpaces=[]){
  const el=document.getElementById('threeDOperationsReadout');if(!el)return;const n=Array.isArray(cargoItems)?cargoItems.filter(it=>!String(it.id||'').startsWith('ballast_lab_')).length:0,tanks=Array.isArray(ballastPlan)?ballastPlan:[],spaces=Array.isArray(cargoSpaces)?cargoSpaces:[],slack=tanks.filter(t=>(+t.fill||0)>0&&(+t.fill||0)<100).length,crane=s.crane?`${(+s.craneMass||0).toFixed(0)}t @ ${(+s.craneHeight||0).toFixed(1)}m / ${(+s.craneOutreach||0).toFixed(1)}m`:'OFF',damage=s.damage?`${String(s.damageMode).toUpperCase()}`:'OFF';
  const loadedSpaces=spaces.filter(sp=>Number(sp.fillRawPercent||0)>.05).length,overSpaces=spaces.filter(sp=>Number(sp.fillRawPercent||0)>100.05).length;el.innerHTML=`<span class="${internalArrangementView?'text-violet-300':'text-slate-400'}"><b>${internalArrangementView?'INTERNAL ARRANGEMENT':'EXTERIOR VIEW'}</b></span> · ${(s.spaceLayoutLabel||s.hullType||'general').toUpperCase()} · REV ${s.spaceLayoutRevision||0}<br>Cargo spaces <b>${spaces.length}</b> · loaded <b>${loadedSpaces}</b>${overSpaces?` · <span class="text-rose-300">${overSpaces} OVER</span>`:''} · movable loads <b>${n}</b><br>Ballast arrangement <b>${tanks.length} tanks${slack?` · ${slack} slack`:''}</b> · machinery <b>${engineRoom?.label||'Engine Room'}</b><br>Vessel TCG <b>${(+s.tcg||0)>=0?'+':''}${(+s.tcg||0).toFixed(2)}m</b> · LCG <b>${(+s.lcg||0)>=0?'+':''}${(+s.lcg||0).toFixed(2)}m</b><br>Crane <b>${crane}</b> · Damage <b>${damage}</b>`;
}
function showOperationInspector(obj){
  if(interactionMode!=='inspect')return;resetOperationHighlights();
  const d=obj?.userData?.operationData,type=obj?.userData?.operationType;if(!d||!type)return;
  const title=document.getElementById('threeDInspectorTitle'),body=document.getElementById('threeDInspectorBody'),panel=document.getElementById('threeDInspector');
  if(!title||!body||!panel)return;
  if(type==='ballastLab'){
    const t=ballastLab.tanks[d.key]||d;title.textContent=`Ballast Tank ${t.key} · ${t.name||''}`;
    body.innerHTML=`Mass <b>${(+t.mass||0).toFixed(1)} t</b><br>Fill <b>${((+t.mass||0)/Math.max(1,+t.capacity||1)*100).toFixed(0)}%</b><br>TCG <b>${(+t.tcg||0)>=0?'+':''}${(+t.tcg||0).toFixed(2)} m</b> · LCG <b>${(+t.lcg||0)>=0?'+':''}${(+t.lcg||0).toFixed(2)} m</b><br><span class="text-cyan-300">Partly filled tanks contribute to the Phase-8 slack-tank count when FSC coupling is enabled.</span>`;
  }else if(type==='cargo'){
    title.textContent=`Cargo · ${d.name||'Load'}`;
    body.innerHTML=`Mass <b>${(+d.mass||0).toFixed(0)} t</b><br>VCG <b>${(+d.vcg||0).toFixed(2)} m</b><br>TCG <b>${(+d.tcg||0)>=0?'+':''}${(+d.tcg||0).toFixed(2)} m</b><br>LCG <b>${(+d.lcg||0)>=0?'+':''}${(+d.lcg||0).toFixed(2)} m</b><br><span class="text-slate-500">+TCG = Starboard · +LCG = Forward. Block size is illustrative; moments use the entered values.</span>`;
  }else if(type==='tank'){
    const slack=d.fill>0&&d.fill<100;
    title.textContent=`Tank ${d.index||''} · ${slack?'Slack':'Non-slack'} condition`;
    body.innerHTML=`Fill <b>${(+d.fill||0).toFixed(0)}%</b><br>Liquid density <b>${(+d.density||0).toFixed(3)} t/m³</b><br>${slack?'<span class="text-cyan-300">The visible liquid surface is kept approximately horizontal as the ship heels.</span>':'Full or empty tanks do not create an ideal free liquid surface.'}<br><span class="text-slate-500">The simulator FSC still comes from the rectangular-tank free-surface model.</span>`;
  }else if(type==='cargoSpace'){
    title.textContent=d.name||'Cargo Space';
    const isLng=!!(d.moss||d.shape==='sphere'||String(d.type||'').toLowerCase().includes('gas')||String(d.type||'').toLowerCase().includes('lng'));
    const adjacent=isLng?highlightLngAdjacentBallast(d):[];
    body.innerHTML=`Type <b>${d.type||'Cargo space'}</b><br>Fill <b class="${Number(d.fillRawPercent||0)>100.05?'text-rose-300':'text-cyan-300'}">${Number(d.fillRawPercent||0)>100.05?Number(d.fillRawPercent).toFixed(0)+'% OVER':Number(d.fillRawPercent||0).toFixed(0)+'% FULL'}</b>${Number(d.fillMass)>0?` · cargo ${Number(d.fillMass).toFixed(0)} t`:''}<br>LCG <b>${(+d.lcg||0)>=0?'+':''}${(+d.lcg||0).toFixed(2)} m</b> · TCG <b>${(+d.tcg||0)>=0?'+':''}${(+d.tcg||0).toFixed(2)} m</b><br>Length <b>${(+d.length||0).toFixed(1)} m</b> · Breadth <b>${(+d.breadth||0).toFixed(1)} m</b> · Height <b>${(+d.height||0).toFixed(1)} m</b>${isLng?`<br><span class="text-cyan-300">Moss containment visual: deck collar, support, access platform and pipe tower are aligned in a simplified way to this cargo-space geometry.</span>${adjacent.length?`<br>Adjacent ballast spaces highlighted: <b>${adjacent.join(' · ')}</b>`:''}`:''}<br><span class="text-amber-300">${d.source==='AMCOL TRAINING MODEL'?'AMCOL training geometry':(d.reference?'Reference-informed geometry · '+d.reference:'Reference-informed representative geometry')}. Use the vessel GA/capacity plan for exact boundaries.</span>`;
  }else if(type==='machinery'){
    title.textContent=d.label||'Engine Room';
    body.innerHTML=`Representative machinery space<br>LCG <b>${(+d.lcg||0)>=0?'+':''}${(+d.lcg||0).toFixed(2)} m</b><br>Length <b>${(+d.length||0).toFixed(1)} m</b> · Breadth <b>${(+d.breadth||0).toFixed(1)} m</b> · Height <b>${(+d.height||0).toFixed(1)} m</b><br><span class="text-orange-300">Machinery location is a vessel-family teaching arrangement unless verified from the vessel general arrangement plan.</span>`;
  }else if(type==='crane'){
    title.textContent='Suspended Crane Load';
    const side=(+d.side||0)>0?'Starboard':(+d.side||0)<0?'Port':'Centre';
    body.innerHTML=`Load <b>${(+d.mass||0).toFixed(0)} t</b><br>Hook height <b>${(+d.height||0).toFixed(1)} m</b><br>Outreach <b>${(+d.outreach||0).toFixed(1)} m</b> · ${side}<br>LCG <b>${(+d.lcg||0)>=0?'+':''}${(+d.lcg||0).toFixed(1)} m</b><br><span class="text-violet-300">For stability, the suspended load acts at the point of suspension.</span>`;
  }else if(type==='damage'){
    title.textContent=`Damage · ${String(d.mode).replaceAll('_',' ')}`;
    body.innerHTML=d.mode==='added'
      ? `Added floodwater mass <b>${(+d.mass||0).toFixed(0)} t</b><br>VCG <b>${(+d.vcg||0).toFixed(2)} m</b> · TCG <b>${(+d.tcg||0).toFixed(2)} m</b><br><span class="text-rose-300">This increases displacement and shifts G.</span>`
      : `Damaged side <b>${(+d.side||1)>0?'Starboard':'Port'}</b><br>Width <b>${(+d.width||0).toFixed(0)}%</b> · height <b>${(+d.height||0).toFixed(0)}%</b><br>Permeability <b>${(+d.permeability||0).toFixed(2)}</b><br><span class="text-rose-300">This is the simulator's simplified lost-buoyancy teaching model.</span>`;
  }
  if(cleanToolOpen)toggleCleanTool(cleanToolOpen);
  panel.classList.remove('hidden');
  selectedInspectionObject=obj;
  if(inspectionOptions.autoFocus)focusObject3D(obj,650);
}
function cloneRuntimeFor3D(runtime={}){
  return {
    ...runtime,
    cargoItems:Array.isArray(runtime.cargoItems)?runtime.cargoItems.map(x=>({...x})):[],
    ballastTanks:Array.isArray(runtime.ballastTanks)?runtime.ballastTanks.map(x=>({...x})):[],
    cargoSpaces:Array.isArray(runtime.cargoSpaces)?runtime.cargoSpaces.map(x=>({...x})):[],
    engineRoom:runtime.engineRoom?{...runtime.engineRoom}:null
  };
}
function internalLayoutIdentityFor(s,runtime={}){
  const family=String(runtime.spaceLayoutFamily||expectedInternalFamily(s?.hullType||'general'));
  const rev=Number(runtime.spaceLayoutRevision||s?.spaceLayoutRevision||0);
  const cargo=(Array.isArray(runtime.cargoSpaces)?runtime.cargoSpaces:[]).map(x=>String(x.id||x.name||'')).join(',');
  const tanks=(Array.isArray(runtime.ballastTanks)?runtime.ballastTanks:[]).map(x=>String(x.id||x.name||'')).join(',');
  const er=runtime.engineRoom||{};
  return String(runtime.spaceLayoutKey||`${family}|${s?.vesselName||''}|${(+s?.length||0).toFixed(2)}|${(+s?.beam||0).toFixed(2)}|${(+s?.depth||0).toFixed(2)}|R${rev}|C:${cargo}|B:${tanks}|ER:${er.label||''}:${(+er.lcg||0).toFixed(2)}`);
}
function replaceInternalArrangement(s,runtime={}){
  const snap=cloneRuntimeFor3D(runtime);
  latestState=s;latestRuntime=snap;
  if(!sceneReady||!s)return;
  if(!runtimeInternalFamilyOK(s,snap)){
    const expected=expectedInternalFamily(s?.hullType||'general'),actual=String(snap?.spaceLayoutFamily||'unknown');
    console.warn(`AMCOL 3D refused internal-layout replacement: expected ${expected}, received ${actual}.`);
    clearOperations();operationSignature='';internalLayoutIdentity='';return;
  }
  const cargoItems=snap.cargoItems,ballastPlan=snap.ballastTanks,engineRoom=snap.engineRoom,cargoSpaces=snap.cargoSpaces;
  // One atomic replacement: old vessel spaces are disposed before the new family is built.
  clearOperations();
  buildCargoSpaces3D(s,cargoSpaces);buildCargo3D(s,cargoItems,cargoSpaces);buildTank3D(s,ballastPlan);buildMachinery3D(s,engineRoom);buildCrane3D(s);buildDamage3D(s);
  operationSignature=operationStateSignature(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);
  internalLayoutIdentity=internalLayoutIdentityFor(s,snap);
  if(operationsGroup){operationsGroup.userData.layoutIdentity=internalLayoutIdentity;operationsGroup.userData.family=snap.spaceLayoutFamily||expectedInternalFamily(s.hullType);operationsGroup.userData.revision=snap.spaceLayoutRevision||0;operationsGroup.userData.vesselName=s.vesselName||'';}
  updateOperationVisibility();updateOperationsReadout(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);
  updateOperations._readoutSig='';
}
function updateOperations(s,runtime={}){
  const cargoItems=Array.isArray(runtime?.cargoItems)?runtime.cargoItems:[],ballastPlan=Array.isArray(runtime?.ballastTanks)?runtime.ballastTanks:[],engineRoom=runtime?.engineRoom||null,cargoSpaces=Array.isArray(runtime?.cargoSpaces)?runtime.cargoSpaces:[];
  if(!runtimeInternalFamilyOK(s,runtime)){
    const expected=expectedInternalFamily(s?.hullType||'general'),actual=String(runtime?.spaceLayoutFamily||'unknown');
    if(updateOperations._familyWarn!==`${expected}|${actual}`){updateOperations._familyWarn=`${expected}|${actual}`;console.warn(`AMCOL 3D rejected stale internal layout: expected ${expected}, received ${actual}.`);}
    operationSignature='';internalLayoutIdentity='';clearOperations();return;
  }
  updateOperations._familyWarn='';
  const layoutId=internalLayoutIdentityFor(s,runtime);
  // Structural vessel-space changes are handled separately from fill/mass changes.
  // This guarantees that General Cargo spaces cannot survive a Bulk/Tanker/Ro-Ro/etc. switch.
  if(layoutId!==internalLayoutIdentity){replaceInternalArrangement(s,runtime);return;}
  const sig=operationStateSignature(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);
  if(sig!==operationSignature)buildOperations(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);
  internalLayoutIdentity=layoutId;
  updateTankFreeSurface(s);
  const readoutSig=[layoutId,cargoSpaces.length,ballastPlan.length,+s.tcg||0,+s.lcg||0,s.crane,s.damage,internalArrangementView].join('|');
  if(updateOperations._readoutSig!==readoutSig){updateOperations._readoutSig=readoutSig;updateOperationsReadout(s,cargoItems,ballastPlan,engineRoom,cargoSpaces);}
}

function buildVessel(s){
  if(shipVisual){shipRoot.remove(shipVisual);disposeObject(shipVisual);}
  animatedPropellers=[];
  shipVisual=new THREE.Group();shipVisual.name='HighDetailTeachingVessel';
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  const type=s.hullType||'general',q=detailLevel(),greatFortuneVisual=isGreatFortuneVisualState(s);
  shipVisual.userData.hullForm=vessel3DHullProfile(type).label;

  // Main hull with stronger PBR response and vessel-family colour cues.
  const hullColorMap={container:0x214b24,bulk:0x6f7c8c,general:0x6e7b8b,roro:0x204a7b,ferry:0x204a7b,tanker:0xd9d9d6,chemical:0xc8d0d9,lng:0x2f3136,osv:0xd96f32,box:0x8b939d};
  const deckColorMap={container:0x9c3e33,bulk:0xc98474,general:0xad6d5e,roro:0x69855e,ferry:0x69855e,tanker:0xf2f2ee,chemical:0xf3f5f7,lng:0x8db64a,osv:0xb98b3d,box:0xa2adb8};
  const hullColor=greatFortuneVisual?0x1f2e44:(hullColorMap[type]??0x182b3a);
  const deckColor=greatFortuneVisual?0xa77057:(deckColorMap[type]??0x9ca9b5);
  const hull=new THREE.Mesh(
    createHullGeometry(L,B,D,type),
    makeMaterial(hullColor,{roughness:greatFortuneVisual?.47:.39,metalness:greatFortuneVisual?.14:.18})
  );
  hull.name='MainHullShell';hull.userData.visualRole='hullShell';hull.castShadow=true;hull.receiveShadow=true;shipVisual.add(hull);

  // Bulbous bow visual detail only. Removed old rectangular lower-hull / boot-top helper meshes
  // that appeared as artificial platforms beneath the ship.
  addVisualBowFormDetails(shipVisual,B,D,L,type,s);

  // Main weather deck with tapered foredeck strips so the deck blends into the bow instead of overhanging it.
  addBlendedMainDeck(shipVisual,B,D,L,type,deckColor);
  addDeckCamberCrown(shipVisual,B,D,L,type);

  // Generic forecastle/stern platform boxes removed. The closed hull shell and main weather deck
  // now define the bow/stern silhouette without detached square platforms.

  if(type==='container'){
    addAccommodation(shipVisual,B,D,L,L*.355,.78,.68,.075,q===2?5:3);
    addFunnel(shipVisual,B*.12,D*1.72,L*.395,B,D,0x0f172a,0x111827);
    addRadarMast(shipVisual,0,D*1.83,L*.305,B,D);
    addNavLights(shipVisual,B,D,L,L*.31);
    if(q>=1){
      addRaisedCatwalk(shipVisual,0,D*1.14,-L*.36,-L*.12,B,D,0x475569);
      addHullNameSprite(shipVisual,'CONTAINER',0,D*1.42,-L*.02,B*.22,D*.10);
      addRadarMast(shipVisual,0,D*1.42,-L*.39,B,D);
    }

    const bays=q===0?5:(q===1?8:10);
    const tiers=q===0?2:(q===1?3:4);
    for(let i=0;i<bays;i++){
      const z=-L*.30+i*(L*.055);
      addContainerBay(shipVisual,B,D,L,z,tiers,4,i);
    }
    // Hatch coamings / lashing bridges.
    if(q>=1){
      for(let i=0;i<5;i++){
        const z=-L*.27+i*L*.105;
        addBox(shipVisual,[B*.86,D*.12,L*.018],[0,D*1.16,z],0x64748b,{roughness:.65});
        addRailingLine(shipVisual,[-B*.34,D*1.20,z-L*.018],[-B*.34,D*1.20,z+L*.018],D*.16,0xcbd5e1);
        addRailingLine(shipVisual,[ B*.34,D*1.20,z-L*.018],[ B*.34,D*1.20,z+L*.018],D*.16,0xcbd5e1);
      }
      addBreakwater(shipVisual,B,D,L,type,-L*.365,D*1.07);
      addForeMooringGear(shipVisual,B,D,L,type,-L*.41,D*1.04);
    }
    addLifeboat(shipVisual,-B*.39,D*1.49,L*.345,L,B);
    addLifeboat(shipVisual, B*.39,D*1.49,L*.345,L,B);

  }else if(type==='bulk'){
    if(greatFortuneVisual){
      addAccommodation(shipVisual,B,D,L,L*.388,.66,.64,.080,q===2?5:4);
      addFunnel(shipVisual,B*.11,D*1.62,L*.426,B,D,0xf5f7fa,0x111827);
      addRadarMast(shipVisual,0,D*1.74,L*.322,B,D);
      addCylinder(shipVisual,Math.max(.018,B*.008),D*.62,[B*.01,D*1.30,-L*.415],0xf8fafc);
      addBox(shipVisual,[B*.12,D*.014,B*.014],[B*.01,D*1.58,-L*.415],0xe2e8f0,{metalness:.26,roughness:.38});
      const gfHolds=greatFortuneVisualHoldLayout(s);
      gfHolds.forEach((h,i)=>{
        if(q>=1){
          addRoundedBox(shipVisual,[Math.min(B*.82,h.width+B*.045),D*.090,h.holdLen],[0,D*1.082,h.z],0x4c5865,{roughness:.76,edgeOpacity:.14});
          addRoundedBox(shipVisual,[Math.min(B*.86,h.width+B*.090),D*.022,h.holdLen*1.03],[0,D*1.148,h.z],0xae7d62,{roughness:.90,metalness:.02,edgeOpacity:.08});
        }
        addHatchCover(shipVisual,0,D*1.128,h.z,Math.min(B*.79,h.width),h.hatchLen,D,0xd7dde3);
        if(q>=1){
          addRailingLine(shipVisual,[-Math.min(B*.39,h.width*.52),D*1.133,h.z-h.hatchLen*.50],[Math.min(B*.39,h.width*.52),D*1.133,h.z-h.hatchLen*.50],D*.050,0xaab4be);
        }
      });
      const cranes=greatFortuneCraneStations(s,gfHolds);
      cranes.forEach((cr,i)=>addGreatFortuneDeckCrane(shipVisual,B*.03,D*1.055,cr.z,B,D,L,cr.swing));
      addBreakwater(shipVisual,B,D,L,type,-L*.365,D*1.07);
      addForeMooringGear(shipVisual,B,D,L,type,-L*.41,D*1.04);
      addLifeboat(shipVisual,-B*.37,D*1.44,L*.372,L,B);
      if(q>=1){
        addHullNameSprite(shipVisual,'GREAT FORTUNE',B*.33,D*.73,-L*.395,B*.13,D*.055);
        addHullNameSprite(shipVisual,'GREAT FORTUNE',-B*.33,D*.73,-L*.395,B*.13,D*.055);
      }
    }else{
      addAccommodation(shipVisual,B,D,L,L*.385,.64,.64,.075,q===2?4:3);
      addFunnel(shipVisual,B*.11,D*1.61,L*.425,B,D,0x374151,0x111827);
      addRadarMast(shipVisual,0,D*1.72,L*.32,B,D);
      const hatchCount=5;
      for(let i=0;i<hatchCount;i++){
        const z=-L*.285+i*L*.125;
        if(q>=1){addRoundedBox(shipVisual,[B*.76,D*.08,L*.112],[0,D*1.08,z],0x4d5a68,{roughness:.70});}
        addHatchCover(shipVisual,0,D*1.125,z,B*.70,L*.095,D,0x566575);
        if(q>=1){
          addRailingLine(shipVisual,[-B*.36,D*1.125,z-L*.046],[B*.36,D*1.125,z-L*.046],D*.055,0x94a3b8);
        }
      }
      // Deck cranes between holds.
      const craneCount=q===0?2:4;
      for(let i=0;i<craneCount;i++){
        const z=-L*.21+i*(L*.14);
        addDeckCrane(shipVisual,B*.04,D*1.07,z,B,D,L,.30,.055);
      }
      addBreakwater(shipVisual,B,D,L,type,-L*.365,D*1.07);
      addForeMooringGear(shipVisual,B,D,L,type,-L*.41,D*1.04);
      addLifeboat(shipVisual,-B*.37,D*1.42,L*.37,L,B);
      addLifeboat(shipVisual, B*.37,D*1.42,L*.37,L,B);
    }

  }else if(type==='roro'){
    // Enclosed Ro-Ro / Ro-Pax body with a full-length vehicle deck and stern ramp.
    addRoundedBox(shipVisual,[B*.92,D*.80,L*.80],[0,D*1.40,-L*.01],0xf2f5f8,{roughness:.58,metalness:.04,edgeColor:0xcbd5e1});
    // Main vehicle deck roof / weather deck.
    addRoundedBox(shipVisual,[B*.84,D*.030,L*.72],[0,D*1.82,-L*.02],0x6b8e5f,{roughness:.78,metalness:.04});
    // Aft accommodation and bridge block.
    addRoundedBox(shipVisual,[B*.50,D*.40,L*.24],[0,D*2.02,L*.26],0xf6f8fb,{roughness:.56,metalness:.04});
    addRoundedBox(shipVisual,[B*.36,D*.12,L*.15],[0,D*2.24,L*.18],0xe7eef4,{roughness:.52});
    // Twin funnel uptakes.
    addFunnel(shipVisual,-B*.16,D*2.18,L*.30,B,D,0x334155,0x111827);
    addFunnel(shipVisual, B*.16,D*2.18,L*.30,B,D,0x334155,0x111827);
    addRadarMast(shipVisual,0,D*2.30,L*.16,B,D);
    addNavLights(shipVisual,B,D,L,L*.14);
    // Side shell openings and passenger/crew window bands.
    for(const side of [-1,1]){
      const x1=side*B*.465;
      const x2=side*B*.452;
      const x3=side*B*.448;
      for(let i=0;i<18;i++){
        const z=-L*.31+i*L*.036;
        addWindow(shipVisual,[x1,D*1.48,z],[B*.012,D*.060,L*.026],false);
      }
      for(let i=0;i<12;i++){
        const z=-L*.18+i*L*.040;
        addWindow(shipVisual,[x2,D*1.63,z],[B*.010,D*.048,L*.022],q===2&&i%4===0);
      }
      for(let i=0;i<6;i++){
        const z=L*.17+i*L*.030;
        addWindow(shipVisual,[x3,D*2.04,z],[B*.012,D*.058,L*.028],true);
      }
    }
    addWindowBand(shipVisual,B,D,L,L*.16,D*2.13,.42,1);
    // Stern ramp / door area and inner lane deck cue.
    addRoundedBox(shipVisual,[B*.80,D*.44,L*.020],[0,D*1.27,L*.475],0x214b75,{roughness:.62,metalness:.10});
    addRoundedBox(shipVisual,[B*.58,D*.028,L*.22],[0,D*1.02,L*.33],0x6b8e5f,{roughness:.78,metalness:.04});
    addRoroRamp(shipVisual,B,D,L);
    // Side casings / intake blocks.
    if(q>=1){
      addRoundedBox(shipVisual,[B*.16,D*.18,L*.060],[-B*.17,D*1.79,L*.28],0x4b5563,{roughness:.60});
      addRoundedBox(shipVisual,[B*.16,D*.18,L*.060],[ B*.17,D*1.79,L*.28],0x4b5563,{roughness:.60});
    }
    // Lifeboats concentrated near the superstructure.
    addLifeboat(shipVisual,-B*.33,D*1.86,L*.29,L,B);
    addLifeboat(shipVisual, B*.33,D*1.86,L*.29,L,B);
    if(q>=2){
      addLifeboat(shipVisual,-B*.34,D*1.86,L*.20,L,B);
      addLifeboat(shipVisual, B*.34,D*1.86,L*.20,L,B);
    }

  }else if(type==='tanker'||type==='chemical'){
    addAccommodation(shipVisual,B,D,L,L*.40,.62,.60,.070,q===2?4:3);
    addFunnel(shipVisual,B*.10,D*1.58,L*.435,B,D,0x3f4b59,0x111827);
    addRadarMast(shipVisual,0,D*1.70,L*.33,B,D);
    addRaisedCatwalk(shipVisual,0,D*1.22,-L*.35,L*.24,B,D,0xe5e7eb);
    // Main pipe rack.
    const pipeXs=q===0?[-B*.18,B*.18]:[-B*.24,-B*.12,0,B*.12,B*.24];
    pipeXs.forEach((x,i)=>{
      addPipeRun(shipVisual,[x,D*1.11,L*.27],[x,D*1.11,-L*.29],Math.max(.018,B*(q===2?.012:.009)),i%2?0xf59e0b:0xd97706);
    });
    const manifolds=q===0?4:(q===1?7:10);
    for(let i=0;i<manifolds;i++){
      const z=-L*.25+i*(L*.48/(manifolds-1));
      addVent(shipVisual,0,D*1.12,z,B,D);
    }
    // Midship cargo manifold.
    if(q>=1){
      addBox(shipVisual,[B*.74,D*.09,L*.028],[0,D*1.14,0],0x6b7280,{roughness:.62,metalness:.18});
      for(const side of [-1,1]){
        for(let i=0;i<4;i++)addPipeRun(shipVisual,[side*B*.05,D*1.16,-L*.015+i*L*.010],[side*B*.42,D*1.16,-L*.015+i*L*.010],B*.010,0xef8b17);
        addDeckCrane(shipVisual,side*B*.18,D*1.02,0,B,D,L,-.12,0);
      }
      for(let i=0;i<4;i++) addPipeRun(shipVisual,[-B*.22,D*1.19,-L*.01+i*L*.014],[B*.22,D*1.19,-L*.01+i*L*.014],B*.006,0x94a3b8);
    }
    if(type==='chemical'&&q>=1){
      // Chemical tanker has denser piping/venting.
      for(let i=0;i<9;i++){
        const z=-L*.27+i*L*.065;
        addPipeRun(shipVisual,[-B*.30,D*1.16,z],[B*.30,D*1.16,z],B*.006,0x94a3b8);
      }
    }
    addLifeboat(shipVisual,-B*.36,D*1.40,L*.37,L,B);
    addLifeboat(shipVisual, B*.36,D*1.40,L*.37,L,B);

  }else if(type==='lng'){
    addAccommodation(shipVisual,B,D,L,L*.405,.56,.57,.065,q===2?4:3);
    addFunnel(shipVisual,B*.11,D*1.55,L*.435,B,D,0x263746,0x111827);
    addRadarMast(shipVisual,0,D*1.68,L*.34,B,D);
    addHullNameSprite(shipVisual,'L N G',0,D*1.46,-L*.02,B*.18,D*.09);
    const tankSpaces=loadedLngCargoSphereSpaces(),tankSpecs=tankSpaces.map(sp=>({sp,...lngExteriorTankVisualSpec(s,sp)}));
    tankSpecs.forEach(({x,z,d,r,visualCentreY,bottom,scaleX,scaleY,scaleZ,supportTop,topY})=>{
      const sphere=new THREE.Mesh(
        new THREE.SphereGeometry(r,q===0?18:(q===1?28:40),q===0?12:(q===1?18:24)),
        makeMaterial(0xdce9f2,{roughness:.25,metalness:.08})
      );
      sphere.scale.set(scaleX,scaleY,scaleZ);
      sphere.position.set(x,visualCentreY,z);sphere.castShadow=true;shipVisual.add(sphere);
      addLngTankArchitecture(shipVisual,s,{x,z,d,r,visualCentreY,bottom,scaleX,scaleY,scaleZ,supportTop,topY});
      const saddleW=Math.max(B*.12,r*.72),saddleL=Math.max(L*.030,d*.17),saddleH=Math.max(D*.045,d*.08);
      addRoundedBox(shipVisual,[saddleW,saddleH,saddleL],[x,supportTop-saddleH*.28,z],0xd5dee9,{roughness:.56});
      if(q>=1){
        const band=new THREE.Mesh(new THREE.TorusGeometry(r,Math.max(B*.006,r*.028),8,q===2?40:24),makeMaterial(0x8796a5,{roughness:.48,metalness:.18}));
        band.rotation.x=Math.PI/2;band.scale.set(1,scaleY,scaleZ);band.position.set(x,visualCentreY,z);shipVisual.add(band);
        const skirtH=Math.max(D*.05,supportTop-bottom+D*.010);
        addCylinder(shipVisual,Math.max(B*.022,r*.12),skirtH,[x,bottom+skirtH*.5,z],0xcfd8e3);
        const domeTop=Math.min(topY+D*.018,D*1.56);
        addRoundedBox(shipVisual,[Math.max(B*.16,r*.70),D*.04,Math.max(L*.035,d*.18)],[x,domeTop,z],0xe5edf5,{roughness:.44});
        addCylinder(shipVisual,Math.max(B*.008,r*.045),D*.08,[x,domeTop+D*.08,z],0xcbd5e1);
        addCylinder(shipVisual,Math.max(B*.007,r*.030),D*.06,[x-r*.24,domeTop+D*.04,z],0xcbd5e1);
        addCylinder(shipVisual,Math.max(B*.007,r*.030),D*.06,[x+r*.24,domeTop+D*.04,z],0xcbd5e1);
      }
    });
    const zMin=tankSpecs.length?Math.min(...tankSpecs.map(t=>t.z-t.r*.42)):-L*.33;
    const zMax=tankSpecs.length?Math.max(...tankSpecs.map(t=>t.z+t.r*.42)):L*.20;
    const zMid=(zMin+zMax)*.5,trunkLen=Math.max(L*.30,(zMax-zMin)+L*.06),bridgeY=Math.max(D*1.34, tankSpecs.length?Math.max(...tankSpecs.map(t=>t.topY))+D*.07:D*1.34);
    addRoundedBox(shipVisual,[B*.22,D*.05,trunkLen],[0,bridgeY+D*.08,zMid],0xe8eef5,{roughness:.48});
    addPipeRun(shipVisual,[-B*.25,D*1.10,zMin],[-B*.25,D*1.10,zMax],B*.008,0xeab308);
    addPipeRun(shipVisual,[ B*.25,D*1.10,zMin],[ B*.25,D*1.10,zMax],B*.008,0xeab308);
    addRaisedCatwalk(shipVisual,0,bridgeY,zMin+(zMax-zMin)*.10,zMax-(zMax-zMin)*.20,B,D,0xf8fafc);
    addLifeboat(shipVisual,-B*.36,D*1.37,L*.39,L,B);
    addLifeboat(shipVisual, B*.36,D*1.37,L*.39,L,B);

  }else if(type==='osv'){
    // Forward superstructure, large open aft deck.
    addAccommodation(shipVisual,B,D,L,-L*.30,.88,.76,.17,q===2?5:3);
    addRoundedBox(shipVisual,[B*.66,D*.18,L*.12],[0,D*1.92,-L*.33],0xdce8f0,{roughness:.50});
    addRadarMast(shipVisual,0,D*2.08,-L*.31,B,D);
    addFunnel(shipVisual,B*.15,D*1.85,-L*.19,B,D,0x374151,0x111827);
    addRoundedBox(shipVisual,[B*.80,D*.030,L*.42],[0,D*1.035,L*.15],0xd59a26,{roughness:.75});
    addDeckCrane(shipVisual,B*.14,D*1.08,-L*.01,B,D,L,.26,-.02);
    if(q>=1){
      // Deck cargo securing grid.
      for(let i=0;i<7;i++){
        const z=-L*.01+i*L*.065;
        addBox(shipVisual,[B*.73,D*.008,L*.006],[0,D*1.055,z],0x374151,{roughness:.8});
      }
    }
    addLifeboat(shipVisual,-B*.40,D*1.57,-L*.28,L,B);
    addLifeboat(shipVisual, B*.40,D*1.57,-L*.28,L,B);

  }else if(type==='box'){
    addRoundedBox(shipVisual,[B*.97,D*.055,L*.94],[0,D*1.03,0],0xa2adb8,{roughness:.78});
    addAccommodation(shipVisual,B,D,L,L*.30,.48,.48,.13,q===2?3:2);
    addRadarMast(shipVisual,0,D*1.55,L*.25,B,D);
    if(q>=1){addBox(shipVisual,[B*.18,D*.08,L*.08],[0,D*1.08,-L*.36],0x6b7280,{roughness:.75});}
    if(q>=1){
      for(let i=0;i<4;i++)addMooringBits(shipVisual,B,D,L);
    }

  }else{
    // General cargo / multipurpose.
    addAccommodation(shipVisual,B,D,L,L*.355,.64,.62,.090,q===2?4:3);
    addFunnel(shipVisual,B*.11,D*1.60,L*.405,B,D,0x334155,0x111827);
    addRadarMast(shipVisual,0,D*1.72,L*.30,B,D);
    const holds=4;
    for(let i=0;i<holds;i++){
      const z=-L*.265+i*L*.145;
      if(q>=1){addRoundedBox(shipVisual,[B*.64,D*.07,L*.118],[0,D*1.08,z],0x4f5964,{roughness:.72});}
      addHatchCover(shipVisual,0,D*1.115,z,B*.58,L*.105,D,0x596878);
    }
    const cranes=q===0?2:(q===1?3:4);
    for(let i=0;i<cranes;i++){
      const z=-L*.19+i*(L*.39/Math.max(1,cranes-1));
      addDeckCrane(shipVisual,0,D*1.07,z,B,D,L,.35,.07);
    }
    addBreakwater(shipVisual,B,D,L,type,-L*.365,D*1.07);
    addForeMooringGear(shipVisual,B,D,L,type,-L*.41,D*1.04);
    addLifeboat(shipVisual,-B*.37,D*1.42,L*.34,L,B);
    addLifeboat(shipVisual, B*.37,D*1.42,L*.34,L,B);
  }

  addDeckSafetyDetails(shipVisual,B,D,L,type);
  addBootTopBands(shipVisual,B,D,L,type);
  addRestrainedWeathering(shipVisual,B,D,L,type);
  addSternMooringDetails(shipVisual,B,D,L,type);
  addSternAppendages(shipVisual,B,D,L,type);

  // Metric forward/aft draft marks on both Port and Starboard shell plating.
  // These are visual teaching marks referenced from the keel; actual calculated drafts remain state.draftBow/state.draftStern.
  addVesselDraftMarks(shipVisual,B,D,L,type);

  // Generic bow flagstaff/light removed for a cleaner vessel-specific silhouette.

  // General navigation mast / light near accommodation.
  const navZ=(type==='osv')?-L*.31:L*.34;
  addNavLights(shipVisual,B,D,L,navZ);

  // Phase-10 clean view: no solid rectangular waterline teaching slab.
  waterlineMarker=null;

  shipRoot.add(shipVisual);
  vesselSignature=vesselGeometrySignatureFor(s);
  updateCameraLimits(s);
  buildHydroOverlay(s);
  // Internal spaces have their own lifecycle and are rebuilt by updateOperations()
  // from the current runtime snapshot after the hull rebuild completes.
  operationSignature='';internalLayoutIdentity='';
  setVesselXRay(!!hydroOptions.xray);
  updateCutawayWorldPlane();applyCutawayMaterials();
  // Ballast transfer binds to the actual vessel tank meshes after buildOperations().
}

function createWater(){
  const waterSegments=detailQuality==='high'?168:(detailQuality==='performance'?64:112);
  const geo=new THREE.PlaneGeometry(1100,1100,waterSegments,waterSegments);
  const mat=new THREE.ShaderMaterial({
    transparent:true,side:THREE.DoubleSide,
    uniforms:{
      uTime:{value:0},uHeight:{value:0},uWavelength:{value:60},uPeriod:{value:5},uEncounterOmega:{value:1.256637},uSteepness:{value:.05},uDepth:{value:50},uEnabled:{value:0},
      uHeading:{value:new THREE.Vector2(1,0)},uRoughness:{value:.18},uStorm:{value:0},
      uColorDeep:{value:new THREE.Color(0x07273f)},uColorMid:{value:new THREE.Color(0x0b5f7b)},uColorCrest:{value:new THREE.Color(0xc8eff8)}
    },
    vertexShader:`
      uniform float uTime,uHeight,uWavelength,uPeriod,uEncounterOmega,uSteepness,uDepth,uEnabled,uRoughness;
      uniform vec2 uHeading;
      varying float vWave;varying float vCrest;varying float vSlope;varying vec3 vObjPos;varying vec3 vWorldPos;
      void main(){
        vec3 p=position;
        float lambda=max(uWavelength,1.0);
        float k=6.2831853/lambda;
        float a=.5*max(uHeight,0.0)*uEnabled;
        float omega=abs(uEncounterOmega)>.00001?uEncounterOmega:6.2831853/max(uPeriod,.15);
        vec2 h=normalize(uHeading);
        vec2 h2=normalize(vec2(-h.y*.82+h.x*.38,h.x*.82+h.y*.38));
        vec2 h3=normalize(vec2(h.x*.62-h.y*.52,h.y*.62+h.x*.52));
        float ph1=k*dot(position.xy,h)-omega*uTime;
        float ph2=k*1.58*dot(position.xy,h2)-omega*1.23*uTime+1.35;
        float ph3=k*.72*dot(position.xy,h3)-omega*.82*uTime+2.20;
        float shallow=clamp((k*max(uDepth,.5))/3.1415926,.25,1.0);
        float q=clamp(.10+uSteepness*1.55+(1.0-shallow)*.055,.10,.34);
        float a1=a*(.82-.05*uRoughness),a2=a*(.12+.03*uRoughness),a3=a*(.06+.02*uRoughness);
        vec2 horizontal=q*a1*h*cos(ph1)+q*.55*a2*h2*cos(ph2)+q*.42*a3*h3*cos(ph3);
        float z=a1*sin(ph1)+a2*sin(ph2)+a3*sin(ph3);
        p.xy+=horizontal;
        p.z+=z;
        vWave=z;
        vCrest=sin(ph1)*.78+sin(ph2)*.15+sin(ph3)*.07;
        vSlope=abs(cos(ph1))*k*a1+abs(cos(ph2))*k*1.58*a2+abs(cos(ph3))*k*.72*a3;
        vObjPos=p;
        vec4 world=modelMatrix*vec4(p,1.0);
        vWorldPos=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      uniform vec3 uColorDeep,uColorMid,uColorCrest;
      uniform float uHeight,uRoughness,uStorm,uSteepness,uEnabled,uTime,uDepth;
      varying float vWave;varying float vCrest;varying float vSlope;varying vec3 vObjPos;varying vec3 vWorldPos;
      void main(){
        vec3 dx=dFdx(vWorldPos),dy=dFdy(vWorldPos);
        vec3 normal=normalize(cross(dx,dy));
        vec3 viewDir=normalize(cameraPosition-vWorldPos);
        vec3 sunDir=normalize(vec3(-0.32,0.88,-0.24));
        float h=max(.25,uHeight);
        float lift=clamp(.44+vWave/(h*1.7),0.0,1.0);
        float shallowTint=1.0-clamp(uDepth/80.0,0.0,1.0);
        vec3 base=mix(uColorDeep,uColorMid,lift+.08*shallowTint);
        float micro=.5+.5*sin(dot(vObjPos.xy,vec2(.18,.11))+uTime*1.7)*sin(dot(vObjPos.xy,vec2(-.09,.15))-uTime*1.3);
        float crest=smoothstep(.52,.93,max(vCrest,0.0));
        float steep=smoothstep(.035,.20,uSteepness);
        float slope=smoothstep(.03,.24,vSlope);
        float foam=crest*steep*slope*(.10+.44*clamp(uHeight/5.0,0.0,1.0))*uEnabled;
        foam+=smoothstep(.82,1.0,micro)*.035*clamp(uRoughness*1.4,0.0,1.0)*uEnabled;
        float fresnel=pow(1.0-max(dot(normal,viewDir),0.0),2.4);
        float spec=pow(max(dot(reflect(-sunDir,normal),viewDir),0.0),84.0)*(0.10+0.34*(1.0-uRoughness*.55));
        float glint=pow(max(dot(reflect(-sunDir,normal),viewDir),0.0),18.0)*.16*micro;
        vec3 c=mix(base,uColorCrest,foam*.88);
        c=mix(c,vec3(0.72,0.86,0.94),fresnel*.18);
        c+=vec3(1.0,0.96,0.86)*(spec+glint);
        c*=1.0-.16*uStorm;
        float alpha=.87+.07*fresnel+.02*foam;
        gl_FragColor=vec4(c,clamp(alpha,0.0,0.98));
      }`
  });
  water=new THREE.Mesh(geo,mat);water.rotation.x=-Math.PI/2;water.receiveShadow=true;scene.add(water);
  waterEffectsGroup=new THREE.Group();waterEffectsGroup.name='WaterInteractionEffects';scene.add(waterEffectsGroup);

  seabed=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),makeMaterial(0x3f3428,{roughness:1}));
  seabed.rotation.x=-Math.PI/2;seabed.position.y=-15;seabed.receiveShadow=true;scene.add(seabed);
}

function makeSeaEffectPlane(color=0xf8fafc,opacity=.25){
  const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.renderOrder=8;return m;
}
function rebuildWaterInteractionEffects(s){
  if(!waterEffectsGroup||!s)return;
  while(waterEffectsGroup.children.length){const c=waterEffectsGroup.children.pop();disposeObject(c);}
  waterEffectMeshes=[];
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16);
  const bow=makeSeaEffectPlane(0xe8fbff,.08);bow.name='BowFoam';bow.position.set(0,.035,-L*.48);bow.scale.set(B*.34,L*.016,1);waterEffectsGroup.add(bow);
  const stern=makeSeaEffectPlane(0xe8fbff,.08);stern.name='SternFoam';stern.position.set(0,.032,L*.49);stern.scale.set(B*.44,L*.020,1);waterEffectsGroup.add(stern);
  for(let i=0;i<4;i++){
    const w=makeSeaEffectPlane(i<2?0xdff8ff:0xbfe9f7,.07-i*.010);w.name='WakeStrip';w.position.set((i%2?1:-1)*B*(.15+i*.022),.024,L*(.55+i*.09));w.scale.set(B*(.13+i*.028),L*(.08+i*.045),1);waterEffectsGroup.add(w);waterEffectMeshes.push(w);
  }
  waterEffectMeshes.push(bow,stern);waterEffectSignature=[L.toFixed(2),B.toFixed(2)].join('|');
}
function updateWaterInteraction3D(s,t=0){
  if(!s||!waterEffectsGroup)return;
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),sig=[L.toFixed(2),B.toFixed(2)].join('|');if(sig!==waterEffectSignature)rebuildWaterInteractionEffects(s);
  const speed=Math.max(0,+s.shipSpeedKts||0),strength=Math.min(1,speed/22);
  // Propulsion wake is speed-driven only. Wind-wave crest foam is rendered separately by the wave surface shader.
  waterEffectsGroup.visible=!!environmentOptions.master&&!!environmentOptions.sea&&strength>.025;
  waterEffectsGroup.children.forEach((m,i)=>{if(!m.material)return;const pulse=.92+.08*Math.sin(t*(1.0+i*.12)+i);m.material.opacity=(m.name==='BowFoam'?.05+.18*strength:m.name==='SternFoam'?.04+.15*strength:.025+.12*strength)*pulse;});
  const rpm=Math.min(2.8,.18+speed*.14);animatedPropellers.forEach((r,i)=>{r.rotation.z+=(i%2?-1:1)*rpm*.035;});
}

function createSkyDome(){
  const geo=new THREE.SphereGeometry(700,32,18);
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{uTop:{value:new THREE.Color(0x2b8bd3)},uHorizon:{value:new THREE.Color(0xc7ecff)},uStorm:{value:0}},
    vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform vec3 uTop,uHorizon;uniform float uStorm;varying vec3 vWorld;void main(){float t=clamp(normalize(vWorld).y*.78+.22,0.0,1.0);vec3 c=mix(uHorizon,uTop,t);c*=1.0-.34*uStorm;gl_FragColor=vec4(c,1.0);}`
  });
  skyDome=new THREE.Mesh(geo,mat);scene.add(skyDome);

  // Soft solar glow for dry-weather daylight.
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d');const grad=g.createRadialGradient(128,128,10,128,128,126);
  grad.addColorStop(0,'rgba(255,255,235,1)');grad.addColorStop(.18,'rgba(255,242,170,.98)');grad.addColorStop(.45,'rgba(255,213,110,.55)');grad.addColorStop(1,'rgba(255,210,100,0)');
  g.fillStyle=grad;g.fillRect(0,0,256,256);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const sm=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.95});
  sunSprite=new THREE.Sprite(sm);sunSprite.scale.set(72,72,1);sunSprite.position.set(-170,220,-260);scene.add(sunSprite);
}

function createRainSystem(){
  const N=1600;rainPositions=new Float32Array(N*3);rainSeeds=[];
  for(let i=0;i<N;i++){
    const seed={x:(Math.random()-.5)*180,y:Math.random()*95+5,z:(Math.random()-.5)*180,speed:.65+Math.random()*.8};rainSeeds.push(seed);
    rainPositions[i*3]=seed.x;rainPositions[i*3+1]=seed.y;rainPositions[i*3+2]=seed.z;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));geo.setDrawRange(0,0);
  const mat=new THREE.PointsMaterial({color:0xc7e9ff,size:.18,transparent:true,opacity:.55,depthWrite:false});
  rainPoints=new THREE.Points(geo,mat);rainPoints.frustumCulled=false;scene.add(rainPoints);
}

function environmentDirectionVector(name){
  if(name==='port_to_starboard')return new THREE.Vector3(1,0,0);
  if(name==='starboard_to_port')return new THREE.Vector3(-1,0,0);
  if(name==='head')return new THREE.Vector3(0,0,1);
  if(name==='following')return new THREE.Vector3(0,0,-1);
  if(name==='quarter_port')return new THREE.Vector3(.72,0,.69).normalize();
  if(name==='quarter_starboard')return new THREE.Vector3(-.72,0,.69).normalize();
  return new THREE.Vector3(1,0,0);
}
function clearVectorGroup(group){while(group?.children?.length){const c=group.children.pop();disposeObject(c);}}
function makeFlowArrow(dir,origin,length,color,head=.9){
  const a=new THREE.ArrowHelper(dir.clone().normalize(),origin,length,color,Math.min(head,length*.28),Math.min(head*.55,length*.15));
  a.line.material.transparent=true;a.line.material.opacity=.82;a.line.material.depthWrite=false;
  a.cone.material.transparent=true;a.cone.material.opacity=.94;a.cone.material.depthWrite=false;
  return a;
}
function rebuildEnvironmentVectors(s){
  if(!windVectorGroup||!currentVectorGroup)return;
  clearVectorGroup(windVectorGroup);clearVectorGroup(currentVectorGroup);
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  if(s.windEnabled&&(+s.windSpeedKts||0)>0){
    const dir=environmentDirectionVector(s.windDirection||'port_to_starboard');
    const speed=Math.max(0,+s.windSpeedKts||0)*Math.max(1,+s.gustFactor||1);
    const len=Math.max(B*.65,Math.min(B*2.0,B*.55+speed*.12));
    const cross=new THREE.Vector3(-dir.z,0,dir.x);
    for(let i=-2;i<=2;i++){
      const origin=dir.clone().multiplyScalar(-B*1.35).add(cross.clone().multiplyScalar(i*L*.075));
      origin.y=D*(1.0+(i%2)*.08);origin.z+=i*L*.055;
      windVectorGroup.add(makeFlowArrow(dir,origin,len,0x67e8f9,Math.max(.45,B*.07)));
    }
  }
  if(s.currentEnabled&&(+s.currentSpeedKts||0)>0){
    const dir=environmentDirectionVector(s.currentDirection||'port_to_starboard');
    const speed=Math.max(0,+s.currentSpeedKts||0);
    const len=Math.max(B*.50,Math.min(B*1.55,B*.48+speed*1.1));
    const cross=new THREE.Vector3(-dir.z,0,dir.x);
    for(let i=-2;i<=2;i++){
      const origin=dir.clone().multiplyScalar(-B*1.25).add(cross.clone().multiplyScalar(i*L*.08));
      origin.y=-Math.max(.8,(+s.eqDraft||D*.45)*.42);origin.z+=i*L*.05;
      currentVectorGroup.add(makeFlowArrow(dir,origin,len,0x3b82f6,Math.max(.40,B*.06)));
    }
  }
}
function windMomentVisualN(s){
  if(!s.windEnabled||(+s.windSpeedKts||0)<=0)return 0;
  const v=(+s.windSpeedKts||0)*.514444*Math.max(1,+s.gustFactor||1);
  return .5*1.225*(+s.windCd||1.1)*(+s.windageArea||0)*v*v*(+s.windLever||0)*((s.windDirection==='port_to_starboard'||s.windDirection==='quarter_port')?1:(s.windDirection==='starboard_to_port'||s.windDirection==='quarter_starboard')?-1:0);
}
function currentMomentVisualN(s){
  if(!s.currentEnabled||(+s.currentSpeedKts||0)<=0)return 0;
  const v=(+s.currentSpeedKts||0)*.514444;
  const dir=((s.currentDirection==='port_to_starboard'||s.currentDirection==='quarter_port')?1:(s.currentDirection==='starboard_to_port'||s.currentDirection==='quarter_starboard')?-1:0);
  return .5*(+s.density||1.025)*1000*(+s.currentCd||1)*(+s.currentArea||0)*v*v*(+s.currentLever||0)*dir;
}
function updateEnvironmentVisibility(){
  if(environmentGroup)environmentGroup.visible=!!environmentOptions.master;
  if(water)water.visible=!!environmentOptions.master&&!!environmentOptions.sea;
  if(waterEffectsGroup)waterEffectsGroup.visible=!!environmentOptions.master&&!!environmentOptions.sea&&waterEffectsGroup.visible;
  if(windVectorGroup)windVectorGroup.visible=!!environmentOptions.master&&!!environmentOptions.wind;
  if(currentVectorGroup)currentVectorGroup.visible=!!environmentOptions.master&&!!environmentOptions.current;
  if(rainPoints)rainPoints.visible=!!environmentOptions.master&&!!environmentOptions.atmosphere;
  if(environmentForceGroup)environmentForceGroup.visible=!!environmentOptions.master&&!!environmentOptions.heelingArm;
  if(skyDome)skyDome.visible=!!environmentOptions.master&&!!environmentOptions.lighting;
  if(sunSprite)sunSprite.visible=!!environmentOptions.master&&!!environmentOptions.lighting&&((+latestState?.rainIntensity||0)<.18);
}
function setEnvironmentOption(key,value){if(!(key in environmentOptions))return;environmentOptions[key]=!!value;updateEnvironmentVisibility();}
function updateEnvironmentReadout3D(s){
  const el=document.getElementById('threeDEnvironmentReadout');if(!el)return;
  const wm=windMomentVisualN(s)/1000,cm=currentMomentVisualN(s)/1000;
  const wind=s.windEnabled?`${(+s.windSpeedKts||0).toFixed(0)}kn × ${(+s.gustFactor||1).toFixed(2)} · ${String(s.windDirection).replaceAll('_',' ')}`:'OFF';
  const cur=s.currentEnabled?`${(+s.currentSpeedKts||0).toFixed(1)}kn · ${String(s.currentDirection).replaceAll('_',' ')}`:'OFF';
  const waveTe=s.waveEnabled&&typeof calculateEncounterPeriod==='function'?calculateEncounterPeriod():null,waveSteep=s.waveEnabled?Math.max(0,(+s.waveHeight||0)/Math.max(1,+s.waveLength||1)):0;
  const wave=s.waveEnabled?`H ${(+s.waveHeight||0).toFixed(1)}m · λ ${(+s.waveLength||0).toFixed(0)}m · T<sub>W</sub> ${(+s.wavePeriod||0).toFixed(1)}s · T<sub>E</sub> ${Number.isFinite(waveTe)?waveTe.toFixed(1)+'s':waveTe===Infinity?'∞':'—'} · H/λ ${waveSteep.toFixed(3)} · ${s.waveHeading}`:'OFF';
  el.innerHTML=`Weather <b>${String(s.weatherPreset||'custom').toUpperCase()}</b> · visibility <b>${(+s.visibilityNm||0).toFixed(1)}nm</b><br>`+
    `Wind <b>${wind}</b> · ${wm>=0?'+':''}${wm.toFixed(0)}kN·m<br>`+
    `Current <b>${cur}</b> · ${cm>=0?'+':''}${cm.toFixed(0)}kN·m<br>`+
    `Waves <b>${wave}</b><br>Net HA <b class="${Math.abs(+s.environmentHeelingArm||0)>.05?'text-rose-300':'text-emerald-300'}">${(+s.environmentHeelingArm||0)>=0?'+':''}${(+s.environmentHeelingArm||0).toFixed(3)}m</b>`;
}
function updateEnvironmentLighting(s){
  if(!scene)return;
  const rain=Math.max(0,Math.min(1,+s.rainIntensity||0));
  const vis=Math.max(.2,+s.visibilityNm||12);
  const wind=Math.max(0,+s.windSpeedKts||0);
  // Dry weather is deliberately rendered as daylight/sunny. Rain drives the overcast transition.
  const wet=Math.min(1,rain*1.45);
  const haze=vis<4?Math.min(1,(4-vis)/4):0;
  const storm=Math.max(wet,haze*.70);
  const sunny=rain<=.015;
  const clearBg=new THREE.Color(0x8fd1f4),overcastBg=new THREE.Color(0x1b2635),bg=clearBg.clone().lerp(overcastBg,storm);
  scene.background.copy(bg);
  if(scene.fog){
    scene.fog.color.copy(bg);
    scene.fog.density=sunny?(.00045+(1/Math.max(3,vis))*.0012):(.0016+(1/Math.max(.7,vis))*.0040+rain*.0045);
  }
  if(envHemi){
    envHemi.intensity=environmentOptions.lighting?(3.10-1.55*storm):1.7;
    envHemi.color.set(new THREE.Color(0xd9f2ff).lerp(new THREE.Color(0x93a4b8),storm));
    envHemi.groundColor.set(new THREE.Color(0x54724b).lerp(new THREE.Color(0x111827),storm));
  }
  if(envSun){
    envSun.intensity=environmentOptions.lighting?(4.55-3.55*storm):2.0;
    envSun.color.set(new THREE.Color(0xfff0c2).lerp(new THREE.Color(0xb8c1cb),storm));
    envSun.position.set(-95,145,-115);
  }
  if(envFill){
    envFill.intensity=environmentOptions.lighting?(1.55-.85*storm):.8;
    envFill.color.set(new THREE.Color(0xaedfff).lerp(new THREE.Color(0x718096),storm));
  }
  if(renderer)renderer.toneMappingExposure=1.20-.30*storm;
  if(sunSprite){sunSprite.visible=!!environmentOptions.lighting&&rain<.18;sunSprite.material.opacity=Math.max(0,.98-rain*5.2-haze*.45);sunSprite.scale.setScalar(72+18*(1-storm));}
  if(skyDome?.material?.uniforms){
    skyDome.material.uniforms.uStorm.value=storm;
    skyDome.material.uniforms.uTop.value.copy(new THREE.Color(0x268bd2).lerp(new THREE.Color(0x172033),storm));
    skyDome.material.uniforms.uHorizon.value.copy(new THREE.Color(0xd8f4ff).lerp(new THREE.Color(0x46515f),storm));
  }
  if(water?.material?.uniforms){
    water.material.uniforms.uStorm.value=storm;
    water.material.uniforms.uRoughness.value=Math.min(1,.08+wind/70+rain*.30);
    water.material.uniforms.uColorDeep.value.copy(new THREE.Color(0x075985).lerp(new THREE.Color(0x062b46),storm));
    water.material.uniforms.uColorMid.value.copy(new THREE.Color(0x159bc5).lerp(new THREE.Color(0x0b6280),storm));
    water.material.uniforms.uColorCrest.value.copy(new THREE.Color(0xd9f7ff).lerp(new THREE.Color(0x94d7e8),storm));
  }
}
function updateRain(s,dt){
  if(!rainPoints||!rainPositions)return;
  const intensity=Math.max(0,Math.min(1,+s.rainIntensity||0));
  const count=Math.floor(rainSeeds.length*intensity);
  rainPoints.geometry.setDrawRange(0,count);
  rainPoints.material.opacity=.25+.55*intensity;
  const dir=environmentDirectionVector(s.windDirection||'port_to_starboard');
  const drift=(s.windEnabled?(+s.windSpeedKts||0):0)*.010;
  const fall=34+intensity*50;
  for(let i=0;i<count;i++){
    let x=rainPositions[i*3],y=rainPositions[i*3+1],z=rainPositions[i*3+2];
    const seed=rainSeeds[i];
    y-=fall*seed.speed*dt;x+=dir.x*drift*dt*16;z+=dir.z*drift*dt*16;
    if(y<-5){y=85+Math.random()*35;x=(Math.random()-.5)*180;z=(Math.random()-.5)*180;}
    if(Math.abs(x)>110)x*=-.82;if(Math.abs(z)>110)z*=-.82;
    rainPositions[i*3]=x;rainPositions[i*3+1]=y;rainPositions[i*3+2]=z;
  }
  rainPoints.geometry.attributes.position.needsUpdate=true;
}
function updateEnvironmentalHeelingArm3D(s){
  if(!environmentForceGroup)return;
  clearVectorGroup(environmentForceGroup);
  if(!environmentOptions.heelingArm)return;
  const ha=+s.environmentHeelingArm||0;
  if(Math.abs(ha)<.0005)return;
  const D=Math.max(3,+s.depth||10),B=Math.max(4,+s.beam||16);
  const sign=Math.sign(ha)||1;
  const len=Math.max(B*.28,Math.min(B*1.15,B*.25+Math.abs(ha)*B*6));
  const origin=new THREE.Vector3(0,Math.max(D*.58,+s.kgCorr-(+s.eqDraft||0)),0);
  const a=makeFlowArrow(new THREE.Vector3(sign,0,0),origin,len,0xfb7185,Math.max(.45,B*.065));
  environmentForceGroup.add(a);
  const label=operationSprite(`ENV HA ${ha>=0?'+':''}${ha.toFixed(3)}m`,'#fda4af',Math.max(.55,Math.min(.9,B/24)));
  label.position.copy(origin).add(new THREE.Vector3(sign*len*.55,D*.15,0));environmentForceGroup.add(label);
}
function updateEnvironment3D(s,dt=0){
  if(!s)return;
  updateEnvironmentVisibility();
  updateEnvironmentLighting(s);
  updateEnvironmentReadout3D(s);
  updateEnvironmentalHeelingArm3D(s);
  if(dt>0)updateRain(s,dt);
}

function init3D(){
  if(!container)return;
  try{
    try{
      detailQuality=localStorage.getItem('amcol_3d_detail_quality')||'balanced';
      inspectionOptions.autoFocus=(localStorage.getItem('amcol_3d_auto_focus')??'true')!=='false';
      inspectionOptions.challengeCamera=localStorage.getItem('amcol_3d_challenge_camera')==='true';
      cutawayMode=localStorage.getItem('amcol_3d_cutaway_mode')||'none';
      interactionMode=localStorage.getItem('amcol_3d_interaction_mode')||'inspect';
      interactionAxis=localStorage.getItem('amcol_3d_interaction_axis')||'x';
      interactionSnap=Number(localStorage.getItem('amcol_3d_interaction_snap')??'.25');
    }catch(e){detailQuality='balanced';inspectionOptions.autoFocus=true;inspectionOptions.challengeCamera=false;cutawayMode='none';interactionMode='inspect';interactionAxis='x';interactionSnap=.25;}
    if(!DETAIL_LEVEL.hasOwnProperty(detailQuality))detailQuality='balanced';
    const qualitySelect=document.getElementById('threeDDetailQuality');if(qualitySelect)qualitySelect.value=detailQuality;
    const autoEl=document.getElementById('threeDAutoFocus');if(autoEl)autoEl.checked=inspectionOptions.autoFocus;
    const chEl=document.getElementById('threeDChallengeCamera');if(chEl)chEl.checked=inspectionOptions.challengeCamera;
    const cutEl=document.getElementById('threeDCutawayMode');if(cutEl)cutEl.value=cutawayMode;
    const snapEl=document.getElementById('interactionSnap');if(snapEl)snapEl.value=String(interactionSnap);
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x06111f);
    scene.fog=new THREE.FogExp2(0x06111f,.0024);

    camera=new THREE.PerspectiveCamera(42,1,.1,5000);
    camera.position.set(40,28,70);

    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,detailQuality==='high'?2.0:1.5));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.20;
    container.prepend(renderer.domElement);

    controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.07;
    controls.screenSpacePanning=true;
    controls.target.set(0,5,0);
    controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI*.96;
    controls.addEventListener('start',()=>{cameraTween=null;});
    setupTransformControls();

    envHemi=new THREE.HemisphereLight(0xd9f2ff,0x54724b,3.1);scene.add(envHemi);
    envSun=new THREE.DirectionalLight(0xfff0c2,4.55);envSun.position.set(-95,145,-115);envSun.castShadow=true;
    envSun.shadow.mapSize.set(2048,2048);envSun.shadow.camera.near=1;envSun.shadow.camera.far=500;scene.add(envSun);
    envFill=new THREE.DirectionalLight(0xaedfff,1.55);envFill.position.set(90,38,80);scene.add(envFill);

    environmentGroup=new THREE.Group();environmentGroup.name='3DEnvironmentVectors';scene.add(environmentGroup);
    windVectorGroup=new THREE.Group();currentVectorGroup=new THREE.Group();environmentForceGroup=new THREE.Group();
    environmentGroup.add(windVectorGroup,currentVectorGroup,environmentForceGroup);

    shipRoot=new THREE.Group();shipRoot.rotation.order='ZXY';scene.add(shipRoot);
    createWater();createSkyDome();createRainSystem();
    installHydroPicking();

    resize();
    sceneReady=true;
    document.getElementById('threeDContainer')?.classList.add('clean-layout');
    setViewActive(!container?.classList.contains('pointer-events-none'));
    loadTeacherState();
    populateOperationalChallenges();
    applyTeacherAssignmentFilter();
    setCutawayMode(cutawayMode);
    updateCameraStatus();
    loading?.classList.add('hidden');
    if(statusEl)statusEl.textContent='Three.js WebGL scene ready · waiting for vessel snapshot';
    const boot=window.AMCOL_GET_RENDER_SNAPSHOT?.();
    if(boot?.state)hardLoadVesselSnapshot(boot.state,boot.runtime||{});
    else if(latestState)hardLoadVesselSnapshot(latestState,latestRuntime);
    animate3D();
  }catch(err){
    console.error('3D initialisation failed:',err);
    if(loading)loading.innerHTML='<div class="three-d-control rounded-xl px-4 py-3 text-center"><div class="text-rose-300 font-black text-xs">3D VIEW UNAVAILABLE</div><div class="text-[9px] text-slate-400 mt-1">WebGL or the Three.js CDN could not initialise. Use the 2D Teaching view.</div></div>';
    if(statusEl)statusEl.textContent='3D unavailable · 2D simulator remains functional';
  }
}

function updateCameraLimits(s){
  if(!controls||!s)return;
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  const span=Math.max(L,B*2,D*4);
  controls.minDistance=Math.max(D*1.4,B*.8);
  controls.maxDistance=span*5;
}

function cameraDistanceFor(s,axis='long'){
  const L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  const fov=THREE.MathUtils.degToRad(camera.fov);
  const targetSize=axis==='side'?L:Math.max(B,D*2.2);
  return Math.max(targetSize/(2*Math.tan(fov/2))*1.25,D*4);
}



function interactionUI(){
  document.getElementById('interactionInspectBtn')?.classList.toggle('active',interactionMode==='inspect');
  document.getElementById('interactionCargoBtn')?.classList.toggle('active',interactionMode==='cargo');
  document.getElementById('interactionCraneBtn')?.classList.toggle('active',interactionMode==='crane');
  document.getElementById('interactionAxisX')?.classList.toggle('active',interactionAxis==='x');
  document.getElementById('interactionAxisY')?.classList.toggle('active',interactionAxis==='y');
  document.getElementById('interactionAxisZ')?.classList.toggle('active',interactionAxis==='z');
  container?.classList.toggle('direct-manipulation',interactionMode!=='inspect');
}
function setInteractionMode(mode){
  interactionMode=['inspect','cargo','crane'].includes(mode)?mode:'inspect';
  try{localStorage.setItem('amcol_3d_interaction_mode',interactionMode);}catch(e){}
  deselectInteractiveObject(false);
  interactionUI();
  const el=document.getElementById('interactionReadout');
  if(el)el.innerHTML=interactionMode==='inspect'
    ? 'Inspection mode. Click K/B/G/M₀, cargo, tanks, crane or damage for information.'
    : `Select a <b>${interactionMode==='cargo'?'cargo / ballast block':'crane hook or suspended load'}</b> in the 3D vessel.`;
}

function setSelectedLongitudinalZone(zone){
  if(interactionMode!=='cargo'||!interactiveObject||interactiveObject.userData?.operationType!=='cargo'){
    const el=document.getElementById('interactionReadout');if(el)el.innerHTML='<span class="warn">Select Cargo mode and click a cargo block first.</span>';
    return;
  }
  const L=Math.max(20,+latestState?.length||80),map={bow:.40,forward:.23,mid:0,aft:-.23,stern:-.40};
  if(!(zone in map))return;
  const lcg=L*map[zone],id=interactiveObject.userData?.operationData?.id;
  const name=interactiveObject.userData?.operationData?.name||'Cargo';
  const result=window.AMCOL_DIRECT3D_BRIDGE?.moveCargo?.(id,{lcg});
  if(result?.ok){
    recordMissionAction(`Cargo longitudinal position: ${name} → ${zone.toUpperCase()} (LCG ${lcg.toFixed(2)} m).`,'3d');
    transformControls?.detach();interactiveObject=null;interactiveOriginal=null;interactionDragging=false;interactionCommitPending=false;
    setInteractionAxis('z');setTimeout(()=>updateStabilityAdvisor(),80);
  }
}
function stabilityAdvisorData(s=latestState){
  if(!s)return {items:[],primary:'No simulator state available.'};
  const L=Math.max(1,+s.length||80),B=Math.max(1,+s.beam||16),trim=+s.trimMeters||((+s.draftBow||0)-(+s.draftStern||0));
  const items=[];
  if(Math.abs(trim)>Math.max(.20,L*.003))items.push({level:'warn',text:trim>0?'Bow-heavy: move cargo aft or transfer ballast Fore → Aft in matched Port/Starboard pairs.':'Stern-heavy: move cargo forward or transfer ballast Aft → Fore in matched Port/Starboard pairs.'});
  if(Math.abs(+s.tcg||0)>B*.008||Math.abs(+s.equilibrium||0)>1)items.push({level:'warn',text:(+s.tcg||0)>0?'Starboard-heavy: shift weight towards centre/Port or transfer ballast Starboard → Port at the same longitudinal station.':'Port-heavy: shift weight towards centre/Starboard or transfer ballast Port → Starboard at the same longitudinal station.'});
  if((+s.gm||0)<.15)items.push({level:'danger',text:'Low corrected GM: lower heavy weights, reduce high cargo and remove free-surface penalty by emptying or pressing-up slack tanks where operationally appropriate.'});
  if((+s.fsc||0)>.05)items.push({level:'warn',text:'Free-surface correction is significant in this teaching model: minimise the number of slack tanks; complete transfers so tanks become fuller or emptier.'});
  if((+s.ukc||0)<1)items.push({level:'danger',text:'Low teaching UKC margin: avoid adding ballast/cargo solely to correct stability without checking resulting draught and the vessel-specific minimum UKC requirement.'});
  if(Math.abs(+s.lcg||0)>L*.08)items.push({level:'warn',text:'Large longitudinal CG offset: redistribute cargo/ballast closer to amidships where practicable, while checking the longitudinal-strength curve.'});
  if(s.strength?.concentration>.18)items.push({level:'danger',text:'Longitudinal weight distribution is highly concentrated in the teaching strength model. Reduce heavy end/cluster loading before optimising trim with ballast.'});
  else if(s.strength?.concentration>.13)items.push({level:'warn',text:'Longitudinal concentration is elevated. Prefer spreading heavy cargo over a greater length rather than correcting trim only with ballast.'});
  if(s.individualBallastFSE&&(+s.fsmIndividual||0)>0)items.push({level:'warn',text:'Individual ballast free surfaces are active: complete transfers toward pressed-up or empty tanks where operationally appropriate to reduce FSM.'});
  if(!s.coupledValid)items.push({level:'danger',text:'Coupled heel–trim–sinkage equilibrium did not fully converge. Treat the condition as unresolved and review loading inputs.'});else if(s.coupledMode==='gz-loll-branch')items.push({level:'warn',text:'Negative-GM condition: heel is taken from the established nonlinear GZ angle-of-loll branch while Phase 12 couples trim and sinkage around it. Recover positive GM before normal optimisation.'});
  if((+s.gm||0)>=.15&&Math.abs(trim)<=Math.max(.20,L*.003)&&Math.abs(+s.equilibrium||0)<=1&&(+s.ukc||0)>=1&&s.coupledValid&&(s.strength?.concentration||0)<.13)items.push({level:'ok',text:'Condition is reasonably balanced in the teaching model: coupled equilibrium converged, list/trim are controlled and longitudinal concentration is modest.'});
  return {items,trim};
}
function updateStabilityAdvisor(){
  const el=document.getElementById('stabilityAdvisorReadout');if(!el||!latestState)return;
  const d=stabilityAdvisorData(latestState),cls={ok:'text-emerald-300',warn:'text-amber-200',danger:'text-rose-300'};
  const trimDir=d.trim>0?'by bow':d.trim<0?'by stern':'even';
  el.innerHTML=`<div class="text-slate-500 mb-1">Coupled <b class="${latestState.coupledValid?'text-emerald-300':'text-rose-300'}">${latestState.coupledValid?'SOLVED':'CHECK'}</b> · Trim <b class="text-slate-200">${Math.abs(d.trim).toFixed(2)} m ${trimDir}</b> · Strength index <b class="text-slate-200">${((latestState.strength?.concentration||0)*100).toFixed(1)}%</b></div>`+
    d.items.slice(0,4).map((x,i)=>`<div class="${cls[x.level]||'text-slate-300'}">${i+1}. ${x.text}</div>`).join('');
}

function setInteractionAxis(axis){
  interactionAxis=['x','y','z'].includes(axis)?axis:'x';
  try{localStorage.setItem('amcol_3d_interaction_axis',interactionAxis);}catch(e){}
  if(transformControls){
    transformControls.showX=interactionAxis==='x';
    transformControls.showY=interactionAxis==='y';
    transformControls.showZ=interactionAxis==='z';
  }
  if(interactionAxis==='z'&&(interactionMode==='cargo'||interactionMode==='crane')&&['bow','stern','top'].includes(currentPreset))setCameraPreset('starboard');
  interactionUI();updateInteractionReadout();
}
function setInteractionSnap(v){
  interactionSnap=Math.max(0,Number(v)||0);
  try{localStorage.setItem('amcol_3d_interaction_snap',String(interactionSnap));}catch(e){}
  if(transformControls)transformControls.setTranslationSnap(interactionSnap||null);
}
function interactionLimits(type=interactiveOriginal?.type||interactiveObject?.userData?.operationType){
  const s=latestState||{},B=(+s.beam||16),D=(+s.depth||10),L=(+s.length||80);
  return {
    x:Math.max(1,B*(type==='crane'?.78:.46)),
    yMin:type==='crane'?D*1.02:.15,
    yMax:Math.max(1,D*(type==='crane'?2.60:1.28)),
    z:Math.max(4,L*.45)
  };
}
function constrainedInteractiveLocalPosition(obj){
  if(!obj||!shipRoot)return null;
  const p=obj.getWorldPosition(new THREE.Vector3());
  const local=shipRoot.worldToLocal(p.clone());
  const lim=interactionLimits();
  local.x=Math.max(-lim.x,Math.min(lim.x,local.x));
  local.y=Math.max(lim.yMin,Math.min(lim.yMax,local.y));
  local.z=Math.max(-lim.z,Math.min(lim.z,local.z));
  return local;
}
function applyLocalPositionToObject(obj,local){
  if(!obj||!obj.parent||!shipRoot||!local)return;
  const world=shipRoot.localToWorld(local.clone());
  obj.parent.updateMatrixWorld(true);
  obj.position.copy(obj.parent.worldToLocal(world));
}
function selectInteractiveObject(obj){
  if(!obj||!transformControls)return false;
  let type=obj.userData?.operationType;
  if(interactionMode==='cargo'&&type!=='cargo')return false;
  if(interactionMode==='crane'&&type!=='crane')return false;
  if(interactionMode==='crane'&&type==='crane'&&obj.userData?.operationRole!=='hook'){
    const hook=operationPickables.find(o=>o.userData?.operationType==='crane'&&o.userData?.operationRole==='hook');
    if(hook)obj=hook;
  }
  type=obj.userData?.operationType;

  interactiveObject=obj;
  interactiveOriginal={
    position:obj.position.clone(),
    world:obj.getWorldPosition(new THREE.Vector3()),
    data:{...(obj.userData.operationData||{})},
    type
  };
  transformControls.attach(obj);
  transformControls.setMode('translate');
  transformControls.setSpace('local');
  transformControls.showX=interactionAxis==='x';
  transformControls.showY=interactionAxis==='y';
  transformControls.showZ=interactionAxis==='z';
  transformControls.setTranslationSnap(interactionSnap||null);
  selectedInspectionObject=obj;
  updateInteractionReadout();
  return true;
}
function deselectInteractiveObject(restore=false){
  if(restore&&interactiveObject&&interactiveOriginal){
    interactiveObject.position.copy(interactiveOriginal.position);
  }
  transformControls?.detach();
  interactiveObject=null;interactiveOriginal=null;interactionDragging=false;interactionCommitPending=false;
  updateInteractionReadout();
}
function updateInteractionReadout(){
  const el=document.getElementById('interactionReadout');if(!el)return;
  if(!interactiveObject||!interactiveOriginal){
    el.innerHTML=interactionMode==='inspect'
      ? 'Inspection mode. Direct manipulation is disabled.'
      : `Mode <b>${interactionMode.toUpperCase()}</b> · axis <b>${interactionAxis.toUpperCase()}</b><br>Click a compatible object to attach the movement handle.`;
    return;
  }
  const local=constrainedInteractiveLocalPosition(interactiveObject);
  if(!local)return;
  const axisName=interactionAxis==='x'?'TCG / SIDE':interactionAxis==='y'?'VCG / VERTICAL':'LCG / FORE-AFT';
  if(interactiveOriginal.type==='cargo'){
    const d=interactiveOriginal.data;
    el.innerHTML=`Selected <b>${d.name||'Cargo'}</b> · ${(+d.mass||0).toFixed(0)}t<br>`+
      `${axisName}<br>`+
      `TCG <b>${local.x>=0?'+':''}${local.x.toFixed(2)}m</b> · VCG <b>${local.y.toFixed(2)}m</b> · LCG <b>${(-local.z)>=0?'+':''}${(-local.z).toFixed(2)}m</b><br>`+
      `<span class="warn">Release the handle to recalculate stability.</span>`;
  }else{
    el.innerHTML=`Selected <b>Crane suspended load</b><br>`+
      `${axisName}<br>`+
      `Side position <b>${local.x>=0?'+':''}${local.x.toFixed(2)}m</b> · Hook <b>${local.y.toFixed(2)}m</b> · LCG <b>${(-local.z)>=0?'+':''}${(-local.z).toFixed(2)}m</b><br>`+
      `<span class="warn">Release the handle to write crane settings.</span>`;
  }
}
function commitInteractiveObject(){
  if(!interactiveObject||!interactiveOriginal||!window.AMCOL_DIRECT3D_BRIDGE)return;
  const local=constrainedInteractiveLocalPosition(interactiveObject);if(!local)return;
  applyLocalPositionToObject(interactiveObject,local);

  const type=interactiveOriginal.type;
  let result=null;
  if(type==='cargo'){
    const id=interactiveOriginal.data.id;
    result=window.AMCOL_DIRECT3D_BRIDGE.moveCargo(id,{tcg:local.x,vcg:local.y,lcg:-local.z});
    if(result?.ok)recordMissionAction(`3D cargo move committed: ${interactiveOriginal.data.name||'Cargo'} → TCG ${local.x.toFixed(2)} m, VCG ${local.y.toFixed(2)} m, LCG ${(-local.z).toFixed(2)} m.`,'3d');
  }else if(type==='crane'){
    result=window.AMCOL_DIRECT3D_BRIDGE.moveCrane({tcg:local.x,height:local.y,lcg:-local.z});
    if(result?.ok)recordMissionAction(`3D crane move committed: side position ${local.x.toFixed(2)} m, hook ${local.y.toFixed(2)} m, LCG ${(-local.z).toFixed(2)} m.`,'3d');
  }

  const el=document.getElementById('interactionReadout');
  if(el&&result?.ok)el.innerHTML=`<span class="ok">Committed to simulator.</span><br>Stability has been recalculated from the updated numeric inputs.`;
  transformControls.detach();
  interactiveObject=null;interactiveOriginal=null;interactionDragging=false;interactionCommitPending=false;
}
function setupTransformControls(){
  if(!camera||!renderer||!scene)return;
  transformControls=new TransformControls(camera,renderer.domElement);
  transformControls.setMode('translate');
  transformControls.setSpace('local');
  transformControls.setSize(.72);
  transformControls.setTranslationSnap(interactionSnap);
  const helper=transformControls.getHelper();
  scene.add(helper);

  transformControls.addEventListener('dragging-changed',e=>{
    interactionDragging=!!e.value;
    controls.enabled=!e.value;
    if(e.value)cameraTween=null;
    else if(interactionCommitPending||interactiveObject)commitInteractiveObject();
  });
  transformControls.addEventListener('objectChange',()=>{
    if(!interactiveObject)return;
    const local=constrainedInteractiveLocalPosition(interactiveObject);
    if(local)applyLocalPositionToObject(interactiveObject,local);
    interactionCommitPending=true;
    updateInteractionReadout();
  });
  interactionUI();
}


function ballastTankDefs(s=latestState){
  const B=Math.max(4,+s?.beam||16),D=Math.max(3,+s?.depth||10),L=Math.max(20,+s?.length||80);
  const x=B*.32,lf=L*.29,y=D*.24;
  return {
    PF:{key:'PF',name:'Port Fore',tcg:-x,lcg:+lf,x:-x,y,z:-lf}, SF:{key:'SF',name:'Starboard Fore',tcg:+x,lcg:+lf,x:+x,y,z:-lf},
    PM:{key:'PM',name:'Port Midship',tcg:-x,lcg:0,x:-x,y,z:0}, SM:{key:'SM',name:'Starboard Midship',tcg:+x,lcg:0,x:+x,y,z:0},
    PA:{key:'PA',name:'Port Aft',tcg:-x,lcg:-lf,x:-x,y,z:+lf}, SA:{key:'SA',name:'Starboard Aft',tcg:+x,lcg:-lf,x:+x,y,z:+lf}
  };
}
function escBallastText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ballastPlanFromBridge(){
  const direct=window.AMCOL_DIRECT3D_BRIDGE?.getBallastPlan?.();
  if(Array.isArray(direct))return direct;
  const statePlan=window.AMCOL_DIRECT3D_BRIDGE?.getState?.()?.ballastTanks;
  return Array.isArray(statePlan)?statePlan:[];
}
function ballastPlanStructureSignature(plan=[]){
  return plan.map((t,i)=>[String(t.id||t.key||i),Number(t.capacity||0).toFixed(2),Number(t.lcg||0).toFixed(2),Number(t.tcg||0).toFixed(2),Number(t.length||0).toFixed(2),Number(t.breadth||0).toFixed(2),Number(t.height||0).toFixed(2)].join(':')).join('|');
}
function ballastPlanValueSignature(plan=[]){
  return plan.map((t,i)=>[String(t.id||t.key||i),Number(t.mass||0).toFixed(3),Number(t.fill||0).toFixed(3),t.sourceLocked?'L':'U'].join(':')).join('|');
}
function ballastTankSide(t){
  const s=String(t?.side||'').toLowerCase();if(s==='port'||s==='starboard'||s==='centre'||s==='center')return s==='center'?'centre':s;
  return (+t?.tcg||0)<-.01?'port':(+t?.tcg||0)>.01?'starboard':'centre';
}
function labTankFromPlan(t,i=0){
  const cap=Math.max(.001,Number(t.capacity)||Number(t.mass)||1),mass=Math.max(0,Math.min(cap,Number(t.mass)||0));
  const id=String(t.id||t.key||`tank_${i}`),side=ballastTankSide(t);
  return {
    id,key:id,name:String(t.name||`Ballast Tank ${i+1}`),type:String(t.type||'Ballast'),side,source:String(t.source||'representative'),
    sourceLocked:!!t.sourceLocked,sourceSpecific:!!t.sourceSpecific,modified:false,
    capacity:cap,mass,fill:mass/cap,vcg:Number(t.vcg)||0,fsm:Number(t.fsm)||0,tcg:Number(t.tcg)||0,lcg:Number(t.lcg)||0,
    bottom:Math.max(0,Number(t.bottom)||0),length:Math.max(.1,Number(t.length)||1),breadth:Math.max(.1,Number(t.breadth)||1),height:Math.max(.1,Number(t.height)||1),density:Math.max(.1,Number(t.density)||1.025),
    x:Number(t.tcg)||0,z:-(Number(t.lcg)||0),y:0
  };
}
function ballastLabTankArray(){return Object.values(ballastLab.tanks||{});}
function routePartnerScore(src,dst){
  if(!src||!dst||src.key===dst.key)return 1e9;
  const sidePenalty=(src.side==='port'&&dst.side==='starboard')||(src.side==='starboard'&&dst.side==='port')?0:src.side===dst.side?2:1;
  const longitudinal=Math.abs((+src.lcg||0)-(+dst.lcg||0))/Math.max(1,+latestState?.length||80);
  const emptyBonus=1-Math.max(0,Math.min(1,dst.mass/Math.max(.001,dst.capacity)));
  return sidePenalty+longitudinal-emptyBonus*.35;
}
function chooseDefaultBallastRoute(){
  const arr=ballastLabTankArray();if(!arr.length)return {source:'',destination:''};
  const loaded=arr.filter(t=>t.mass>.001).sort((a,b)=>b.mass-a.mass);
  const src=loaded[0]||arr[0];
  const dst=arr.filter(t=>t.key!==src.key&&t.capacity-t.mass>.001).sort((a,b)=>routePartnerScore(src,a)-routePartnerScore(src,b))[0]||arr.find(t=>t.key!==src.key)||src;
  return {source:src.key,destination:dst.key};
}
function compactTankName(t){
  const n=String(t?.name||t?.key||'Tank');return n.length>24?n.slice(0,22)+'…':n;
}
function populateBallastRouteSelects(preserve=true){
  const srcEl=document.getElementById('ballastSource'),dstEl=document.getElementById('ballastDestination');if(!srcEl||!dstEl)return;
  const arr=ballastLabTankArray().sort((a,b)=>(+b.lcg||0)-(+a.lcg||0)||(+a.tcg||0)-(+b.tcg||0));
  const oldS=preserve?(srcEl.value||ballastLab.source):'',oldD=preserve?(dstEl.value||ballastLab.destination):'';
  const options=arr.map(t=>`<option value="${escBallastText(t.key)}">${escBallastText(compactTankName(t))} · ${(t.fill*100).toFixed(0)}% · ${t.mass.toFixed(0)}/${t.capacity.toFixed(0)}t</option>`).join('');
  srcEl.innerHTML=options;dstEl.innerHTML=options;
  const def=chooseDefaultBallastRoute();
  ballastLab.source=arr.some(t=>t.key===oldS)?oldS:def.source;
  ballastLab.destination=arr.some(t=>t.key===oldD&&t.key!==ballastLab.source)?oldD:def.destination;
  if(ballastLab.destination===ballastLab.source)ballastLab.destination=arr.find(t=>t.key!==ballastLab.source)?.key||ballastLab.source;
  srcEl.value=ballastLab.source;dstEl.value=ballastLab.destination;
}
function syncBallastLabFromVessel(opts={}){
  if(!latestState||!window.AMCOL_DIRECT3D_BRIDGE)return;
  if(ballastLab.running)stopBallastTransfer();
  const plan=ballastPlanFromBridge(),el=document.getElementById('ballastLabReadout');
  if(!plan.length){
    ballastLab.active=false;ballastLab.tanks={};ballastLab.status='No ballast tank plan';ballastLab.planSignature='';
    clearBallastLabVisuals();updateBallastUI();
    if(el)el.innerHTML='<span class="text-rose-300">No ballast tank plan is available for this vessel. Reload the vessel or open Loading → Ballast Tank Plan.</span>';
    return;
  }
  const preserveSnapshot=opts.preserveSnapshot!==false;
  if(!preserveSnapshot||!ballastLab.originalSnapshot)ballastLab.originalSnapshot=window.AMCOL_DIRECT3D_BRIDGE.getBallastSnapshot?.();
  const previousSource=ballastLab.source,previousDestination=ballastLab.destination;
  ballastLab.tanks={};plan.forEach((t,i)=>{const lt=labTankFromPlan(t,i);ballastLab.tanks[lt.key]=lt;});
  ballastLab.active=true;ballastLab.running=false;ballastLab.paused=false;ballastLab.transferred=0;ballastLab.targetMass=0;ballastLab.status='Ready';ballastLab.scenarioKey=activeScenarioKey();ballastLab.planSignature=ballastPlanStructureSignature(plan);ballastLab.valueSignature=ballastPlanValueSignature(plan);
  ballastLab.source=opts.preserveRoute!==false&&ballastLab.tanks[previousSource]?previousSource:'';
  ballastLab.destination=opts.preserveRoute!==false&&ballastLab.tanks[previousDestination]?previousDestination:'';
  populateBallastRouteSelects(true);refreshBallastTankPhysics();buildBallastLabVisuals();setBallastRoute();updateBallastUI();
}
function refreshBallastLabValuesFromVessel(forceUI=false){
  if(!ballastLab.active||ballastLab.running)return false;const plan=ballastPlanFromBridge();if(!plan.length)return false;
  const sig=ballastPlanStructureSignature(plan);if(sig!==ballastLab.planSignature){syncBallastLabFromVessel({preserveSnapshot:false,preserveRoute:false});return true;}
  const valueSig=ballastPlanValueSignature(plan);if(valueSig===ballastLab.valueSignature){if(forceUI){populateBallastRouteSelects(true);updateBallastUI();}return false;}
  plan.forEach((p,i)=>{const key=String(p.id||p.key||`tank_${i}`),t=ballastLab.tanks[key];if(!t)return;const fresh=labTankFromPlan(p,i);Object.assign(t,fresh,{modified:false});});
  ballastLab.valueSignature=valueSig;refreshBallastTankPhysics();populateBallastRouteSelects(true);updateBallastTankVisuals();rebuildBallastPipe();updateBallastUI();return true;
}
function initialiseBallastLab(){syncBallastLabFromVessel({preserveSnapshot:false,preserveRoute:false});}
function ballastSlackStats(){
  const arr=ballastLabTankArray(),slack=arr.filter(t=>t.capacity>0&&t.mass>.001&&t.mass<t.capacity-.001),avg=slack.length?slack.reduce((a,t)=>a+t.mass/t.capacity*100,0)/slack.length:100;
  return {slackCount:slack.length,avgFill:avg};
}
function refreshBallastTankPhysics(){
  if(!ballastLab.active)return;
  ballastLabTankArray().forEach(t=>{
    const fill=Math.max(0,Math.min(1,t.mass/Math.max(.001,t.capacity)));t.fill=fill;t.x=+t.tcg||0;t.z=-(+t.lcg||0);
    if(t.modified||!t.sourceLocked){
      t.vcg=t.bottom+t.height*fill*.5;
      t.fsm=(fill>.001&&fill<.98)?t.density*t.length*Math.pow(t.breadth,3)/12:0;
    }
  });
}
function ballastPayload(){
  refreshBallastTankPhysics();return ballastLabTankArray().map(t=>({id:t.id,key:t.key,name:t.name,mass:t.mass,capacity:t.capacity,fill:t.fill,vcg:t.vcg,tcg:t.tcg,lcg:t.lcg,length:t.length,breadth:t.breadth,height:t.height,bottom:t.bottom,density:t.density,modified:!!t.modified}));
}
function commitBallastLab(force=false){
  if(!ballastLab.active||!window.AMCOL_DIRECT3D_BRIDGE)return;
  const now=performance.now();if(!force&&now-ballastLab.lastCommit<180)return;
  ballastLab.lastCommit=now;window.AMCOL_DIRECT3D_BRIDGE.applyBallastLab(ballastPayload());
}
function findTransferDestination(src,candidates,preferSameSide=true){
  return candidates.filter(d=>d.key!==src.key&&d.capacity-d.mass>.001).sort((a,b)=>{
    const sa=preferSameSide?(a.side===src.side?0:1):0,sb=preferSameSide?(b.side===src.side?0:1):0;
    return sa-sb+Math.abs((+a.lcg||0)-(+src.lcg||0))/Math.max(1,+latestState?.length||80)-Math.abs((+b.lcg||0)-(+src.lcg||0))/Math.max(1,+latestState?.length||80);
  })[0];
}
function applyPairedTrimAssist(){
  if(!ballastLab.active){syncBallastLabFromVessel({preserveSnapshot:false});if(!ballastLab.active)return;}
  stopBallastTransfer();const s=latestState;if(!s)return;
  const trim=+s.trimMeters||0;if(Math.abs(trim)<.01){ballastLab.status='Trim already near neutral';updateBallastUI();return;}
  const sternDown=trim>0,arr=ballastLabTankArray();
  const sources=arr.filter(t=>t.mass>.001&&(sternDown?t.lcg<-.01:t.lcg>.01)).sort((a,b)=>Math.abs(b.lcg)-Math.abs(a.lcg));
  const destinations=arr.filter(t=>t.capacity-t.mass>.001&&(sternDown?t.lcg>.01:t.lcg<-.01));
  let needMoment=Math.abs(trim*100*(+s.mct1cm||0));if(!(needMoment>0))needMoment=Math.abs((+s.dispMass||0)*(+s.lcg||0));let moved=0;
  for(const src of sources){if(needMoment<=.01)break;const dst=findTransferDestination(src,destinations,true);if(!dst)continue;const arm=Math.abs(dst.lcg-src.lcg);if(arm<.1)continue;const q=Math.min(src.mass,Math.max(0,dst.capacity-dst.mass),needMoment/arm);if(q<=.001)continue;src.mass-=q;dst.mass+=q;src.modified=dst.modified=true;moved+=q;needMoment-=q*arm;}
  ballastLab.status=moved>0?`Trim assist moved ${moved.toFixed(1)} t ${sternDown?'Aft → Fore':'Fore → Aft'}`:'Insufficient ballast/capacity for trim correction';
  updateBallastTankVisuals();commitBallastLab(true);populateBallastRouteSelects(true);rebuildBallastPipe();updateBallastUI();if(moved>0)recordMissionAction(ballastLab.status,'ballast');setTimeout(()=>updateStabilityAdvisor(),80);
}
function applyPairedListAssist(){
  if(!ballastLab.active){syncBallastLabFromVessel({preserveSnapshot:false});if(!ballastLab.active)return;}
  stopBallastTransfer();const s=latestState;if(!s)return;
  const tcg=+s.tcg||0;if(Math.abs(tcg)<.005){ballastLab.status='List already near neutral';updateBallastUI();return;}
  const heavy=tcg>0?'starboard':'port',light=heavy==='starboard'?'port':'starboard',arr=ballastLabTankArray();
  const sources=arr.filter(t=>t.side===heavy&&t.mass>.001).sort((a,b)=>b.mass-a.mass),destinations=arr.filter(t=>t.side===light&&t.capacity-t.mass>.001);
  let needMoment=Math.abs((+s.dispMass||0)*tcg),moved=0;
  for(const src of sources){if(needMoment<=.01)break;const dst=destinations.filter(d=>d.key!==src.key).sort((a,b)=>Math.abs(a.lcg-src.lcg)-Math.abs(b.lcg-src.lcg))[0];if(!dst)continue;const arm=Math.abs(dst.tcg-src.tcg);if(arm<.1)continue;const q=Math.min(src.mass,Math.max(0,dst.capacity-dst.mass),needMoment/arm);if(q<=.001)continue;src.mass-=q;dst.mass+=q;src.modified=dst.modified=true;moved+=q;needMoment-=q*arm;}
  ballastLab.status=moved>0?`List assist moved ${moved.toFixed(1)} t ${heavy==='starboard'?'Starboard → Port':'Port → Starboard'}`:'Insufficient ballast/capacity for list correction';
  updateBallastTankVisuals();commitBallastLab(true);populateBallastRouteSelects(true);rebuildBallastPipe();updateBallastUI();if(moved>0)recordMissionAction(ballastLab.status,'ballast');setTimeout(()=>updateStabilityAdvisor(),80);
}
function setBallastFSECoupling(){ballastLab.status='Tank FSC follows the main Free Surface setting';updateBallastUI();}
function setBallastCapacity(){ballastLab.status='Each vessel tank now uses its own actual/representative capacity';updateBallastUI();}
function setBallastRoute(){
  const srcEl=document.getElementById('ballastSource'),dstEl=document.getElementById('ballastDestination');
  ballastLab.source=srcEl?.value||ballastLab.source;ballastLab.destination=dstEl?.value||ballastLab.destination;
  if(ballastLab.destination===ballastLab.source){const alt=ballastLabTankArray().find(t=>t.key!==ballastLab.source);if(alt){ballastLab.destination=alt.key;if(dstEl)dstEl.value=alt.key;}}
  rebuildBallastPipe();updateBallastUI();
}
function chooseBallastTank(key,role='source',encoded=false){
  if(encoded){try{key=decodeURIComponent(key);}catch(e){}}
  if(!ballastLab.tanks[key])return;const el=document.getElementById(role==='destination'?'ballastDestination':'ballastSource');if(el)el.value=key;
  if(role==='destination')ballastLab.destination=key;else ballastLab.source=key;
  if(ballastLab.source===ballastLab.destination){const alt=ballastLabTankArray().find(t=>t.key!==key);if(alt){if(role==='source')ballastLab.destination=alt.key;else ballastLab.source=alt.key;}}
  populateBallastRouteSelects(true);rebuildBallastPipe();updateBallastUI();
}
function startBallastTransfer(){
  if(!ballastLab.active){syncBallastLabFromVessel({preserveSnapshot:false});if(!ballastLab.active)return;}
  setBallastRoute();if(ballastLab.source===ballastLab.destination){ballastLab.status='Source and destination must differ';updateBallastUI();return;}
  const src=ballastLab.tanks[ballastLab.source],dst=ballastLab.tanks[ballastLab.destination];if(!src||!dst){ballastLab.status='Select valid vessel tanks';updateBallastUI();return;}
  const requested=Math.max(0,+document.getElementById('ballastTransferMass')?.value||0),available=Math.max(0,src.mass),space=Math.max(0,dst.capacity-dst.mass);
  ballastLab.targetMass=Math.min(requested,available,space);ballastLab.rate=Math.max(.1,+document.getElementById('ballastPumpRate')?.value||50);ballastLab.timeScale=Math.max(1,+document.getElementById('ballastTimeScale')?.value||1);ballastLab.transferred=0;
  if(available<=.001){ballastLab.status=`${src.name} is empty · set its ballast level in Loading first`;updateBallastUI();return;}
  if(space<=.001){ballastLab.status=`${dst.name} is full · choose another destination`;updateBallastUI();return;}
  if(ballastLab.targetMass<=.001){ballastLab.status='Enter a transfer mass greater than 0';updateBallastUI();return;}
  ballastLab.running=true;ballastLab.paused=false;ballastLab.status='Pumping';recordMissionAction(`Ballast transfer started: ${src.name} → ${dst.name}, target ${ballastLab.targetMass.toFixed(1)} t at ${ballastLab.rate.toFixed(1)} t/min.`,'ballast');rebuildBallastPipe();updateBallastUI();
}
function toggleBallastPause(){if(!ballastLab.running)return;ballastLab.paused=!ballastLab.paused;ballastLab.status=ballastLab.paused?'Paused':'Pumping';updateBallastUI();}
function stopBallastTransfer(){if(ballastLab.running){commitBallastLab(true);recordMissionAction(`Ballast transfer stopped after ${ballastLab.transferred.toFixed(1)} t.`,'ballast');}ballastLab.running=false;ballastLab.paused=false;if(ballastLab.active)ballastLab.status='Stopped';populateBallastRouteSelects(true);updateBallastUI();}
function resetBallastLab(){
  if(ballastLab.running)stopBallastTransfer();const snap=ballastLab.originalSnapshot;if(snap)window.AMCOL_DIRECT3D_BRIDGE?.restoreBallastSnapshot?.(snap);
  ballastLab={active:false,running:false,paused:false,tanks:{},source:'',destination:'',targetMass:0,transferred:0,rate:50,timeScale:10,originalSnapshot:null,lastCommit:0,status:'Restored',scenarioKey:'',planSignature:'',valueSignature:''};
  clearBallastLabVisuals();setTimeout(()=>syncBallastLabFromVessel({preserveSnapshot:false,preserveRoute:false}),40);
}
function abandonBallastLabForScenarioChange(){
  ballastLab.active=false;ballastLab.running=false;ballastLab.paused=false;ballastLab.originalSnapshot=null;ballastLab.tanks={};ballastLab.status='Vessel/condition changed · resyncing tanks';ballastLab.scenarioKey='';ballastLab.planSignature='';clearBallastLabVisuals();updateBallastUI();
}
function stepBallastTransfer(dt){
  if(ballastLab.active&&ballastLab.scenarioKey&&activeScenarioKey()!==ballastLab.scenarioKey){abandonBallastLabForScenarioChange();return;}
  if(!ballastLab.active||!ballastLab.running||ballastLab.paused)return;
  const src=ballastLab.tanks[ballastLab.source],dst=ballastLab.tanks[ballastLab.destination];if(!src||!dst){ballastLab.running=false;return;}
  const remaining=ballastLab.targetMass-ballastLab.transferred,amount=Math.min(remaining,src.mass,Math.max(0,dst.capacity-dst.mass),ballastLab.rate*(dt/60)*ballastLab.timeScale);
  if(amount<=1e-6){ballastLab.running=false;ballastLab.status='Transfer limit reached';commitBallastLab(true);populateBallastRouteSelects(true);updateBallastUI();return;}
  src.mass-=amount;dst.mass+=amount;src.modified=dst.modified=true;ballastLab.transferred+=amount;refreshBallastTankPhysics();updateBallastTankVisuals();commitBallastLab(false);updateBallastUI();
  if(ballastLab.transferred>=ballastLab.targetMass-.001){ballastLab.running=false;ballastLab.status='Transfer complete';commitBallastLab(true);recordMissionAction(`Ballast transfer complete: ${ballastLab.transferred.toFixed(1)} t moved ${src.name} → ${dst.name}.`,'ballast');populateBallastRouteSelects(true);updateBallastUI();}
}
function resetBallastTankSelectionStyles(){
  Object.values(ballastTankVisuals||{}).forEach(v=>{
    if(v?.outline?.material?.color)v.outline.material.color.setHex(0x38bdf8);
    if(v?.outline?.material)v.outline.material.opacity=.90;
    if(v?.shell?.material)v.shell.material.opacity=.08;
  });
}
function clearBallastLabVisuals(){
  resetBallastTankSelectionStyles();
  operationPickables=operationPickables.filter(o=>o?.userData?.operationType!=='ballastTransferRoute');
  if(shipRoot){const stale=shipRoot.children.filter(ch=>ch===ballastLabGroup||ch?.name==='VesselBallastTransferRoute');stale.forEach(ch=>{try{shipRoot.remove(ch);disposeObject(ch);}catch(e){console.warn('AMCOL ballast route cleanup:',e);}});}
  ballastLabGroup=null;ballastTankGroup=null;ballastPipeGroup=null;ballastLabelGroup=null;ballastFlowParticles=[];ballastFlowCurve=null;
}
function actualTankVisualPosition(t){
  const v=ballastTankVisuals?.[t.key];
  if(v?.pivot)return {x:v.pivot.position.x,y:v.pivot.position.y,z:v.pivot.position.z};
  if(!latestState)return {x:+t.tcg||0,y:+t.bottom||0,z:-(+t.lcg||0)};
  const raw={...t,name:t.name,type:t.type,side:t.side,tcg:t.tcg,lcg:t.lcg,bottom:t.bottom,length:t.length,breadth:t.breadth,height:t.height,source:t.source};
  const box=ballastTankVisualBox(latestState,raw),sec=shellTankSection(latestState,raw,box);return {x:sec.x,y:sec.y,z:sec.z};
}
function buildBallastLabVisuals(){
  clearBallastLabVisuals();if(!ballastLab.active||!shipRoot||!latestState)return;
  // Transfer mode never creates another set of tank meshes. It only overlays the route
  // and highlights the already-rendered vessel ballast tanks by their persistent IDs.
  ballastLabGroup=new THREE.Group();ballastLabGroup.name='VesselBallastTransferRoute';shipRoot.add(ballastLabGroup);
  ballastPipeGroup=new THREE.Group();ballastPipeGroup.name='BallastTransferPipe';ballastLabGroup.add(ballastPipeGroup);
  refreshBallastTankPhysics();
  ballastLabTankArray().forEach(t=>{const p=actualTankVisualPosition(t);t.x=p.x;t.y=p.y;t.z=p.z;});
  updateBallastTankVisuals();rebuildBallastPipe();updateOperationVisibility();
}
function replaceActualTankLiquid(v,t){
  if(!v?.liquidPivot)return;
  const fill=Math.max(0,Math.min(1,t.fill||0));
  if(v.liquid){operationPickables=operationPickables.filter(o=>o!==v.liquid);v.liquidPivot.remove(v.liquid);disposeObject(v.liquid);v.liquid=null;}
  const liquid=makeFillMesh(v.sectionPoints,v.length,fill,0x0284c7,.48);
  if(liquid){liquid.userData.operationType='tank';liquid.userData.operationData=v.operationData;v.liquidPivot.add(liquid);operationPickables.push(liquid);v.liquid=liquid;}
  if(v.operationData)v.operationData.fill=fill*100;
  if(v.freeSurfaceEntry)v.freeSurfaceEntry.slack=fill>.001&&fill<.999;
  v.lastFill=fill;
}
function updateBallastTankVisuals(){
  if(!ballastLab.active)return;refreshBallastTankPhysics();
  ballastLabTankArray().forEach(t=>{
    const v=ballastTankVisuals?.[t.key];if(!v)return;
    const p=actualTankVisualPosition(t);t.x=p.x;t.y=p.y;t.z=p.z;
    // Rebuild only the water body, never the tank itself. 1% threshold keeps transfer smooth.
    if(!Number.isFinite(v.lastFill)||Math.abs(v.lastFill-t.fill)>=.01||t.fill<=.001||t.fill>=.999)replaceActualTankLiquid(v,t);
    const isSrc=t.key===ballastLab.source,isDst=t.key===ballastLab.destination;
    if(v.outline?.material?.color)v.outline.material.color.setHex(isSrc?0xf59e0b:(isDst?0x22d3ee:0x38bdf8));
    if(v.outline?.material)v.outline.material.opacity=(isSrc||isDst)?1:.90;
    if(v.shell?.material)v.shell.material.opacity=(isSrc||isDst)?.15:.08;
  });
}
function updateBallastFreeSurfaces(){
  // The same actual vessel tank liquid pivots are already maintained by updateTankFreeSurface().
  // No separate transfer-tank free-surface objects exist anymore.
  if(ballastLab.active&&latestState)updateTankFreeSurface(latestState);
}
function rebuildBallastPipe(){
  if(!ballastPipeGroup||!ballastLab.active)return;clearVectorGroup(ballastPipeGroup);ballastFlowParticles=[];ballastFlowCurve=null;const a=ballastLab.tanks[ballastLab.source],b=ballastLab.tanks[ballastLab.destination];if(!a||!b||a.key===b.key)return;
  const D=Math.max(3,+latestState.depth||10),B=Math.max(4,+latestState.beam||16),p0=new THREE.Vector3(a.x,a.y+D*.08,a.z),p1=new THREE.Vector3(a.x,D*.64,a.z),p2=new THREE.Vector3(b.x,D*.64,b.z),p3=new THREE.Vector3(b.x,b.y+D*.08,b.z);ballastFlowCurve=new THREE.CatmullRomCurve3([p0,p1,p2,p3]);const pts=ballastFlowCurve.getPoints(42),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x22d3ee,transparent:true,opacity:.72,depthTest:false}));ballastPipeGroup.add(line);for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.04,B*.010),10,8),new THREE.MeshBasicMaterial({color:0x67e8f9,depthTest:false}));m.userData.flowOffset=i/7;ballastPipeGroup.add(m);ballastFlowParticles.push(m);}
}
function animateBallastFlow(t){if(!ballastFlowCurve)return;ballastFlowParticles.forEach(p=>{const u=((t*(ballastLab.running&&!ballastLab.paused?.22:.035))+p.userData.flowOffset)%1;p.position.copy(ballastFlowCurve.getPointAt(u));p.visible=ballastLab.active;});}
function ballastTankCardHTML(t){
  const pct=Math.max(0,Math.min(100,t.fill*100)),sel=t.key===ballastLab.source?'border-amber-400/60 bg-amber-500/10':t.key===ballastLab.destination?'border-cyan-400/60 bg-cyan-500/10':'border-slate-800 bg-slate-950/65',fillTone=pct>=98?'text-blue-200':pct<=.1?'text-slate-500':'text-cyan-300';
  return `<div class="rounded-lg border ${sel} p-2"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-200 truncate" title="${escBallastText(t.name)}">${escBallastText(compactTankName(t))}</div><div class="text-[8px] text-slate-500">${escBallastText(t.side.toUpperCase())} · LCG ${(t.lcg>=0?'+':'')+t.lcg.toFixed(1)}m</div></div><b class="${fillTone}">${pct.toFixed(0)}%</b></div><div class="mt-1 h-1.5 rounded-full bg-slate-900 overflow-hidden"><div class="h-full bg-cyan-500" style="width:${pct}%"></div></div><div class="mt-1 flex items-center justify-between gap-1 text-[8px]"><span class="text-slate-400">${t.mass.toFixed(0)} / ${t.capacity.toFixed(0)} t</span><span><button onclick="window.AMCOL3D?.chooseBallastTank('${encodeURIComponent(t.key)}','source',true)" class="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300">SRC</button> <button onclick="window.AMCOL3D?.chooseBallastTank('${encodeURIComponent(t.key)}','destination',true)" class="px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300">DST</button></span></div></div>`;
}
function updateBallastUI(){
  const sum=document.getElementById('ballastLabSummary'),el=document.getElementById('ballastLabReadout'),bar=document.getElementById('ballastProgress'),pt=document.getElementById('ballastProgressText'),grid=document.getElementById('ballastTankStatusGrid'),route=document.getElementById('ballastRouteInfo');
  const arr=ballastLabTankArray();if(sum)sum.textContent=ballastLab.active?`${ballastLab.status} · ${arr.length} vessel tanks · ${arr.reduce((a,t)=>a+t.mass,0).toFixed(0)} t ballast`:'Vessel ballast tanks load automatically';
  const pct=ballastLab.targetMass>0?Math.min(100,ballastLab.transferred/ballastLab.targetMass*100):0;if(bar)bar.style.width=pct+'%';if(pt)pt.textContent=`${ballastLab.transferred.toFixed(1)} / ${ballastLab.targetMass.toFixed(1)} t`;
  const pb=document.getElementById('ballastPauseBtn');if(pb)pb.innerHTML=ballastLab.paused?'<i class="fa-solid fa-play mr-1"></i>Resume':'<i class="fa-solid fa-pause mr-1"></i>Pause';
  if(grid)grid.innerHTML=ballastLab.active?arr.sort((a,b)=>(+b.lcg||0)-(+a.lcg||0)||(+a.tcg||0)-(+b.tcg||0)).map(ballastTankCardHTML).join(''):'<div class="col-span-full text-slate-500 p-2">Open this control to sync the current vessel tank plan.</div>';
  if(!ballastLab.active){if(route)route.textContent='Vessel tanks will sync automatically when this panel opens.';if(el)el.innerHTML='The preloaded ballast spaces are permanent vessel tanks. Set tank fill levels in Loading, then use this control for realistic tank-to-tank transfers.';return;}
  refreshBallastTankPhysics();const src=ballastLab.tanks[ballastLab.source],dst=ballastLab.tanks[ballastLab.destination],available=Math.max(0,src?.mass||0),space=Math.max(0,(dst?.capacity||0)-(dst?.mass||0)),maxTransfer=Math.min(available,space);
  if(route)route.innerHTML=src&&dst?`<b class="text-amber-300">${escBallastText(src.name)}</b> → <b class="text-cyan-300">${escBallastText(dst.name)}</b> · source available <b>${available.toFixed(1)} t</b> · destination space <b>${space.toFixed(1)} t</b> · maximum transfer <b>${maxTransfer.toFixed(1)} t</b>`:'Select a valid source and destination tank.';
  const massInput=document.getElementById('ballastTransferMass');if(massInput){massInput.max=Math.max(0,maxTransfer).toFixed(1);if(+massInput.value>maxTransfer&&maxTransfer>0)massInput.value=Math.floor(maxTransfer*10)/10;}
  if(!el)return;const fs=ballastSlackStats(),totalFSM=arr.reduce((a,t)=>a+(t.fsm||0),0),fseOn=!!window.AMCOL_DIRECT3D_BRIDGE?.getState?.()?.fse,bound3D=arr.filter(t=>!!ballastTankVisuals?.[t.key]).length;
  el.innerHTML=`Tank plan <b>${arr.length}</b> spaces · <span class="${bound3D===arr.length?'text-emerald-300':'text-amber-300'}">3D bound <b>${bound3D}/${arr.length}</b></span> · partially filled tanks <b>${fs.slackCount}</b> · current tank FSM <b>${totalFSM.toFixed(0)} t·m</b> · Free Surface <b class="${fseOn?'text-cyan-300':'text-slate-500'}">${fseOn?'ON':'OFF'}</b><br>Ship TCG <b>${(+latestState?.tcg||0)>=0?'+':''}${(+latestState?.tcg||0).toFixed(3)}m</b> · trim <b>${(+latestState?.trimMeters||0)>=0?'+':''}${(+latestState?.trimMeters||0).toFixed(3)}m</b> · GM <b>${(+latestState?.gm||0).toFixed(3)}m</b> · list <b>${(+latestState?.equilibrium||0).toFixed(2)}°</b><br><span class="text-slate-500">Transfers animate and update the same preloaded vessel tank objects shown in the 3D internal arrangement; no transfer-only tank set is generated. Total ballast mass is preserved. For source-locked workbook tanks, the first transfer converts only the modified tanks to user-modified teaching values.</span>`;
}

function toggleCleanTool(name){
  const map={
    hydro:'threeDHydroPanel',operations:'threeDOperationsPanel',environment:'threeDEnvironmentPanel',
    interaction:'threeDInteractionPanel',mission:'operationalMissionPanel',ballast:'threeDBallastLabPanel'
  };
  const container=document.getElementById('threeDContainer');if(!container)return;
  container.classList.add('clean-layout');
  const next=cleanToolOpen===name?'':name;cleanToolOpen=next;
  if(next==='ballast'){
    const plan=ballastPlanFromBridge(),sig=ballastPlanStructureSignature(plan);
    if(!ballastLab.active||sig!==ballastLab.planSignature)syncBallastLabFromVessel({preserveSnapshot:false,preserveRoute:false});
    else refreshBallastLabValuesFromVessel(true);
  }

  // A tool panel and inspector should never compete for the same viewport space.
  closeInspector();

  Object.entries(map).forEach(([key,id])=>{
    const el=document.getElementById(id);if(!el)return;
    const open=key===next;
    el.classList.toggle('clean-panel-open',open);
    if(el.tagName==='DETAILS')el.open=open;
  });
  document.querySelectorAll('#cleanToolDock [data-clean-tool]').forEach(b=>b.classList.toggle('active',b.dataset.cleanTool===next));

  // Keep the GZ curve available but compact while a large tool drawer is open.
  const gz=document.getElementById('gzFloatingPanel');
  if(gz&&next){gzPanelCollapsed=true;gzPanelExpanded=false;gz.classList.add('gz-collapsed');gz.classList.remove('gz-expanded');setTimeout(()=>gzChart?.resize?.(),180);}
}
function loadTeacherState(){
  try{
    const s=JSON.parse(localStorage.getItem(TEACHER_STORE_KEY)||'{}');
    teacherState={examMode:!!s.examMode,leaderboard:!!s.leaderboard,activeAssignment:s.activeAssignment||'',assignmentSets:s.assignmentSets||{},results:Array.isArray(s.results)?s.results:[]};
  }catch(e){teacherState={examMode:false,leaderboard:false,activeAssignment:'',assignmentSets:{},results:[]};}
  applyTeacherExamMode();refreshTeacherDashboard();applyTeacherAssignmentFilter();
}
function saveTeacherState(){
  try{localStorage.setItem(TEACHER_STORE_KEY,JSON.stringify(teacherState));}catch(e){}
}
function teacherHasPin(){try{return !!localStorage.getItem(TEACHER_PIN_KEY);}catch(e){return false;}}
function openTeacherDashboard(){
  document.getElementById('teacherDashboardBackdrop')?.classList.remove('hidden');
  document.getElementById('teacherDashboardDrawer')?.classList.add('open');
  if(!teacherUnlocked){
    document.getElementById('teacherLockedView')?.classList.remove('hidden');
    document.getElementById('teacherUnlockedView')?.classList.add('hidden');
    const msg=document.getElementById('teacherLockMessage');if(msg)msg.textContent=teacherHasPin()?'Enter the local instructor PIN.':'No instructor PIN is set on this browser. Enter 4–8 digits to create one.';
    setTimeout(()=>document.getElementById('teacherPinInput')?.focus(),80);
  }else refreshTeacherDashboard();
}
function closeTeacherDashboard(){
  document.getElementById('teacherDashboardBackdrop')?.classList.add('hidden');
  document.getElementById('teacherDashboardDrawer')?.classList.remove('open');
}
function unlockTeacherDashboard(){
  const inp=document.getElementById('teacherPinInput'),pin=(inp?.value||'').trim();
  if(!/^\d{4,8}$/.test(pin)){alert('Use a 4–8 digit instructor PIN.');return;}
  let stored='';try{stored=localStorage.getItem(TEACHER_PIN_KEY)||'';}catch(e){}
  if(!stored){try{localStorage.setItem(TEACHER_PIN_KEY,pin);}catch(e){}}
  else if(stored!==pin){alert('Incorrect instructor PIN.');return;}
  teacherUnlocked=true;if(inp)inp.value='';
  document.getElementById('teacherLockedView')?.classList.add('hidden');
  document.getElementById('teacherUnlockedView')?.classList.remove('hidden');
  refreshTeacherDashboard();
}
function lockTeacherDashboard(){teacherUnlocked=false;closeTeacherDashboard();}
function changeTeacherPin(){
  if(!teacherUnlocked)return;
  const pin=prompt('Enter a new 4–8 digit instructor PIN:');if(pin===null)return;
  if(!/^\d{4,8}$/.test(pin.trim())){alert('PIN must contain 4–8 digits.');return;}
  try{localStorage.setItem(TEACHER_PIN_KEY,pin.trim());}catch(e){}
  alert('Instructor PIN updated on this browser.');
}
function applyTeacherExamMode(){
  document.body.classList.toggle('exam-mode',!!teacherState.examMode);
  const t=document.getElementById('teacherExamToggle');if(t)t.checked=!!teacherState.examMode;
  if(teacherState.examMode){
    document.getElementById('referenceSolutionPanel')?.classList.add('hidden');
    if(operationalMission.active)document.getElementById('operationalHintBox')?.classList.add('hidden');
  }
}
function setTeacherExamMode(on){
  teacherState.examMode=!!on;saveTeacherState();applyTeacherExamMode();applyTeacherAssignmentFilter();
  if(on){closeTeacherDashboard();teacherUnlocked=false;}
}
function teacherChallengeList(){return window.AMCOL_DIRECT3D_BRIDGE?.listOperationalChallenges?.()||[];}
function refreshTeacherChallengeChecklist(){
  const box=document.getElementById('teacherChallengeChecklist');if(!box)return;
  const active=teacherState.assignmentSets[teacherState.activeAssignment]?.keys||[];
  box.innerHTML=teacherChallengeList().map(c=>`<label class="flex items-center gap-2 text-[9px] text-slate-300"><input type="checkbox" class="teacher-challenge-check accent-violet-500" value="${c.key}" ${active.includes(c.key)?'checked':''}><span class="text-slate-500">${c.difficulty}</span><span>${c.title.replace(/^Challenge · /,'')}</span></label>`).join('');
}
function refreshTeacherAssignmentSelect(){
  const sel=document.getElementById('teacherAssignmentSelect');if(!sel)return;
  sel.innerHTML='<option value="">All challenges</option>'+Object.keys(teacherState.assignmentSets).sort().map(n=>`<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');
  sel.value=teacherState.activeAssignment||'';
}
function saveTeacherAssignment(){
  if(!teacherUnlocked)return;
  const name=(document.getElementById('teacherAssignmentName')?.value||'').trim();
  const keys=[...document.querySelectorAll('.teacher-challenge-check:checked')].map(x=>x.value);
  if(!name){alert('Enter a name for the assignment set.');return;}
  if(!keys.length){alert('Select at least one challenge.');return;}
  teacherState.assignmentSets[name]={name,keys,createdAt:new Date().toISOString()};
  teacherState.activeAssignment=name;saveTeacherState();refreshTeacherDashboard();applyTeacherAssignmentFilter();
}
function activateTeacherAssignment(name){teacherState.activeAssignment=name||'';saveTeacherState();refreshTeacherDashboard();applyTeacherAssignmentFilter();}
function deleteTeacherAssignment(){
  const name=teacherState.activeAssignment;if(!name)return;
  if(!confirm(`Delete assignment set “${name}”?`))return;
  delete teacherState.assignmentSets[name];teacherState.activeAssignment='';saveTeacherState();refreshTeacherDashboard();applyTeacherAssignmentFilter();
}
function applyTeacherAssignmentFilter(){
  const allowed=teacherState.assignmentSets[teacherState.activeAssignment]?.keys||[];
  populateOperationalChallenges(allowed.length?allowed:null);
  const scenario=document.getElementById('scenarioSelect');
  if(scenario){
    [...scenario.options].forEach(o=>{
      const isChallenge=teacherChallengeList().some(c=>c.key===o.value);
      o.disabled=!!teacherState.examMode&&allowed.length&&isChallenge&&!allowed.includes(o.value);
    });
  }
}
function saveOperationalResultToTeacherHistory(status='PASS'){
  const r=operationalMission.result;if(!r)return;
  const snap=r.snapshot||{};
  teacherState.results.push({
    id:Date.now(),date:new Date().toISOString(),student:operationalMission.student||'Unnamed',className:operationalMission.className||'',
    key:operationalMission.key,title:operationalMission.title,category:operationalMission.category,difficulty:operationalMission.difficulty,
    score:r.score??operationalMissionScore(),pass:!!r.pass,status,elapsed:missionElapsedSeconds(),attempts:operationalMission.attempts,hints:operationalMission.hints,
    gm:snap.metrics?.gm??null,gz:snap.metrics?.gz??null,list:snap.metrics?.equilibrium??null,trim:snap.metrics?.trim??null,ukc:snap.metrics?.ukc??null,fsc:snap.metrics?.fsc??null
  });
  if(teacherState.results.length>500)teacherState.results=teacherState.results.slice(-500);
  saveTeacherState();refreshTeacherDashboard();
}
function refreshTeacherResults(){
  const rows=teacherState.results.slice().reverse(),body=document.getElementById('teacherResultsBody');
  if(body)body.innerHTML=rows.slice(0,60).map(r=>`<tr><td><b>${safeHTML(r.student)}</b><br><span class="text-slate-600">${safeHTML(r.className||'')}</span></td><td>${safeHTML((r.title||r.key||'').replace(/^Challenge · /,''))}<br><span class="text-slate-600">${safeHTML(r.difficulty||'')}</span></td><td class="font-mono text-amber-300">${Number(r.score||0).toFixed(0)}</td><td class="${r.pass?'text-emerald-300':'text-rose-300'} font-bold">${r.pass?'PASS':'NOT PASSED'}</td></tr>`).join('')||'<tr><td colspan="4" class="text-slate-600">No saved mission results yet.</td></tr>';
  const n=rows.length,passes=rows.filter(r=>r.pass).length,avg=n?rows.reduce((a,r)=>a+(+r.score||0),0)/n:0;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('teacherResultCount',n);set('teacherAverageScore',n?avg.toFixed(1):'—');set('teacherPassRate',n?`${Math.round(passes/n*100)}%`:'—');
  renderTeacherLeaderboard();
}
function setTeacherLeaderboard(on){teacherState.leaderboard=!!on;saveTeacherState();renderTeacherLeaderboard();}
function renderTeacherLeaderboard(){
  const box=document.getElementById('teacherLeaderboard'),toggle=document.getElementById('teacherLeaderboardToggle');if(toggle)toggle.checked=!!teacherState.leaderboard;if(!box)return;
  box.classList.toggle('hidden',!teacherState.leaderboard);if(!teacherState.leaderboard)return;
  const best={};teacherState.results.forEach(r=>{const k=r.student||'Unnamed';if(!best[k]||(+r.score||0)>best[k].score)best[k]={score:+r.score||0,pass:r.pass};});
  const rows=Object.entries(best).sort((a,b)=>b[1].score-a[1].score).slice(0,10);
  box.innerHTML='<div class="text-[8px] font-black text-amber-300 uppercase mb-1">Local Best Scores</div>'+rows.map(([n,r],i)=>`<div class="flex justify-between text-[9px] py-0.5"><span>${i+1}. ${safeHTML(n)}</span><b class="text-amber-300">${r.score}</b></div>`).join('')||'<div class="text-[8px] text-slate-600">No results yet.</div>';
}
function exportTeacherCSV(){
  const cols=['date','student','className','key','title','category','difficulty','score','pass','elapsed','attempts','hints','gm','gz','list','trim','ukc','fsc'];
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv=[cols.join(','),...teacherState.results.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='AMCOL_Stability_Mission_Results.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);
}
function clearTeacherResults(){
  if(!confirm('Clear all locally saved mission results on this browser?'))return;
  teacherState.results=[];saveTeacherState();refreshTeacherDashboard();
}
function refreshTeacherDashboard(){
  refreshTeacherAssignmentSelect();refreshTeacherChallengeChecklist();refreshTeacherResults();applyTeacherExamMode();
}

function populateOperationalChallenges(allowedKeys=null){
  const sel=document.getElementById('operationalChallengeSelect');
  let list=window.AMCOL_DIRECT3D_BRIDGE?.listOperationalChallenges?.()||[];
  if(Array.isArray(allowedKeys)&&allowedKeys.length)list=list.filter(c=>allowedKeys.includes(c.key));
  if(!sel)return;
  sel.innerHTML='';
  const groups={};
  list.forEach(c=>(groups[c.category]??=[]).push(c));
  Object.entries(groups).forEach(([category,items])=>{
    const og=document.createElement('optgroup');og.label=category;
    items.forEach(c=>{const o=document.createElement('option');o.value=c.key;o.textContent=`${c.difficulty} · ${c.title.replace(/^Challenge · /,'')}`;og.appendChild(o);});
    sel.appendChild(og);
  });
}
function missionElapsedSeconds(){
  if(!operationalMission.startedAt)return 0;
  const end=operationalMission.finished?operationalMission.endedAt:performance.now();
  return Math.max(0,(end-operationalMission.startedAt)/1000);
}
function operationalMissionScore(){
  const elapsed=missionElapsedSeconds(),limit=operationalMission.timeLimit||480;
  const timePenalty=elapsed<=limit?Math.max(0,(elapsed/limit-.60)*20):20+Math.min(15,(elapsed-limit)/60*3);
  const attemptPenalty=Math.max(0,operationalMission.attempts-1)*9;
  const hintPenalty=operationalMission.hints*8;
  const lateCap=operationalMission.expired?60:100;
  return Math.round(Math.max(20,Math.min(lateCap,100-timePenalty-attemptPenalty-hintPenalty)));
}
function fmtMissionTime(seconds){
  const s=Math.max(0,Math.ceil(seconds)),m=Math.floor(s/60),r=s%60;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
function recordMissionAction(message,kind='change'){
  if(!operationalMission.active||operationalMission.finished||!message)return;
  const now=missionElapsedSeconds();
  const last=operationalMission.actions.at(-1);
  if(last&&last.message===message&&now-last.t<1.2)return;
  operationalMission.actions.push({t:now,message,kind});
  if(operationalMission.actions.length>150)operationalMission.actions.shift();
  operationalMission.lastActionAt=performance.now();
  renderOperationalActionLog();
}
function snapshotComparable(snap){
  if(!snap)return null;
  return {
    inputs:{...(snap.inputs||{})},
    cargo:(snap.cargo||[]).filter(x=>!/Ballast Tank [A-Z]{2}/.test(String(x.name))).map(x=>({id:x.id,name:x.name,mass:+x.mass||0,vcg:+x.vcg||0,tcg:+x.tcg||0,lcg:+x.lcg||0}))
  };
}
function describeInputChange(k,a,b){
  const labels={
    density:'Water density',waterDepth:'Water depth',lightshipKG:'Lightship KG',lightshipTCG:'Lightship TCG',lightshipLCG:'Lightship LCG',
    tankCount:'Slack tank count',tankFill:'Tank fill',fse:'Free surface',crane:'Crane',craneHeight:'Crane hook height',craneOutreach:'Crane outreach',
    craneSide:'Crane side',craneLCG:'Crane LCG',windEnabled:'Wind',windSpeedKts:'Wind speed',gustFactor:'Gust factor',windDirection:'Wind direction',
    currentEnabled:'Current',currentSpeedKts:'Current speed',currentDirection:'Current direction',waveEnabled:'Waves',waveHeight:'Wave height',
    waveLength:'Wavelength',waveSpeed:'Wave speed',wavePeriod:'Wave period',waveHeading:'Wave heading',damage:'Damage',dmgMass:'Flood mass',
    dmgVCG:'Flood VCG',dmgTCG:'Flood TCG'
  };
  const f=v=>typeof v==='number'?Number(v).toFixed(2):String(v);
  return `${labels[k]||k}: ${f(a)} → ${f(b)}`;
}
function detectMissionChanges(prev,next){
  if(!prev||!next)return;
  const p=snapshotComparable(prev),n=snapshotComparable(next);
  if(!p||!n)return;
  const changes=[];
  Object.keys(n.inputs).forEach(k=>{
    const a=p.inputs[k],b=n.inputs[k];
    const changed=(typeof a==='number'||typeof b==='number')?Math.abs((Number(a)||0)-(Number(b)||0))>1e-5:a!==b;
    if(changed)changes.push(describeInputChange(k,a,b));
  });
  const pm=new Map(p.cargo.map(x=>[String(x.id??x.name),x]));
  n.cargo.forEach(c=>{
    const old=pm.get(String(c.id??c.name));if(!old)return;
    for(const prop of ['mass','vcg','tcg','lcg']){
      if(Math.abs((old[prop]||0)-(c[prop]||0))>1e-5)changes.push(`${c.name} ${prop.toUpperCase()}: ${(old[prop]||0).toFixed(2)} → ${(c[prop]||0).toFixed(2)}`);
    }
  });
  if(changes.length){
    const msg=changes.slice(0,3).join(' · ')+(changes.length>3?` · +${changes.length-3} more`:'');
    recordMissionAction(msg,'change');
  }
}
function updateOperationalMetrics(snap){
  if(!snap?.metrics)return;
  const m=snap.metrics,o=snap.outcome;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('opMetricGM',`${m.gm.toFixed(3)} m`);
  set('opMetricGZ',`${m.gz>0?'+':''}${m.gz.toFixed(3)} m · ${m.gz<0?'OVERTURNING':'RIGHTING'}`);
  set('opMetricList',`${m.equilibrium>=0?'+':''}${m.equilibrium.toFixed(2)}°`);
  set('opMetricTrim',`${m.trim>=0?'+':''}${m.trim.toFixed(2)}°`);
  set('opMetricUKC',`${m.ukc.toFixed(2)} m`);
  set('opMetricFSC',`${m.fsc.toFixed(3)} m`);
  const status=document.getElementById('opMetricStatus');
  if(status){
    const ok=!!o?.pass;status.textContent=ok?'TARGET PASS':o?.physicalPass?'STABLE / NOT SOLVED':'UNSAFE';
    status.className=`font-bold ${ok?'text-emerald-300':o?.physicalPass?'text-amber-300':'text-rose-300'}`;
  }
}
function renderOperationalActionLog(){
  const el=document.getElementById('operationalActionLog');if(!el)return;
  el.innerHTML=operationalMission.actions.length?operationalMission.actions.map(a=>`<div><span class="text-slate-600 font-mono">${fmtMissionTime(a.t)}</span> · ${a.message}</div>`).join(''):'<div class="text-slate-600">No corrective actions recorded yet.</div>';
  const n=document.getElementById('operationalMissionActions');if(n)n.textContent=operationalMission.actions.length;
}
function updateOperationalMissionUI(){
  const timer=document.getElementById('operationalMissionTimerChip'),score=document.getElementById('operationalMissionScoreChip');
  const summary=document.getElementById('operationalMissionSummary');
  if(!operationalMission.active&&!operationalMission.finished){
    if(timer){timer.textContent='--:--';timer.classList.remove('urgent','expired');}
    if(score)score.textContent='100';
    if(summary)summary.textContent='Ready for assessment mission';
    return;
  }
  const elapsed=missionElapsedSeconds(),remain=operationalMission.timeLimit-elapsed;
  if(timer){
    timer.textContent=remain>0?fmtMissionTime(remain):`+${fmtMissionTime(Math.abs(remain))}`;
    timer.classList.toggle('urgent',remain>0&&remain<=60);timer.classList.toggle('expired',remain<=0);
  }
  if(score)score.textContent=operationalMissionScore();
  if(summary)summary.textContent=operationalMission.finished
    ? `${operationalMission.result?.pass?'Completed · PASS':'Completed · NOT PASSED'}`
    : `${operationalMission.difficulty} · ${operationalMission.category}`;
  document.getElementById('operationalMissionAttempts').textContent=operationalMission.attempts;
  document.getElementById('operationalMissionHints').textContent=operationalMission.hints;
}
function startOperationalMission(random=false){
  const bridge=window.AMCOL_DIRECT3D_BRIDGE;if(!bridge)return;
  if(operationalMission.active&&!operationalMission.finished&&!confirm('A mission is already active. Start a new mission and discard the current mission log?'))return;
  if(ballastLab.active)resetBallastLab();

  const list=bridge.listOperationalChallenges?.()||[];
  let key=document.getElementById('operationalChallengeSelect')?.value;
  if(random&&list.length)key=list[Math.floor(Math.random()*list.length)].key;
  const info=bridge.loadOperationalChallenge?.(key);if(!info?.ok)return;
  const limit=Math.max(60,+document.getElementById('operationalTimeLimit')?.value||480);
  operationalMission={
    active:true,finished:false,key,title:info.title,brief:info.brief,goal:info.goal,tasks:info.tasks||[],category:info.category,difficulty:info.difficulty,
    startedAt:performance.now(),endedAt:0,timeLimit:limit,expired:false,attempts:0,hints:0,actions:[],lastSnapshot:null,lastPollAt:0,lastActionAt:0,result:null,
    student:(document.getElementById('operationalStudentName')?.value||'').trim(),
    className:(document.getElementById('operationalClassName')?.value||'').trim()
  };
  const sel=document.getElementById('operationalChallengeSelect');if(sel)sel.value=key;
  document.getElementById('operationalMissionSetup')?.classList.add('hidden');
  document.getElementById('operationalMissionActive')?.classList.remove('hidden');
  document.getElementById('operationalReportBtn')?.classList.add('hidden');
  document.getElementById('operationalHintBox')?.classList.add('hidden');
  document.getElementById('operationalMissionFeedback')?.classList.add('hidden');
  document.getElementById('operationalMissionTitle').textContent=info.title;
  document.getElementById('operationalMissionDifficulty').textContent=`${info.difficulty} · ${info.category}`;
  document.getElementById('operationalMissionBrief').textContent=info.brief;
  document.getElementById('operationalMissionGoal').textContent=info.goal;
  operationalMission.lastSnapshot=bridge.getOperationalMissionSnapshot?.();
  recordMissionAction('Mission started. Initial condition loaded.','system');
  updateOperationalMetrics(operationalMission.lastSnapshot);updateOperationalMissionUI();renderOperationalActionLog();
  const briefingBtn=document.getElementById('challengeBriefingStartBtn');
  if(briefingBtn)briefingBtn.innerHTML='<i class="fa-solid fa-play mr-1"></i>Begin Mission';
  setDisplayMode('3d');frameActiveChallenge();setInspectionOption('challengeCamera',true);
}
function requestOperationalHint(){
  if(teacherState.examMode)return;
  if(!operationalMission.active||operationalMission.finished)return;
  const i=operationalMission.hints;
  const hints=operationalMission.tasks||[];
  const hint=hints[Math.min(i,hints.length-1)]||'Review the mission goal, identify the physical cause and change only the controls that address that cause.';
  operationalMission.hints++;
  const box=document.getElementById('operationalHintBox');if(box){box.classList.remove('hidden');box.innerHTML=`<b>Hint ${operationalMission.hints}:</b> ${hint}`;}
  recordMissionAction(`Hint ${operationalMission.hints} requested.`,'hint');updateOperationalMissionUI();
}
function runOperationalPhysicsTest(){
  if(!operationalMission.active||operationalMission.finished)return;
  recordMissionAction('Final stability animation/test started.','test');
  window.AMCOL_DIRECT3D_BRIDGE?.runOperationalPhysicsTest?.();
}
function submitOperationalMission(){
  if(!operationalMission.active||operationalMission.finished)return;
  const snap=window.AMCOL_DIRECT3D_BRIDGE?.getOperationalMissionSnapshot?.();if(!snap)return;
  operationalMission.attempts++;
  updateOperationalMetrics(snap);
  const o=snap.outcome,pass=!!o?.pass;
  const box=document.getElementById('operationalMissionFeedback');
  box.classList.remove('hidden','border-emerald-600','bg-emerald-950/30','text-emerald-100','border-amber-600','bg-amber-950/30','text-amber-100','border-rose-600','bg-rose-950/30','text-rose-100');
  if(pass){
    operationalMission.finished=true;operationalMission.active=false;operationalMission.endedAt=performance.now();
    operationalMission.result={pass:true,snapshot:snap,score:operationalMissionScore()};
    box.classList.add('border-emerald-600','bg-emerald-950/30','text-emerald-100');
    box.innerHTML=`<div class="font-black text-emerald-300"><i class="fa-solid fa-trophy mr-1"></i>MISSION PASSED · ${operationalMission.result.score}/100</div><div class="mt-1">${o.targetMessage}</div>`;
    document.getElementById('operationalReportBtn')?.classList.remove('hidden');
    recordMissionAction('Mission submitted: PASS.','submit');
    saveOperationalResultToTeacherHistory('PASS');
  }else{
    box.classList.add(o?.physicalPass?'border-amber-600':'border-rose-600',o?.physicalPass?'bg-amber-950/30':'bg-rose-950/30',o?.physicalPass?'text-amber-100':'text-rose-100');
    box.innerHTML=o?.physicalPass
      ? `<b>NOT YET:</b> Vessel is physically stable, but the required challenge target/correction is not complete.<br>${o?.targetMessage||''}`
      : `<b>UNSAFE / NOT YET:</b> ${(o?.physicalReasons||[]).join(' · ')}<br>${o?.targetMessage||''}`;
    recordMissionAction(`Submission ${operationalMission.attempts}: NOT PASSED.`,'submit');
  }
  operationalMission.lastSnapshot=snap;updateOperationalMissionUI();renderOperationalActionLog();
}
function abortOperationalMission(){
  if(!operationalMission.active||operationalMission.finished)return;
  if(!confirm('Abort the current operational mission? The action log will remain available for the report.'))return;
  operationalMission.finished=true;operationalMission.active=false;operationalMission.endedAt=performance.now();
  const snap=window.AMCOL_DIRECT3D_BRIDGE?.getOperationalMissionSnapshot?.();
  operationalMission.result={pass:false,aborted:true,snapshot:snap,score:Math.min(40,operationalMissionScore())};
  recordMissionAction('Mission aborted.','system');
  document.getElementById('operationalMissionFeedback')?.classList.remove('hidden');
  const box=document.getElementById('operationalMissionFeedback');if(box){box.className='mt-2 rounded-lg border p-2 text-[9px] border-rose-600 bg-rose-950/30 text-rose-100';box.innerHTML='<b>MISSION ABORTED.</b> Instructor report is available.';}
  document.getElementById('operationalReportBtn')?.classList.remove('hidden');saveOperationalResultToTeacherHistory('ABORTED');updateOperationalMissionUI();
}
function pollOperationalMission(){
  if(!operationalMission.active||operationalMission.finished)return;
  const now=performance.now();
  const elapsed=missionElapsedSeconds();
  if(!operationalMission.expired&&elapsed>=operationalMission.timeLimit){
    operationalMission.expired=true;recordMissionAction('Time limit expired. Mission may continue, but score is capped at 60.','time');
  }
  if(now-operationalMission.lastPollAt>=800){
    operationalMission.lastPollAt=now;
    const snap=window.AMCOL_DIRECT3D_BRIDGE?.getOperationalMissionSnapshot?.();
    if(snap){
      detectMissionChanges(operationalMission.lastSnapshot,snap);
      operationalMission.lastSnapshot=snap;updateOperationalMetrics(snap);
    }
  }
  updateOperationalMissionUI();
}
function safeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function operationalReportHTML(){
  const r=operationalMission.result||{pass:false,snapshot:operationalMission.lastSnapshot,score:operationalMissionScore()};
  const snap=r.snapshot||{},m=snap.metrics||{},o=snap.outcome||{};
  const date=new Date();
  const actions=operationalMission.actions.map(a=>`<tr><td>${safeHTML(fmtMissionTime(a.t))}</td><td>${safeHTML(a.message)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>AMCOL Stability Mission Report</title><style>
    body{font-family:Arial,sans-serif;color:#162033;margin:32px;line-height:1.4}h1{color:#062A5B;margin-bottom:4px}h2{font-size:16px;color:#062A5B;border-bottom:2px solid #d9b451;padding-bottom:5px;margin-top:24px}
    .meta{color:#526070;font-size:12px}.score{font-size:30px;font-weight:800;color:${r.pass?'#16803b':'#b42318'}}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}th,td{border:1px solid #d7dde5;padding:7px;text-align:left}th{background:#eef3f8}.pass{color:#16803b;font-weight:700}.fail{color:#b42318;font-weight:700}.note{font-size:11px;color:#667085;margin-top:18px}</style></head><body>
    <h1>AMCOL Ship Stability Operational Mission Report</h1>
    <div class="meta">${safeHTML(date.toLocaleString())}</div>
    <h2>Candidate</h2><table><tr><th>Student / Team</th><td>${safeHTML(operationalMission.student||'—')}</td><th>Class / Group</th><td>${safeHTML(operationalMission.className||'—')}</td></tr></table>
    <h2>Mission</h2><table><tr><th>Challenge</th><td colspan="3">${safeHTML(operationalMission.title)}</td></tr><tr><th>Category</th><td>${safeHTML(operationalMission.category)}</td><th>Difficulty</th><td>${safeHTML(operationalMission.difficulty)}</td></tr><tr><th>Goal</th><td colspan="3">${safeHTML(operationalMission.goal)}</td></tr></table>
    <h2>Assessment Result</h2><div class="score">${safeHTML(r.score)} / 100</div>
    <table><tr><th>Mission outcome</th><td class="${r.pass?'pass':'fail'}">${r.pass?'PASS':'NOT PASSED'}</td><th>Elapsed</th><td>${safeHTML(fmtMissionTime(missionElapsedSeconds()))}</td></tr>
    <tr><th>Attempts</th><td>${operationalMission.attempts}</td><th>Hints</th><td>${operationalMission.hints}</td></tr>
    <tr><th>Challenge target</th><td>${o.targetPass?'PASS':'NOT YET'}</td><th>Physical screen</th><td>${o.physicalPass?'PASS':'FAIL'}</td></tr></table>
    <h2>Final Stability Condition</h2><table>
      <tr><th>Displacement</th><td>${Number(m.disp||0).toFixed(1)} t</td><th>Corrected KG</th><td>${Number(m.kg||0).toFixed(3)} m</td></tr>
      <tr><th>Corrected GM</th><td>${Number(m.gm||0).toFixed(3)} m</td><th>GZ at active heel</th><td>${Number(m.gz||0).toFixed(3)} m</td></tr>
      <tr><th>Equilibrium / list</th><td>${Number(m.equilibrium||0).toFixed(2)}°</td><th>Trim</th><td>${Number(m.trim||0).toFixed(2)}°</td></tr>
      <tr><th>UKC</th><td>${Number(m.ukc||0).toFixed(2)} m</td><th>FSC</th><td>${Number(m.fsc||0).toFixed(3)} m</td></tr>
      <tr><th>IMO teaching audit</th><td>${snap.imoPass?'PASS':'REVIEW / FAIL'}</td><th>Required correction detected</th><td>${o.changed?'YES':'NO'}</td></tr>
    </table>
    <h2>Action Log</h2><table><tr><th style="width:90px">Mission time</th><th>Recorded action/change</th></tr>${actions||'<tr><td colspan="2">No actions logged.</td></tr>'}</table>
    <h2>Final Feedback</h2><p>${safeHTML(o.targetMessage||'')}</p><p>${safeHTML((o.physicalReasons||[]).join(' · '))}</p>
    <div class="note"><b>Training-use boundary:</b> This report documents performance in the AMCOL educational ship-stability model. It is not an approved loading-computer output, stability booklet calculation, class certificate or operational loading approval.</div>
    </body></html>`;
}
function downloadOperationalMissionReport(){
  if(!operationalMission.finished&&!operationalMission.result)return;
  const html=operationalReportHTML(),blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const base=(operationalMission.student||'student').replace(/[^a-z0-9_-]+/gi,'_');
  a.href=url;a.download=`AMCOL_Stability_Mission_${base}_${operationalMission.key||'mission'}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function cameraEase(t){return 1-Math.pow(1-Math.max(0,Math.min(1,t)),3);}
function cameraTransitionTo(position,target,up=new THREE.Vector3(0,1,0),duration=850){
  if(!camera||!controls)return;
  cameraTween={
    started:performance.now(),duration:Math.max(120,duration),
    p0:camera.position.clone(),p1:position.clone(),
    t0:controls.target.clone(),t1:target.clone(),
    u0:camera.up.clone(),u1:up.clone().normalize()
  };
}
function updateCameraTween(){
  if(!cameraTween||!camera||!controls)return;
  const raw=(performance.now()-cameraTween.started)/cameraTween.duration;
  const t=cameraEase(raw);
  camera.position.lerpVectors(cameraTween.p0,cameraTween.p1,t);
  controls.target.lerpVectors(cameraTween.t0,cameraTween.t1,t);
  camera.up.lerpVectors(cameraTween.u0,cameraTween.u1,t).normalize();
  camera.lookAt(controls.target);
  if(raw>=1){cameraTween=null;controls.update();}
}
function localToShipWorld(v){
  if(!shipRoot)return v.clone();
  shipRoot.updateMatrixWorld(true);
  return shipRoot.localToWorld(v.clone());
}
function vesselBridgeZ(s){
  const L=Math.max(20,+s.length||80);
  const type=s.hullType||'general';
  if(type==='osv')return -L*.30;
  if(type==='roro')return -L*.27;
  return L*.35;
}
function updateCameraStatus(){
  const el=document.getElementById('threeDCameraStatus');if(!el)return;
  const names={
    bow:'Bow',stern:'Stern',starboard:'Starboard',port:'Port',top:'Top',
    perspective:'Perspective',underwater:'Underwater',bridge:'Bridge',deck:'Deck',cargo:'Cargo',ballast:'Ballast',waterline:'Waterline',engine:'Engine Room',lngTanks:'LNG Tanks'
  };
  const cutNames={none:'Off',starboard_open:'Starboard Open',port_open:'Port Open',bow_open:'Bow Open',stern_open:'Stern Open'};
  el.textContent=`Camera: ${names[currentPreset]||currentPreset} · Cutaway: ${cutNames[cutawayMode]||cutawayMode} · ${interactionMode.toUpperCase()}${inspectionOptions.challengeCamera?' · Challenge Cam ON':''}`;
}
function focusObject3D(obj,duration=720){
  if(!obj||!camera||!controls)return;
  const box=new THREE.Box3().setFromObject(obj);
  if(box.isEmpty())return;
  const centre=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  const radius=Math.max(.45,size.length()*.55);
  const dir=camera.position.clone().sub(controls.target);
  if(dir.lengthSq()<.01)dir.set(1,.5,1);
  dir.normalize();
  const distance=Math.max(radius*4.0,latestState?Math.max(3,(+latestState.beam||16)*.38):5);
  cameraTransitionTo(centre.clone().add(dir.multiplyScalar(distance)),centre,new THREE.Vector3(0,1,0),duration);
  selectedInspectionObject=obj;
}
function focusSelectedObject(){
  if(selectedInspectionObject)focusObject3D(selectedInspectionObject);
}
function setInspectionOption(key,value){
  if(!(key in inspectionOptions))return;
  inspectionOptions[key]=!!value;
  try{
    if(key==='autoFocus')localStorage.setItem('amcol_3d_auto_focus',String(inspectionOptions.autoFocus));
    if(key==='challengeCamera')localStorage.setItem('amcol_3d_challenge_camera',String(inspectionOptions.challengeCamera));
  }catch(e){}
  if(key==='challengeCamera'&&value)frameActiveChallenge();
  updateCameraStatus();
}
function applyCutawayMaterials(){
  if(!renderer)return;
  renderer.localClippingEnabled=cutawayMode!=='none';
  if(!shipVisual)return;
  shipVisual.traverse(obj=>{
    if(!obj.isMesh||obj===waterlineMarker)return;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    mats.forEach(m=>{
      m.clippingPlanes=cutawayMode==='none'?[]:[cutawayPlaneWorld];
      m.clipShadows=true;m.needsUpdate=true;
    });
  });
}
function updateCutawayWorldPlane(){
  if(cutawayMode==='none'||!cutawayLocalPlane||!shipRoot)return;
  shipRoot.updateMatrixWorld(true);
  cutawayPlaneWorld.copy(cutawayLocalPlane).applyMatrix4(shipRoot.matrixWorld);
}
function setCutawayMode(mode){
  cutawayMode=['none','starboard_open','port_open','bow_open','stern_open'].includes(mode)?mode:'none';
  if(cutawayMode==='starboard_open')cutawayLocalPlane=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
  else if(cutawayMode==='port_open')cutawayLocalPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0);
  else if(cutawayMode==='bow_open')cutawayLocalPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  else if(cutawayMode==='stern_open')cutawayLocalPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);
  else cutawayLocalPlane=null;
  const sel=document.getElementById('threeDCutawayMode');if(sel&&sel.value!==cutawayMode)sel.value=cutawayMode;
  try{localStorage.setItem('amcol_3d_cutaway_mode',cutawayMode);}catch(e){}
  updateCutawayWorldPlane();applyCutawayMaterials();updateCameraStatus();
}
function activeScenarioKey(){return window.activeScenarioKey?.()||document.getElementById('scenarioSelect')?.value||'free';}
function pickOperationByType(type,preferText=''){
  const candidates=operationPickables.filter(o=>o?.userData?.operationType===type);
  if(!candidates.length)return null;
  if(preferText){
    const p=preferText.toLowerCase();
    const found=candidates.find(o=>JSON.stringify(o.userData.operationData||{}).toLowerCase().includes(p));
    if(found)return found;
  }
  return candidates[0];
}
function frameActiveChallenge(force=true){
  if(!latestState)return;
  const key=activeScenarioKey();
  if(!force&&key===lastChallengeCameraScenario)return;
  lastChallengeCameraScenario=key;

  const lower=String(key).toLowerCase();
  let obj=null;
  if(/damage|flood/.test(lower))obj=pickOperationByType('damage');
  else if(/crane|heavyoutreach|heavy_lift|lifting/.test(lower))obj=pickOperationByType('crane');
  else if(/slack|fse|tank/.test(lower))obj=pickOperationByType('tank');
  else if(/ballast/.test(lower))obj=pickOperationByType('cargo','ballast')||pickOperationByType('tank');
  else if(/container/.test(lower))obj=pickOperationByType('cargo','container')||pickOperationByType('cargo');
  else if(/vehicle|roro|passenger/.test(lower))obj=pickOperationByType('cargo','vehicle')||pickOperationByType('cargo','passenger')||pickOperationByType('cargo');
  else if(/ore|bulk/.test(lower))obj=pickOperationByType('cargo','ore')||pickOperationByType('cargo');
  else if(/cargo|deckload|osv|freshwater|density|ukc/.test(lower))obj=pickOperationByType('cargo');

  if(/loll|negative/.test(lower)){
    const g=hydroMarkers?.G;if(g){focusObject3D(g,820);showHydroInspector('G');return;}
  }
  if(obj){focusObject3D(obj,820);showOperationInspector(obj);return;}
  if(/wind|wave|gale|squall|current|weather|resonance|beamsea/.test(lower)){setCameraPreset('perspective');return;}
  setCameraPreset('perspective');
}

function setCameraPreset(name){
  if(!camera||!controls||!latestState)return;
  currentPreset=name;
  const s=latestState,L=Math.max(20,+s.length||80),B=Math.max(4,+s.beam||16),D=Math.max(3,+s.depth||10);
  if(name==='cargo'){const obj=pickOperationByType('cargoSpace')||pickOperationByType('cargo');if(obj){focusObject3D(obj,900);updateCameraStatus();return;}}
  if(name==='ballast'){const obj=pickOperationByType('tank')||pickOperationByType('ballastLab');if(obj){focusObject3D(obj,900);updateCameraStatus();return;}}
  if(name==='engine'){const obj=pickOperationByType('machinery');if(obj){focusObject3D(obj,900);updateCameraStatus();return;}}
  if(name==='lngTanks'){const obj=pickOperationByType('cargoSpace','moss')||pickOperationByType('cargoSpace','gas cargo tank')||pickOperationByType('cargoSpace');if(obj){focusObject3D(obj,920);updateCameraStatus();return;}name='perspective';currentPreset='perspective';}
  let target=new THREE.Vector3(0,D*.52,0),pos=null,up=new THREE.Vector3(0,1,0);

  if(name==='bow'){
    const d=cameraDistanceFor(s,'end');pos=new THREE.Vector3(0,D*.62,-d);
  }else if(name==='stern'){
    const d=cameraDistanceFor(s,'end');pos=new THREE.Vector3(0,D*.62,+d);
  }else if(name==='starboard'){
    const d=cameraDistanceFor(s,'side');pos=new THREE.Vector3(+d,D*.72,0);
  }else if(name==='port'){
    const d=cameraDistanceFor(s,'side');pos=new THREE.Vector3(-d,D*.72,0);
  }else if(name==='top'){
    const d=Math.max(cameraDistanceFor(s,'side')*.72,L*.75);
    pos=new THREE.Vector3(0,d,0);up=new THREE.Vector3(0,0,-1);
  }else if(name==='waterline'){
    const d=cameraDistanceFor(s,'side')*.78;pos=new THREE.Vector3(+d,Math.max(D*.18,(+s.eqDraft||D*.45)*.18),-L*.04);target=new THREE.Vector3(0,0,-L*.02);
  }else if(name==='underwater'){
    const draft=Math.max(.8,+s.eqDraft||D*.45);
    pos=localToShipWorld(new THREE.Vector3(B*.92,Math.min(draft*.36,D*.28),-L*.08));
    target=localToShipWorld(new THREE.Vector3(0,Math.min(draft*.42,D*.35),0));
  }else if(name==='bridge'){
    const bz=vesselBridgeZ(s);
    const y=(s.hullType==='roro'?D*1.95:(s.hullType==='osv'?D*1.92:D*1.62));
    pos=localToShipWorld(new THREE.Vector3(B*.10,y,bz-L*.015));
    target=localToShipWorld(new THREE.Vector3(0,y*.91,-L*.48));
  }else if(name==='deck'){
    const z=s.hullType==='osv'?L*.12:-L*.08;
    pos=localToShipWorld(new THREE.Vector3(B*.25,D*1.17,z+L*.08));
    target=localToShipWorld(new THREE.Vector3(0,D*1.06,z-L*.30));
  }else{
    currentPreset='perspective';
    const d=cameraDistanceFor(s,'side');
    pos=new THREE.Vector3(+d*.46,D*1.92,-d*.56);
    target=new THREE.Vector3(0,D*.58,-L*.025);
  }

  cameraTransitionTo(pos,target,up,name==='bridge'||name==='deck'?1000:820);
  updateCameraStatus();
}
function headingVector(name){
  // Water local XY becomes world XZ after plane rotation.
  if(name==='head')return new THREE.Vector2(0,1);
  if(name==='following')return new THREE.Vector2(0,-1);
  if(name==='quartering')return new THREE.Vector2(.707,.707).normalize();
  return new THREE.Vector2(1,0); // beam
}
function visualEncounterAngularFrequency(s){
  const Tw=Math.max(.15,+s?.wavePeriod||5),lambda=Math.max(1,+s?.waveLength||60),V=Math.max(0,+s?.shipSpeedKts||0)*0.514444;
  const alpha=({head:0,beam:90,quartering:135,following:180})[s?.waveHeading]??90;
  const fe=(1/Tw)+(V*Math.cos(alpha*Math.PI/180)/lambda);
  return 2*Math.PI*fe;
}
function visualWaveSteepness(s){
  const H=Math.max(0,+s?.waveHeight||0),lambda=Math.max(1,+s?.waveLength||60);
  return Math.max(0,Math.min(.28,Math.PI*H/lambda));
}
function visualWaveElevationAt(s,x=0,z=0,t=0){
  if(!s?.waveEnabled)return 0;
  const H=Math.max(0,+s.waveHeight||0),lambda=Math.max(1,+s.waveLength||60),a=H*.5,k=2*Math.PI/lambda,omega=visualEncounterAngularFrequency(s),h=headingVector(s.waveHeading||'beam');
  const ph1=k*(x*h.x+z*h.y)-omega*t;
  const h2=new THREE.Vector2(-h.y*.82+h.x*.38,h.x*.82+h.y*.38).normalize(),ph2=k*1.58*(x*h2.x+z*h2.y)-omega*1.23*t+1.35;
  return a*Math.sin(ph1)+a*.14*Math.sin(ph2);
}

function vesselGeometrySignatureFor(s){
  if(!s)return '';
  const customHullData=window.AMCOL_CUSTOM_HULL_FORM,customHullApplies=!!(customHullData?.enabled&&(!customHullData.vesselName||customHullData.vesselName===(latestState?.vesselName||s?.vesselName||''))),customHullSig=customHullApplies?`${customHullData.label||'custom'}|${customHullData.stations?.length||0}`:'family';
  return `${s.hullType||'general'}|${(+s.length||80).toFixed(2)}|${(+s.beam||16).toFixed(2)}|${(+s.depth||10).toFixed(2)}|${detailQuality}|${customHullSig}`;
}
function expectedInternalFamily(type){return type==='ferry'?'roro':type==='barge'?'box':(type||'general');}
function runtimeInternalFamilyOK(s,runtime){
  const expected=expectedInternalFamily(s?.hullType||'general'),actual=String(runtime?.spaceLayoutFamily||expected);
  return actual===expected;
}
function updateDynamicPose(s){
  if(!sceneReady||!s||!shipRoot)return;
  const heel=THREE.MathUtils.degToRad(+s.heel||0),trim=THREE.MathUtils.degToRad(+s.trimAngle||0),t=clock.elapsedTime,H=s.waveEnabled?Math.max(0,+s.waveHeight||0):0,T=Math.max(.25,+s.wavePeriod||5),heading=s.waveHeading||'beam';
  const L=Math.max(20,+s.length||80),lambda=Math.max(5,+s.waveLength||60),response=Math.max(.12,Math.min(1,lambda/L));
  const etaC=visualWaveElevationAt(s,0,0,t),etaBow=visualWaveElevationAt(s,0,-L*.42,t),etaStern=visualWaveElevationAt(s,0,L*.42,t);
  const heave=etaC*(.10+.30*response),wavePitch=Math.atan2((etaBow-etaStern)*(.38+.38*response),L*.84);
  const visualMeanDraft=Math.max(0,(+s.eqDraft||0)+(+s.visualHeelDraftDelta||0)),trimPivotCorrection=(+s.lcf||0)*Math.sin(trim);
  shipRoot.position.set(0,-visualMeanDraft+trimPivotCorrection+heave,0);shipRoot.rotation.z=-heel;shipRoot.rotation.x=-trim+wavePitch;
  if(waterlineMarker)waterlineMarker.position.y=Math.max(.05,+s.eqDraft||0);
  if(water?.material?.uniforms){
    const u=water.material.uniforms;u.uHeight.value=H;u.uWavelength.value=lambda;u.uPeriod.value=T;u.uHeading.value.copy(headingVector(heading));
    if(u.uEncounterOmega)u.uEncounterOmega.value=visualEncounterAngularFrequency(s);if(u.uSteepness)u.uSteepness.value=visualWaveSteepness(s);if(u.uDepth)u.uDepth.value=Math.max(.5,+s.waterDepth||50);if(u.uEnabled)u.uEnabled.value=s.waveEnabled?1:0;
  }
  if(seabed)seabed.position.y=-Math.max(2,+s.waterDepth||15);
  updateTankFreeSurface(s);
}

function hardLoadVesselSnapshot(s,runtime={}){
 if(!s)return false;
 const snap=cloneRuntimeFor3D(runtime||{}),stateSnap={...s,upright:s.upright?{...s.upright}:s.upright,hydro:s.hydro?{...s.hydro}:s.hydro};
 latestState=stateSnap;latestRuntime=snap;
 if(!sceneReady)return false;
 try{
   // Hard boundary used only for first 3D entry or a complete vessel/reference change.
   vesselSignature='';hydroSignature='';operationSignature='';internalLayoutIdentity='';updateOperations._readoutSig='';
   buildVessel(stateSnap);
   replaceInternalArrangement(stateSnap,snap);
   const envSig=[stateSnap.length,stateSnap.beam,stateSnap.depth,stateSnap.windEnabled,stateSnap.windSpeedKts,stateSnap.gustFactor,stateSnap.windDirection,stateSnap.currentEnabled,stateSnap.currentSpeedKts,stateSnap.currentDirection].join('|');
   syncFromSimulator._envSig=envSig;rebuildEnvironmentVectors(stateSnap);
   updateDynamicPose(stateSnap);updateHydroOverlay(stateSnap);updateEnvironment3D(stateSnap,0);updateOperationVisibility();updateHydroVisibility();setVesselXRay(internalArrangementView||hydroOptions.xray);resize();
   if(loading)loading.classList.add('hidden');
   if(statusEl)statusEl.textContent=`${String(stateSnap.hullType||'general').replaceAll('_',' ').toUpperCase()} · vessel + internal spaces loaded`;
   return true;
 }catch(err){
   console.error('AMCOL 3D hard vessel load error:',err);
   if(statusEl)statusEl.textContent='3D vessel load error · 2D/physics remain available';
   return false;
 }
}

function syncPoseFromSimulator(s){
 if(!s)return false;
 latestState={...(latestState||{}),...s,upright:s.upright?{...s.upright}:s.upright,hydro:s.hydro?{...s.hydro}:s.hydro};
 if(!sceneReady)return false;
 try{updateDynamicPose(latestState);return true;}catch(err){console.error('AMCOL 3D pose sync error:',err);return false;}
}

function syncFromSimulator(s,runtime={}){
  if(!s)return false;
  latestState={...s,upright:s.upright?{...s.upright}:s.upright,hydro:s.hydro?{...s.hydro}:s.hydro};latestRuntime=cloneRuntimeFor3D(runtime||{});
  if(!sceneReady)return false;
  s=latestState;
  const sig=vesselGeometrySignatureFor(s);
  if(sig!==vesselSignature)buildVessel(s);
  const envSig=[s.length,s.beam,s.depth,s.windEnabled,s.windSpeedKts,s.gustFactor,s.windDirection,s.currentEnabled,s.currentSpeedKts,s.currentDirection].join('|');
  if(syncFromSimulator._envSig!==envSig){syncFromSimulator._envSig=envSig;rebuildEnvironmentVectors(s);}

  // Pose/wave motion is lightweight and does not rebuild vessel/internal geometry.
  updateDynamicPose(s);

  updateHydroOverlay(s);
  updateOperations(s,latestRuntime);
  updateEnvironment3D(s,0);
  updateStabilityAdvisor();
  if(ballastLab.active&&ballastLab.scenarioKey&&activeScenarioKey()!==ballastLab.scenarioKey)abandonBallastLabForScenarioChange();
  const ballastPanelOpen=!!document.getElementById('threeDBallastLabPanel')?.open;
  if(ballastPanelOpen&&!ballastLab.running){const bp=ballastPlanFromBridge(),ps=ballastPlanStructureSignature(bp),pv=ballastPlanValueSignature(bp);if(ps&&ps!==ballastLab.planSignature)syncBallastLabFromVessel({preserveSnapshot:false,preserveRoute:false});else if(ps&&pv!==ballastLab.valueSignature)refreshBallastLabValuesFromVessel();}
  updateCutawayWorldPlane();
  if(inspectionOptions.challengeCamera&&!container.classList.contains('pointer-events-none'))frameActiveChallenge(false);

  const type=(s.hullType||'general').replaceAll('_',' ');
  if(statusEl)statusEl.textContent=`${type.toUpperCase()} · ${detailQuality.toUpperCase()} DETAIL · heel ${(s.heel||0).toFixed(1)}° · trim ${(s.trimAngle||0).toFixed(2)}° · hydro draft ${(s.eqDraft||0).toFixed(2)} m · visual WL ${((+s.eqDraft||0)+(+s.visualHeelDraftDelta||0)).toFixed(2)} m`;
  return true;
}

function resize(){
  if(!renderer||!camera||!container)return;
  const w=Math.max(2,container.clientWidth),h=Math.max(2,container.clientHeight);
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
}

function animate3D(){
  if(!sceneReady)return;
  requestAnimationFrame(animate3D);
  if(!threeDViewActive){clock.getDelta();return;}
  try{
    const dt=clock.getDelta(),t=clock.elapsedTime;
    if(water?.material?.uniforms)water.material.uniforms.uTime.value=t;
    if(skyDome&&camera)skyDome.position.copy(camera.position);
    if(latestState){updateDynamicPose(latestState);updateRain(latestState,dt);updateWaterInteraction3D(latestState,t);}
    stepBallastTransfer(dt);updateBallastFreeSurfaces();animateBallastFlow(t);pollOperationalMission();updateCameraTween();controls?.update();
    if(latestState&&hydroOptions.master)updateHydroMarkerPresentation();
    updateOperationLabelPresentation();
    renderer.render(scene,camera);
    animate3D._errorCount=0;
  }catch(err){
    animate3D._errorCount=(animate3D._errorCount||0)+1;const now=performance.now();
    if(!animate3D._lastErrorAt||now-animate3D._lastErrorAt>2500){animate3D._lastErrorAt=now;console.error('AMCOL 3D frame error (physics continues):',err);if(statusEl)statusEl.textContent='3D frame error · physics continues independently';}
  }
}

function setViewActive(active){
  const on=!!active;threeDViewActive=on;
  if(container){
    container.style.visibility=on?'visible':'hidden';
    container.style.pointerEvents=on?'auto':'none';
  }
  // Never leave a transform drag or WebGL pointer capture active when returning to 2D.
  if(!on){
    cameraTween=null;
    hydroPointerDown=null;
    interactionDragging=false;
    interactionCommitPending=false;
    try{transformControls?.detach();}catch(e){}
    interactiveObject=null;interactiveOriginal=null;
    try{renderer?.domElement?.releasePointerCapture?.(1);}catch(e){}
    closeInspector();
    if(controls)controls.enabled=false;
  }else{
    if(controls)controls.enabled=!interactionDragging;
    resize();
  }
}

function invalidateOperations(){operationSignature='';internalLayoutIdentity='';updateOperations._readoutSig='';}
function invalidateHull(){vesselSignature='';hydroSignature='';operationSignature='';internalLayoutIdentity='';if(latestState)syncFromSimulator(latestState,latestRuntime);}
function getInternalLayoutDebug(){return {hullType:latestState?.hullType||null,expectedFamily:expectedInternalFamily(latestState?.hullType||'general'),runtimeFamily:latestRuntime?.spaceLayoutFamily||null,layoutRevision:latestRuntime?.spaceLayoutRevision||latestState?.spaceLayoutRevision||0,layoutKey:latestRuntime?.spaceLayoutKey||null,internalLayoutIdentity,cargoSpaces:Array.isArray(latestRuntime?.cargoSpaces)?latestRuntime.cargoSpaces.map(x=>x.name):[],ballastTanks:Array.isArray(latestRuntime?.ballastTanks)?latestRuntime.ballastTanks.map(x=>x.name):[],engineRoom:latestRuntime?.engineRoom?.label||null,rendered:{family:operationsGroup?.userData?.family||null,revision:operationsGroup?.userData?.revision||0,vesselName:operationsGroup?.userData?.vesselName||'',groups:shipRoot?.children?.filter?.(x=>x?.name==='3DOperations')?.length||0,cargoSpaceObjects:cargoSpaces3DGroup?.children?.length||0,ballastObjects:tanks3DGroup?.children?.length||0,machineryObjects:machinery3DGroup?.children?.length||0},vesselSignature,operationSignature};}

window.AMCOL3D={
  get ready(){return sceneReady;},
  syncFromSimulator,
  syncPoseFromSimulator,
  hardLoadVesselSnapshot,
  replaceInternalArrangement,
  updateDynamicPose,
  invalidateOperations,
  getInternalLayoutDebug,
  resize,
  invalidateHull,
  setViewActive,
  setCameraPreset,
  setHydroOption,
  setOperationOption,
  applyVisualLayerPreset,
  setInternalArrangementView,
  setEnvironmentOption,
  setDetailQuality,
  setInspectionOption,
  setCutawayMode,
  setInteractionMode,
  setInteractionAxis,
  setInteractionSnap,
  setSelectedLongitudinalZone,
  updateStabilityAdvisor,
  initialiseBallastLab,
  syncBallastLabFromVessel,
  refreshBallastLabValuesFromVessel,
  chooseBallastTank,
  resetBallastLab,
  startBallastTransfer,
  toggleBallastPause,
  stopBallastTransfer,
  setBallastFSECoupling,
  setBallastCapacity,
  setBallastRoute,
  applyPairedTrimAssist,
  applyPairedListAssist,
  startOperationalMission,
  requestOperationalHint,
  runOperationalPhysicsTest,
  submitOperationalMission,
  abortOperationalMission,
  downloadOperationalMissionReport,
  recordMissionAction,
  toggleCleanTool,
  openTeacherDashboard,
  closeTeacherDashboard,
  unlockTeacherDashboard,
  lockTeacherDashboard,
  changeTeacherPin,
  setTeacherExamMode,
  saveTeacherAssignment,
  activateTeacherAssignment,
  deleteTeacherAssignment,
  setTeacherLeaderboard,
  exportTeacherCSV,
  clearTeacherResults,
  selectInteractiveObject,
  deselectInteractiveObject,
  focusObject3D,
  focusSelectedObject,
  frameActiveChallenge,
  focusHydroPoint,
  showHydroInspector,
  showOperationInspector,
  closeInspector,
  resize,
  rebuild(){if(latestState){vesselSignature='';hydroSignature='';operationSignature='';internalLayoutIdentity='';syncFromSimulator(latestState,latestRuntime);}},
  fit(){setCameraPreset(currentPreset||'perspective');}
};

window.addEventListener('resize',resize);
window.addEventListener('amcol:simulator-ready',()=>{if(!sceneReady)return;const boot=window.AMCOL_GET_RENDER_SNAPSHOT?.();if(boot?.state)hardLoadVesselSnapshot(boot.state,boot.runtime||{});});
window.addEventListener('DOMContentLoaded',init3D);
