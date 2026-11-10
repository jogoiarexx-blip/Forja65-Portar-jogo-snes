'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../tools/replay-converge');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-replay-'));
try{
  const trace=path.join(d,'hashes.txt');
  fs.writeFileSync(trace,'frame=0 framebuffer=a wram=1 pc=8000\nframe=1 framebuffer=a wram=2 pc=8002\nframe=2 framebuffer=b wram=3 pc=8004\n');
  assert.deepEqual(R.frameStats(trace),{frames:3,unique_framebuffers:2,unique_wram:3,last_frame:2,first_changed_frame:2});
  assert.throws(()=>R.options(['--project',path.join(d,'missing')]),/cart-data.bin/);
  assert.throws(()=>R.options(['--project']),/Expected/);
  console.log('replay-converge-regression: PASS');
}finally{fs.rmSync(d,{recursive:true,force:true});}
