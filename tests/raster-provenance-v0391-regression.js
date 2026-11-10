'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'raster-provenance-v0391.sfc');
const header=F.generateProject(rom,F.analyze(rom,256,[]))['src/runtime.hpp'];
assert(header.includes('void recordRasterSegment('));
assert(header.includes('void beginRasterTrace('));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-raster-v0391-'));
try {
 fs.writeFileSync(path.join(dir,'runtime.hpp'),header);
 const exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 const compile=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-O0','-g0','-I',dir,path.join(__dirname,'raster_provenance_smoke.cpp'),'-o',exe],{encoding:'utf8',cwd:dir});
 assert.equal(compile.status,0,compile.stderr||String(compile.error));
 const capture=path.join(dir,'capture');
 const run=cp.spawnSync(exe,[],{encoding:'utf8',cwd:dir,env:{...process.env,FORJA65_RASTER_TRACE_FRAME:'1',FORJA65_CAPTURE_DIR:capture,FORJA65_PPU_TRACE:'0'}});
 assert.equal(run.status,0,run.stderr||run.stdout||String(run.error));
 const csv=fs.readFileSync(path.join(capture,'raster-pixels.csv'),'utf8');
 assert(csv.includes('obj_rgb')&&csv.includes('bg_depth')&&csv.includes('occlusion_cause')&&csv.includes('1,10,40,'), 'expected BG-vs-OBJ audit columns and pixel');
 console.log('FORJA65_RASTER_PROVENANCE_V0391_PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
