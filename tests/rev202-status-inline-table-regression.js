// Forja65 REV202: STATUS estatico (avisos especulativos/runtime nao bloqueiam), certificado de rota e tabela inline
// apos JSL para destino que consome o retorno (padrao ExecutePtr do SMW).
'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
// 1) classificacao
assert.strictEqual(C.staticBlockingIssue({kind:'VECTOR',pc:1,detail:'x'}),true);
assert.strictEqual(C.staticBlockingIssue({kind:'VECTOR',pc:1,detail:'x',speculative:true}),false);
assert.strictEqual(C.staticBlockingIssue({kind:'CFG-DYNAMIC',pc:1,detail:'x'}),false);
assert.strictEqual(C.staticBlockingIssue({kind:'CFG-NONROM-TARGET',pc:1,detail:'x',wram:true}),false);
assert.strictEqual(C.staticBlockingIssue({kind:'CFG-LIMIT',pc:null,detail:'x'}),true);
// 2) certificado
const cert={schema:'forja65.rev200.route-certification.v1',status:'CPU_AOT_CERTIFIED',strict_cpu_aot_certified:true,certified_logical_inputs:10,rom_sha256:'ab'.repeat(32),logic_sha256:'cd'.repeat(32)};
let a={status:'PORT_AINDA_NAO_JOGAVEL'};
C.finalizePortStatus(a,[cert],{sha256:'ab'.repeat(32)});
assert.strictEqual(a.status,'PORT_JOGAVEL_ROTA_CERTIFICADA');assert.strictEqual(a.cfgStaticStatus,'PORT_AINDA_NAO_JOGAVEL');
a={status:'PORT_AINDA_NAO_JOGAVEL'};C.finalizePortStatus(a,[cert],{sha256:'ef'.repeat(32)});assert.strictEqual(a.status,'PORT_AINDA_NAO_JOGAVEL','ROM diferente nao promove');
a={status:'CFG_DIRETO_RECOMPILAVEL'};C.finalizePortStatus(a,[{...cert,status:'NOT_CERTIFIED'}],{sha256:'ab'.repeat(32)});assert.strictEqual(a.status,'CFG_DIRETO_RECOMPILAVEL','NOT_CERTIFIED nao promove');
a={status:'CFG_DIRETO_RECOMPILAVEL'};C.finalizePortStatus(a,[{...cert,failure:{reason:'x'}}],{sha256:'ab'.repeat(32)});assert.strictEqual(a.status,'CFG_DIRETO_RECOMPILAVEL','falha nao promove');
// 3) ROM sintetica: $008000 JSL $008100 ; tabela dw $8008,$8009 ; $8008/$8009 RTS
//    $008100: STY $03 ; PLY ; STY $00 ; REP #$30 ; AND #$00FF ; ASL ; TAY ; PLA ; STA $01 ; INY ; LDA [$00],Y ; STA $00 ; SEP #$30 ; LDY $03 ; JML [$0000]
const d=C.makeSyntheticRom();
const put=(a,bytes)=>bytes.forEach((b,i)=>d[(a&0x7FFF)+i]=b);
put(0x8000,[0x22,0x00,0x81,0x00, 0x08,0x80, 0x09,0x80]);
put(0x8008,[0x60,0x60]);
put(0x8100,[0x84,0x03,0x7A,0x84,0x00,0xC2,0x30,0x29,0xFF,0x00,0x0A,0xA8,0x68,0x85,0x01,0xC8,0xB7,0x00,0x85,0x00,0xE2,0x30,0xA4,0x03,0xDC,0x00,0x00]);
const rom=C.loadRom(d,'synthetic.sfc');
const st={emulation:false,m8:true,x8:true,carry:null};
const consumed=C.calleeConsumesReturnAddress(rom,0x008100,st);
assert(consumed&&consumed.kind==='inline-pointer-table-call','ExecutePtr reconhecido');assert.strictEqual(consumed.width,2);
const tbl=C.parseInlinePointerTable(rom,0x008004,consumed);
assert(tbl&&tbl.entries===2&&tbl.targets.includes(0x008008)&&tbl.targets.includes(0x008009),'tabela inline lida');
// rotina comum (RTS) nao e tratada como consumidora de retorno
put(0x8200,[0xA9,0x01,0x60]);assert.strictEqual(C.calleeConsumesReturnAddress(C.loadRom(d,'s2.sfc'),0x008200,st),null);
console.log('REV202_STATUS_INLINE_TABLE_PASS');
