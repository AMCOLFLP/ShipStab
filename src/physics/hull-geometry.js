(function(root){
  'use strict';
  const ns=root.AMCOLPhysics=root.AMCOLPhysics||{};
  const ENVELOPES={
    container:[[.35,1,.72,0,0],[.58,.995,.70,.012,.004],[.72,.965,.63,.030,.014],[.84,.86,.52,.060,.038],[.92,.66,.38,.100,.075],[.97,.38,.21,.135,.120],[1,.055,.065,.155,.155]],
    bulk:[[.42,1,.74,0,0],[.64,.998,.72,.010,.003],[.78,.975,.67,.025,.012],[.88,.90,.57,.052,.030],[.95,.66,.39,.090,.070],[.985,.31,.19,.122,.115],[1,.065,.075,.140,.145]],
    general:[[.38,1,.72,0,0],[.60,.995,.70,.012,.004],[.75,.965,.62,.032,.016],[.86,.84,.49,.066,.043],[.94,.59,.33,.105,.085],[.98,.30,.17,.135,.128],[1,.055,.065,.150,.150]],
    roro:[[.48,1,.76,0,0],[.70,.998,.74,.008,.002],[.84,.955,.64,.024,.010],[.93,.76,.45,.050,.030],[.98,.40,.23,.072,.060],[1,.085,.085,.082,.078]],
    ferry:[[.48,1,.76,0,0],[.70,.998,.74,.010,.002],[.84,.96,.64,.028,.012],[.93,.78,.46,.058,.034],[.98,.42,.24,.080,.065],[1,.085,.085,.092,.084]],
    tanker:[[.50,1,.78,0,0],[.70,1,.77,.008,.002],[.83,.975,.71,.020,.009],[.91,.88,.59,.045,.025],[.96,.66,.42,.070,.050],[.99,.30,.21,.090,.082],[1,.075,.085,.100,.100]],
    chemical:[[.48,1,.77,0,0],[.69,1,.76,.009,.002],[.82,.97,.69,.022,.010],[.91,.86,.57,.048,.028],[.96,.63,.40,.075,.055],[.99,.29,.20,.096,.088],[1,.07,.08,.108,.108]],
    lng:[[.50,1,.79,0,0],[.71,1,.77,.008,.002],[.84,.98,.71,.021,.010],[.92,.88,.58,.047,.027],[.97,.62,.39,.074,.054],[.99,.29,.20,.096,.088],[1,.075,.085,.108,.108]],
    osv:[[.36,1,.70,0,0],[.58,.995,.68,.016,.005],[.73,.96,.60,.040,.020],[.84,.84,.48,.078,.050],[.93,.61,.32,.118,.095],[.98,.30,.17,.150,.140],[1,.055,.065,.165,.165]],
    box:[[.72,1,.90,0,0],[.88,.96,.86,.005,.003],[.96,.90,.80,.012,.010],[1,.84,.78,.020,.015]],
    axe:[[.30,1,.68,0,0],[.58,.92,.60,.020,.015],[.76,.72,.48,.050,.050],[.90,.44,.30,.090,.105],[1,.055,.07,.115,.170]]
  };
  const PROFILES={
    container:{label:'Fine flared merchant bow / bulbous',form:'raked',flare:.087,stemRake:.23,sternFull:.705,bulb:{w:.047,h:.037,l:.039,y:.095}},
    bulk:{label:'Full rounded raked merchant bow / bulbous',form:'raked',flare:.068,stemRake:.18,sternFull:.76,bulb:{w:.060,h:.050,l:.046,y:.105}},
    general:{label:'Conventional rounded raked cargo bow / bulbous',form:'raked',flare:.076,stemRake:.21,sternFull:.73,bulb:{w:.040,h:.034,l:.030,y:.096}},
    roro:{label:'High-freeboard conventional Ro-Ro bow',form:'vertical',flare:.048,stemRake:.016,sternFull:.885,bulb:null},
    ferry:{label:'High-freeboard conventional ferry bow',form:'vertical',flare:.055,stemRake:.018,sternFull:.86,bulb:null},
    tanker:{label:'Full rounded tanker bow / bulbous',form:'full',flare:.048,stemRake:.125,sternFull:.895,bulb:{w:.068,h:.058,l:.048,y:.108}},
    chemical:{label:'Full rounded chemical-tanker bow / bulbous',form:'full',flare:.054,stemRake:.14,sternFull:.86,bulb:{w:.064,h:.055,l:.044,y:.108}},
    lng:{label:'Full rounded gas-carrier bow / bulbous',form:'full',flare:.046,stemRake:.125,sternFull:.91,bulb:{w:.068,h:.058,l:.049,y:.108}},
    osv:{label:'Conventional offshore flared bow',form:'raked',flare:.045,stemRake:.16,sternFull:.70,bulb:null},
    box:{label:'Box / pontoon bow',form:'box',flare:.010,stemRake:0,sternFull:.97,bulb:null},
    axe:{label:'Specialised Axe / flareless bow',form:'axe',flare:.008,stemRake:0,sternFull:.70,bulb:null,axeBack:.18}
  };
  const MIDSHIP={
    box:[[ -.5,0],[.5,0],[.5,1],[-.5,1]],
    roro:[[-.45,0],[.45,0],[.50,.16],[.50,1],[-.50,1],[-.50,.16]],
    ferry:[[-.45,0],[.45,0],[.50,.16],[.50,1],[-.50,1],[-.50,.16]],
    container:[[-.33,0],[.33,0],[.46,.15],[.50,.43],[.50,1],[-.50,1],[-.50,.43],[-.46,.15]],
    bulk:[[-.31,0],[.31,0],[.45,.13],[.50,.42],[.48,1],[-.48,1],[-.50,.42],[-.45,.13]],
    tanker:[[-.36,0],[.36,0],[.48,.12],[.50,.32],[.50,1],[-.50,1],[-.50,.32],[-.48,.12]],
    chemical:[[-.36,0],[.36,0],[.48,.12],[.50,.32],[.50,1],[-.50,1],[-.50,.32],[-.48,.12]],
    lng:[[-.34,0],[.34,0],[.47,.12],[.50,.36],[.49,1],[-.49,1],[-.50,.36],[-.47,.12]],
    osv:[[-.26,0],[.26,0],[.42,.18],[.50,.52],[.48,1],[-.48,1],[-.50,.52],[-.42,.18]],
    general:[[-.28,0],[.28,0],[.43,.16],[.50,.48],[.50,1],[-.50,1],[-.50,.48],[-.43,.16]],
    axe:[[-.20,0],[.20,0],[.35,.22],[.44,.58],[.42,1],[-.42,1],[-.44,.58],[-.35,.22]]
  };
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function smooth01(t){t=clamp(t,0,1);return t*t*(3-2*t);}
  function key(type){type=String(type||'general').toLowerCase();if(type==='barge')return'box';return ENVELOPES[type]?type:'general';}
  function interpolate(points,x){if(!points?.length)return null;if(x<=points[0][0])return points[0];if(x>=points[points.length-1][0])return points[points.length-1];for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i],t=smooth01((x-a[0])/Math.max(1e-9,b[0]-a[0]));return [x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t,a[4]+(b[4]-a[4])*t];}return points.at(-1);}
  function profile(type){const k=key(type),p=PROFILES[k]||PROFILES.general;return {...p,bowCurve:(ENVELOPES[k]||ENVELOPES.general).map(r=>r.slice())};}
  function stationEnvelopeAt(xNorm,type='general',customStations=null){
    const k=key(type);xNorm=clamp(Number(xNorm)||0,-1,1);
    if(Array.isArray(customStations)&&customStations.length>=5){const pts=customStations.map(s=>[+s.xNorm,+s.beamFactor,+s.bottomFactor,+s.sheerRatio||0,+s.keelRiseRatio||0]).filter(a=>a.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]),r=interpolate(pts,xNorm);if(r)return {beamFactor:r[1],bottomFactor:r[2],sheerRatio:r[3],keelRiseRatio:r[4],source:'custom'};}
    const pts=ENVELOPES[k],first=pts[0][0],p=PROFILES[k];
    if(xNorm<-.70){const u=smooth01((xNorm+1)/.30),aft=p?.sternFull??.73;return {beamFactor:aft+(1-aft)*u,bottomFactor:.45+.27*u,sheerRatio:.010*(1-u),keelRiseRatio:0,source:'family'};}
    if(xNorm<first)return {beamFactor:1,bottomFactor:k==='box'?.90:.72,sheerRatio:0,keelRiseRatio:0,source:'family'};
    const r=interpolate(pts,xNorm);return {beamFactor:r[1],bottomFactor:r[2],sheerRatio:r[3],keelRiseRatio:r[4],source:'family'};
  }
  function midshipPolygon(type,B,D){const k=key(type),pts=MIDSHIP[k]||MIDSHIP.general;return pts.map(([x,y])=>[x*B,y*D]);}
  function halfBreadthAtDraft(y,xNorm,B,D,type='general',customStations=null){
    const st=stationEnvelopeAt(xNorm,type,customStations),p=profile(type),hd=B*.5*st.beamFactor,hb=B*.5*st.bottomFactor;
    const keel=D*(st.keelRiseRatio||0),sheer=D*(st.sheerRatio||0),localY=clamp(Number(y)-keel-sheer,0,D),frac=clamp(localY/Math.max(.001,D),0,1),u=Math.pow(frac,1/.78);
    let width=hb*.16+(hd-hb*.16)*Math.pow(Math.sin(u*Math.PI/2),.78);const fore=Math.max(0,clamp((xNorm-(p.bowCurve?.[0]?.[0]??.4))/Math.max(.001,1-(p.bowCurve?.[0]?.[0]??.4)),0,1));
    width*=1+p.flare*Math.pow(u,1.15)*Math.pow(fore,1.15);if(u>.70)width*=1+.028*((u-.70)/.30)+p.flare*.16*Math.pow(fore,1.08);return Math.max(B*.012,width);
  }
  ns.hull={ENVELOPES,PROFILES,MIDSHIP,key,profile,interpolate,stationEnvelopeAt,midshipPolygon,halfBreadthAtDraft};
  root.AMCOL_HULL_STATION_ENVELOPES=ENVELOPES;
})(typeof globalThis!=='undefined'?globalThis:this);
