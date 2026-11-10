// This test checks the current sliver renderer rather than removed cachedTile internals.
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'obj-bank-regression.sfc');
const files=C.generateProject(rom,C.analyze(rom,256,[]));
const runtime=files['src/runtime.hpp'];
// The generated C++ smoke executes bank selection, wrapped Y, scalar/row
// parity, DMA, and input replay. Source spelling is not the contract.
assert(files['tests/obj_sprite_bank_smoke.cpp'],'missing generated C++ verification');
assert(files['CMakeLists.txt'].includes('add_test(NAME obj_sprite_bank_smoke'),'missing CTest registration');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-v0380-'));
try{
  fs.mkdirSync(path.join(d,'src'));
  fs.writeFileSync(path.join(d,'src/runtime.hpp'),runtime);
  fs.writeFileSync(path.join(d,'src/pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(d,'verify.cpp'),files['tests/obj_sprite_bank_smoke.cpp']);
  const b=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-I'+path.join(d,'src'),path.join(d,'verify.cpp'),'-o',path.join(d,'verify')],{encoding:'utf8'});
  assert.strictEqual(b.status,0,b.stderr||String(b.error));
  const r=cp.spawnSync(path.join(d,'verify'),[],{encoding:'utf8'});
  assert.strictEqual(r.status,0,r.stderr||String(r.error));
  assert(r.stdout.includes('FORJA65_OBJ_BANK_DMA_WRAP_PASS'));
  // Preserve the former capture/shared-row guard as an output assertion:
  // generated capture smoke compares a rendered rectangular OBJ pixel and
  // exported alpha/metadata, and checks replay/probe input behavior.
  fs.writeFileSync(path.join(d,'src/capture_test_io.hpp'),files['tests/capture_test_io.hpp']||files['src/capture_test_io.hpp']);
  fs.writeFileSync(path.join(d,'capture.cpp'),files['tests/obj_capture_probe_smoke.cpp']);
  const capture=path.join(d,'capture');
  const cc=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-I'+path.join(d,'src'),path.join(d,'capture.cpp'),'-o',capture],{encoding:'utf8'});
  assert.strictEqual(cc.status,0,cc.stderr||String(cc.error));
  const cr=cp.spawnSync(capture,[],{cwd:d,encoding:'utf8'});
  assert.strictEqual(cr.status,0,cr.stderr||String(cr.error));
  assert(cr.stdout.includes('OBJ_RECTANGULAR_CAPTURE_AND_INPUT_PROBE_PASS'));
  console.log('OBJ banks / DMA / Y-wrap v0.3.80: PASS');
}finally{fs.rmSync(d,{recursive:true,force:true});}
