'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core'),R=require('../analysis/indirect-targets'),Inv=require('../analysis/rom-inventory');
const native={emulation:false,m8:false,x8:false,carry:null};
function check(code){
 const b=C.makeSyntheticRom();b.set(code);b.set([0,0x82,0x10,0x82,0x20,0x82,0x30,0x82],0x1000);const rom=C.loadRom(b),path=[];let pc=0x8000,st={...native};
 for(let n=0;n<40;n++){const before={...st},i=C.decodeOne(rom,pc,st);i.stateIn=before;i.stateOut={...st};path.push(i);if(R.supported(i))break;pc+=i.size;}
 return R.resolve(path,{rom,bus:a=>Inv.busOffset(rom,C.snesToRom,a),executable:a=>C.isRomAddress(rom,a)});
}
// Decimal must be explicitly clear. The unknown two-bit input becomes {2,4,6,8} after ADC and ASL.
let q=check([0xd8,0x18,0xad,0,0x10,0x29,1,0,0x69,1,0,0x0a,0xaa,0x7c,0,0x90]);
assert.deepEqual(q.targets,[0x8210,0x8220],'bounded ADC must retain small finite value domains');
q=check([0xd8,0x38,0xa9,4,0,0xe9,2,0,0xaa,0x7c,0,0x90]);assert.deepEqual(q.targets,[0x8210]);
q=check([0xf8,0x18,0xa9,0,0,0x69,2,0,0xaa,0x7c,0,0x90]);assert.deepEqual(q.targets,[],'decimal ADC must not use binary witnesses');
q=check([0xd8,0xa9,0,0,0x69,2,0,0xaa,0x7c,0,0x90]);assert.deepEqual(q.targets,[],'unknown carry must not be invented');
// Integration: analysis must find the new target without runtime hints.
const bytes=C.makeSyntheticRom();bytes.set([0x18,0xfb,0xc2,0x30,0xd8,0x18,0xa9,0,0,0x69,2,0,0xaa,0x7c,0,0x90]);bytes.set([0,0x82],0x1002);bytes.set([0xdb],0x200);
const a=C.analyze(C.loadRom(bytes),128,[],{globalCfg:false});assert(a.functions.some(f=>f.start===0x8200));
console.log('CFG_ARITHMETIC_REV140_PASS binary finite domains decimal/carry guards integration');
