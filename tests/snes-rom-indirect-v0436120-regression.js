'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const hw=require('../tools/snes-hardware-audit');
function rom(mapper='lorom'){
 const r=Buffer.alloc(0x20000,0xff),h=mapper==='lorom'?0x7fc0:0xffc0;
 r.write('FORJA INDIRECT REGRESSION',h,'ascii');r[h+0x15]=mapper==='lorom'?0x20:0x21;
 r[h+0x17]=9;r.writeUInt16LE(0x1234,h+0x1c);r.writeUInt16LE(0xedcb,h+0x1e);
 r.writeUInt16LE(0x8000,h+0x3c);
 const start=mapper==='lorom'?0:0x8000;
 r[start]=0xdb;
 return r;
}
let passed=0;
function test(name,fn){fn();console.log('PASS',name);passed++;}
test('JMP (abs) loads ROM pointer from bank 00 and follows candidate',()=>{
 const r=rom();r.set([0x6c,0x00,0x90],0);r.set([0x90,0x80],0x1000);
 r.set([0x8d,0x05,0x21,0xdb],0x90);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.resolvedRomLiteralIndirectTransfers,1);
 assert.equal(a.scan.unresolvedIndirectControlTransfers,0);
 assert.equal(a.scan.romLiteralIndirectExamples[0].target,'008090');
 assert.equal(a.scan.romLiteralIndirectExamples[0].confidence,'static_rom_literal_not_executed');
 assert(a.scan.hardwareReferences.some(x=>x.register==='2105'));
});
test('JMP (abs) preserves PBR after previous JML and pointer is still bank 00',()=>{
 const r=rom();r.set([0x5c,0x00,0x80,0x81],0);r.set([0x6c,0x00,0x90],0x8000);
 r.set([0x88,0x80],0x1000);r.set([0x8d,0x0c,0x42,0xdb],0x8088);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.romLiteralIndirectExamples[0].target,'818088');
 assert(a.scan.hardwareReferences.some(x=>x.register==='420C'));
});
test('JML [abs] reads three literal pointer bytes including bank',()=>{
 const r=rom();r.set([0xdc,0x20,0x90],0);r.set([0x77,0x80,0x82],0x1020);
 r.set([0x8d,0x0b,0x42,0xdb],0x10077);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.romLiteralIndirectExamples[0].target,'828077');
 assert(a.scan.hardwareReferences.some(x=>x.register==='420B'));
});
test('JMP pointer in WRAM cannot be certified as immutable ROM',()=>{
 const r=rom();r.set([0x6c,0x00,0x1f],0);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.resolvedRomLiteralIndirectTransfers,0);
 assert.equal(a.scan.unresolvedIndirectControlTransfers,1);
});
test('JMP pointer spanning bank boundary into WRAM remains unresolved',()=>{
 const r=rom();r.set([0x6c,0xff,0xff],0);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.resolvedRomLiteralIndirectTransfers,0);
 assert.equal(a.scan.unresolvedIndirectControlTransfers,1);
});
test('JMP pointer to unmapped WRAM target remains unresolved',()=>{
 const r=rom();r.set([0x6c,0x00,0x90],0);r.set([0x00,0x10],0x1000);
 const a=hw.audit(r,{max:50});
 assert.equal(a.scan.resolvedRomLiteralIndirectTransfers,0);
 assert.equal(a.scan.unresolvedIndirectControlTransfers,1);
});
test('Indexed JMP and JSR do not invent an unknown X/indexed pointer',()=>{
 for(const opcode of [0x7c,0xfc]){
  const r=rom();r.set([opcode,0x00,0x90],0);r.set([0x80,0x80],0x1000);
  const a=hw.audit(r,{max:20});
  assert.equal(a.scan.resolvedRomLiteralIndirectTransfers,0);
  assert(a.scan.unresolvedIndirectControlTransfers>=1);
 }
});
test('HiROM static pointer is read from bank 00 not the source PBR',()=>{
 const r=rom('hirom');r.set([0x5c,0x00,0x81,0xc0],0x8000);
 r.set([0x6c,0x10,0x90],0x8100); // the program bank differs from the pointer bank
 r.set([0x90,0x80],0x9010);
 r.set([0x8d,0x00,0x21,0xdb],0x8090);
 const a=hw.audit(r,{max:50});
 assert(a.scan.romLiteralIndirectExamples.some(x=>x.target==='C08090'));
 assert(a.scan.hardwareReferences.some(x=>x.register==='2100'));
});
test('Persistent SHA cache separates options and copier headers, survives reload',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-cache-'));
 try{
  const raw=rom();
  const first=hw.auditWithCache(raw,{cacheDir:dir,max:20});
  assert.equal(first.hit,false);assert(fs.existsSync(first.path));
  const again=hw.auditWithCache(raw,{cacheDir:dir,max:20});
  assert.equal(again.hit,true);assert.deepEqual(first.result,again.result);
  assert.equal(hw.auditWithCache(raw,{cacheDir:dir,max:30}).hit,false);
  assert.equal(hw.auditWithCache(raw,{cacheDir:dir,max:20,allVectors:true}).hit,false);
  const header=Buffer.concat([Buffer.alloc(512),raw]);
  const withHeader=hw.auditWithCache(header,{cacheDir:dir,max:20});
  assert.equal(withHeader.hit,false);assert.equal(withHeader.result.copierHeaderBytes,512);
  assert.equal(withHeader.result.romSha256,first.result.romSha256);
  fs.writeFileSync(first.path,'not json');
  assert.equal(hw.auditWithCache(raw,{cacheDir:dir,max:20}).hit,false);
  assert.equal(hw.auditWithCache(raw,{cacheDir:dir,max:20}).hit,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
console.log('SNES_ROM_INDIRECT_PASS '+passed+' tests');
