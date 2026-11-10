'use strict';
// A runtime FLOW observation is a witnessed target, not a closed JSR (abs,X)
// table. A caller must retain an unknown-width fallback even when every
// *observed* target has a fully resolved return summary.
const assert=require('node:assert/strict');
const C=require('../forja65-core');
let checks=0;
function fixture({wideX=false,second=false,reverse=false,direct=false,badRom=false}={}){
 const bytes=C.makeSyntheticRom();
 bytes.set(direct?[0x20,0x60,0x80,0xA9,0x44,0xEA,0xDB]:[0xFC,0x40,0x80,0xA9,0x44,0xEA,0xDB],0);
 bytes.set([0x18,0xFB,0xC2,wideX?0x30:0x20,0x60],0x60);
 // An additional known handler that returns the same wide state.
 bytes.set([0x18,0xFB,0xC2,wideX?0x30:0x20,0x60],0x70);
 const rom=C.loadRom(bytes),hash=C.romFingerprint(rom);
 let targets=[0x8060,...(second?[0x8070]:[])];if(reverse)targets.reverse();
 const hints=direct?[]:targets.map((t,i)=>({rom:badRom&&i===0?'ffffffffffffffff':hash,target:t,from:0x8000,kind:'FLOW',state:{emulation:true,m8:true,x8:true,carry:null},observed:1}));
 const result=C.analyze(rom,4096,hints),fn=result.functions.find(f=>f.start===0x8000);
 assert(fn,'missing caller');
 const widths=fn.instructions.filter(i=>i.pc===0x8003&&i.mnemonic==='LDA').map(i=>i.stateIn.emulation?'emulation-8':i.stateIn.x8?'native-A16-X8':'native-A16-X16');
 return {fn,result,widths};
}
for(const opt of [{},{wideX:true},{second:true},{second:true,reverse:true}]){
 const {fn,result,widths}=fixture(opt);
 assert(widths.includes('emulation-8'),'must preserve unobserved-width fallback'); checks++;
 assert(widths.some(s=>s.startsWith('native-A16')),'must preserve known callee return');checks++;
 assert(fn.frontierDiagnostics.openIndirectReturnDomains>=1,'must record unproven indirect domain');checks++;
 assert(result.summaryConverged,'fixed-point summaries must converge');checks++;
}
{
 const {fn,widths}=fixture({direct:true});
 assert.deepEqual(widths,['native-A16-X8'],'a direct JSR needs no speculative dynamic-domain fallback');checks++;
 assert.equal(fn.frontierDiagnostics.openIndirectReturnDomains,0);checks++;
}
{
 const {fn,result,widths}=fixture({badRom:true});
 assert.equal(result.runtimeHintsRejected,1);checks++;
 assert(!widths.some(s=>s.startsWith('native-A16')),'foreign ROM target must not be imported');checks++;
 assert.equal(fn.frontierDiagnostics.openIndirectReturnDomains,0);checks++;
}
console.log('CFG_OPEN_INDIRECT_RETURN_DOMAIN_V043690_PASS checks='+checks);
