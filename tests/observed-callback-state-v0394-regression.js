'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core');
function fixture({operand=0x800a,kind='FLOW',m8=false,foreign=false,noPea=false}={}){
 const bytes=F.makeSyntheticRom();
 // PHP saves M16; PEA supplies the callback's RTS word, not a saved status.
 bytes.set([0x18,0xfb,0xc2,0x30,0x08,0xf4,operand&255,operand>>>8,0x6c,0x42,0x00,0xa9,0x55,0x28,0xa9,0x34,0x12,0xdb],0);
 if(noPea)bytes.set([0xea,0xea,0xea],5);
 bytes.set([0xe2,0x20,0x60],0x100);
 const rom=F.loadRom(bytes,'observed-callback.sfc');
 const hints=F.parseRuntimeHints(`rom=${foreign?'0000000000000000':F.romFingerprint(rom)} target=008100 from=008008 kind=${kind} e=0 m=${m8?1:0} x=0 c=1`);
 const a=F.analyze(rom,512,hints),fn=a.functions.find(f=>f.start===0x008000);
 return {a,fn};
}
const {a,fn}=fixture();
assert(fn.calls.some(c=>c.from===0x008008&&c.target===0x008100),'observed FLOW must connect the actual caller to its callback');
assert(fn.instructions.some(i=>i.pc===0x00800b&&i.stateIn.m8&&i.size===2&&i.returnSite),'callback M8 exit must decode the immediate at its PEA continuation');
assert(fn.instructions.some(i=>i.pc===0x00800e&&!i.stateIn.m8&&i.size===3),'RTS must consume the PEA word so PLP restores the saved M16 status');
assert(a.staticReturnTargets.includes(0x00800b),'computed return must be authorized from a decoded PEA');
for(const options of [{m8:true},{foreign:true},{kind:'STACK-RTS'}]){
 const q=fixture(options);
 assert(!q.fn.calls.some(c=>c.from===0x008008&&c.target===0x008100),'foreign ROM, incompatible widths and return observations cannot invent callback edges');
}
for(const options of [{operand:0x9000},{noPea:true}])assert(!fixture(options).fn.instructions.some(i=>i.pc===0x00800b&&i.returnSite),'an unrelated or absent PEA cannot invent a callback continuation');
console.log('OBSERVED_CALLBACK_STATE_V0394_PASS state-edge=1 continuation=1 status-stack=1 guards=5');
