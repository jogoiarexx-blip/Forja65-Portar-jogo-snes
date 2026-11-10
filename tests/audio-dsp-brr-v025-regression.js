"use strict";
const F=require('../forja65-core.js');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'brr-v025.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-brr-v025-'));
try{
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'assets/cart-data.bin'),generated['assets/cart-data.bin']);
  fs.writeFileSync(path.join(dir,'runtime.hpp'),generated['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','audio_dsp_brr_v025.cpp'),path.join(dir,'test.cpp'));
  cp.execFileSync(process.env.PYTHON||'python3',[path.join(__dirname,'../tools/brr-reference-v025.py'),path.join(dir,'vectors.txt')],{stdio:'inherit'});
  const bin=path.join(dir,process.platform==='win32'?'brr-test.exe':'brr-test');
  const sanitize=process.platform==='linux'&&process.env.FORJA65_TEST_SANITIZE!=='0'?['-fsanitize=undefined','-fno-sanitize-recover=all']:[];
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2',...sanitize,'test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  const vectors=path.join(dir,'vectors.txt');
  const defaults={...process.env,FORJA65_DSP_BRR:'hardware',FORJA65_DSP_KEYS:'hardware',FORJA65_DSP_ENVELOPE:'hardware',FORJA65_DSP_INTERPOLATION:'gaussian',FORJA65_ROM_MODE:'cart',FORJA65_AUDIO_MODE:'off',FORJA65_AUDIO_DUMP:'0'};
  cp.execFileSync(bin,[vectors],{cwd:dir,stdio:'inherit',env:defaults});
  cp.execFileSync(bin,[vectors],{cwd:dir,stdio:'inherit',env:{...defaults,FORJA65_DSP_BRR:'legacy',FORJA65_DSP_KEYS:'legacy',FORJA65_DSP_ENVELOPE:'legacy',FORJA65_DSP_INTERPOLATION:'linear'}});
  // Prove the comparator catches a changed expectation and reports its FIRST
  // location, rather than accepting an all-silent/nonzero-only approximation.
  const rows=fs.readFileSync(vectors,'utf8').split('\n');
  const first=rows[0].split(' ');first[19]='0';rows[0]=first.join(' ');
  const corrupt=path.join(dir,'corrupt.txt');fs.writeFileSync(corrupt,rows.join('\n'));
  const mismatch=cp.spawnSync(bin,[corrupt],{cwd:dir,encoding:'utf8'});
  assert.equal(mismatch.status,1);
  const diff=JSON.parse(mismatch.stderr.trim());
  assert.deepEqual(diff,{record:0,header:0,history_pcm:[0,0],block:0,sample:0,expected:0,actual:-2});
  console.log('BRR_FIRST_DIVERGENCE_DIAGNOSTIC_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
