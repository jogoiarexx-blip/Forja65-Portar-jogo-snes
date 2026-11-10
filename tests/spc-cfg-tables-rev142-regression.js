'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
function fixture(base=0x200,table=0x400){
 const data=new Uint8Array(65536);data.fill(0xff);
 data.set([0x68,3,0xb0,5,0x1c,0x5d,0x1f,table&255,table>>8,0x6f],base);
 for(let k=0;k<3;k++){let t=0x500+k*8;data[(table+k*2)&65535]=t&255;data[(table+k*2+1)&65535]=t>>8;data.set([0xe8,k,0x6f],t);}
 return {data,entry:base};
}
let cap=fixture(),a=F.spcAnalyze(cap,128);
for(let k=0;k<3;k++)assert(a.instructions.some(i=>i.pc===0x500+k*8),'bounded indirect table target '+k+' missing');
cap.entries=[0x206];const again=F.spcAnalyze(cap,128);assert(again.instructions.some(i=>i.pc===0x510),'additional root must not remove bounded table coverage');
assert.equal(a.unresolved.length,0);assert(a.tables.some(t=>t.pc===0x206&&t.entries===3));
assert(a.edges.some(e=>e.kind==='indexed-table'&&e.to===0x510));
// No proof, no table enumeration: changing ASL into INC must keep it unresolved.
cap=fixture();cap.data[0x204]=0xbc;a=F.spcAnalyze(cap,128);assert(a.unresolved.some(i=>i.pc===0x206));assert(!a.instructions.some(i=>i.pc===0x500));
// Branch must bypass the JMP, and a 0/overflowing bound is not accepted.
for(const mutate of [d=>d[0x203]=0,d=>d[0x201]=0,d=>d[0x201]=129]){cap=fixture();mutate(cap.data);a=F.spcAnalyze(cap,128);assert(a.unresolved.some(i=>i.pc===0x206));}
// Wrapped pointer table still resolves with 16-bit SPC addressing.
cap=fixture(0x200,0xfffe);a=F.spcAnalyze(cap,128);assert(a.instructions.some(i=>i.pc===0x510));
cap=fixture();cap.data.set([0xe8,9,0x6f],0x700);cap.entries=[0x700,0x200];a=F.spcAnalyze(cap,128);assert(a.instructions.some(i=>i.pc===0x700));
const loaded=F.loadSpcCapture(cap.data,'entry_candidate=512\npc=1792');assert(F.spcAnalyze(loaded,128).instructions.some(i=>i.pc===0x700),'captured live PC must seed standalone analysis');
assert(F.spcCpp(cap,a).includes('forja65SpcPeek'),'mutable SPC code retains opcode guard');
console.log('SPC_CFG_TABLES_REV142_PASS bounded-table negative-cases wrap multi-entry guarded-AOT');
