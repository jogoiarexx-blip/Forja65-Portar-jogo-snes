'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),C=require('../forja65-core');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-mixed-width-'));
try{const rom=C.loadRom(C.makeSyntheticRom());const files=C.generateProject(rom,C.analyze(rom,384));for(const[n,data]of Object.entries(files)){if(!n.endsWith('.hpp'))continue;const p=path.join(tmp,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
const fixture=path.join(tmp,'test.cpp');fs.copyFileSync(path.join(__dirname,'fixtures/mixed_width_raster.cpp'),fixture);const exe=path.join(tmp,'test');cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O1','-DFORJA65_ENABLE_TRACE=0','-I'+path.join(tmp,'src'),fixture,'-o',exe],{stdio:'inherit'});cp.execFileSync(exe,[],{cwd:tmp,stdio:'inherit'});console.log('MIXED_WIDTH_GENERATED_RUNTIME_PASS');}finally{fs.rmSync(tmp,{recursive:true,force:true});}
