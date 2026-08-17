/* v1.15.3 worker-ready pure physics endpoint. The main simulator does not yet offload the full
   stateful calculation pipeline here; this endpoint is used by tests and is ready for staged adoption. */
importScripts('../physics/mass-properties.js','../physics/hydrostatics.js','../physics/trim.js','../physics/kn.js','../physics/gz.js','../physics/tank-sounding.js','../physics/draft-survey.js','../physics/draft-survey-mission.js');
self.onmessage=function(ev){
  const msg=ev.data||{},id=msg.id,op=msg.op,p=msg.payload||{};let result;
  try{
    if(op==='mass.aggregate')result=AMCOLPhysics.mass.aggregate(p);
    else if(op==='mass.freeSurface')result=AMCOLPhysics.mass.applyFreeSurface(p);
    else if(op==='hydro.interpolateRows')result=AMCOLPhysics.hydro.interpolateRows(p.rows,p.key,p.x);
    else if(op==='hydro.sourceEquivalentDisplacement')result=AMCOLPhysics.hydro.sourceEquivalentDisplacement(p.displacement,p.currentDensity,p.sourceDensity);
    else if(op==='trim.solve')result=AMCOLPhysics.trim.solve(p);
    else if(op==='kn.interpolate')result=AMCOLPhysics.kn.interpolateKNRows(p.rows,p.displacement,p.angle,p.side);
    else if(op==='gz.fromKN')result=AMCOLPhysics.gz.fromKN(p.angle,p.kn,p.kg,p.tcg);
    else if(op==='tankSounding.calculate')result=AMCOLPhysics.tankSounding.calculateTank(p);
    else if(op==='tankSounding.calculateMany')result=AMCOLPhysics.tankSounding.calculateMany(p.entries,p.calibrationRows);
    else if(op==='draftSurvey.calculate')result=AMCOLPhysics.draftSurvey.calculateSurvey(p);
    else if(op==='draftSurveyMission.solveDraft')result=AMCOLPhysics.draftSurveyMission.solveSurveyDraft(p);
    else if(op==='draftSurveyMission.grade')result=AMCOLPhysics.draftSurveyMission.gradeMission(p);
    else throw new Error('Unsupported physics worker operation: '+op);
    self.postMessage({id,ok:true,result});
  }catch(error){self.postMessage({id,ok:false,error:String(error&&error.message||error)});}
};
