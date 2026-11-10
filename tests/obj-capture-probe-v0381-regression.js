"use strict";
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'obj-probe-regression.sfc');
const files=C.generateProject(rom,C.analyze(rom,256,[]));
assert(files['tests/obj_capture_probe_smoke.cpp'],'C++ smoke must be generated');
assert(files['CMakeLists.txt'].includes('add_test(NAME obj_capture_probe_smoke'),'CTest registration missing');
const rt=files['src/runtime.hpp'];
assert(rt.includes('void appendObjInputProbe()'),'missing runtime diagnostic');
assert(rt.includes('auto row=ppu.buildSpriteRow((int)y);'),'capture and runtime sprite compositor disagree');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-obj-capture-v0381-'));
try {
 fs.mkdirSync(path.join(d,'src'));
 fs.writeFileSync(path.join(d,'src/runtime.hpp'),rt);
 fs.writeFileSync(path.join(d,'capture_test_io.hpp'),files['tests/capture_test_io.hpp']);
 fs.writeFileSync(path.join(d,'verify.cpp'),files['tests/obj_capture_probe_smoke.cpp']);
 const build=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I'+path.join(d,'src'),path.join(d,'verify.cpp'),'-o',path.join(d,'verify')],{encoding:'utf8'});
 assert.strictEqual(build.status,0,build.stderr||String(build.error));
 const run=cp.spawnSync(path.join(d,'verify'),[],{encoding:'utf8'});
 assert.strictEqual(run.status,0,run.stderr||String(run.error));
 assert(run.stdout.includes('OBJ_RECTANGULAR_CAPTURE_AND_INPUT_PROBE_PASS'));
 console.log('Forja65 v0.3.81 OBJ renderer/capture/probe: PASS');
} finally {fs.rmSync(d,{recursive:true,force:true});}
