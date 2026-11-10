'use strict';
const assert=require('node:assert/strict'),C=require('../forja65-core');
const failures=[];
function check(name,f){try{f();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);}}
function hirom(){const r=C.loadRom(C.makeSyntheticRom());r.header.mapping=C.MAP.HIROM;r.data=new Uint8Array(0x20000);r.data.fill(0xdb);return r;}
const native={emulation:false,m8:true,x8:true,carry:null};
check('operand fetch wraps within PB',()=>{const r=hirom();r.data[0xffff]=0xa9;r.data[0]=0x42;r.data[0x10000]=0x99;assert.equal(C.decodeOne(r,0xc0ffff,{...native}).operand,0x42);});
check('linear PC wraps within PB',()=>{const r=hirom();r.data[0xffff]=0xea;assert.deepEqual(C.decodeLinear(r,0xc0ffff,2).map(i=>i.pc),[0xc0ffff,0xc00000]);});
check('CFG fallthrough wraps within PB',()=>{const r=hirom();r.data[0xffff]=0xea;r.data.set([0x4c,0xff,0xff],0xffd0);const f=C.analyze(r,128,[{target:0xc0ffd0,state:native,kind:'STATE',from:null}]);assert(f.functions.flatMap(q=>q.instructions).some(i=>i.pc===0xc00000));assert(!f.functions.flatMap(q=>q.instructions).some(i=>i.pc===0xc10000));});
check('branch target wraps without changing PB',()=>{const r=hirom();r.data[0xfffe]=0x80;r.data[0xffff]=0;r.data.set([0x4c,0xfe,0xff],0xffd0);const f=C.analyze(r,128,[{target:0xc0ffd0,state:native,kind:'STATE',from:null}]);assert(f.functions.flatMap(q=>q.instructions).some(i=>i.pc===0xc00000));});
check('unmapped wrapped operand is rejected',()=>{const r=C.loadRom(C.makeSyntheticRom());r.data[0x7fff]=0xa9;assert.throws(()=>C.decodeOne(r,0x00ffff,{...native}),/ROM|mapeamento/);});
check('REP cannot widen emulation registers',()=>{const r=C.loadRom(C.makeSyntheticRom());r.data.set([0xc2,0x30,0xa9,0x42,0xa2,0x12,0xdb],0);const a=C.analyze(r,128),ins=a.functions.flatMap(f=>f.instructions);assert(ins.some(i=>i.pc===0x8002&&i.size===2&&i.stateIn.m8&&i.stateIn.x8));assert(ins.some(i=>i.pc===0x8004&&i.size===2));});
check('REP native widths and carry remain supported',()=>{const r=hirom();r.data.set([0xc2,0x31,0xa9,0x34,0x12],0);const s={...native,carry:true};C.decodeOne(r,0xc00000,s);assert.deepEqual(s,{emulation:false,m8:false,x8:false,carry:false});assert.equal(C.decodeOne(r,0xc00002,s).size,3);});
assert.deepEqual(failures,[]);console.log('CFG_PC_WIDTH_V043616_PASS cases=7');
