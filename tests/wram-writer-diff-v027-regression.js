'use strict';
const F=require('../forja65-core.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const rom=F.loadRom(F.makeSyntheticRom(),'wram-writer-diff-v027.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384));
const header=generated['src/runtime.hpp'];
assert.ok(generated['tests/wram_observers_v027_smoke.cpp']);
assert.ok(generated['CMakeLists.txt'].includes('add_test(NAME wram_observers_v027_smoke'));
assert.equal(generated['tests/wram_observers_v027_smoke.cpp'],fs.readFileSync(path.join(__dirname,'fixtures','wram_writer_diff_v027.cpp'),'utf8'));
for(const token of ['traceWramWrite','appendWramDiffSnapshot','appendWramDeltaSnapshot','FORJA65_WRAM_WRITE_ADDRS','FORJA65_WRAM_DIFF_MAX_PER_FRAME'])assert.ok(header.includes(token),token);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-audio-key-v024-'));
try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname,'fixtures','wram_writer_diff_v027.cpp'),path.join(dir,'test.cpp'));
  const bin=path.join(dir,process.platform==='win32'?'key-test.exe':'key-test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit'}); // A generated CTest may run repeatedly in the same build directory.
  console.log('FORJA65_WRAM_WRITER_DIFF_V027_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
