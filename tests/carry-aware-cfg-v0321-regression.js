const assert=require('assert');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'carry-aware.sfc');
const start=C.resetAddress(rom),off=C.snesToRom(rom,start);
// Dois caminhos com mesmo E/M/X convergem em XCE, mas com Carry diferente.
// BNE -> SEC -> XCE ; fallthrough -> CLC -> BRA -> XCE.
const code=[0xD0,0x03, 0x18, 0x80,0x01, 0x38, 0xFB, 0xEA, 0xDB];
rom.data.set(code,off);
const a=C.analyze(rom,512);
const xce=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===start+6);
assert(xce.some(i=>i.stateIn.carry===false),'CFG perdeu variante XCE com C=0');
assert(xce.some(i=>i.stateIn.carry===true),'CFG perdeu variante XCE com C=1');
const after=a.functions.flatMap(f=>f.instructions).filter(i=>i.pc===start+7);
assert(after.some(i=>i.stateIn.emulation===false),'XCE com C=0 deve entrar em modo nativo');
assert(after.some(i=>i.stateIn.emulation===true),'XCE com C=1 deve permanecer em emulacao');

const hints=C.parseRuntimeHints(
  `target=${(start+6).toString(16)} from=${start.toString(16)} kind=STATE e=1 m=1 x=1 c=0\n`+
  `target=${(start+6).toString(16)} from=${start.toString(16)} kind=STATE e=1 m=1 x=1 c=1\n`
);
assert.strictEqual(hints[0].state.carry,false,'parser deve preservar c=0');
assert.strictEqual(hints[1].state.carry,true,'parser deve preservar c=1');
const ah=C.analyze(rom,512,hints);
const hinted=ah.functions.filter(f=>f.start===start+6 && f.entryName==='RUNTIME-HINT');
assert(hinted.some(f=>f.entryState.carry===false),'hint C=0 foi normalizado incorretamente');
assert(hinted.some(f=>f.entryState.carry===true),'hint C=1 foi normalizado incorretamente');

const files=C.generateProject(rom,ah);
assert(files['src/dispatch.cpp'].includes('carryKnown'),'dispatcher C++ sem discriminacao de Carry');
assert(files['src/dispatch.cpp'].includes('cpu.c!=e.c'),'dispatcher nao prioriza variante C-especifica');
assert(files['src/runtime.hpp'].includes('kind=STATE'),'runtime nao gera hint STATE');
assert(files['src/runtime.hpp'].includes('c="<<(c?1:0)'), 'runtime hint STATE ainda fixa Carry incorretamente');
console.log('CARRY_AWARE_CFG_V0321_PASS',{xceVariants:xce.map(i=>i.stateSig),hinted:hinted.map(f=>f.entryStateSig)});
