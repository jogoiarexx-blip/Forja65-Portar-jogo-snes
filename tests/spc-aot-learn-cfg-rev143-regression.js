'use strict';
// REV143: padroes novos de tabela SPC (AND/ASL/MOV X,A; BCS para saida qualquer; MOV X,#imm), analise
// multi-captura indexada por (PC, opcode) e raizes aprendidas por perfil de misses. Casos negativos incluidos.
const assert=require('node:assert/strict'),F=require('../forja65-core');
const blank=()=>{const d=new Uint8Array(65536);d.fill(0xff);return d;};
const w16=(d,a,v)=>{d[a&65535]=v&255;d[(a+1)&65535]=v>>8;};
function targets(d,table,n,step=2){for(let k=0;k<n;k++){const t=0x500+k*8;w16(d,table+k*step,t);d.set([0xe8,k,0x6f],t);}}
// 1) AND A,#3 / ASL A / MOV X,A / JMP [!$0400+X]: 4 destinos exatos
let d=blank();d.set([0x28,3,0x1c,0x5d,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,4);
let a=F.spcAnalyze({data:d,entry:0x200},256);
for(let k=0;k<4;k++)assert(a.instructions.some(i=>i.pc===0x500+k*8),'AND: destino '+k);
assert(!a.instructions.some(i=>i.pc===0x520),'AND: nao pode enumerar alem da mascara');
assert(a.tables.some(t=>t.proof==='and-asl-movx'&&t.entries===4));
// mascara com buracos: AND #$05 -> indices {0,1,4,5}
d=blank();d.set([0x28,5,0x1c,0x5d,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,6);
a=F.spcAnalyze({data:d,entry:0x200},256);
for(const k of [0,1,4,5])assert(a.instructions.some(i=>i.pc===0x500+k*8),'AND buracos: '+k);
for(const k of [2,3])assert(!a.instructions.some(i=>i.pc===0x500+k*8),'AND buracos: indice impossivel '+k);
// negativo: mascara > 127 (ASL transbordaria)
d=blank();d.set([0x28,0x80,0x1c,0x5d,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,2);
a=F.spcAnalyze({data:d,entry:0x200},256);assert(a.unresolved.some(q=>q.pc===0x204),'AND #$80 nao prova limite');
// 2) CMP #2 / BCS para saida distante / ASL / MOV X,A / JMP
d=blank();d.set([0x68,2,0xb0,0x20,0x1c,0x5d,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,3);d.set([0x6f],0x226);
a=F.spcAnalyze({data:d,entry:0x200},256);
assert(a.instructions.some(i=>i.pc===0x500)&&a.instructions.some(i=>i.pc===0x508)&&!a.instructions.some(i=>i.pc===0x510),'CMP/BCS saida distante');
assert(a.tables.some(t=>t.proof==='cmp-bcs-any-asl-movx'));
// negativo: BCS que cai dentro do proprio padrao
d=blank();d.set([0x68,2,0xb0,0x01,0x1c,0x5d,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,3);
a=F.spcAnalyze({data:d,entry:0x200},256);assert(a.unresolved.some(q=>q.pc===0x206),'BCS para dentro do padrao nao prova');
// 3) MOV X,#4 / JMP [!$0400+X]: destino unico (indice 4 = entrada 2)
d=blank();d.set([0xcd,4,0x1f,0x00,0x04,0x6f],0x200);targets(d,0x400,3);
a=F.spcAnalyze({data:d,entry:0x200},256);
assert(a.instructions.some(i=>i.pc===0x510)&&!a.instructions.some(i=>i.pc===0x500),'MOV X,#imm destino unico');
// 4) multi-captura: mesmo PC com opcodes diferentes em duas capturas -> dois casos guardados
const c1=blank(),c2=blank();c1.set([0xe8,1,0x2f,0xfc],0x300);c2.set([0xbc,0x2f,0xfd],0x300);
const multi=F.spcAnalyzeMulti([{data:c1,entry:0x300,entries:[]},{data:c2,entry:0x300,entries:[]}],{max:64});
assert.equal(multi.multiOpcodePcs,1);assert(multi.instructions.filter(i=>i.pc===0x300).length===2);
const cpp=F.spcCppMulti(multi);
assert(cpp.includes('case 0xE8u: return forja65SpcExecute<0xE8u>(apu);')&&cpp.includes('case 0xBCu: return forja65SpcExecute<0xBCu>(apu);'),'casos por opcode');
assert(cpp.includes('switch(forja65SpcPeek(apu,apu.spc.pc))'),'opcode lido ao vivo');
// 5) perfil de misses: raiz aprendida so quando o opcode confere com a captura
const c3=blank();c3.set([0xe8,7,0x6f],0x800);c3.set([0x6f],0x300);
const prof='pc=0x0800 opcode=0xE8 count=10\npc=0x0900 opcode=0xE8 count=3\n';
const learned=F.spcAnalyzeMulti([{data:c3,entry:0x300,entries:[]}],{max:64,missProfiles:[prof]});
assert(learned.instructions.some(i=>i.pc===0x800),'raiz aprendida');assert(!learned.instructions.some(i=>i.pc===0x900),'opcode divergente nao vira raiz');
assert.equal(learned.learnedRoots,1);assert.equal(learned.unmatchedProfile,1);assert.equal(learned.unmatchedProfileCount,3);
// 6) loadSpcCapture: roots= decimal do instantaneo de aprendizado
const cap=F.loadSpcCapture(c3,'source=forja65-spc-aot-learn\nentry_candidate=0x300\nroots=2048,768');
assert.deepEqual(cap.entries,[2048,768]);
// 7) runtime: o perfil de misses e os instantaneos existem e nao entram no caminho de execucao
const rom=F.loadRom(F.makeSyntheticRom());const rt=F.generateProject(rom,F.analyze(rom,64))['src/runtime.hpp'];
assert(rt.includes('void recordSpcAotMiss();')&&rt.includes('FORJA65_SPC_AOT_LEARN')&&rt.includes('spc-aot-misses.txt'));
console.log('SPC_AOT_LEARN_CFG_REV143_PASS and-mask cmp-any-exit movx-imm multi-capture learned-roots');
