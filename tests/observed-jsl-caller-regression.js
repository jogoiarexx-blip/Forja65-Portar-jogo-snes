'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core'),IO=require('../tools/project-io');
// Removing observed caller seeds must lose the subsequent native-width calls.
const bytes=C.makeSyntheticRom();bytes[0]=0xDB;
bytes.set([0x22,0,0x82,0,0x22,0x40,0x82,0,0x22,0x60,0x82,0,0xDB],0x100);
for(const at of [0x200,0x240,0x260])bytes.set([0xA9,0x12,0x34,0x6B],at);
const rom=C.loadRom(bytes,'observed-jsl.sfc'),hash=C.romFingerprint(rom);
const initial=C.parseRuntimeHints('target=008100 kind=FLOW e=0 m=1 x=1 c=0');
const cache=IO.makeCfgCache(C.analyze(rom,128,initial),hash);
const hints=C.parseRuntimeHints('rom='+hash+' target=008200 from=008100 kind=FLOW e=0 m=0 x=0 c=0');
const ordered=IO.prioritizeUncoveredHints(hints,cache);
const result=C.analyze(rom,128,ordered,{discoverySeeds:IO.cachedCallerSeeds(ordered,cache,rom)});
for(const pc of [0x8104,0x8108,0x8240,0x8260])assert(result.instructions.some(i=>i.pc===pc&&!i.stateIn.m8&&!i.stateIn.x8),
 'an observed JSL entry must recover caller continuation and later callees with actual CPU widths at '+pc.toString(16));
for(const changes of [{target:0x8260},{rom:'another-rom'},{rom:null},{kind:'STACK-RTL'},{cachedCoverage:true},{from:0x8200},{from:0x7E0000}]){
 const invalid={...ordered[0],...changes};
 const candidates=IO.cachedCallerSeeds([invalid],null,rom);
 assert(!candidates.some(s=>s.start===invalid.from),'an unrelated observation must not prove a caller state: '+JSON.stringify(changes));
}
console.log('OBSERVED_JSL_CALLER_PASS');
