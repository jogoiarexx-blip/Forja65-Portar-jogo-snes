#!/usr/bin/env node
'use strict';
/*
 * Forja65 SNES Hardware Audit v1.2.0. Independent, read-only, bounded static ROM
 * reconnaissance. No emulator code or third-party code has been copied.
 * It produces hypotheses for the existing RIE, never executable equivalence.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

// 65C816 opcode *instruction byte lengths* indexed in CPU opcode order.
// M = depends on accumulator width, X = depends on index width.
// Includes all 256 opcodes, including BRK/COP signatures and WDM.
const LENGTH_ROWS = [
 '222222221M113334', '2222222213113334',
 '324222221M113334', '2222222213113334',
 '122232221M113334', '2222322213114334',
 '123222221M113334', '2222222213113334',
 '223222221M113334', '2222222213113334',
 'X2X222221M113334', '2222222213113334',
 'X22222221M113334', '2222222213113334',
 'X22222221M113334', '2222322213113334'
];
// Validate table at module load to avoid silent decoding mistakes.
if (LENGTH_ROWS.length !== 16 || LENGTH_ROWS.some(row => row.length !== 16 || /[^1234MX]/.test(row))) {
 throw Error('Internal 65C816 opcode table is malformed');
}
const LENGTH = LENGTH_ROWS.join('');
const BRANCH8 = new Set([0x10,0x30,0x50,0x70,0x90,0xb0,0xd0,0xf0]);
const BRA = 0x80, BRL = 0x82;
const STOP = new Set([0x00,0x02,0x40,0x60,0x6b,0xcb,0xdb]); // BRK, COP, RTI, RTS, RTL, WAI, STP
const CONTROL = new Map([[0x20,'JSR'],[0x22,'JSL'],[0x4c,'JMP'],[0x5c,'JML'],[0x6c,'JMP (abs)'],[0x7c,'JMP (abs,X)'],[0xdc,'JML [abs]'],[0xfc,'JSR (abs,X)']]);
const KNOWN_ABSOLUTE_RW = new Map([
 [0x0c,'write'],[0x0d,'read'],[0x0e,'read/write'],[0x1c,'write'],[0x2c,'read'],[0x2d,'read'],[0x2e,'read/write'],
 [0x4d,'read'],[0x4e,'read/write'],[0x6d,'read'],[0x6e,'read/write'],[0x8c,'write'],[0x8d,'write'],[0x8e,'write'],
 [0x9c,'write'],[0xac,'read'],[0xad,'read'],[0xae,'read'],[0xcc,'read'],[0xcd,'read'],[0xce,'read/write'],
 [0xec,'read'],[0xed,'read'],[0xee,'read/write']
]);
const KNOWN_LONG_RW = new Map([[0x0f,'read'],[0x2f,'read'],[0x4f,'read'],[0x6f,'read'],[0x8f,'write'],[0xaf,'read'],[0xcf,'read'],[0xef,'read']]);
// SNES $21xx/$42xx register names. Names describe address decoding only;
// a static reference is NOT evidence that a transfer happened in a game.
const REGS = new Map([
 [0x2100,'INIDISP'],[0x2101,'OBSEL'],[0x2102,'OAMADDL'],[0x2103,'OAMADDH'],[0x2104,'OAMDATA'],
 [0x2105,'BGMODE'],[0x2106,'MOSAIC'],[0x2107,'BG1SC'],[0x2108,'BG2SC'],[0x2109,'BG3SC'],[0x210a,'BG4SC'],
 [0x210b,'BG12NBA'],[0x210c,'BG34NBA'],[0x210d,'BG1HOFS'],[0x210e,'BG1VOFS'],[0x210f,'BG2HOFS'],
 [0x2110,'BG2VOFS'],[0x2111,'BG3HOFS'],[0x2112,'BG3VOFS'],[0x2113,'BG4HOFS'],[0x2114,'BG4VOFS'],
 [0x2115,'VMAIN'],[0x2116,'VMADDL'],[0x2117,'VMADDH'],[0x2118,'VMDATAL'],[0x2119,'VMDATAH'],
 [0x211a,'M7SEL'],[0x211b,'M7A'],[0x211c,'M7B'],[0x211d,'M7C'],[0x211e,'M7D'],[0x211f,'M7X'],[0x2120,'M7Y'],
 [0x2121,'CGADD'],[0x2122,'CGDATA'],[0x2123,'W12SEL'],[0x2124,'W34SEL'],[0x2125,'WOBJSEL'],
 [0x2126,'WH0'],[0x2127,'WH1'],[0x2128,'WH2'],[0x2129,'WH3'],[0x212a,'WBGLOG'],[0x212b,'WOBJLOG'],
 [0x212c,'TM'],[0x212d,'TS'],[0x212e,'TMW'],[0x212f,'TSW'],[0x2130,'CGWSEL'],[0x2131,'CGADSUB'],
 [0x2132,'COLDATA'],[0x2133,'SETINI'],[0x2134,'MPYL'],[0x2135,'MPYM'],[0x2136,'MPYH'],
 [0x2137,'SLHV'],[0x2138,'RDOAM'],[0x2139,'RDVRAML'],[0x213a,'RDVRAMH'],[0x213b,'RDCGRAM'],
 [0x213c,'OPHCT'],[0x213d,'OPVCT'],[0x213e,'STAT77'],[0x213f,'STAT78'],
 [0x2140,'APUIO0'],[0x2141,'APUIO1'],[0x2142,'APUIO2'],[0x2143,'APUIO3'],
 [0x2180,'WMDATA'],[0x2181,'WMADDL'],[0x2182,'WMADDM'],[0x2183,'WMADDH'],
 [0x4016,'JOYSER0'],[0x4017,'JOYSER1'],
 [0x4200,'NMITIMEN'],[0x4201,'WRIO'],[0x4202,'WRMPYA'],[0x4203,'WRMPYB'],
 [0x4204,'WRDIVL'],[0x4205,'WRDIVH'],[0x4206,'WRDIVB'],[0x4207,'HTIMEL'],[0x4208,'HTIMEH'],
 [0x4209,'VTIMEL'],[0x420a,'VTIMEH'],[0x420b,'MDMAEN'],[0x420c,'HDMAEN'],[0x420d,'MEMSEL'],
 [0x4210,'RDNMI'],[0x4211,'TIMEUP'],[0x4212,'HVBJOY'],[0x4213,'RDIO'],
 [0x4214,'RDDIVL'],[0x4215,'RDDIVH'],[0x4216,'RDMPYL'],[0x4217,'RDMPYH'],
 [0x4218,'JOY1L'],[0x4219,'JOY1H'],[0x421a,'JOY2L'],[0x421b,'JOY2H'],
 [0x421c,'JOY3L'],[0x421d,'JOY3H'],[0x421e,'JOY4L'],[0x421f,'JOY4H']
]);
const DMA_REGS=['DMAP','BBAD','A1TL','A1TH','A1B','DASL','DASH','DASB','A2AL','A2AH','NTRL'];

function hex(n, width=6) { return n.toString(16).toUpperCase().padStart(width,'0'); }
function u16(b,o) { return b[o] | (b[o+1]<<8); }
function trimTitle(b) { return Buffer.from(b).toString('ascii').replace(/[\x00-\x1f\x7f-\xff]+/g,' ').trim(); }
function isSafeRom(a, mapper) {
 if (!Number.isInteger(a) || a < 0 || a > 0xffffff) return false;
 // REV196: mapa do nucleo (--core-mapper): todas as placas conferidas com o bsnes (REV194/REV195).
 if (mapper && typeof mapper === 'object') return mapper.map(a) !== null;
 const bank = a >>> 16, low = a & 65535;
 if (bank === 0x7e || bank === 0x7f) return false;
 if (mapper === 'lorom') {
  if (low < 0x8000 && ((bank < 0x40) || (bank >= 0x80 && bank < 0xc0) || (bank >= 0x70 && bank < 0x80) || bank >= 0xf0)) return false;
  return true;
 }
 if (mapper === 'hirom') return low >= 0x8000 || ((bank >= 0x40 && bank <= 0x7d) || bank >= 0xc0);
 return false;
}
function romOffset(a, mapper, size) {
 if (mapper && typeof mapper === 'object') { if (!Number.isInteger(a) || a < 0 || a > 0xffffff) return null; const o = mapper.map(a); return o === null || o >= size ? null : o; }
 if (!isSafeRom(a,mapper)) return null;
 const bank = a >>> 16, low = a & 65535;
 const off = mapper === 'lorom' ? ((bank & 0x7f) << 15) | (low & 0x7fff) : ((bank & 0x3f) << 16) | low;
 return off < size ? off : null; // Never invent mirroring of arbitrary ROM sizes.
}
function parseHeader(rom,kind,off) {
 if (off < 0 || off + 0x40 > rom.length) return null;
 const p=rom.subarray(off,off+0x40), mapperValue=p[0x15], reset=u16(p,0x3c),
  checksum=u16(p,0x1e), complement=u16(p,0x1c);
 const expected = kind==='lorom'?[0x20,0x30,0x22,0x32]:kind==='hirom'?[0x21,0x31,0x23,0x33]:[0x25,0x35];
 const title=trimTitle(p.subarray(0,21));
 let score=0;
 const mapMatches=expected.includes(mapperValue);
 if (mapMatches) score+=5;
 if (checksum!==0 && complement!==0 && (checksum^complement)===65535) score+=3;
 if (reset>=0x8000 && reset!==0xffff) score+=2;
 if (title.length>=4 && /^[\x20-\x7e]+$/.test(title)) score+=1;
 if (p[0x17]>=7 && p[0x17]<=0x0f) score+=1;
 if (kind!=='exhirom' && reset>=0x8000) {
  const f=romOffset(reset,kind,rom.length);
  if (f!==null && ![0x00,0xff].includes(rom[f])) score+=2;
 }
 return {mapper:kind,offset:hex(off,6),score,headerMapMode:hex(mapperValue,2),mapModeMatches:mapMatches,
  title,cartridgeType:hex(p[0x16],2),romSizeExponent:p[0x17],sramSizeExponent:p[0x18],regionCode:hex(p[0x19],2),
  fastRomAdvertised:!!(mapperValue & 0x10),checksumPairValid:(checksum^complement)===65535 && checksum!==0,
  resetVector:hex(reset,4)};
}
function detectRom(raw) {
 const copierHeader=raw.length % 0x8000===512 ? 512 : 0;
 const rom=raw.subarray(copierHeader);
 const choices=[['lorom',0x7fc0],['hirom',0xffc0],['exhirom',0x40ffc0]];
 const candidates=choices.map(([kind,off])=>parseHeader(rom,kind,off)).filter(Boolean).sort((a,b)=>b.score-a.score);
 if (!candidates.length || candidates[0].score < 7 || !candidates[0].mapModeMatches || candidates[0].resetVector === 'FFFF' || candidates[0].resetVector < '8000') throw Error('Unable to identify a plausible SNES ROM header; mapper must not be guessed');
 return {rom,copierHeader,selected:candidates[0],candidates,warning:candidates.length>1 && candidates[1].score===candidates[0].score?'Ambiguous mapper candidates: review before trusting static ROM ownership':null};
}
function readCpu(rom,mapper,address) {
 const off=romOffset(address,mapper,rom.length);
 return off===null?null:rom[off];
}
function fetchCpu(rom,mapper,address,length) {
 const output=[];
 for(let n=0;n<length;n++){
  const a=(address&0xff0000)|((address+n)&0xffff);
  const value=readCpu(rom,mapper,a);
  if(value===null)return null;
  output.push(value);
 }
 return output;
}
function registerInfo(address) {
 const b=address>>>16, v=address&0xffff;
 if(!((b<=0x3f)||(b>=0x80&&b<=0xbf)))return null;
 let category;
 if(v>=0x2100 && v<=0x213f) category='PPU';
 else if(v>=0x2140&&v<=0x2143)category='APU/SPC700';
 else if(v>=0x2180&&v<=0x2183)category='WRAM port';
 else if(v===0x4016||v===0x4017)category='controller';
 else if(v>=0x4200&&v<=0x421f)category='S-CPU I/O';
 else if(v>=0x4300&&v<=0x437f)category='DMA/HDMA';
 else return null;
 let name=REGS.get(v);
 if(v>=0x4300&&v<=0x437f){
  const channel=(v-0x4300)>>4,offset=v&0x0f;
  name=DMA_REGS[offset]?`DMA${channel}_${DMA_REGS[offset]}`:`DMA${channel}_UNUSED_${hex(offset,1)}`;
  if(!DMA_REGS[offset])category='DMA/HDMA reserved address';
 }
 return {category,name:name||'register '+hex(v,4),register:hex(v,4)};
}
function vectors(rom,mapper) {
 const entries=[['native_COP',0xffe4],['native_BRK',0xffe6],['native_ABORT',0xffe8],['native_NMI',0xffea],['native_IRQ',0xffee],
  ['emulation_COP',0xfff4],['emulation_ABORT',0xfff8],['emulation_NMI',0xfffa],['emulation_RESET',0xfffc],['emulation_IRQ_BRK',0xfffe]];
 return entries.map(([name,offset])=>{
  const buf=fetchCpu(rom,mapper,offset,2); const target=buf?(buf[0]|buf[1]<<8):null;
  return {name,vector:hex(offset,4),target:target===null?null:hex(target,4),mapped:target!==null && romOffset(target,mapper,rom.length)!==null};
 });
}
function nextPc(pc,n){return (pc&0xff0000)|((pc+n)&65535);}
// JMP (absolute) and JML [absolute] load their pointer from bank $00,
// NOT from the current program bank or the data bank register. Reading a
// literal pointer is safe only when ALL bytes live in mapped, immutable ROM.
// This does not apply to indexed-indirect jumps, whose index is unknown here.
function romLiteralIndirect(rom,mapper,pc,opcode,pointer) {
 if(opcode!==0x6c && opcode!==0xdc)return null;
 const length=opcode===0xdc?3:2;
 const bytes=fetchCpu(rom,mapper,pointer,length); // pointer in bank 00
 if(!bytes)return null;
 const target=(opcode===0xdc?bytes[2]<<16:pc&0xff0000)|(bytes[0]|(bytes[1]<<8));
 // Never certify a target that starts in WRAM, SRAM or unmapped space.
 if(romOffset(target,mapper,rom.length)===null)return null;
 return {target,pointer,bytes};
}
function clone(s,mods={}) {return {...s,...mods};}
// Instructions that overwrite carry. Keeping a stale C here could make XCE
// falsely classify emulation/native mode, changing every width-sensitive parse.
const CARRY_MODIFY = new Set([
  // ADC / SBC / CMP addressing variants, including stack-relative and indirect.
  ...[0x61,0x63,0x65,0x67,0x69,0x6d,0x6f,0x71,0x72,0x73,0x75,0x77,0x79,0x7d,0x7f],
  ...[0xe1,0xe3,0xe5,0xe7,0xe9,0xed,0xef,0xf1,0xf2,0xf3,0xf5,0xf7,0xf9,0xfd,0xff],
  ...[0xc1,0xc3,0xc5,0xc7,0xc9,0xcd,0xcf,0xd1,0xd2,0xd3,0xd5,0xd7,0xd9,0xdd,0xdf],
  0xc0,0xc4,0xcc,0xe0,0xe4,0xec,
  // ASL, LSR, ROL, ROR (accumulator and memory forms).
  0x06,0x0a,0x0e,0x16,0x1e,0x46,0x4a,0x4e,0x56,0x5e,
  0x26,0x2a,0x2e,0x36,0x3e,0x66,0x6a,0x6e,0x76,0x7e
]);
function afterTransfer(s,op,bytes) {
 if(op===0x18)return [clone(s,{c:0})]; // CLC
 if(op===0x38)return [clone(s,{c:1})]; // SEC
 if(op===0xfb){ // XCE: swap E and C, including unknown carry.
  return (s.c===null?[0,1]:[s.c]).map(c=>clone(s,{e:c,m:c?1:s.m,x:c?1:s.x,c:s.e}));
 }
 if(op===0xc2||op===0xe2){
  const bits=bytes[1], set=op===0xe2;
  return [clone(s,{m:s.e?1:(bits&0x20?Number(set):s.m),x:s.e?1:(bits&0x10?Number(set):s.x),c:bits&1?Number(set):s.c})];
 }
 if(op===0x28){return [clone(s,{m:s.e?1:null,x:s.e?1:null,c:null})];} // PLP
 if(op===0xab||op===0x54||op===0x44)return [clone(s,{dbr:null})]; // PLB / MVN / MVP
 if(CARRY_MODIFY.has(op))return [clone(s,{c:null})];
 return [s];
}
// A Forja CFG entry is a *candidate analysis seed*, NOT proof of execution.
// Native entry states cannot inherit reset-time DBR=00: the caller may have
// changed DBR. Preserve the CFG's E/M/X state, but never fabricate DBR.
function normalizeSeeds(roots,rom,mapper) {
 if(roots===undefined||roots===null)return [];
 if(!Array.isArray(roots))throw Error('hardware seeds must be an array');
 if(roots.length>4096)throw Error('hardware seeds must contain at most 4096 entries');
 const unique=new Map();
 for(const entry of roots){
  if(!entry||typeof entry!=='object')throw Error('hardware seed must be an object');
  const pc=entry.pc;
  if(!Number.isSafeInteger(pc)||pc<0||pc>0xffffff)throw Error('hardware seed pc must be a 24-bit integer');
  const e=entry.e,m=entry.m,x=entry.x;
  if((e!==0&&e!==1)||(m!==0&&m!==1&&m!==null)||(x!==0&&x!==1&&x!==null))throw Error('hardware seed E/M/X must be 0, 1, or unknown M/X');
  // E=1 forces 8-bit M/X on a real 65C816, regardless of stale caller metadata.
  if(e===1&&(m===0||x===0))throw Error('hardware seed has invalid emulation-width state');
  if(entry.c!==undefined&&entry.c!==null&&entry.c!==0&&entry.c!==1)throw Error('invalid hardware seed carry');
  if(romOffset(pc,mapper,rom.length)===null)continue;
  const seed={pc,e,m:e===1?1:m,x:e===1?1:x,c:entry.c??null,dbr:null};
  unique.set([seed.pc,seed.e,seed.m,seed.x,seed.c].join(':'),seed);
 }
 return [...unique.values()].sort((a,b)=>a.pc-b.pc||a.e-b.e||String(a.m).localeCompare(String(b.m))||String(a.x).localeCompare(String(b.x))||String(a.c).localeCompare(String(b.c)));
}
function scanCode(rom,mapper,roots,limit) {
 const toState=root=>({pc:typeof root==='number'?root:root.pc,e:typeof root==='number'?1:root.e,m:typeof root==='number'?1:(root.m===undefined?(root.e?1:null):root.m),x:typeof root==='number'?1:(root.x===undefined?(root.e?1:null):root.x),c:typeof root==='number'?null:(root.c??null),dbr:typeof root==='number'?0:(root.dbr??null)});
 // Complete the legacy vector-root closure FIRST, then add CFG seeds one by
 // one. A huge imported frontier must not steal the RESET scan's budget.
 const todo=roots.filter(r=>r.origin!=='forja_cfg_candidate').map(toState);
 const deferred=roots.filter(r=>r.origin==='forja_cfg_candidate');
 let deferredNext=0;
 let i=0,decoded=0,ambiguous=0,unmapped=0,unresolved=0, capped=false;
 const seen=new Set(), codeSites=new Set(), opcounts={}, regs=new Map(), controls=[], interesting=[], resolvedPointers=[];
 let indirectResolved=0;
 while(i<todo.length||deferredNext<deferred.length){
  if(decoded>=limit){capped=true;break;}
  if(i===todo.length){todo.push(toState(deferred[deferredNext++]));continue;}
  const state=todo[i++];
  const sig=[state.pc,state.e,state.m,state.x,state.c,state.dbr].join(':');
  if(seen.has(sig))continue;
  seen.add(sig);
  const op=readCpu(rom,mapper,state.pc);
  if(op===null){unmapped++;continue;}
  const marker=LENGTH[op];
  const sizes=marker==='M'?(state.m===null?[2,3]:[state.m?2:3]):marker==='X'?(state.x===null?[2,3]:[state.x?2:3]):[Number(marker)];
  if(sizes.length>1)ambiguous++;
  for(const size of sizes){
   if(decoded>=limit){capped=true;break;}
   const bytes=fetchCpu(rom,mapper,state.pc,size);
   if(bytes===null){unmapped++;continue;}
   decoded++;codeSites.add(state.pc);
   opcounts[hex(op,2)]=(opcounts[hex(op,2)]||0)+1;
   const continuation=nextPc(state.pc,size), word=bytes.length>=3?bytes[1]|(bytes[2]<<8):null;
   const control=CONTROL.get(op);
   if(control&&controls.length<256)controls.push({pc:hex(state.pc),type:control});
   // Direct absolute + absolute long only, no indirection or unknown DBR: avoid false ownership of MMIO.
   let ref=null;
   if(KNOWN_ABSOLUTE_RW.has(op) && state.dbr!==null)ref={address:(state.dbr<<16)|word,access:KNOWN_ABSOLUTE_RW.get(op)};
   else if(KNOWN_LONG_RW.has(op))ref={address:bytes[1]|bytes[2]<<8|bytes[3]<<16,access:KNOWN_LONG_RW.get(op)};
   if(ref){
    const reg=registerInfo(ref.address);
    if(reg){
     const key=reg.register+':'+ref.access;
     if(!regs.has(key))regs.set(key,{...reg,access:ref.access,sites:[],occurrences:0,confidence:'static_possible'});
     const item=regs.get(key);item.occurrences++;
     if(item.sites.length<16)item.sites.push(hex(state.pc));
    }
   }
   if(op===0x20||op===0x22){
    const target=op===0x20?(state.pc&0xff0000)|word:(bytes[1]|bytes[2]<<8|bytes[3]<<16);
    todo.push(clone(state,{pc:target}));
    // Return-state is not proven: unknown M/X/C/DBR conservatively after subroutine.
    todo.push(clone(state,{pc:continuation,m:state.e?1:null,x:state.e?1:null,c:null,dbr:null}));
    continue;
   }
   if(op===0x4c||op===0x5c){
    const target=op===0x4c?(state.pc&0xff0000)|word:(bytes[1]|bytes[2]<<8|bytes[3]<<16);
    todo.push(clone(state,{pc:target}));continue;
   }
   if(op===0x6c||op===0x7c||op===0xdc||op===0xfc){
    const literal=romLiteralIndirect(rom,mapper,state.pc,op,word);
    if(literal){
     indirectResolved++;
     if(resolvedPointers.length<128)resolvedPointers.push({
      pc:hex(state.pc),opcode:hex(op,2),pointer:hex(literal.pointer),
      target:hex(literal.target),pointerBytes:literal.bytes.map(b=>hex(b,2)),
      confidence:'static_rom_literal_not_executed'
     });
     todo.push(clone(state,{pc:literal.target}));
    }else{
     unresolved++;
     if(interesting.length<128)interesting.push({pc:hex(state.pc),opcode:hex(op,2),pointer:word===null?null:hex(word,4),
      reason:op===0x7c||op===0xfc?'indexed pointer depends on X/register state':
       'pointer or destination is not provably immutable mapped ROM; needs runtime evidence'});
    }
    if(op===0xfc)todo.push(clone(state,{pc:continuation,m:state.e?1:null,x:state.e?1:null,c:null,dbr:null}));
    continue;
   }
   if(BRANCH8.has(op)||op===BRA){
    const displacement=bytes[1]<128?bytes[1]:bytes[1]-256;
    todo.push(clone(state,{pc:nextPc(continuation,displacement)}));
    if(op!==BRA)todo.push(clone(state,{pc:continuation}));
    continue;
   }
   if(op===BRL){
    const displacement=word<32768?word:word-65536;
    todo.push(clone(state,{pc:nextPc(continuation,displacement)}));continue;
   }
   if(STOP.has(op))continue;
   for(const after of afterTransfer(state,op,bytes))todo.push(clone(after,{pc:continuation}));
  }
 }
 const sortedRegisters=[...regs.values()].sort((a,b)=>a.register.localeCompare(b.register)||a.access.localeCompare(b.access));
 const groups={};for(const r of sortedRegisters){
  if(!groups[r.category])groups[r.category]={registerAccessPairs:0,potentialInstructionSites:0};
  groups[r.category].registerAccessPairs++;
  groups[r.category].potentialInstructionSites+=r.occurrences;
 }
 return {hardwareSummary:groups,scope:'bounded potential static reachability from interrupt vectors and optional Forja CFG candidates; no observed execution',decodedStates:decoded,uniqueInstructionAddresses:codeSites.size,uniqueStates:seen.size,queueStates:todo.length,
  limit,limitReached:capped,ambiguousImmediateSites:ambiguous,unmappedCodeStates:unmapped,
  resolvedRomLiteralIndirectTransfers:indirectResolved,unresolvedIndirectControlTransfers:unresolved,
  opcodeCounts:opcounts,hardwareReferences:sortedRegisters,romLiteralIndirectExamples:resolvedPointers,
  indirectControlExamples:interesting,controlExamples:controls};
}
function audit(raw, opts={}) {
 if(!Buffer.isBuffer(raw))raw=Buffer.from(raw);
 let det;
 try{det=detectRom(raw);}catch(error){
  if(!opts.coreMapper)throw error;
  // Cabecalho que a heuristica propria recusa (ExLoROM, SPC7110...): o nucleo decide; o relatorio registra isso.
  const copierHeader=raw.length % 0x8000===512 ? 512 : 0, rom=raw.subarray(copierHeader);
  const F=require(path.join(__dirname,'..','forja65-core.js')),h=F.loadRom(new Uint8Array(raw),'audit.sfc').header;
  const sel=parseHeader(rom,h.headerOffset%0x10000===0x7FC0?'lorom':'hirom',h.headerOffset);
  det={rom,copierHeader,selected:sel,candidates:[sel],warning:'Header chosen by the Forja65 core (bsnes heuristic); the audit\'s own strict header check rejected it.'};
 }
 const {rom,copierHeader,selected,candidates,warning}=det;
 let mapper=selected.mapper,coreMapping=null;
 if(opts.coreMapper){
  // O nucleo escolhe o cabecalho pela heuristica do bsnes e conhece ExHiROM/ExLoROM/SA-1/S-DD1/GSU/SPC7110/OBC1/...
  const F=require(path.join(__dirname,'..','forja65-core.js'));
  const core=F.loadRom(new Uint8Array(raw),'audit.sfc');
  coreMapping={mapping:core.header.mapping,board:core.header.board||null,headerOffset:hex(core.header.headerOffset,6)};
  mapper={kind:'core',map:a=>F.snesToRom(core,a)};
 }
 const supported=coreMapping?true:mapper!=='exhirom';
 const vectorData=supported?vectors(rom,mapper):[];
 const roots=[];
 if(supported){
  for(const v of vectorData){
   if((v.name==='emulation_RESET'||opts.allVectors) && v.mapped && v.target!=='FFFF' && v.target!=='0000')roots.push({pc:Number.parseInt(v.target,16),e:v.name.startsWith('native_')?0:1,name:v.name});
  }
 }
 const vectorRoots=roots.map(r=>({...r,m:r.e?1:null,x:r.e?1:null,c:null,dbr:r.e?0:null,origin:'interrupt_vector'}));
 const seedRoots=supported?normalizeSeeds(opts.seeds,rom,mapper):[];
 // Distinct roots do not imply distinct decoded instruction sites. A CFG seed
 // from an old port must never be promoted to a verified native dispatcher.
 roots.splice(0,roots.length,...vectorRoots,...seedRoots.map(r=>({...r,origin:'forja_cfg_candidate'})));
 const limit=Math.max(1,Math.min(2000000,Number(opts.max)||32768));
 const analysis=roots.length ? scanCode(rom,mapper,roots,limit):null;
 const caveats=[
  'Only potential static execution paths; no emulator run or native port fidelity is established.',
  'Branches are explored both ways; indirect jumps, computed addresses, dynamic DBR/DP and self-modifying code need runtime evidence.',
  'Absolute MMIO references are reported only with a known data bank and an unindexed operand.',
  'ROM mirroring of unusual cartridge sizes and enhancement-chip mappings are not inferred.',
  'Forja CFG seed addresses are prior static candidates, not independently verified gameplay or proof of hardware behavior.'
 ];
 if(copierHeader)caveats.push('Detected and skipped a 512-byte copier header in the ROM file.');
 if(warning)caveats.push(warning);
 if(!supported)caveats.push('ExHiROM reported from the header, but static code traversal is intentionally unavailable for this mapper (use --core-mapper).');
 if(coreMapping)caveats.push('ROM ownership follows the Forja65 core mapper ('+coreMapping.mapping+(coreMapping.board?'/'+coreMapping.board:'')+'), validated against bsnes probe ROMs; chip registers are not modelled.');
 if(selected.cartridgeType!=='00'&&selected.cartridgeType!=='01'&&selected.cartridgeType!=='02')caveats.push('Cartridge hardware type may require chip-specific mapping; check against the game hardware.');
 return {schema:'forja65.snes-hardware-audit.v1',version:'1.2.0',romSha256:crypto.createHash('sha256').update(rom).digest('hex'),
  originalFileBytes:raw.length,romBytes:rom.length,copierHeaderBytes:copierHeader,header:selected,...(coreMapping?{coreMapping}:{}),headerCandidates:candidates,vectors:vectorData,
  architecture:{cpu:'Ricoh 5A22 / WDC 65C816 compatible',initialExecutionMode:'6502 emulation mode (E=1)',busAddressBits:24,
   wramBytes:128*1024,ppuRegisters:'2100-213F',spc700Ports:'2140-2143',dmaRegisters:'4300-437F',dmaStart:'420B',hdmaEnable:'420C',fastRomSelect:'420D',
   hardwareClockNote:'CPU bus accesses use 6, 8, or 12 SNES master clocks depending on region and MEMSEL; not a fixed CPU clock'},
  scan:analysis,rootAddresses:roots.map(x=>({...(x.name?{vector:x.name}:{}),origin:x.origin||'interrupt_vector',address:hex(x.pc),e:x.e,m:x.m,x:x.x})),
  cfgSeedInputs:seedRoots.length,caveats};
}
// Optional disk cache for expensive, bounded scans. Entries are keyed by the
// headerless ROM SHA-256 AND every analysis option that can change the result.
// These reports are NOT runtime-proven routes and must never be silently
// imported into a native port's validated dispatcher.
function auditWithCache(raw,options={}) {
 const {max=32768,allVectors=false,cacheDir=null,seeds=[],coreMapper=false}=options;
 if(!cacheDir)return {result:audit(raw,{max,allVectors,seeds,coreMapper}),hit:false,path:null};
 const {rom,copierHeader,selected}=detectRom(raw);
 const normalized=selected.mapper==='exhirom'&&!coreMapper?[]:normalizeSeeds(seeds,rom,selected.mapper==='exhirom'?'hirom':selected.mapper);
 const seedsSha=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0,20);
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 const location=path.join(path.resolve(cacheDir),`${sha}-hardware-1.2.0-copier${copierHeader}-max${max}-${allVectors?'all':'reset'}-seeds${seedsSha}${coreMapper?'-core':''}.json`);
 try{
  const previous=JSON.parse(fs.readFileSync(location,'utf8'));
  if(previous.schema==='forja65.snes-hardware-audit.v1' && previous.version==='1.2.0' && previous.romSha256===sha &&
   Array.isArray(previous.rootAddresses) && (previous.scan===null||(previous.scan && previous.scan.limit===max)) &&
   previous.rootAddresses.every(r=>allVectors||r.origin==='forja_cfg_candidate'||r.vector==='emulation_RESET') &&
   previous.cfgSeedInputs===normalized.length)return {result:previous,hit:true,path:location};
 }catch(error){if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}
 const result=audit(raw,{max,allVectors,seeds:normalized,coreMapper});
 fs.mkdirSync(path.dirname(location),{recursive:true});
 const temp=location+'.tmp-'+process.pid+'-'+crypto.randomBytes(6).toString('hex');
 try{
  fs.writeFileSync(temp,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  fs.renameSync(temp,location);
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return {result,hit:false,path:location};
}
function main(argv=process.argv.slice(2)) {
 let file=null,out=null,allVectors=false,max=32768,cacheDir=null,coreMapper=false;
 for(let i=0;i<argv.length;i++){
  const v=argv[i];
  if(v==='--rom' || v==='--out'||v==='--max'||v==='--cache-dir'){
   if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing value after '+v);
   const value=argv[++i];if(v==='--rom')file=value;else if(v==='--out')out=value;else if(v==='--cache-dir')cacheDir=value;else max=Number(value);
  }else if(v==='--all-vectors')allVectors=true;
  else if(v==='--core-mapper')coreMapper=true;
  else if(v==='--help'||v==='-h'){
   console.log('Usage: node tools/snes-hardware-audit.js --rom game.sfc [--out analysis/snes-hardware-audit.json] [--max 32768] [--all-vectors] [--cache-dir analysis/cache] [--core-mapper]');return;
  }else throw Error('Unknown argument: '+v);
 }
 if(!file)throw Error('Missing required --rom path');
 if(!Number.isInteger(max)||max<1||max>2000000)throw Error('--max must be integer between 1 and 2000000');
 const {result,hit,path:cachePath}=auditWithCache(fs.readFileSync(file),{max,allVectors,cacheDir,coreMapper});
 if(hit)console.error('SNES hardware audit: cache HIT '+cachePath);
 const json=JSON.stringify(result,null,2)+'\n';
 if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,json);}
 else process.stdout.write(json);
 return result;
}
if(require.main===module){try{main();}catch(error){console.error('SNES hardware audit: '+error.message);process.exitCode=2;}}
module.exports={audit,auditWithCache,normalizeSeeds,detectRom,romOffset,isSafeRom,registerInfo,fetchCpu,scanCode,romLiteralIndirect,LENGTH,main};
