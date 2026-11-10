'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const C=require('../forja65-core'),IO=require('../tools/project-io');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-uncovered-priority-'));
try {
 const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
 bytes.fill(0xEA,0x300,0x500);bytes[0x500]=0xDB;bytes.set([0x20,0,0x81,0x20,0x40,0x81],0x300);bytes.set([0xE8,0x60],0x140);bytes.set([0xE8,0x20,0x20,0x81,0x60],0x100);bytes.set([0xC8,0x60],0x120);
 const romPath=path.join(dir,'cart.sfc'),out=path.join(dir,'project');fs.writeFileSync(romPath,bytes);
 const oldHint='target=008300 from=008000 kind=FLOW e=1 m=1 x=1 c=0';
 const first=IO.generate({romPath,out,max:64,hints:oldHint});
 const before=new Set(first.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 const second=IO.generate({romPath,out,max:64,hints:'target=008100 from=008300 kind=FLOW e=1 m=1 x=1 c=0',update:true});
 const cpp=fs.readFileSync(path.join(out,'src/dispatch.cpp'),'utf8');
 assert.match(cpp,/\{0x008100u,true,true,true,/, 'newly observed lower-address target must enter dispatcher before cached long routines exhaust budget');
 assert(second.a.functions.some(f=>f.start===0x8100&&f.instructions.some(i=>i.mnemonic==='INX')));
 assert(second.a.functions.some(f=>f.start===0x8140),'other direct calls of the cached observed caller must be discovered together');
 assert(second.a.functions.some(f=>f.start===0x8120),'new observed destination direct callees must precede cached seeds');
 const after=new Set(second.a.functions.flatMap(f=>f.instructions.map(i=>i.pc+'|'+i.stateSig)));
 for(const key of before)assert(after.has(key),'previous CFG coverage must not be evicted');
 // A newly observed width must stay pending even when the address is cached.
 bytes.set([0xA9,0x12,0xDB,0x60],0x100);fs.writeFileSync(romPath,bytes);
 const q=path.join(dir,'widths');IO.generate({romPath,out:q,max:600,hints:'target=008100 kind=FLOW e=0 m=1 x=1 c=0\n'+oldHint});
 IO.generate({romPath,out:q,max:64,hints:'target=008100 kind=FLOW e=0 m=0 x=1 c=0',update:true});
 assert.match(fs.readFileSync(path.join(q,'src/dispatch.cpp'),'utf8'),/\{0x008100u,false,false,true,/, 'cached address with incompatible M must remain pending');
 // An observed target must outrank a table peer even if the peer was queued first.
 const table=C.makeSyntheticRom();table[0]=0xDB;table.set([0x7C,0,0x82],0x100);
 for(let i=0;i<5;i++){const t=0x8300+16*i;table[0x200+2*i]=t&255;table[0x201+2*i]=t>>8;table.set([0xEA,0x60],t-0x8000);}
 table.fill(0xEA,0x340,0x3F0);table[0x3F0]=0x60;
 const tr=C.loadRom(table,'table.sfc');
 const covered=C.parseRuntimeHints('target=808340 from=808100 kind=FLOW e=1 m=1 x=1 c=?')[0];
 const pending=C.parseRuntimeHints('target=808300 from=808100 kind=FLOW e=1 m=1 x=1 c=?')[0];
 const cache=IO.makeCfgCache(C.analyze(tr,64,[covered]),C.romFingerprint(tr));
 assert(C.analyze(tr,64,IO.prioritizeUncoveredHints([pending,covered],cache)).functions.some(f=>f.start===pending.target),'observed destination predicted as a peer must retain observed priority');
 // Computed-return table peers must also precede long cached routines.
 const returns=C.makeSyntheticRom();returns[0]=0xDB;
 returns.fill(0xEA,0x300,0x500);returns[0x500]=0xDB;
 for(let n=0;n<20;n++){const t=0x9000+n*4,at=0x2000+n*4;returns[t-0x8000]=0x6B;returns[at]=(t-1)&255;returns[at+1]=(t-1)>>8;returns[at+2]=0;returns[at+3]=0;}
 const rr=C.loadRom(returns,'return-peers.sfc');
 const rh=C.parseRuntimeHints('target=00900C from=00B000 kind=STACK-RTL e=1 m=1 x=1 c=0')[0];
 const long=C.parseRuntimeHints('target=008300 kind=FLOW e=1 m=1 x=1 c=0')[0];
 const ra=C.analyze(rr,64,[{...rh,cachedCoverage:false},{...long,cachedCoverage:true}]);
 assert(ra.instructions.some(i=>i.pc===0x9008)&&ra.instructions.some(i=>i.pc===0x9010),'return table candidates must be decoded before covered seeds exhaust the discovery budget');
 assert.throws(()=>IO.generate({romPath,out:path.join(dir,'too-small'),max:64,cacheLimit:1,hints:'target=008100 e=0 m=0 x=1 c=0'}),/ceiling/);
 assert(!fs.existsSync(path.join(dir,'too-small')),'initial ceiling failure must not write an invalid project');
 const bootRom=path.join(dir,'boot.sfc');fs.writeFileSync(bootRom,C.makeSyntheticRom());
 assert.throws(()=>IO.generate({romPath:bootRom,out:path.join(dir,'too-small'),max:64,cacheLimit:1}),/ceiling/);
 assert(!fs.existsSync(path.join(dir,'too-small')),'initial ceiling failure must not write a project');
 assert.throws(()=>IO.generate({romPath,out:q,max:64,update:true,cacheLimit:0}),/cacheLimit must/);
 IO.generate({romPath,out:q,max:64,update:true,cacheLimit:65536});
 assert.equal(JSON.parse(fs.readFileSync(path.join(q,'analysis/generation-options.json'))).cacheLimit,65536);
 IO.generate({romPath,out:q,max:64,update:true});
 assert.equal(JSON.parse(fs.readFileSync(path.join(q,'analysis/generation-options.json'))).cacheLimit,65536,'audited project ceiling must persist across updates');
 console.log('UNCOVERED_HINT_PRIORITY_V0376_PASS: new target, CPU width, monotonic coverage');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
