'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('../forja65-core');
const {inspect,address}=require('../tools/indirect-site-audit');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-indirect-audit-'));
try {
  const rom=Buffer.alloc(0x10000,0xff);
  // Internally consistent LoROM SNES header and reset vector.
  Buffer.from('INDIRECT AUDIT DEMO   ').copy(rom,0x7fc0);
  rom[0x7fd5]=0x20;rom[0x7fd6]=0x00;rom[0x7fd7]=7;
  rom[0x7fdc]=0x00;rom[0x7fdd]=0x00;rom[0x7fde]=0xff;rom[0x7fdf]=0xff;
  rom[0x7ffc]=0x00;rom[0x7ffd]=0x80;
  rom[0x0200]=0xfc;rom[0x0300]=0x60;
  fs.mkdirSync(path.join(dir,'assets'));fs.mkdirSync(path.join(dir,'analysis'));
  fs.writeFileSync(path.join(dir,'assets/cart-data.bin'),rom);
  const hash=C.romFingerprint(C.loadRom(rom));
  fs.writeFileSync(path.join(dir,'analysis/runtime-hints.txt'),[
    `rom=${hash} target=808300 from=808200 kind=FLOW e=0 m=0 x=0 c=1 observed=3`,
    `rom=${hash} target=808300 from=808200 kind=FLOW e=0 m=1 x=0 c=1 observed=2`,
    `rom=deadbeefdeadbeef target=808400 from=808200 kind=FLOW e=0 m=0 x=0 c=1 observed=2`,
    `rom=${hash} target=00003e from=808200 kind=FLOW e=0 m=0 x=0 c=1 observed=1`,
    `rom=${hash} target=808500 from=808210 kind=FLOW e=0 m=0 x=0 c=1 observed=1`,
  ].join('\n'));
  const result=inspect(dir,address('$808200'));
  assert.equal(result.indexed_indirect_call,true);
  assert.equal(result.verified_rom_targets,1);
  assert.equal(result.total_hint_observations,5);
  assert.equal(result.targets[0].states.length,2);
  assert.equal(result.rejected.different_rom,1);
  assert.equal(result.rejected.non_rom_destination,1);
  assert.throws(()=>inspect(dir,address('000020')),/not executable ROM/);
  console.log('indirect-site-audit-regression PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
