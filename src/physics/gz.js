(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  function fromKN(angleDeg,kn,kg,tcg=0){
    const knValue=Number(kn);if(!Number.isFinite(knValue))return NaN;
    const angle=Number(angleDeg)||0,phi=angle*Math.PI/180,sgn=angle<0?-1:angle>0?1:0;
    return sgn*Math.abs(knValue)-(Number(kg)||0)*Math.sin(phi)-(Number(tcg)||0)*Math.cos(phi);
  }
  function adjustReferenceGZ(angleDeg,baseGZ,assumedKG,effectiveKG,effectiveTCG=0){
    const angle=Number(angleDeg)||0,phi=angle*Math.PI/180,rad=Math.abs(phi),sign=angle<0?-1:angle>0?1:0;
    return Number(baseGZ)+sign*((Number(assumedKG)||0)-(Number(effectiveKG)||0))*Math.sin(rad)-(Number(effectiveTCG)||0)*Math.cos(phi);
  }
  function restoringSigned(angleDeg,rawGZ){if(!Number.isFinite(Number(rawGZ)))return NaN;if(Math.abs(Number(angleDeg)||0)<1e-9)return 0;return Math.sign(Number(angleDeg))*Number(rawGZ);}
  ns.gz={fromKN,adjustReferenceGZ,restoringSigned};
})(typeof globalThis!=='undefined'?globalThis:this);
