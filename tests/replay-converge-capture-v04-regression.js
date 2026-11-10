'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {options,isStalled,blockedEdge}=require('../tools/replay-converge.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-captures-'));
try {
  const project=path.join(tmp,'project'),build=path.join(tmp,'build');
  fs.mkdirSync(path.join(project,'assets'),{recursive:true});
  fs.mkdirSync(path.join(project,'analysis'),{recursive:true});
  fs.mkdirSync(build,{recursive:true});
  fs.writeFileSync(path.join(project,'assets/cart-data.bin'),'rom');
  fs.writeFileSync(path.join(project,'analysis/generation-options.json'),'{}');
  fs.writeFileSync(path.join(build,'CMakeCache.txt'),'configured');
  const args=['--project',project,'--build',build,'--frames','4000','--capture-frames','100,1050,2350','--stall-iterations','4'];
  const parsed=options(args);
  assert.deepEqual(parsed.captureFrames,[100,1050,2350]);
  assert.equal(parsed.stallIterations,4);
  for(const invalid of ['0,100','12,12','10,','10000','five'])
    assert.throws(()=>options([...args.slice(0,6),'--capture-frames',invalid]),/Invalid|unique|nonempty/);
  const row=(frames,unique_framebuffers,unique_wram)=>({run:{exit_code:2},frames,unique_framebuffers,unique_wram,first_changed_frame:94});
  assert.equal(isStalled([row(20,10,5),row(20,10,5),row(20,10,5)],3),true);
  assert.equal(isStalled([row(20,10,5),row(21,10,5),row(20,10,5)],3),false);
  assert.equal(isStalled([row(20,10,5),row(20,10,5)],3),false);
  assert.equal(blockedEdge('fluxo CFG nao resolvido em pc=8487249 target=8489522'),'CFG:8487249:8489522');
  assert.equal(blockedEdge('estado M/X/C nao recompilado em pc=8423896'),'STATE:8423896');
  assert.equal(blockedEdge('success'),null);
  const changed=[row(2384,1741,2309),row(2384,1741,2309),row(2384,1741,2309)];
  changed[0].blocked_edge='CFG:818151:81DC00';
  changed[1].blocked_edge='CFG:818151:81DC01';
  changed[2].blocked_edge='CFG:818151:81DC02';
  assert.equal(isStalled(changed,3),false,'new dynamic edges must not trigger frame-only stall');
  changed.forEach(x=>x.blocked_edge='CFG:818151:81DC00');
  assert.equal(isStalled(changed,3),true,'identical unresolved edges must stall');
  console.log('FORJA65_REPLAY_MULTICAPTURE_V04_OK');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
