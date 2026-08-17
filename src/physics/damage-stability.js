(function(root){
 'use strict';
 const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
 function n(v,d=0){v=Number(v);return Number.isFinite(v)?v:d;}
 function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
 function overlapLength(a0,a1,b0,b1){return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));}
 function normaliseCompartment(c={},kind='space'){
   const length=Math.max(.1,n(c.length,1)),breadth=Math.max(.1,n(c.breadth,1)),height=Math.max(.1,n(c.height,1)),block=clamp(n(c.blockFactor,kind==='tank'?.88:.92),.1,1),capacity=n(c.capacityVolume,0)>0?n(c.capacityVolume):length*breadth*height*block;
   const side=String(c.side||'').toLowerCase();return {id:String(c.id||c.name||Math.random()),name:String(c.name||c.id||'Compartment'),kind,lcg:n(c.lcg),tcg:n(c.tcg),bottom:n(c.bottom),length,breadth,height,capacity,side:side.includes('port')?'port':side.includes('star')?'starboard':'centre',permeability:clamp(n(c.permeability,kind==='tank'?.95:.70),.05,1),connections:Array.isArray(c.connections)?c.connections.map(String):[]};
 }
 function estimate(input={}){
   const L=Math.max(1,n(input.length,1)),B=Math.max(1,n(input.beam,1)),D=Math.max(1,n(input.depth,1)),rho=Math.max(.1,n(input.density,1.025)),damage=input.damage||{},side=n(damage.side,1)<0?'port':'starboard',damageLength=clamp(n(damage.lengthPct,20)/100,.01,.9)*L,damageLCG=n(damage.lcg),d0=damageLCG-damageLength/2,d1=damageLCG+damageLength/2,penetration=clamp(n(damage.widthPct,22)/100,.01,.5),vertical=clamp(n(damage.heightPct,55)/100,.01,1),perm=clamp(n(damage.permeability,.95),.05,1);
   const comps=[...(input.cargoSpaces||[]).map(c=>normaliseCompartment(c,'cargo')),...(input.ballastTanks||[]).map(c=>normaliseCompartment(c,'tank'))],affected=[];
   for(const c of comps){const c0=c.lcg-c.length/2,c1=c.lcg+c.length/2,ol=overlapLength(c0,c1,d0,d1);if(ol<=0)continue;let sideFactor=c.side==='centre'?.5:(c.side===side?1:0);if(sideFactor<=0&&Math.abs(c.tcg)<B*.08)sideFactor=.5;if(sideFactor<=0)continue;const longitudinal=clamp(ol/c.length,0,1),transverse=clamp(penetration/(Math.max(.05,c.breadth/B)),0,1),verticalFactor=clamp(vertical/(Math.max(.05,c.height/D)),0,1),floodableVolume=c.capacity*longitudinal*sideFactor*transverse*verticalFactor*perm*c.permeability,mass=floodableVolume*rho;affected.push({...c,longitudinal,transverse,verticalFactor,floodableVolume,mass});}
   const totalVolume=affected.reduce((s,c)=>s+c.floodableVolume,0),totalMass=affected.reduce((s,c)=>s+c.mass,0),den=Math.max(1e-9,totalMass),lcg=affected.reduce((s,c)=>s+c.mass*c.lcg,0)/den,tcg=affected.reduce((s,c)=>s+c.mass*(c.side==='port'?-Math.max(Math.abs(c.tcg),B*.25):c.side==='starboard'?Math.max(Math.abs(c.tcg),B*.25):c.tcg),0)/den,vcg=affected.reduce((s,c)=>s+c.mass*(c.bottom+c.height*.45),0)/den;
   return {valid:true,side,damageLength,damageLCG,affected,totalVolume,totalMass,lcg:Number.isFinite(lcg)?lcg:0,tcg:Number.isFinite(tcg)?tcg:0,vcg:Number.isFinite(vcg)?vcg:0,authority:'DERIVED TEACHING ESTIMATE',warning:'Compartment connectivity, cross-flooding, openings and actual subdivision are not known unless supplied.'};
 }
 function progressiveFlooding(compartments=[],initialIds=[]){
   const rows=compartments.map(c=>normaliseCompartment(c,c.kind||'space')),byId=new Map(rows.map(c=>[String(c.id),c])),wet=new Set((initialIds||[]).map(String)),queue=[...wet],order=[];
   while(queue.length){const id=queue.shift(),c=byId.get(id);if(!c)continue;order.push(id);for(const nxt of c.connections||[]){const k=String(nxt);if(byId.has(k)&&!wet.has(k)){wet.add(k);queue.push(k);}}}
   return {valid:true,initial:[...(initialIds||[])].map(String),flooded:[...wet],progressionOrder:order,hasConnectivity:rows.some(c=>c.connections.length>0),authority:'EXPLICIT CONNECTIVITY ONLY',warning:'Progressive flooding is propagated only through connections explicitly supplied in the vessel dataset; no missing doors, ducts or cross-flooding paths are invented.'};
 }
 ns.damageStability={estimate,normaliseCompartment,progressiveFlooding};
})(typeof globalThis!=='undefined'?globalThis:this);
