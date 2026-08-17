(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  function finite(v,fallback=0){v=Number(v);return Number.isFinite(v)?v:fallback;}
  function aggregate(input={}){
    const light=input.lightship||{};
    let mass=Math.max(0,finite(light.mass)),vm=mass*finite(light.kg),tm=mass*finite(light.tcg),lm=mass*finite(light.lcg);
    for(const item of input.items||[]){
      const m=Math.max(0,finite(item.mass));
      if(m<=0)continue;
      mass+=m;vm+=m*finite(item.vcg);tm+=m*finite(item.tcg);lm+=m*finite(item.lcg);
    }
    const denom=Math.max(.001,mass);
    return {mass,verticalMoment:vm,transverseMoment:tm,longitudinalMoment:lm,kgSolid:vm/denom,tcg:tm/denom,lcg:lm/denom};
  }
  function applyFreeSurface(input={}){
    const displacement=Math.max(.001,finite(input.displacement,.001));
    const genericFSM=Math.max(0,finite(input.genericFSM));
    const individualFSM=Math.max(0,finite(input.individualFSM));
    const cargoFSM=Math.max(0,finite(input.cargoFSM));
    const totalFSM=genericFSM+individualFSM;
    const fsc=totalFSM/displacement;
    return {genericFSM,individualFSM,cargoFSM,totalFSM,fsc,kgCorr:finite(input.kgSolid)+fsc};
  }
  ns.mass={aggregate,applyFreeSurface};
})(typeof globalThis!=='undefined'?globalThis:this);
