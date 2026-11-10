'use strict';
// Compile a generated C++ port runtime, not a JavaScript copy of the DSP.
const assert=require('node:assert/strict');
const F=require('../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom());
const generated=F.generateProject(rom,F.analyze(rom,128));
const runtime=generated['src/runtime.hpp'];
assert.ok(runtime.includes('S-DSP rereads DIR/SRCN at the END boundary'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-dsp-live-loop-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),runtime);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),generated['src/pcm_audio_output.hpp']);
 fs.copyFileSync(path.join(__dirname,'fixtures','dsp_live_brr_loop_v043641.cpp'),path.join(dir,'test.cpp'));
 const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o',bin],{cwd:dir,stdio:'inherit',timeout:180000});
 cp.execFileSync(bin,[],{cwd:dir,stdio:'inherit',timeout:60000});
 console.log('DSP_LIVE_BRR_LOOP_BUILD_V043641_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
