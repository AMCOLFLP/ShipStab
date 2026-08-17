(function(global){
  'use strict';
  let worker=null,workerBlobUrl='',seq=0,pending=new Map(),disabled=false;
  function inlineSource(){return typeof global.AMCOL_INLINE_PHYSICS_WORKER_SOURCE==='string'&&global.AMCOL_INLINE_PHYSICS_WORKER_SOURCE.length>100?global.AMCOL_INLINE_PHYSICS_WORKER_SOURCE:'';}
  function canUse(){return !disabled&&typeof Worker!=='undefined'&&typeof location!=='undefined'&&(!!inlineSource()||location.protocol!=='file:');}
  function ensure(){
    if(worker||!canUse())return worker;
    try{
      const src=inlineSource();if(src){workerBlobUrl=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));worker=new Worker(workerBlobUrl);}else worker=new Worker('src/workers/physics-worker.js');
      worker.onmessage=e=>{const m=e.data||{},p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.ok?p.resolve(m.result):p.reject(new Error(m.error||'Physics worker error'));};
      worker.onerror=e=>{console.warn('AMCOL physics worker disabled; synchronous physics remains authoritative.',e?.message||e);disabled=true;try{worker.terminate();}catch(_){}if(workerBlobUrl){try{URL.revokeObjectURL(workerBlobUrl);}catch(_){}workerBlobUrl='';}worker=null;for(const p of pending.values())p.reject(new Error('Physics worker unavailable'));pending.clear();};
    }catch(e){disabled=true;console.warn('AMCOL physics worker unavailable; synchronous fallback retained.',e);}
    return worker;
  }
  function call(op,payload,timeout=4000){
    const w=ensure();if(!w)return Promise.reject(new Error('Physics worker unavailable'));
    const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Physics worker timeout'));},timeout);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});w.postMessage({id,op,payload});});
  }
  function status(){return {available:!!worker||canUse(),active:!!worker,disabled,pending:pending.size};}
  function shutdown(){if(worker)worker.terminate();worker=null;if(workerBlobUrl){try{URL.revokeObjectURL(workerBlobUrl);}catch(_){}workerBlobUrl='';}pending.clear();}
  global.AMCOLPhysicsWorker={call,status,shutdown};
})(typeof window!=='undefined'?window:globalThis);
