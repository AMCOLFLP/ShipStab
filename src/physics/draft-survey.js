(function(global){
  'use strict';
  const root=global.AMCOLPhysics=global.AMCOLPhysics||{};
  const EPS=1e-9;
  function n(v){const x=Number(v);return Number.isFinite(x)?x:NaN;}
  function clampDensity(v){const x=n(v);return Number.isFinite(x)&&x>0?x:NaN;}
  function mean2(a,b){a=n(a);b=n(b);return Number.isFinite(a)&&Number.isFinite(b)?(a+b)/2:NaN;}
  function interpolateByDraft(rows,draft){
    if(!Array.isArray(rows)||rows.length<2||!Number.isFinite(n(draft)))return null;
    if(root.hydro?.interpolateRows)return root.hydro.interpolateRows(rows,'draft',n(draft));
    const r=rows.filter(x=>Number.isFinite(n(x?.draft))).slice().sort((a,b)=>a.draft-b.draft),x=n(draft);
    if(!r.length||x<r[0].draft-EPS||x>r[r.length-1].draft+EPS)return null;
    if(x<=r[0].draft)return {...r[0]};if(x>=r[r.length-1].draft)return {...r[r.length-1]};
    for(let i=1;i<r.length;i++)if(r[i].draft>=x){const a=r[i-1],b=r[i],t=(x-a.draft)/(b.draft-a.draft),o={};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const av=n(a[k]),bv=n(b[k]);o[k]=Number.isFinite(av)&&Number.isFinite(bv)?av+t*(bv-av):(a[k]??b[k]);}return o;}
    return null;
  }
  /* Signed offsets are measured longitudinally from the target reference location in the simulator convention:
     + = forward, - = aft. Trim aft is positive. With this convention:
       draft(reference) = draft(mark) + trimAft * offset / distanceBetweenMarks.
     This is algebraically equivalent to the UN/ECE mark-to-perpendicular similar-triangle correction when the
     sign is assigned from the mark's physical position relative to the perpendicular. */
  function correctMarkDraft(markDraft,trimAft,offset,distanceBetweenMarks){
    const d=n(markDraft),t=n(trimAft),o=n(offset),L=n(distanceBetweenMarks);
    if(![d,t,o,L].every(Number.isFinite)||Math.abs(L)<EPS)return NaN;
    return d+t*o/L;
  }
  function draftMeans(readings={}){
    const fwd=mean2(readings.forwardPort,readings.forwardStarboard),mid=mean2(readings.midshipPort,readings.midshipStarboard),aft=mean2(readings.aftPort,readings.aftStarboard);
    return {forward:fwd,midship:mid,aft};
  }
  function correctedDrafts(readings={},geometry={}){
    const means=draftMeans(readings),lbp=n(geometry.lbp),of=n(geometry.forwardMarkOffset||0),om=n(geometry.midshipMarkOffset||0),oa=n(geometry.aftMarkOffset||0);
    const distance=Number.isFinite(n(geometry.distanceBetweenMarks))&&n(geometry.distanceBetweenMarks)>0?n(geometry.distanceBetweenMarks):(Number.isFinite(lbp)?lbp+of-oa:NaN);
    if(![means.forward,means.midship,means.aft,distance].every(Number.isFinite)||distance<=0)return {valid:false,means,distanceBetweenMarks:distance,reason:'Complete six draught readings and valid mark geometry are required.'};
    const trimAtMarks=means.aft-means.forward;
    const forward=correctMarkDraft(means.forward,trimAtMarks,of,distance);
    const midship=correctMarkDraft(means.midship,trimAtMarks,om,distance);
    const aft=correctMarkDraft(means.aft,trimAtMarks,oa,distance);
    const trimAft=aft-forward,extremeMean=(forward+aft)/2,hogSag=midship-extremeMean;
    // UN/ECE M/M/M: M=(F+A)/2; M/M=(M+MS)/2; M/M/M=(M/M+MS)/2 = (M+3MS)/4.
    const meanOfMeans=(extremeMean+midship)/2;
    const mmm=(meanOfMeans+midship)/2;
    const keelThickness=Math.max(0,n(geometry.keelThickness)||0),mouldedDraft=mmm-keelThickness;
    return {valid:true,means,distanceBetweenMarks:distance,trimAtMarks,forward,midship,aft,trimAft,extremeMean,hogSag,hogSagSense:hogSag>1e-5?'SAG':hogSag<-1e-5?'HOG':'STRAIGHT',meanOfMeans,mmm,keelThickness,mouldedDraft};
  }
  function trimCorrections(rows,draft,trimAft,lbp){
    const h=interpolateByDraft(rows,draft),L=n(lbp),T=n(trimAft);
    if(!h||!Number.isFinite(L)||L<=0||!Number.isFinite(T))return {valid:false,reason:'Hydrostatic data, LBP and corrected trim are required.'};
    const tpc=n(h.tpc),lcf=n(h.lcf),mctc=n(h.mctc),disp=n(h.disp);
    if(![tpc,lcf,mctc,disp].every(Number.isFinite))return {valid:false,hydro:h,reason:'Hydrostatic row is missing displacement/TPC/LCF/MCT1cm.'};
    // Simulator LCF convention is +forward / -aft. This reproduces the UN/ECE first-trim-correction sign table.
    const first=-100*tpc*lcf*T/L;
    const plus=interpolateByDraft(rows,draft+.5),minus=interpolateByDraft(rows,draft-.5);
    const secondAvailable=!!(plus&&minus&&Number.isFinite(n(plus.mctc))&&Number.isFinite(n(minus.mctc)));
    const dM=secondAvailable?n(plus.mctc)-n(minus.mctc):NaN;
    const second=secondAvailable?50*Math.abs(dM)*T*T/L:0; // UN/ECE Nemoto correction is applied as a positive correction.
    const total=first+second,corrected=disp+total;
    return {valid:true,hydro:h,displacementTable:disp,firstTrimCorrection:first,secondTrimCorrection:second,totalTrimCorrection:total,displacementTrimCorrected:corrected,secondAvailable,mctcPlus05:plus? n(plus.mctc):NaN,mctcMinus05:minus? n(minus.mctc):NaN,dMctc:dM};
  }
  function densityCorrection(displacementTrimCorrected,observedDensity,tableDensity){
    const d=n(displacementTrimCorrected),rho=clampDensity(observedDensity),rho0=clampDensity(tableDensity);
    if(![d,rho,rho0].every(Number.isFinite))return {valid:false,corrected:NaN,correction:NaN};
    const corrected=d*rho/rho0;
    return {valid:true,corrected,correction:corrected-d,ratio:rho/rho0};
  }
  function totalDeductibles(d={}){
    const keys=['ballast','freshWater','fuelOil','dieselOil','lubeOil','slopsBilge','anchorChain','other'];
    const items={};let total=0;
    keys.forEach(k=>{const v=Math.max(0,n(d[k])||0);items[k]=v;total+=v;});
    return {items,total};
  }
  function calculateSurvey(input={}){
    const rows=input.hydroRows||[],geometry=input.geometry||{},drafts=correctedDrafts(input.readings||{},geometry);
    if(!drafts.valid)return {valid:false,stage:'draughts',drafts,reason:drafts.reason};
    const hydro=trimCorrections(rows,drafts.mouldedDraft,drafts.trimAft,geometry.lbp);
    if(!hydro.valid)return {valid:false,stage:'hydrostatics',drafts,hydro,reason:hydro.reason};
    const density=densityCorrection(hydro.displacementTrimCorrected,input.observedDensity,input.tableDensity);
    if(!density.valid)return {valid:false,stage:'density',drafts,hydro,density,reason:'Observed and hydrostatic-table densities are required.'};
    const deductibles=totalDeductibles(input.deductibles||{}),netDisplacement=density.corrected-deductibles.total;
    return {valid:true,drafts,hydro,density,deductibles,netDisplacement,correctedDisplacement:density.corrected,sourceDraft:drafts.mouldedDraft};
  }
  function cargoDifference(initialResult,finalResult){
    if(!initialResult?.valid||!finalResult?.valid)return {valid:false,cargo:NaN,direction:'N/A'};
    const cargo=finalResult.netDisplacement-initialResult.netDisplacement;
    return {valid:true,cargo,direction:cargo>1e-6?'LOADED':cargo<-1e-6?'DISCHARGED':'NO CHANGE',magnitude:Math.abs(cargo)};
  }
  root.draftSurvey={mean2,draftMeans,correctMarkDraft,correctedDrafts,interpolateByDraft,trimCorrections,densityCorrection,totalDeductibles,calculateSurvey,cargoDifference};
})(typeof window!=='undefined'?window:globalThis);
