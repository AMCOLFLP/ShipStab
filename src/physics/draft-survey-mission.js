(function(global){
  'use strict';
  const root=global.AMCOLPhysics=global.AMCOLPhysics||{};
  const EPS=1e-9;
  function n(v){const x=Number(v);return Number.isFinite(x)?x:NaN;}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function observationReadings(meanDraft,trimAft=0,sideDelta=0){
    const M=n(meanDraft),T=n(trimAft),d=Math.max(0,n(sideDelta)||0);
    if(![M,T].every(Number.isFinite))return null;
    const f=M-T/2,a=M+T/2,m=M;
    return {forwardPort:f-d,forwardStarboard:f+d,midshipPort:m-d*.65,midshipStarboard:m+d*.65,aftPort:a-d*.85,aftStarboard:a+d*.85};
  }
  function solveSurveyDraft(input={}){
    const ds=root.draftSurvey,rows=(input.hydroRows||[]).filter(r=>Number.isFinite(n(r?.draft))&&Number.isFinite(n(r?.disp))).slice().sort((a,b)=>n(a.draft)-n(b.draft));
    if(!ds||rows.length<2)return {valid:false,reason:'Hydrostatic rows and draft-survey module are required.'};
    const target=n(input.displacement),rho=n(input.observedDensity),rho0=n(input.tableDensity),L=n(input.lbp),trimAft=n(input.trimAft)||0;
    if(![target,rho,rho0,L].every(Number.isFinite)||target<=0||rho<=0||rho0<=0||L<=0)return {valid:false,reason:'Invalid target displacement/density/LBP.'};
    const evalAt=draft=>ds.calculateSurvey({hydroRows:rows,tableDensity:rho0,observedDensity:rho,geometry:{lbp:L,forwardMarkOffset:0,midshipMarkOffset:0,aftMarkOffset:0,keelThickness:0},readings:observationReadings(draft,trimAft,0),deductibles:{}});
    let lo=n(rows[0].draft),hi=n(rows[rows.length-1].draft),rLo=evalAt(lo),rHi=evalAt(hi);
    if(!rLo.valid||!rHi.valid||target<rLo.correctedDisplacement-EPS||target>rHi.correctedDisplacement+EPS)return {valid:false,reason:'Target displacement lies outside the survey/hydrostatic range.',low:rLo.correctedDisplacement,high:rHi.correctedDisplacement};
    let mid=(lo+hi)/2,res=null;
    for(let i=0;i<72;i++){
      mid=(lo+hi)/2;res=evalAt(mid);if(!res.valid)break;
      if(res.correctedDisplacement<target)lo=mid;else hi=mid;
    }
    if(!res?.valid)return {valid:false,reason:res?.reason||'Unable to solve survey draft.'};
    mid=(lo+hi)/2;res=evalAt(mid);
    return {valid:true,surveyDraft:mid,trimAft,result:res,error:res.correctedDisplacement-target};
  }
  function linearScore(error,fullTol,zeroTol,maxPoints){
    const e=Math.abs(n(error));if(!Number.isFinite(e))return 0;if(e<=fullTol)return maxPoints;if(e>=zeroTol)return 0;return maxPoints*(zeroTol-e)/(zeroTol-fullTol);
  }
  function meanAbsErrors(actual={},target={},keys=[]){
    const e=keys.map(k=>Math.abs(n(actual[k])-n(target[k]))).filter(Number.isFinite);return e.length?e.reduce((s,x)=>s+x,0)/e.length:NaN;
  }
  function relativeError(actual,target,floor=1){const a=n(actual),t=n(target);return [a,t].every(Number.isFinite)?Math.abs(a-t)/Math.max(Math.abs(t),floor):NaN;}
  function gradeMission(input={}){
    const truth=input.truth||{},entered=input.entered||{},breakdown=[];
    const readingKeys=['forwardPort','forwardStarboard','midshipPort','midshipStarboard','aftPort','aftStarboard'];
    const draftErrI=meanAbsErrors(entered.initialReadings||{},truth.initialReadings||{},readingKeys),draftErrF=meanAbsErrors(entered.finalReadings||{},truth.finalReadings||{},readingKeys),draftErr=Number.isFinite(draftErrI)&&Number.isFinite(draftErrF)?(draftErrI+draftErrF)/2:NaN;
    breakdown.push({key:'draughts',label:'Draught observations',points:linearScore(draftErr,.003,.020,20),max:20,metric:draftErr,unit:'m mean abs error'});
    const denI=Math.abs(n(entered.initialDensity)-n(truth.initialDensity)),denF=Math.abs(n(entered.finalDensity)-n(truth.finalDensity)),denErr=Number.isFinite(denI)&&Number.isFinite(denF)?(denI+denF)/2:NaN;
    breakdown.push({key:'density',label:'Water density',points:linearScore(denErr,.0005,.006,10),max:10,metric:denErr,unit:'t/m³ mean abs error'});
    const bI=relativeError(entered.initialBallast,truth.initialBallast,5),bF=relativeError(entered.finalBallast,truth.finalBallast,5),bErr=Number.isFinite(bI)&&Number.isFinite(bF)?(bI+bF)/2:NaN;
    breakdown.push({key:'ballast',label:'Ballast from sounding/ullage',points:linearScore(bErr,.005,.05,20),max:20,metric:bErr,unit:'relative error'});
    const oI=relativeError(entered.initialOther,truth.initialOther,2),oF=relativeError(entered.finalOther,truth.finalOther,2),oErr=Number.isFinite(oI)&&Number.isFinite(oF)?(oI+oF)/2:NaN;
    breakdown.push({key:'deductibles',label:'Other changing deductibles',points:linearScore(oErr,.005,.05,10),max:10,metric:oErr,unit:'relative error'});
    const calcErr=relativeError(entered.calculatedCargo,truth.cargo,20);
    breakdown.push({key:'calculatedCargo',label:'Survey calculated cargo',points:linearScore(calcErr,.0025,.025,25),max:25,metric:calcErr,unit:'relative error'});
    const reportErr=relativeError(entered.reportedCargo,truth.cargo,20);
    breakdown.push({key:'reportedCargo',label:'Student reported cargo',points:linearScore(reportErr,.0025,.03,15),max:15,metric:reportErr,unit:'relative error'});
    const total=breakdown.reduce((s,x)=>s+x.points,0),score=Math.round(total*10)/10;
    const grade=score>=90?'DISTINCTION':score>=80?'VERY GOOD':score>=70?'GOOD':score>=60?'SATISFACTORY':'REQUIRES REVIEW';
    return {score,grade,pass:score>=60,breakdown,draftMeanAbsError:draftErr,densityMeanAbsError:denErr,ballastRelativeError:bErr,calculatedCargoRelativeError:calcErr,reportedCargoRelativeError:reportErr};
  }
  root.draftSurveyMission={observationReadings,solveSurveyDraft,linearScore,meanAbsErrors,relativeError,gradeMission};
})(typeof window!=='undefined'?window:globalThis);
