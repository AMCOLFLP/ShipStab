(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  function interpolateAngle(points,x){
    const p=(points||[]).slice().sort((a,b)=>Number(a.a)-Number(b.a));x=Math.abs(Number(x)||0);
    if(!p.length||x>Number(p[p.length-1].a))return NaN;if(x<=Number(p[0].a))return Number(p[0].v);
    for(let i=1;i<p.length;i++)if(Number(p[i].a)>=x){const a=p[i-1],b=p[i],den=Number(b.a)-Number(a.a),t=den?(x-Number(a.a))/den:0;return Number(a.v)+t*(Number(b.v)-Number(a.v));}
    return NaN;
  }
  function interpolateKNRows(knRows,queryDisp,angleMagnitude,side='starboard'){
    const all=knRows||[],sideSpecific=all.filter(r=>String(r.side||'').toLowerCase()===side),shared=all.filter(r=>!r.side||['both','all',''].includes(String(r.side).toLowerCase())),rows=sideSpecific.length?sideSpecific:shared;
    if(!rows.length)return {valid:false,reason:`no ${side} KN ordinates`};
    const groups=new Map();rows.forEach(r=>{const d=Number(r.disp);if(!Number.isFinite(d))return;if(!groups.has(d))groups.set(d,[]);groups.get(d).push({a:Number(r.angle),v:Number(r.kn)});});
    const levels=[...groups.keys()].sort((a,b)=>a-b),x=Math.abs(Number(angleMagnitude)||0),q=Number(queryDisp);
    if(!levels.length||!Number.isFinite(q))return {valid:false,reason:'no KN displacement levels'};
    const perLevel=levels.map(d=>({disp:d,kn:Math.abs(interpolateAngle(groups.get(d),x))})).filter(o=>Number.isFinite(o.kn));
    if(!perLevel.length)return {valid:false,reason:`heel ${x.toFixed(1)}° outside KN angle coverage`};
    if(perLevel.length===1){const only=perLevel[0],tol=Math.max(25,Math.abs(only.disp)*.0025);if(Math.abs(q-only.disp)>tol)return {valid:false,reason:`Δ ${q.toFixed(0)} t outside single KN level ${only.disp.toFixed(0)} t`,q,levels:[only.disp],angle:x};return {valid:true,kn:only.kn,q,lower:only.disp,upper:only.disp,angle:x,mode:'single-level'};}
    const lo=perLevel[0],hi=perLevel[perLevel.length-1],boundaryTol=Math.max(.01,Math.max(Math.abs(lo.disp),Math.abs(hi.disp))*1e-8);
    if(q<lo.disp-boundaryTol||q>hi.disp+boundaryTol)return {valid:false,reason:`Δ ${q.toFixed(0)} t outside KN range ${lo.disp.toFixed(0)}–${hi.disp.toFixed(0)} t`,q,range:[lo.disp,hi.disp],angle:x};
    const qc=Math.max(lo.disp,Math.min(hi.disp,q));
    if(Math.abs(qc-lo.disp)<=1e-12)return {valid:true,kn:lo.kn,q,lower:lo.disp,upper:lo.disp,angle:x,mode:'exact'};
    if(Math.abs(qc-hi.disp)<=1e-12)return {valid:true,kn:hi.kn,q,lower:hi.disp,upper:hi.disp,angle:x,mode:'exact'};
    for(let i=1;i<perLevel.length;i++)if(perLevel[i].disp>=qc){const a=perLevel[i-1],b=perLevel[i],den=b.disp-a.disp,t=den?(qc-a.disp)/den:0;return {valid:true,kn:a.kn+t*(b.kn-a.kn),q,lower:a.disp,upper:b.disp,angle:x,mode:Math.abs(qc-a.disp)<1e-9||Math.abs(qc-b.disp)<1e-9?'exact':'bilinear'};}
    return {valid:false,reason:'KN interpolation bracket failure'};
  }
  function smallAngleKM(kn,angleDeg=5){const s=Math.sin(Math.abs(Number(angleDeg)||0)*Math.PI/180);return Math.abs(s)>1e-12?Number(kn)/s:NaN;}
  ns.kn={interpolateKNRows,smallAngleKM};
})(typeof globalThis!=='undefined'?globalThis:this);
