'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'spc-indirect-pointer-order-v043659.sfc');
const project=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-pointer59-'));
try{
 let header=project['src/runtime.hpp'];
 const needle='static std::uint8_t sr(ApuBridge& s, std::uint16_t a) {';
 assert.equal(header.split(needle).length,2,'Expected exactly one SPC bus-read helper');
 // Instrument only the test-generated header, never the product runtime.
 header=header.replace(needle,
  'static std::vector<std::uint16_t> forjaSpcReadSequenceTest;\n'+needle+'\n    forjaSpcReadSequenceTest.push_back(a);');
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),project['src/pcm_audio_output.hpp']);
 const levels=(process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',');
 for(const opt of levels){
  assert.ok(['-O0','-O1','-O2'].includes(opt),'Unsupported optimization level');
  const bin=path.join(dir,process.platform==='win32'?'test.exe':'test');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-I'+dir,
   path.join(__dirname,'fixtures','spc_indirect_pointer_order_v043659.cpp'),'-o',bin],
   {cwd:dir,timeout:180000,stdio:'pipe'});
  let out;try{out=cp.execFileSync(bin,[],{cwd:dir,timeout:60000,encoding:'utf8'});}catch(e){process.stderr.write('fixture stderr: '+e.stderr+' stdout: '+e.stdout+'\n');throw e;}
  assert.match(out,/SPC_INDIRECT_POINTER_ORDER_V043659_PASS cases=\d+/);
  console.log(opt,out.trim());
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
