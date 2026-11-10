'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const core=process.env.FORJA65_TEST_CORE||path.join(__dirname,'..','forja65-core.js');
const F=require(core);
const rom=F.loadRom(F.makeSyntheticRom(),'rev130-openbus.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev130-openbus-'));
try{
  for(const n of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,n),files['src/'+n]);
  for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
    const exe=path.join(dir,'probe');
    cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,path.join(__dirname,'cpu-unmapped-openbus-v0436130.cpp'),'-o',exe],{cwd:dir,timeout:180000});
    const r=cp.spawnSync(exe,[],{cwd:dir,encoding:'utf8',timeout:100000});
    const m=/CPU_UNMAPPED_OPENBUS_REV130 pass=(\d+) fail=(\d+) total=(\d+)/.exec(r.stdout||'');
    assert.ok(m,'Probe output missing: '+r.stderr);
    console.log(opt,m[0]);
    if(!process.env.FORJA65_SCORE_ONLY){assert.equal(+m[2],0,'CPU memory open-bus mismatch');assert.equal(r.status,0);}
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
