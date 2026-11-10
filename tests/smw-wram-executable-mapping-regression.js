'use strict';
const assert=require('node:assert/strict');
const C=require('../forja65-core');
const IO=require('../tools/project-io');
const rom=C.loadRom(C.makeSyntheticRom());
for(const bank of [0x7E,0x7F])for(const addr of [0x0000,0x7FFF,0x8000,0xFFFF]){
 const pc=(bank<<16)|addr;
 assert.equal(C.snesToRom(rom,pc),null,'WRAM must not alias a ROM offset: '+pc.toString(16));
 assert.equal(C.isRomAddress(rom,pc),false);
}
assert.notEqual(C.snesToRom(rom,0x008000),null,'ROM must remain decodable');
let decoded=C.analyze(rom,128),cache=IO.makeCfgCache(decoded,C.romFingerprint(rom));
let bogus=JSON.parse(JSON.stringify(cache.functions[0]));
bogus.start=0x7F8000;bogus.functionKey='7F8000|legacy-bogus';bogus.instructions[0].pc=0x7F8000;
cache.functions.push(bogus);
const merged=IO.mergeCfgCoverage(C.analyze(rom,128),cache,C.romFingerprint(rom)).a;
assert.equal(merged.cfgCacheWramFunctionsRejected,1);
assert(!merged.functions.some(f=>(f.start>>>16)===0x7F));
const code=C.generateProject(rom,C.analyze(rom,128));
assert(code['src/runtime.hpp'].includes('if(bank==0x7Eu||bank==0x7Fu)return(std::size_t)-1'));
assert(code['src/dispatch.cpp'].includes('forja65_try_wram_stores_rtl'));
assert(code['src/dispatch.cpp'].includes('hw.captureNonRomExecutionTarget(src,requested)'));
assert(code['src/dispatch.cpp'].includes('hw.ram[pos]!=0x6Bu'));
console.log('PASS WRAM mapping, CFG cache hygiene, guarded generated-code execution');
