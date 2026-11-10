'use strict';
// Forja65 REV204: tabelas inline de ponteiros (padrao ExecutePtr do SMW) com
//  (1) ponteiro nulo no meio (estado sem rotina);
//  (2) tamanho impar ate o primeiro destino (a ultima entrada nao pode ler o codigo);
//  (3) "PER *+3; JML destino": a tabela vem depois do salto, sem JSL.
// Antes: (1) e (2) derrubavam a tabela inteira e (3) nem era procurado; os destinos caiam no interpretador.
const assert=require('assert');
const C=require('../forja65-core.js');
const d=C.makeSyntheticRom();
const put=(a,bytes)=>bytes.forEach((b,i)=>d[(a&0x7FFF)+i]=b);
// ExecutePtr em $008100 (igual ao SMW $0086DF)
put(0x8100,[0x84,0x03,0x7A,0x84,0x00,0xC2,0x30,0x29,0xFF,0x00,0x0A,0xA8,0x68,0x85,0x01,0xC8,0xB7,0x00,0x85,0x00,0xE2,0x30,0xA4,0x03,0xDC,0x00,0x00]);
// (1)+(2): $008000 CLC; XCE; JSL $008100; dw $800F,$0000,$8012 ; bytes soltos em $800C..$800E ; $800F NOP;RTS ; $8012 JMP $8200
put(0x8000,[0x18,0xFB,0x22,0x00,0x81,0x00, 0x0F,0x80, 0x00,0x00, 0x12,0x80, 0x00,0x00,0x00]);
put(0x800F,[0xEA,0x60,0x60,0x4C,0x00,0x82]);
// (3): $008200 PHK; PER $0003; JML $008100; dw $8210,$8212 ; $8210 RTS ; $8212 RTS
put(0x8200,[0x4B,0x62,0x03,0x00,0x5C,0x00,0x81,0x00, 0x10,0x82, 0x12,0x82]);
put(0x8210,[0x60,0x00,0x60]);
const rom=C.loadRom(d,'rev204-inline.sfc');
const st={emulation:false,m8:true,x8:true,carry:null};
const consumed=C.calleeConsumesReturnAddress(rom,0x008100,st);
assert(consumed&&consumed.width===2,'ExecutePtr reconhecido');
const t1=C.parseInlinePointerTable(rom,0x008006,consumed);
assert(t1,'tabela com ponteiro nulo e aceita');
assert.deepStrictEqual(t1.targets.sort(),[0x00800F,0x008012].sort());
assert.strictEqual(t1.holes,2); // $0000 no meio e o par de zeros antes do codigo
// (3) PER + JML
const j=C.decodeOne(rom,0x008204,{...st});j.flowTarget=j.operand;
assert.strictEqual(j.mnemonic,'JML');
const t3=C.perJumpInlineTable(rom,j,st);
assert(t3&&t3.targets.includes(0x008210)&&t3.targets.includes(0x008212),'tabela depois de PER+JML');
// o CFG semeia os destinos de cada JSL com a propria tabela (o objeto do cache nao e compartilhado)
const a=C.analyze(rom,4096);
const fns=new Set(a.functions.map(f=>f.start));
for(const t of [0x00800F,0x008012,0x008210,0x008212])assert(fns.has(t),'destino compilado: $'+t.toString(16));
// sem o PER certo, nada e semeado
put(0x8201,[0x62,0x05,0x00]);
const rom2=C.loadRom(d,'rev204-inline-b.sfc');const j2=C.decodeOne(rom2,0x008204,{...st});j2.flowTarget=j2.operand;
assert.strictEqual(C.perJumpInlineTable(rom2,j2,st),null,'PER que nao aponta para o fim do salto e ignorado');
console.log('REV204_CFG_INLINE_TABLES_PASS');
