'use strict';
const assert=require('node:assert/strict');
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {analyzeScene}=require('../tools/inspect-scene.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-inspect-'));
try{
  fs.writeFileSync(path.join(dir,'capture-manifest.txt'),'FORJA65_SCENE_CAPTURE 1\nsource_frame=3\n');
  fs.writeFileSync(path.join(dir,'test.nscene'),'NATIVE_SCENE 1\nmode 7\ntm 16\nts 0\nbrightness 15\n');
  fs.writeFileSync(path.join(dir,'vram.bin'),Buffer.alloc(65536));
  fs.writeFileSync(path.join(dir,'cgram.bin'),Buffer.alloc(512));
  const oam=Buffer.alloc(544);for(let i=0;i<128;i++){oam[i*4+2]=255;oam[i*4+3]=240;}
  fs.writeFileSync(path.join(dir,'oam.bin'),oam);
  fs.writeFileSync(path.join(dir,'preview.ppm'),Buffer.concat([Buffer.from('P6\n2 1\n255\n'),Buffer.from([0,0,0,1,2,3])]));
  const report=analyzeScene(dir);
  assert.equal(report.ppu.visibleBgEnabled,false);
  assert.equal(report.ppu.objMainEnabled,true);
  assert.equal(report.raw.oamRepeatedInitializerPattern,128);
  assert.equal(report.image.nonBlackPixels,1);
  fs.writeFileSync(path.join(dir,'oam.bin'),Buffer.alloc(3));
  assert.throws(()=>analyzeScene(dir),/invalid VRAM\/CGRAM\/OAM length/);
  console.log('INSPECT_SCENE_V0369_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
