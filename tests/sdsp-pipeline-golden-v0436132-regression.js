'use strict';
// REV132: cycle-ordered S-DSP pipeline must reproduce, bit for bit, the output samples, all 128
// readable DSP registers after every sample and the final 64 KiB ARAM recorded from the external
// reference DSP (tests/fixtures/sdsp-rev132-golden.txt, produced by tools/sdsp-oracle).
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'sdsp-rev132.sfc'),p=F.generateProject(rom,F.analyze(rom,32));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-sdsp-rev132-'));
try{
  for(const f of ['runtime.hpp','pcm_audio_output.hpp'])fs.writeFileSync(path.join(dir,f),p['src/'+f]);
  for(const f of ['sdsp-pipeline-v0436132.cpp','sdsp_scenarios_v0436132.hpp'])fs.copyFileSync(path.join(__dirname,f),path.join(dir,f));
  const exe=path.join(dir,process.platform==='win32'?'sdsp.exe':'sdsp');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','-I'+dir,path.join(dir,'sdsp-pipeline-v0436132.cpp'),'-o',exe],{cwd:dir,timeout:600000});
  const golden=path.join(__dirname,'fixtures','sdsp-rev132-golden.txt');
  const run=(mode)=>{const r=cp.spawnSync(exe,[golden].concat(mode?[mode]:[]),{encoding:'utf8',timeout:600000});return {r,m:/SDSP_GOLDEN mode=(\S+) scenarios=(\d+) output_exact=(\d+) registers_exact=(\d+) aram_exact=(\d+)/.exec(r.stdout||'')};};
  const now=run(),old=run('legacy');assert.ok(now.m&&old.m,'missing SDSP summary');
  const n=+now.m[2];const score=x=>(10*Math.min(+x[3],+x[4],+x[5])/n).toFixed(2);
  console.log(`SDSP_PIPELINE_V0436132 scenarios=${n} antes=${score(old.m)}/10 depois=${score(now.m)}/10 (${now.m[0]})`);
  if(!process.env.FORJA65_SCORE_ONLY){assert.equal(now.r.status,0,'pipeline differs from reference DSP');assert.equal(+now.m[3],n);}
}finally{fs.rmSync(dir,{recursive:true,force:true});}
