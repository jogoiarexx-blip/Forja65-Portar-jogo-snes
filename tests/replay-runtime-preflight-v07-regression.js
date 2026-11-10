'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../tools/replay-converge.js');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v07-preflight-'));
try{
 const project=path.join(base,'port'),build=path.join(project,'build');
 fs.mkdirSync(path.join(project,'analysis'),{recursive:true});fs.mkdirSync(path.join(project,'src'),{recursive:true});fs.mkdirSync(build);
 fs.writeFileSync(path.join(project,'analysis/generation-options.json'),JSON.stringify({rom:'1234567890abcdef'}));
 const hint=(target,rom='1234567890abcdef')=>`rom=${rom} target=${target} from=81812c kind=FLOW e=0 m=0 x=0 c=1`;
 fs.writeFileSync(path.join(project,'analysis/runtime-hints.txt'),hint('81c005'));
 fs.writeFileSync(path.join(project,'src/dispatch.cpp'),'{0x81C005u,false,false,false,true,true,&sub,0x81C005u},');
 assert.equal(R.pendingRuntimeEvidence(project,build).exists,false);
 fs.writeFileSync(path.join(build,'forja65-runtime-hints.txt'),hint('81c005')+'\n'+hint('81c29d'));
 const a=R.pendingRuntimeEvidence(project,build);
 assert.equal(a.exists,true);assert.equal(a.needs_build,true);assert.equal(a.unlearned,1);assert.equal(a.uncompiled,1);
 fs.writeFileSync(path.join(project,'src/dispatch.cpp'),'{0x81C005u,false,false,false,true,true,&sub,0x81C005u},\n{0x81C29Du,false,false,false,true,true,&sub,0x81C29Du},');
 assert.equal(R.pendingRuntimeEvidence(project,build).unlearned,1);
 fs.appendFileSync(path.join(project,'analysis/runtime-hints.txt'),'\n'+hint('81c29d'));
 assert.equal(R.pendingRuntimeEvidence(project,build).needs_build,false);
 fs.appendFileSync(path.join(build,'forja65-runtime-hints.txt'),'\n'+hint('818000','aaaaaaaaaaaaaaaa'));
 assert.equal(R.pendingRuntimeEvidence(project,build).stale,1);
 console.log('replay-runtime-preflight-v07-regression: PASS');
}finally{fs.rmSync(base,{recursive:true,force:true});}
