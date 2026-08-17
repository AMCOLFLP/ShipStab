(function(global){
  'use strict';
  const root=global.AMCOLPhysics=global.AMCOLPhysics||{};
  const rad=d=>d*Math.PI/180, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function headingFactor(heading){
    const h=String(heading||'beam').toLowerCase();
    if(h.includes('head'))return {longitudinal:1,transverse:.18,label:'HEAD'};
    if(h.includes('follow'))return {longitudinal:.90,transverse:.16,label:'FOLLOWING'};
    if(h.includes('quarter'))return {longitudinal:.70,transverse:.68,label:'QUARTERING'};
    if(h.includes('bow'))return {longitudinal:.82,transverse:.50,label:'BOW QUARTER'};
    return {longitudinal:.20,transverse:1,label:'BEAM'};
  }
  /* Educational response proxy only: not strip theory, CFD or a class-approved RAO. */
  function evaluate(p={}){
    const L=Math.max(1,Number(p.length)||100),B=Math.max(1,Number(p.beam)||20),T=Math.max(.1,Number(p.draft)||5),H=Math.max(0,Number(p.waveHeight)||0),lambda=Math.max(1,Number(p.wavelength)||60),Tw=Math.max(.2,Number(p.wavePeriod)||6),Te=Math.max(.2,Math.abs(Number(p.encounterPeriod)||Tw)),Tr=Math.max(.2,Number(p.rollNaturalPeriod)||8),gm=Math.max(.01,Number(p.gm)||1);
    const hf=headingFactor(p.heading),waveA=H*.5,lambdaRatio=lambda/L;
    // Long waves follow the hull vertically; very short waves average out along ship length.
    const heaveRAO=clamp((.18+.82*(1-Math.exp(-2.2*lambdaRatio)))*(.75+.25*hf.longitudinal),.08,1.08);
    const slope=2*Math.PI*waveA/lambda;
    const pitchRAO=clamp((.25+.85*Math.exp(-Math.pow(lambdaRatio-1.15,2)/.90))*hf.longitudinal,.05,1.10);
    const pitchAmp=rad(1)===0?0:Math.atan(slope*L/Math.max(L,.1)*pitchRAO)*180/Math.PI;
    const encounterRatio=Te/Tr;
    const resonanceProximity=Math.exp(-Math.pow((Te-Tr)/Math.max(Tr*.22,.35),2));
    const beamExcitation=hf.transverse*clamp(H/Math.max(B*.22,.5),0,1.5);
    const rollRisk=clamp(resonanceProximity*beamExcitation*(1/Math.sqrt(gm)),0,1);
    const verticalAccelG=clamp((4*Math.PI*Math.PI*(waveA*heaveRAO))/(Te*Te*9.80665),0,2);
    let risk='LOW';if(rollRisk>.72)risk='HIGH';else if(rollRisk>.38)risk='ELEVATED';
    return {authority:'AMCOL SEAKEEPING PROXY',heading:hf.label,heaveRAO,heaveAmplitudeM:waveA*heaveRAO,pitchRAO,pitchAmplitudeDeg:pitchAmp,encounterRatio,resonanceProximity,rollRisk,risk,verticalAccelG,notes:'Educational frequency/geometry proxy; not vessel-specific RAO/strip-theory/CFD.'};
  }
  root.seakeepingProxy={evaluate};
})(typeof window!=='undefined'?window:globalThis);
