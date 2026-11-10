'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-f3-reference-diff-v043654.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-f3-oracle54-'));
try {
  fs.writeFileSync(path.join(dir,'runtime.hpp'),project['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
  const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-I'+dir,
    path.join(__dirname,'fixtures','spc_f3_reference_diff_v043654.cpp'),'-o',bin],{cwd:dir,timeout:150000,stdio:'pipe'});
  const env={...process.env,FORJA65_SPC_PROFILE:'reference',FORJA65_DSP_CLOCK:'fractional',
    FORJA65_APU_DSP_INTERLEAVE:'1',FORJA65_SPC_F3_BUS_TRACE:'1'};
  const stdout=cp.execFileSync(bin,[],{cwd:dir,timeout:60000,encoding:'utf8',env});
  assert.match(stdout,/SPC_F3_REFERENCE_DIFF_V043654_PASS cases=12/);
  const tool=path.join(__dirname,'..','tools','spc_f3_trace_diff.py');
  const python=process.env.PYTHON||'python3';
  const args=['--observed',path.join(dir,'observed54.csv'),'--reference',path.join(dir,'reference54.csv'),
    '--report',path.join(dir,'report54.json')];
  const matched=cp.execFileSync(python,[tool,...args],{encoding:'utf8',timeout:20000});
  const report=JSON.parse(matched);
  assert.equal(report.logical_sequence_matches,true);
  assert.equal(report.physical_timing.status,'not_comparable');
  assert.equal(report.observed_events,2);
  const csv=fs.readFileSync(path.join(dir,'observed54.csv'),'utf8');
  assert.match(csv,/instruction_id,spc_cycles_end/);
  assert.match(csv,/instruction_completion_is_not_write_cycle=1/);
  const modified=fs.readFileSync(path.join(dir,'reference54.csv'),'utf8').replace('768,143,108,32,','768,143,108,31,');
  fs.writeFileSync(path.join(dir,'wrong.csv'),modified);
  const invalid=cp.spawnSync(python,[tool,'--observed',path.join(dir,'observed54.csv'),
    '--reference',path.join(dir,'wrong.csv')],{encoding:'utf8',timeout:20000});
  assert.equal(invalid.status,1,invalid.stderr);
  const mismatch=JSON.parse(invalid.stdout);
  assert.equal(mismatch.first_mismatch.field,'value');
  assert.equal(mismatch.first_mismatch.event_index,0);
  console.log('SPC_F3_REFERENCE_DIFF_V043654_PASS cases=12 comparator=match+first_mismatch');
}finally {fs.rmSync(dir,{recursive:true,force:true});}
