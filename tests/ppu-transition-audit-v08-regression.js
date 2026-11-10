'use strict';const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const a=require('../tools/ppu-transition-audit.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-ppu-audit-'));
try{
  const d=path.join(tmp,'frame-4');fs.mkdirSync(d);
  fs.writeFileSync(path.join(d,'frame-4.nscene'),'NATIVE_SCENE 1\nbrightness 0\nsource_frame 4\nframebuffer_hash_fnv1a64 abcdef1234\n');
  fs.writeFileSync(path.join(d,'preview.ppm'),Buffer.concat([Buffer.from('P6\n2 1\n255\n'),Buffer.alloc(6)]));
  const hash=path.join(tmp,'hashes.txt');fs.writeFileSync(hash,'frame=4 framebuffer=abcdef1234 wram=baad\n');
  let r=a.analyze(tmp,hash);assert.equal(r.captures[0].category,'PPU_BRIGHTNESS_ZERO');assert.equal(r.captures[0].fully_black,true);assert.equal(r.captures[0].hash_verified,true);
  fs.writeFileSync(path.join(d,'frame-4.nscene'),'brightness 15\nsource_frame 4\nframebuffer_hash_fnv1a64 abcdef1234\n');
  r=a.analyze(tmp,hash);assert.equal(r.captures[0].category,'BLACK_WITH_BRIGHTNESS');
  const ppm=Buffer.from('P6\n2 1\n255\n\x00\x00\x00\x10\x20\x30','binary');fs.writeFileSync(path.join(d,'preview.ppm'),ppm);
  r=a.analyze(tmp,hash);assert.equal(r.captures[0].category,'VISIBLE_PIXELS');assert.equal(r.captures[0].nonblack_pixels,1);
  fs.writeFileSync(hash,'frame=4 framebuffer=00000000 wram=baad\n');assert.throws(()=>a.analyze(tmp,hash),/Frame-hash mismatch/);
  fs.writeFileSync(hash,'frame=4 framebuffer=abcdef1234 wram=baad\nframe=4 framebuffer=abcdef1234 wram=baad\n');assert.throws(()=>a.analyze(tmp,hash),/Duplicate frame/);
  fs.writeFileSync(path.join(d,'frame-4.nscene'),'brightness 15\nsource_frame 5\n');assert.throws(()=>a.analyze(tmp,null),/Capture frame disagreement/);
  console.log('ppu-transition-audit-v08-regression: PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
