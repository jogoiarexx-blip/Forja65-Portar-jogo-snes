'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'rev204-logic.sfc');
const out=F.generateProject(rom,F.analyze(rom,384));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-rev204-logic-'));
try {
 fs.mkdirSync(path.join(dir,'assets'));
 fs.writeFileSync(path.join(dir,'runtime.hpp'),process.env.FORJA65_TEST_RUNTIME?fs.readFileSync(process.env.FORJA65_TEST_RUNTIME):out['src/runtime.hpp']);
 fs.writeFileSync(path.join(dir,'assets/cart-data.bin'),out['assets/cart-data.bin']);
 fs.copyFileSync(path.join(__dirname,'fixtures/rev204_logic_dual_bwram.cpp'),path.join(dir,'test.cpp'));
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o','test',...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,stdio:'inherit'});
 const result=cp.spawnSync(path.join(dir,'test'),[],{cwd:dir,encoding:'utf8',timeout:10000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.status!==0||result.error)throw new Error('REV204 logic replay failed: '+(result.error||result.status));
} finally {fs.rmSync(dir,{recursive:true,force:true});}
