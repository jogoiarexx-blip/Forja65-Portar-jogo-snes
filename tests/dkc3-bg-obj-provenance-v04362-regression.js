'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const C=require('../forja65-core');
const rom=C.loadRom(C.makeSyntheticRom());
const generated=C.generateProject(rom,C.analyze(rom,128));
const h=generated['src/runtime.hpp'];
for(const token of ['BgLayerAudit explainBackgroundLayers','bg1_visible,bg1_priority,bg1_windowed','q.bgLayers=explainBackgroundLayers(x,y)']){
  if(!h.includes(token))throw new Error('Missing generated BG provenance: '+token);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-bg-obj-audit-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),h);
 fs.copyFileSync(path.join(__dirname,'fixtures/bg_obj_provenance_v043618.cpp'),path.join(dir,'smoke.cpp'));
 const args=['-std=c++20','-O0','smoke.cpp','-o','smoke'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 cp.execFileSync(process.env.CXX||'g++',args,{cwd:dir,stdio:'pipe'});
 console.log(cp.execFileSync(path.join(dir,'smoke'),[],{cwd:dir,encoding:'utf8'}).trim());
}finally{fs.rmSync(dir,{recursive:true,force:true});}
