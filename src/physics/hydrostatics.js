(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  function interpolateRows(rows,key,x){
    const rr=(rows||[]).slice().sort((a,b)=>Number(a[key])-Number(b[key]));
    if(!rr.length||!Number.isFinite(Number(x)))return null;
    x=Number(x);if(x<Number(rr[0][key])||x>Number(rr[rr.length-1][key]))return null;
    for(let i=1;i<rr.length;i++)if(Number(rr[i][key])>=x){
      const a=rr[i-1],b=rr[i],den=Number(b[key])-Number(a[key]),t=den?(x-Number(a[key]))/den:0,o={};
      Object.keys(a).forEach(k=>{const av=a[k],bv=b[k];o[k]=(typeof av==='number'&&typeof bv==='number')?av+t*(bv-av):av;});
      return o;
    }
    return {...rr[rr.length-1]};
  }
  function interpolateAngleTable(points,angle){
    const sign=Number(angle)<0?-1:1,x=Math.abs(Number(angle)||0),p=(points||[]).slice().sort((a,b)=>Number(a.a)-Number(b.a));
    if(!p.length||x>Number(p[p.length-1].a))return NaN;
    if(x<=Number(p[0].a))return sign*Number(p[0].v);
    for(let i=1;i<p.length;i++)if(Number(p[i].a)>=x){const a=p[i-1],b=p[i],den=Number(b.a)-Number(a.a),t=den?(x-Number(a.a))/den:0;return sign*(Number(a.v)+t*(Number(b.v)-Number(a.v)));}
    return NaN;
  }
  function sourceEquivalentDisplacement(displacement,currentDensity,sourceDensity=1.025){
    const rho0=Math.max(.001,Number(sourceDensity)||1.025),rho=Math.max(.001,Number(currentDensity)||rho0);return Number(displacement||0)*rho0/rho;
  }
  ns.hydro={interpolateRows,interpolateAngleTable,sourceEquivalentDisplacement};
})(typeof globalThis!=='undefined'?globalThis:this);
