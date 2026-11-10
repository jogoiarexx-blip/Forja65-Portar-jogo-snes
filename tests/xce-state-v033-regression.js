const assert=require('assert');
const C=require('../forja65-core.js');
let st={emulation:true,m8:true,x8:true,carry:null};
// synthetic object sufficient for decodeOne isn't trivial; verify using SMK fixture if supplied via env is not required.
// Directly exercise state transitions through tiny synthetic ROM placed at LoROM reset.
const raw=C.makeSyntheticRom();
// find reset ROM offset through loader mapping, inject REP #$09 ; XCE ; SEP #$30 ; NOP
let rom=C.loadRom(raw,'xce-test.sfc');
let off=C.snesToRom(rom,C.resetAddress(rom));
rom.data[off]=0xC2; rom.data[off+1]=0x09; rom.data[off+2]=0xFB; rom.data[off+3]=0xE2; rom.data[off+4]=0x30; rom.data[off+5]=0xEA;
st={emulation:true,m8:true,x8:true,carry:null};
let i=C.decodeOne(rom,C.resetAddress(rom),st); assert.equal(st.carry,false,'REP #$01 must clear static carry');
i=C.decodeOne(rom,C.resetAddress(rom)+2,st); assert.equal(st.emulation,false,'XCE must enter native mode when static carry=0'); assert.equal(st.carry,true,'XCE must put old E into carry');
i=C.decodeOne(rom,C.resetAddress(rom)+3,st); assert.equal(st.m8,true); assert.equal(st.x8,true);
console.log('XCE_STATE_V033_PASS',st);
