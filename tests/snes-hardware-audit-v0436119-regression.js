'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const hw=require('../tools/snes-hardware-audit');
function makeRom(mapper='lorom', size=0x10000){
 const rom=Buffer.alloc(size,0xff);
 const h=mapper==='lorom'?0x7fc0:mapper==='hirom'?0xffc0:0x40ffc0;
 rom.write('FORJA HARDWARE TEST',h,'ascii');
 rom[h+0x15]=mapper==='lorom'?0x20:mapper==='hirom'?0x21:0x25;
 rom[h+0x16]=0;rom[h+0x17]=0x09;rom[h+0x18]=0;rom[h+0x19]=1;
 rom.writeUInt16LE(0x5678,h+0x1c);rom.writeUInt16LE(0xa987,h+0x1e);
 rom.writeUInt16LE(0x8000,h+0x3c);
 const entry=mapper==='lorom'?0:0x8000;
 rom.set(Buffer.from([0x18,0xfb,0xc2,0x30,0xa9,0x34,0x12,0x8d,0x00,0x21,
  0xe2,0x20,0xa9,0x80,0x8d,0x0b,0x42,0x8f,0x40,0x21,0x00,0x20,0x20,0x80,0x80,0x02,0xea,0xea,0xdb]),entry);
 rom.set(Buffer.from([0xc2,0x30,0xa9,0x22,0x11,0x8d,0x18,0x21,0x60]),entry+0x20);
 return rom;
}
let passed=0;
function test(label,fun){fun();console.log('PASS',label);passed++;}
test('All 256 legal opcode lengths are specified',()=>{
 assert.equal(hw.LENGTH.length,256);
 assert.equal(hw.LENGTH[0x00],'2'); assert.equal(hw.LENGTH[0x22],'4');
 assert.equal(hw.LENGTH[0x44],'3'); assert.equal(hw.LENGTH[0x54],'3');
 assert.equal(hw.LENGTH[0xa0],'X'); assert.equal(hw.LENGTH[0xa2],'X');
 assert.equal(hw.LENGTH[0xa9],'M'); assert.equal(hw.LENGTH[0xc9],'M');
 assert.equal(hw.LENGTH[0xdc],'3'); assert.equal(hw.LENGTH[0xfc],'3');
});
test('LoROM detection, 65816 M/X transitions, PPU and DMA accesses',()=>{
 const result=hw.audit(makeRom(),{max:2000});
 assert.equal(result.header.mapper,'lorom');assert.equal(result.header.checksumPairValid,true);
 assert.equal(result.scan.limitReached,false);
 assert(result.scan.hardwareReferences.some(r=>r.register==='2100'&&r.access==='write'));
 assert(result.scan.hardwareReferences.some(r=>r.register==='420B'&&r.access==='write'));
 assert(result.scan.hardwareReferences.some(r=>r.register==='2140'&&r.access==='write'));
 assert(result.scan.hardwareReferences.some(r=>r.register==='2118'));
 assert(result.scan.decodedStates>10);
});
test('HiROM mapping from C0, direct reset and headers',()=>{
 const result=hw.audit(makeRom('hirom'),{max:300});
 assert.equal(result.header.mapper,'hirom');assert.equal(result.header.resetVector,'8000');
 assert(result.scan.hardwareReferences.some(r=>r.register==='2100'));
 assert.equal(hw.romOffset(0xc00000,'hirom',0x10000),0);
 assert.equal(hw.romOffset(0x7e8000,'hirom',0x10000),null);
});
test('Copier header detected and excluded from ROM bytes and hash',()=>{
 const rom=makeRom(), raw=Buffer.concat([Buffer.alloc(512,0xab),rom]);
 const out=hw.audit(raw,{max:200});
 assert.equal(out.copierHeaderBytes,512);assert.equal(out.romBytes,rom.length);
 assert.equal(out.romSha256,hw.audit(rom,{max:200}).romSha256);
});
test('Real PC fetch bank wrap does not access the next physical bank',()=>{
 const rom=makeRom('hirom');
 rom[0xfffe]=0x20;rom[0xffff]=0x56;rom[0]=0x34;
 assert.deepEqual(hw.fetchCpu(rom,'hirom',0xc0fffe,3),[0x20,0x56,0x34]);
 assert.equal(hw.fetchCpu(rom,'hirom',0x00fffe,3),null); // 00:0000 is WRAM, not ROM
});
test('ROM ownership refuses WRAM, MMIO, LoROM potential SRAM and out of range',()=>{
 for(const address of [0x7e1000,0x7f8000,0x008000-1,0x700120,0xf00020,0x1000000]){
  assert.equal(hw.romOffset(address,'lorom',0x400000),null, address.toString(16));
 }
 assert.equal(hw.romOffset(0x408000,'lorom',0x400000),0x200000);
 assert.equal(hw.registerInfo(0x7e2100),null);
 assert.equal(hw.registerInfo(0x402100),null);
 assert.equal(hw.registerInfo(0x002100).category,'PPU');
});
test('After PLB the data bank is unknown: no made-up absolute MMIO access',()=>{
 const rom=makeRom();
 rom.set(Buffer.from([0xab,0x8d,0x00,0x21,0xdb]),0);
 const result=hw.audit(rom,{max:30});
 assert.equal(result.scan.hardwareReferences.length,0);
});
test('Unresolved indirect control transfers are flagged without target fabrication',()=>{
 const rom=makeRom();rom.set(Buffer.from([0x6c,0x00,0x12]),0);
 const result=hw.audit(rom,{max:200});
 assert.equal(result.scan.unresolvedIndirectControlTransfers,1);
 assert.equal(result.scan.indirectControlExamples[0].opcode,'6C');
});
test('Native interrupt entry begins with unknown M/X, not emulation mode flags',()=>{
 const rom=makeRom();
 rom.writeUInt16LE(0x8040,0x7fea);rom.set(Buffer.from([0xa9,0x34,0x12,0x40]),0x40);
 const result=hw.audit(rom,{max:1000,allVectors:true});
 assert(result.rootAddresses.some(r=>r.vector==='native_NMI'&&r.e===0));
 assert(result.scan.ambiguousImmediateSites>0);
});
test('ExHiROM detected but conservatively left untraversed',()=>{
 const rom=makeRom('exhirom',0x410000);
 const result=hw.audit(rom,{max:100});
 assert.equal(result.header.mapper,'exhirom');assert.equal(result.scan,null);
});
test('Reject arbitrary binary rather than assuming a mapper',()=>{
 assert.throws(()=>hw.audit(Buffer.alloc(0x10000,0)),/plausible SNES ROM header/);
 const fake=Buffer.alloc(0x10000,0xff);fake[0x7fd5]=0x20;
 assert.throws(()=>hw.audit(fake),/plausible SNES ROM header/);
});
test('Carry changes before XCE branch conservatively into both E modes',()=>{
 const rom=makeRom();
 // CLC, ADC $00, XCE, LDA #$1122, STP. ADC changes C; XCE cannot assume carry=0.
 rom.set(Buffer.from([0x18,0x65,0x00,0xfb,0xa9,0x22,0x11,0xdb]),0);
 const result=hw.audit(rom,{max:200});
 assert(result.scan.ambiguousImmediateSites===0);
 // Unlike stale C=0, both emulation and native paths must be represented.
 assert(result.scan.decodedStates>=6);
});
test('Report is a parseable JSON file produced by CLI without the missing core',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-snes-hw-'));
 try{
  const romFile=path.join(dir,'test.sfc'),out=path.join(dir,'analysis','hardware.json');
  fs.writeFileSync(romFile,makeRom());
  const r=cp.spawnSync(process.execPath,[path.join(__dirname,'..','tools','snes-hardware-audit.js'),'--rom',romFile,'--out',out,'--max','300'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const data=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(data.schema,'forja65.snes-hardware-audit.v1');
  assert(data.scan.decodedStates>0);
  const integration=cp.spawnSync(process.execPath,[path.join(__dirname,'..','tools','forja65.js'),'hardware-audit','--rom',romFile,'--max','300'],{encoding:'utf8'});
  assert.equal(integration.status,0,integration.stderr);
  assert.equal(JSON.parse(integration.stdout).header.mapper,'lorom');
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
console.log('SNES_HARDWARE_AUDIT_PASS '+passed+' tests');
