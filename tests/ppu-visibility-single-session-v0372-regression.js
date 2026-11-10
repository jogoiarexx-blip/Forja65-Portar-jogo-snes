'use strict';
const assert=require('node:assert/strict');
const {audit}=require('../tools/ppu-visibility-audit');
const head='event,frame,inidisp,blank,brightness,bgmode,tm,ts';
const rows=[head,'frame,0,128,1,0,7,0,0','frame,1,15,0,15,7,16,0','frame,2,15,0,15,7,17,0'].join('\n');
const r=audit(rows);assert.equal(r.sampledFrames,3);assert.equal(r.first.background_enabled,2);assert.equal(r.counts.obj_only,1);
assert.throws(()=>audit(rows+'\nframe,0,128,1,0,7,0,0'),/overlapping runs/);
assert.throws(()=>audit(rows+'\nframe,2,15,0,15,7,17,0'),/overlapping runs/);
console.log('PPU_SINGLE_SESSION_V0372=PASS');
