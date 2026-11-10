'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('../tools/analysis-memory');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-analysis-memory-'));
try {
 let calls=0;const compute=()=>{calls++;return {functions:[{exits:new Map([['E0M0X0C?',{m8:false}]])}],values:new Set([1,2]),value:undefined};};
 const run=(identity={rom:'a',source:'one'},opts={})=>M.createAnalysisMemory(dir,{identity,...opts});
 const request={max:4,hints:[],options:{knowledge:null,focusFrontiers:new Map([['fn',new Set(['pc'])]])}};
 let m=run();const first=m.run(request,compute);assert.equal(calls,1);assert.equal(m.stats.hits,0);assert(!fs.existsSync(path.join(dir,'snapshots')),'writes deferred');
 first.functions[0].exits.clear();m.commit();m=run();const second=m.run(request,compute);assert.equal(calls,1,'exact analysis must not run again');assert(second.functions[0].exits instanceof Map);assert.equal(second.functions[0].exits.size,1,'snapshot isolated from later mutations');assert(second.values instanceof Set);assert.equal(m.stats.hits,1);
 m.run({...request,max:5},compute);m.run({...request,hints:[{target:0x8200}]},compute);m.run({...request,options:{...request.options,knowledge:{dataRegions:[{start:0x9000,end:0x9100}]}}},compute);m.run({...request,options:{...request.options,focusFrontiers:new Map([['fn',new Set(['other'])]])}},compute);assert.equal(calls,5,'all semantic inputs keyed');
 run({rom:'b',source:'one'}).run(request,compute);run({rom:'a',source:'two'}).run(request,compute);assert.equal(calls,7,'ROM and analyzer invalidation');
 const file=fs.readdirSync(path.join(dir,'snapshots')).find(n=>n.endsWith('.bin'));fs.writeFileSync(path.join(dir,'snapshots',file),'broken');m=run();m.run(request,compute);assert.equal(calls,8);assert.equal(m.stats.invalid,1);m.commit();
 m=run(undefined,{maxBytes:1});m.run(request,compute);m.commit();assert(m.stats.bypassed>0,'oversized caches bypass without blocking');
 m=run();for(let max=10;max<15;max++){m.run({...request,max},compute);m.commit();}assert(fs.readdirSync(path.join(dir,'snapshots')).filter(n=>n.endsWith('.bin')).length<=2,'disk capped at two snapshots');
 m=run();m.run({...request,options:{callback(){}}},compute);assert.equal(m.stats.bypassed,1,'unkeyable inputs never reuse');
 const blocker=path.join(dir,'block');fs.writeFileSync(blocker,'x');m=M.createAnalysisMemory(blocker,{identity:{rom:'a'}});m.run(request,compute);const committed=m.commit();assert(committed.failed>0,'I/O errors diagnostic only');
 console.log('PERSISTENT_ANALYSIS_SERIALIZATION_KEYS_CORRUPTION_BOUNDS_PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
