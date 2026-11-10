// Scheduling index only. No opcode decoding, CPU restoration or edge inference.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Forja65InternalReplay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_RECORDS=32768,MAX_PRIORITIES=4096,MAX_PER_FUNCTION=64;
function prepare(cache,{rom,version,context}={}){
 const out={coverage:new Map(),focus:new Map(),accepted:0,rejected:0,truncated:0,priorities:0,contextMatched:false};
 if(!cache||cache.schema!=='forja65.cfg-coverage-cache.v1'||cache.rom!==rom||cache.version!==version||cache.internalReplayContext!==context||typeof context!=='string'||!Array.isArray(cache.functions))return out;
 out.contextMatched=true;let visits=0,functions=0;
 outer:for(const fn of cache.functions){
  if(++functions>MAX_RECORDS){out.truncated++;break;}
  if(out.accepted>=MAX_RECORDS){out.truncated++;break;}
  if(typeof fn?.functionKey!=='string'||fn.functionKey.length>128||!Array.isArray(fn.instructions)){out.rejected++;continue;}
  const map=out.coverage.get(fn.functionKey)||new Map();
  for(const i of fn.instructions){
   if(++visits>MAX_RECORDS*2){out.truncated++;break outer;}
   if(out.accepted>=MAX_RECORDS){out.truncated++;break;}
   if(!i||!Number.isInteger(i.pc)||i.pc<0||i.pc>0xffffff||typeof i.stateKey!=='string'||i.stateKey.length>1024||!i.stateKey.startsWith(i.pc.toString(16).toUpperCase().padStart(6,'0')+'|')||!Number.isInteger(i.size)||i.size<1||i.size>4||!Array.isArray(i.raw)||i.raw.length!==i.size||!i.raw.every(n=>Number.isInteger(n)&&n>=0&&n<=255)){out.rejected++;continue;}
   if(!map.has(i.stateKey)){map.set(i.stateKey,i.raw.join(',')+'|'+i.size);out.accepted++;}
  }
  if(map.size)out.coverage.set(fn.functionKey,map);
  if(Array.isArray(fn.internalFrontier)&&out.priorities<MAX_PRIORITIES){
   const keys=new Set();for(const key of fn.internalFrontier.slice(0,MAX_PER_FUNCTION))if(typeof key==='string'&&key.length<=1024&&out.priorities<MAX_PRIORITIES){keys.add(key);out.priorities++;}
   if(keys.size)out.focus.set(fn.functionKey,keys);
  }
 }
 return out;
}
return {prepare,MAX_RECORDS,MAX_PRIORITIES,MAX_PER_FUNCTION};
});
