// Shared version of the existing monotonic CFG cache merger. Decoder/emitter unchanged.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Forja65CfgCoverage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Local proof annotations do not change emitted instruction semantics or width.
function instructionKey(i){const {rieIndirect,...decoded}=i;return JSON.stringify(decoded);}
function merge(a,cache,hash,limit=32768){
 if(!cache){const variants=new Set(a.functions.flatMap(f=>f.instructions.map(i=>instructionKey(i)))).size;a.cfgCacheUniqueInstructionVariants=variants;if(variants>limit)throw new Error('CFG cache variant ceiling ('+variants+' > '+limit+'); refuse to write coverage above the configured limit');return {a,retained:0};}
 if(cache.rom&&cache.rom!==hash)throw new Error('CFG coverage cache ROM mismatch');
 const byKey=new Map(),runtimePriority=[];
 // A previous LoROM mapping bug admitted SNES WRAM banks $7E/$7F as ROM.
 // Old same-version caches may contain bogus AOT instructions for these banks.
 // Keep legitimate ROM discoveries but discard these provably non-ROM functions;
 // their RAM contents must be validated at runtime, never decoded from cartridge bytes.
 let rejectedWram=0;
 const isWramBank=pc=>(((pc>>>16)&255)===0x7E)||(((pc>>>16)&255)===0x7F);
 for(const f of cache.functions){
  if(!f.functionKey||!Array.isArray(f.instructions)||!f.entryState)throw new Error('Invalid cached CFG function');
  if(isWramBank(f.start)||f.instructions.some(i=>isWramBank(i.pc))){rejectedWram++;continue;}
  byKey.set(f.functionKey,f);
 }
 a.cfgCacheWramFunctionsRejected=rejectedWram;
 const retainedKeys=new Set(byKey.keys());
 const identicalCached=new Set();
 for(const f of byKey.values())for(const i of f.instructions)identicalCached.add(instructionKey(i));
 // A retained call still needs its return-site width guard when fresh
 // scheduling reaches the same instruction through a different predecessor.
 // Match actual bytes and complete state/stack key; preserve no CPU values.
 const returnSites=new Set();
 const returnKey=i=>JSON.stringify([i.stateKey,i.raw,i.size]);
 for(const f of byKey.values())for(const i of f.instructions)if(i.returnSite)returnSites.add(returnKey(i));
 let reused=0;
 for(const discovered of a.functions){
  let f=discovered;
  if(f.instructions.some(i=>!i.returnSite&&returnSites.has(returnKey(i))))
   f={...f,instructions:f.instructions.map(i=>!i.returnSite&&returnSites.has(returnKey(i))?{...i,returnSite:true}:i)};
  if(!retainedKeys.has(f.functionKey)){
   // Only byte-for-byte identical decoded records can reuse an old handler.
   // Branches leaving this sparse suffix resume through the normal dispatcher.
   // Existing functions, their CPU states and their order remain untouched.
   const instructions=f.instructions.filter(i=>!identicalCached.has(instructionKey(i)));
   reused+=f.instructions.length-instructions.length;
   if(!instructions.length)continue;
   f={...f,instructions};
  }
  const old=byKey.get(f.functionKey),keys=new Set(f.instructions.map(i=>instructionKey(i)));
  if(old){
   // Size is not coverage: a larger discovery can omit an older branch/state.
   // Keep the fresh summaries and every missing cached decode record, together
   // with the original graph evidence for those retained records.
   const union=(fresh,prior)=>[...new Map([...(fresh||[]),...(prior||[])].map(v=>[JSON.stringify(v),v])).values()];
   f={...f,instructions:[...f.instructions,...old.instructions.filter(i=>!keys.has(instructionKey(i)))],
    calls:union(f.calls,old.calls),edges:union(f.edges,old.edges),blocks:union(f.blocks,old.blocks)};
   f.blockCount=f.blocks.length;
  }
  byKey.set(f.functionKey,f);if(!retainedKeys.has(f.functionKey))runtimePriority.push(f.functionKey);
 }
 const functions=[...byKey.values()];
 a.cfgCacheIdenticalInstructionsReused=reused;
 const variants=functions.reduce((sum,f)=>sum+f.instructions.length,0);
 // The ceiling bounds distinct decoded records, not repeated references to
 // an identical suffix from several retained roots. Different semantics or
 // CPU-state metadata still count separately; no cached function is evicted.
 const distinct=new Set(functions.flatMap(f=>f.instructions.map(i=>instructionKey(i)))).size;
 a.cfgCacheUniqueInstructionVariants=distinct;
 if(distinct>limit)throw new Error('CFG cache variant ceiling ('+distinct+' > '+limit+'); refuse to evict previously decoded routines silently');
 const oldCount=a.functions.length;
 a.functions=functions;
 const unique=new Map();
 for(const f of functions)for(const i of f.instructions){const pc=i.pc&0xFFFFFF;if(!unique.has(pc))unique.set(pc,i);}
 a.instructions=[...unique.values()].sort((x,y)=>x.pc-y.pc);
 a.decoded=a.instructions.length;
 a.native=a.instructions.filter(i=>i.status==='native').length;
 a.partial=a.instructions.filter(i=>i.status==='partial').length;
 a.unsupported=a.decoded-a.native-a.partial;
 a.instructionVariants=variants;
 a.cfgFunctionVariants=functions.length;
 a.cfgFunctions=new Set(functions.map(f=>f.start)).size;
 a.cfgBlocks=functions.reduce((n,f)=>n+(f.blockCount||0),0);
 a.cfgEdges=functions.reduce((n,f)=>n+(f.edges?.length||0),0);
 a.cfgCalls=functions.reduce((n,f)=>n+(f.calls?.length||0),0);
 a.staticReturnTargets=[...new Set([...(a.staticReturnTargets||[]),...(cache.staticReturnTargets||[]).filter(t=>!isWramBank(t))])].sort((x,y)=>x-y);
 a.syntheticReturnTargets=[...new Set([...(a.syntheticReturnTargets||[]),...(cache.syntheticReturnTargets||[]).filter(t=>!isWramBank(t))])].sort((x,y)=>x-y);
 a.cfgCacheRetained=functions.length-oldCount;
 return {a,retained:a.cfgCacheRetained};
}
return {merge,instructionKey};
});
