(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  function solve(input={}){
    const displacement=Math.max(0,Number(input.displacement)||0),length=Math.max(.001,Number(input.length)||.001);
    const lcg=Number(input.lcg)||0,lcb=Number(input.lcb)||0,lcf=Number(input.lcf)||0,mct1cm=Math.max(0,Number(input.mct1cm)||0),meanDraft=Math.max(0,Number(input.meanDraft)||0);
    const longitudinalMoment=displacement*(lcg-lcb),trimCm=mct1cm>0?longitudinalMoment/mct1cm:0,trimMeters=trimCm/100;
    const trimAngle=Math.atan2(trimMeters,length)*180/Math.PI;
    const distFP=Math.max(0,length/2-lcf),distAP=Math.max(0,length/2+lcf);
    const draftForward=meanDraft+trimMeters*(distFP/length),draftAft=meanDraft-trimMeters*(distAP/length);
    const waterDepth=Number(input.waterDepth),ukc=Number.isFinite(waterDepth)?waterDepth-Math.max(meanDraft,draftForward,draftAft):NaN;
    return {longitudinalMoment,trimCm,trimMeters,trimAngle,distFP,distAP,draftForward,draftAft,ukc};
  }
  ns.trim={solve};
})(typeof globalThis!=='undefined'?globalThis:this);
