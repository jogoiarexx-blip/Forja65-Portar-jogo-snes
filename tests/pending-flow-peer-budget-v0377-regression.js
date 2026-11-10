'use strict';
// Break caught: a descendant call chain of a newly observed table handler
// consumes the discovery budget before siblings of that same live table.
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const C=require('../forja65-core'),IO=require('../tools/project-io');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-pending-flow-peers-'));
try {
 const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
 bytes.set([0x7C,0,0x82],0x100); // JMP ($8200,X)
 const targets=[0x8300,0x8310,0x8320,0x8330,0x8340];
 for(let n=0;n<targets.length;n++){
  const t=targets[n];bytes[0x200+2*n]=t&255;bytes[0x201+2*n]=t>>>8;
  bytes.set(n<2?[0x20,0,0x90,0x60]:[0xE8,0x60],t-0x8000);
 }
 bytes.fill(0xEA,0x1000,0x1300);bytes[0x1300]=0x60;
 const romPath=path.join(dir,'table.sfc'),out=path.join(dir,'project');fs.writeFileSync(romPath,bytes);
 const first=IO.generate({romPath,out,max:64,hints:'target=008300 from=008100 kind=FLOW e=1 m=1 x=1 c=0'});
 const before=new Set(first.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 const second=IO.generate({romPath,out,max:64,update:true,hints:'target=008310 from=008100 kind=FLOW e=1 m=1 x=1 c=0'});
 // Literal pointer-table destinations are independent of the analyzer's own output.
 for(const t of [0x8320,0x8330,0x8340])
  assert(second.a.functions.some(f=>f.start===t),'pending live-table sibling $'+t.toString(16)+' must be discovered before a cached long descendant');
 const after=new Set(second.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 for(const key of before)assert(after.has(key),'previous address/state coverage was evicted');
 assert(!second.a.functions.some(f=>f.start===0xEAEA),'repeated filler is not a table peer');
 const cpp=fs.readFileSync(path.join(out,'src/dispatch.cpp'),'utf8');
 for(const t of ['008320','008330','008340'])assert.match(cpp,new RegExp('\\{0x'+t+'u,true,true,true,'));
 assert(second.a.functions.some(f=>f.start===0x9000),'direct dependency remains in monotonic coverage');
 const rom=C.loadRom(bytes,'promotion.sfc');
 const covered={...C.parseRuntimeHints('target=008300 from=008100 kind=FLOW e=1 m=1 x=1 c=0')[0],cachedCoverage:true};
 const pending={...C.parseRuntimeHints('target=008310 from=008100 kind=FLOW e=1 m=1 x=1 c=0')[0],cachedCoverage:false};
 const promoted=C.analyze(rom,64,[covered,pending]);
 for(const t of [0x8320,0x8330,0x8340])assert(promoted.functions.some(f=>f.start===t),'a peer queued by a covered hint must be promoted for the pending observation');
 assert.equal(promoted.functions[0].entryName,'RESET');
 assert(promoted.functions[1].start===0x8310,'observed destination must precede predicted siblings');
 // Production updates recover unresolved callers from the previous cache.
 // Their descendants must not jump ahead of the newly live table frontier.
 const withCachedCaller=C.analyze(rom,64,[covered,pending],{
  discoverySeeds:[{start:0x9000,state:pending.state}]
 });
 for(const t of [0x8320,0x8330,0x8340])assert(withCachedCaller.functions.some(f=>f.start===t),'cached caller must follow pending table siblings');
 const cachedOnly=C.analyze(rom,64,[covered]);
 assert(cachedOnly.functions.some(f=>f.start===0x9000),'covered table peers must not starve reachable direct calls');
 console.log('PENDING_FLOW_PEER_BUDGET_V0377_PASS: live siblings, direct dependency, monotonic cache, filler guard');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
