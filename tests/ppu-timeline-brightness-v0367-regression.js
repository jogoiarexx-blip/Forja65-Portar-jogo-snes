'use strict';
const assert=require('assert');
const {report}=require('../tools/ppu-timeline-report');
const head='event,frame,instruction,pc,scanline,master_cycle,port,value,inidisp,blank,brightness,bgmode,tm,ts,ppu_writes,dma_bytes,hdma_bytes';
function ev(type,frame,disp,blank,brightness,tm,ts){return [type,frame,10,0x1234,0,0,0x2100,disp,disp,blank,brightness,1,tm,ts,1,0,0].join(',');}
const r=report([head,ev('frame',0,0,0,0,0,0),ev('write',1,0x8f,1,15,7,16),ev('write',1,0,0,0,7,16),ev('frame',2,0,0,0,7,16),ev('write',3,15,0,15,7,0),ev('frame',4,15,0,15,7,0)].join('\n'));
assert.strictEqual(r.firstUnblankAfterForcedBlank.frame,1);
assert.strictEqual(r.frames[1].visibility,'ZERO_BRIGHTNESS');
assert.strictEqual(r.firstBrightnessEnabled.frame,3);
assert.strictEqual(r.firstVisibilityPossible.frame,3);
assert.strictEqual(r.firstVisibleFrameCandidate.frame,4);
assert.strictEqual(r.schema,'forja65.ppu-timeline-report.v2');
const stillBlack=report([head,ev('frame',0,0,0,0,0,0),ev('write',1,0x8f,1,15,7,0),ev('write',1,0,0,0,7,0)].join('\n'));
assert.strictEqual(stillBlack.firstVisibilityPossible,null);
console.log('PPU_BRIGHTNESS_V0367_REGRESSION=PASS');
