'use strict';
// Regression for REV121: candidate seeds expand static reconnaissance without
// changing generated handlers or smuggling unknown DBR into MMIO claims.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const H=require('../tools/snes-hardware-audit');
let passes=0;function test(n,fn){fn();passes++;console.log('PASS '+n);}
const rom=Buffer.alloc(0x20000,0xff),hdr=0x7fc0;
rom.write('CFG HARDWARE CROSSFEED',hdr,'ascii');rom[hdr+0x15]=0x20;rom[hdr+0x17]=9;
rom.writeUInt16LE(0x55aa,hdr+0x1c);rom.writeUInt16LE(0xaa55,hdr+0x1e);rom.writeUInt16LE(0x8000,hdr+0x3c);
// Entry at reset: STA $420C (known DBR=00), STP.
rom.set([0x8d,0x0c,0x42,0xdb],0x0000);
// Native-mode CFG candidate: REP #$20, LDA #$1234, STA long DMA/PPU.
rom.set([0xc2,0x20,0xa9,0x34,0x12,0x8f,0x00,0x43,0x00,
         0x8f,0x01,0x43,0x00,0x8f,0x0b,0x42,0x00,0x8f,0x05,0x21,0x00,0xdb],0x1000);
const native={pc:0x009000,e:0,m:1,x:1,c:null};
const second={pc:0x009000,e:0,m:0,x:1,c:null};
test('CPU E/M/X candidate seed reveals DMA, HDMA and PPU only as possible accesses',()=>{
 const a=H.audit(rom,{max:80}),b=H.audit(rom,{max:80,seeds:[native]});
 assert(!a.scan.hardwareReferences.some(x=>x.register==='4300'));
 for(const [reg,name] of [['4300','DMA0_DMAP'],['4301','DMA0_BBAD'],['420B','MDMAEN'],['2105','BGMODE']]){
  assert(b.scan.hardwareReferences.some(x=>x.register===reg&&x.name===name));
 }
 assert(b.scan.hardwareReferences.some(x=>x.register==='420C'));
 assert(b.scan.uniqueInstructionAddresses>a.scan.uniqueInstructionAddresses);
 assert.equal(b.cfgSeedInputs,1);
 assert(b.rootAddresses.some(x=>x.origin==='forja_cfg_candidate'));
 assert(b.scan.hardwareSummary['DMA/HDMA'].registerAccessPairs>=2);
});
test('Unknown native DBR forbids fabricated absolute MMIO from CFG seed',()=>{
 const testRom=Buffer.from(rom);testRom.set([0x8d,0x18,0x21,0xdb],0x1100);
 const out=H.audit(testRom,{max:80,seeds:[{pc:0x009100,e:0,m:0,x:0}]});
 assert(!out.scan.hardwareReferences.some(x=>x.register==='2118'));
 assert(out.scan.hardwareReferences.some(x=>x.register==='420C'));
});
test('Bad E/M/X or unmapped address is rejected or skipped',()=>{
 assert.throws(()=>H.audit(rom,{seeds:[{pc:0x9000,e:1,m:0,x:1}]}),/invalid emulation-width/);
 assert.throws(()=>H.audit(rom,{seeds:[{pc:0x9000,e:0,m:4,x:0}]}),/E\/M\/X/);
 assert.throws(()=>H.audit(rom,{seeds:[{pc:0x1000000,e:0,m:1,x:1}]}),/24-bit/);
 assert.equal(H.audit(rom,{seeds:[{pc:0x7e0000,e:0,m:1,x:1}]}).cfgSeedInputs,0);
 assert.equal(H.audit(rom,{seeds:[native,native]}).cfgSeedInputs,1);
});
test('Budget cannot exceed limit even when immediate widths are ambiguous',()=>{
 const out=H.audit(rom,{max:2,seeds:[native]});
 assert.equal(out.scan.decodedStates,2);
 assert.equal(out.scan.limitReached,true);
 assert(out.scan.hardwareReferences.some(x=>x.register==='420C'));
});
test('Cache separates candidates, mode width, ROM and reset-only scans',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'f65-cfg-hw-'));
 try {
  const a=H.auditWithCache(rom,{max:80,cacheDir:dir});
  const b=H.auditWithCache(rom,{max:80,cacheDir:dir,seeds:[native]});
  const c=H.auditWithCache(rom,{max:80,cacheDir:dir,seeds:[native]});
  const d=H.auditWithCache(rom,{max:80,cacheDir:dir,seeds:[second]});
  assert.equal(a.hit,false);assert.equal(b.hit,false);assert.equal(c.hit,true);assert.equal(d.hit,false);
  assert.notEqual(a.path,b.path);assert.notEqual(b.path,d.path);
  assert.equal(a.result.cfgSeedInputs,0);assert.equal(b.result.cfgSeedInputs,1);
  const changed=Buffer.from(rom);changed[0x1234]^=1;
  assert.equal(H.auditWithCache(changed,{max:80,cacheDir:dir,seeds:[native]}).hit,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Forja native generator integration preserves ROM provenance and audit manifest',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f65-cfg-project-'));
 try {
  const filepath=path.join(tmp,'probe.sfc'),out=path.join(tmp,'port');fs.writeFileSync(filepath,rom);
  const exe=path.join(__dirname,'../tools/forja65.js');
  const res=cp.spawnSync(process.execPath,[exe,'analyze',filepath,'--out',out,'--max','64','--hardware-max','128','--hardware-cache-dir',path.join(tmp,'cache'),'--no-knowledge-vault'],{encoding:'utf8',timeout:35000});
  if(res.status!==0)throw Error('Generator failed: '+res.stdout+' '+res.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'analysis/snes-hardware-audit.json'),'utf8'));
  assert.equal(report.version,'1.2.0');
  assert(report.cfgSeedInputs>=1);
  assert.equal(report.romSha256,H.audit(rom).romSha256);
  assert(fs.existsSync(path.join(out,'src/runtime.hpp')));
  assert(fs.existsSync(path.join(out,'analysis/generation-options.json')));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
console.log('SNES_CFG_HARDWARE_CROSSFEED_PASS '+passes+' tests');
