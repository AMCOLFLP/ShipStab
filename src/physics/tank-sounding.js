(function(global){
  'use strict';
  const root=global.AMCOLPhysics=global.AMCOLPhysics||{};
  const EPS=1e-9;
  function n(v){const x=Number(v);return Number.isFinite(x)?x:NaN;}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function rowsForTank(rows,tankId){
    return (Array.isArray(rows)?rows:[]).filter(r=>String(r?.tankId)===String(tankId)&&Number.isFinite(n(r?.soundingPercent))).slice().sort((a,b)=>n(a.soundingPercent)-n(b.soundingPercent));
  }
  function interpolateCalibration(rows,tankId,soundingPercent){
    const r=rowsForTank(rows,tankId),x=n(soundingPercent);
    if(r.length<2||!Number.isFinite(x))return null;
    const lo=n(r[0].soundingPercent),hi=n(r[r.length-1].soundingPercent);
    if(x<lo-EPS||x>hi+EPS)return null;
    if(x<=lo)return {...r[0],soundingPercent:lo};
    if(x>=hi)return {...r[r.length-1],soundingPercent:hi};
    for(let i=1;i<r.length;i++){
      const b=r[i],a=r[i-1],xb=n(b.soundingPercent);
      if(x<=xb+EPS){
        const xa=n(a.soundingPercent),t=(x-xa)/(xb-xa),o={tankId:String(tankId),tankName:a.tankName||b.tankName,soundingPercent:x};
        for(const k of ['volumePercent','volumeM3','massT','liquidVCG','FSM']){
          const av=n(a[k]),bv=n(b[k]);o[k]=Number.isFinite(av)&&Number.isFinite(bv)?av+t*(bv-av):NaN;
        }
        return o;
      }
    }
    return null;
  }
  function soundingPercentFromReading(mode,reading,height){
    const x=n(reading),h=n(height),m=String(mode||'sounding').toLowerCase();
    if(!Number.isFinite(x))return NaN;
    if(m==='percent')return clamp(x,0,100);
    if(!Number.isFinite(h)||h<=0)return NaN;
    if(m==='ullage')return clamp(100*(h-x)/h,0,100);
    return clamp(100*x/h,0,100);
  }
  function readingFromSoundingPercent(mode,soundingPercent,height){
    const p=clamp(n(soundingPercent)||0,0,100),h=n(height),m=String(mode||'sounding').toLowerCase();
    if(m==='percent')return p;
    if(!Number.isFinite(h)||h<=0)return NaN;
    const sounding=h*p/100;
    return m==='ullage'?h-sounding:sounding;
  }
  function soundingPercentFromVolumePercent(rows,tankId,volumePercent){
    const r=rowsForTank(rows,tankId),v=clamp(n(volumePercent)||0,0,100);
    if(r.length<2)return NaN;
    const rr=r.filter(x=>Number.isFinite(n(x.volumePercent))).sort((a,b)=>n(a.volumePercent)-n(b.volumePercent));
    if(rr.length<2)return NaN;
    if(v<=n(rr[0].volumePercent)+EPS)return n(rr[0].soundingPercent);
    if(v>=n(rr[rr.length-1].volumePercent)-EPS)return n(rr[rr.length-1].soundingPercent);
    for(let i=1;i<rr.length;i++){
      const b=rr[i],a=rr[i-1],vb=n(b.volumePercent);
      if(v<=vb+EPS){
        const va=n(a.volumePercent),t=Math.abs(vb-va)<EPS?0:(v-va)/(vb-va);
        return n(a.soundingPercent)+t*(n(b.soundingPercent)-n(a.soundingPercent));
      }
    }
    return NaN;
  }
  function normalizeTankSide(tank={}){
    const raw=String(tank.side||'').toLowerCase(),name=String(tank.name||tank.id||'').toLowerCase(),tcg=n(tank.tcg);
    if(raw.includes('port')||raw==='p'||/\bport\b|[-_. ]p$/.test(name))return 'PORT';
    if(raw.includes('star')||raw==='s'||/starboard|[-_. ]s$/.test(name))return 'STARBOARD';
    if(Number.isFinite(tcg)&&tcg<-.01)return 'PORT';
    if(Number.isFinite(tcg)&&tcg>.01)return 'STARBOARD';
    return 'CENTRE';
  }
  function classifyTank(tank={}){
    const txt=[tank.fluid,tank.type,tank.name,tank.id].map(v=>String(v||'').toLowerCase()).join(' ');
    if(/ballast|sea ?water|wbt|peak/.test(txt))return 'BALLAST';
    if(/fresh ?water|\bfw\b/.test(txt))return 'FRESH WATER';
    if(/heavy fuel|fuel oil|\bhfo\b|\bfo\b/.test(txt))return 'FUEL OIL / HFO';
    if(/diesel|\bdo\b|mgo|gas oil/.test(txt))return 'DIESEL OIL';
    if(/lube|lubric|\blo\b/.test(txt))return 'LUBRICATING OIL';
    if(/slop|bilge|oily/.test(txt))return 'SLOPS / BILGE';
    return 'OTHER';
  }
  function calculateTank(input={}){
    const tank=input.tank||{},tankId=String(input.tankId||tank.id||''),height=n(input.height??tank.height),mode=String(input.mode||'sounding').toLowerCase(),reading=n(input.reading),density=n(input.density??tank.density);
    if(!tankId)return {valid:false,reason:'Tank ID is required.'};
    const soundingPercent=soundingPercentFromReading(mode,reading,height);
    if(!Number.isFinite(soundingPercent))return {valid:false,tankId,reason:'Valid sounding/ullage reading and tank height are required.'};
    const cal=interpolateCalibration(input.calibrationRows||[],tankId,soundingPercent);
    if(!cal)return {valid:false,tankId,soundingPercent,reason:'No calibration data at this sounding.'};
    if(!Number.isFinite(density)||density<=0)return {valid:false,tankId,soundingPercent,reason:'Liquid density must be greater than zero.'};
    const baseDensity=Number.isFinite(n(tank.density))&&n(tank.density)>0?n(tank.density):(Number.isFinite(n(input.baseDensity))&&n(input.baseDensity)>0?n(input.baseDensity):1.025);
    const volumeM3=n(cal.volumeM3),massT=Number.isFinite(volumeM3)?volumeM3*density:NaN;
    const fsmBase=n(cal.FSM),fsm=Number.isFinite(fsmBase)?fsmBase*(density/baseDensity):NaN;
    return {valid:true,tankId,tankName:tank.name||cal.tankName||tankId,tankType:tank.type||'',fluid:tank.fluid||'',side:normalizeTankSide(tank),category:classifyTank(tank),mode,reading,height,soundingPercent,volumePercent:n(cal.volumePercent),volumeM3,massT,density,baseDensity,liquidVCG:n(cal.liquidVCG),FSM:fsm,authority:tank.source||'AMCOL tank calibration'};
  }
  function calculateMany(entries=[],calibrationRows=[]){
    const results=(Array.isArray(entries)?entries:[]).map(e=>calculateTank({...e,calibrationRows:e.calibrationRows||calibrationRows}));
    const valid=results.filter(r=>r.valid),invalid=results.filter(r=>!r.valid);
    const sum=k=>valid.reduce((s,r)=>s+(Number.isFinite(n(r[k]))?n(r[k]):0),0);
    return {valid:valid.length>0&&invalid.length===0,partial:valid.length>0&&invalid.length>0,results,validCount:valid.length,invalidCount:invalid.length,totalVolumeM3:sum('volumeM3'),totalMassT:sum('massT'),totalFSM:sum('FSM')};
  }
  function summarizeResults(results=[]){
    const valid=(Array.isArray(results)?results:[]).filter(r=>r&&r.valid);
    const accumulate=(key)=>{const out={};valid.forEach(r=>{const g=String(r[key]||'OTHER');if(!out[g])out[g]={count:0,volumeM3:0,massT:0,FSM:0};out[g].count++;out[g].volumeM3+=Number.isFinite(n(r.volumeM3))?n(r.volumeM3):0;out[g].massT+=Number.isFinite(n(r.massT))?n(r.massT):0;out[g].FSM+=Number.isFinite(n(r.FSM))?n(r.FSM):0;});return out;};
    return {bySide:accumulate('side'),byCategory:accumulate('category')};
  }
  function compareResults(initialResults=[],finalResults=[]){
    const a=new Map((Array.isArray(initialResults)?initialResults:[]).filter(r=>r&&r.valid).map(r=>[String(r.tankId),r]));
    const b=new Map((Array.isArray(finalResults)?finalResults:[]).filter(r=>r&&r.valid).map(r=>[String(r.tankId),r]));
    const ids=[...new Set([...a.keys(),...b.keys()])].sort();
    const rows=ids.map(id=>{const i=a.get(id)||null,f=b.get(id)||null;return {tankId:id,tankName:f?.tankName||i?.tankName||id,side:f?.side||i?.side||'CENTRE',category:f?.category||i?.category||'OTHER',initial:i,final:f,deltaVolumeM3:(f?.volumeM3||0)-(i?.volumeM3||0),deltaMassT:(f?.massT||0)-(i?.massT||0)};});
    return {rows,totalDeltaVolumeM3:rows.reduce((s,r)=>s+r.deltaVolumeM3,0),totalDeltaMassT:rows.reduce((s,r)=>s+r.deltaMassT,0)};
  }
  root.tankSounding={rowsForTank,interpolateCalibration,soundingPercentFromReading,readingFromSoundingPercent,soundingPercentFromVolumePercent,normalizeTankSide,classifyTank,calculateTank,calculateMany,summarizeResults,compareResults};
})(typeof window!=='undefined'?window:globalThis);
