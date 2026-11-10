'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const F=require('../forja65-core.js'),rom=F.loadRom(F.makeSyntheticRom(),'poll.sfc');
const generated=F.generateProject(rom,F.analyze(rom,384))['src/runtime.hpp'];
assert(generated.includes('inputPollRead('),'generated runtime must support consumption-based controller replay');
const headers=[['generated',generated],['kirby',fs.readFileSync(path.resolve(__dirname,'../../Kirby-Dream-Land-3-Port-v0.3-FULLGAME/src/runtime.hpp'),'utf8')]];
for(const [name,header] of headers){const d=fs.mkdtempSync(path.join(os.tmpdir(),'poll-test-'));try{
 fs.writeFileSync(path.join(d,'runtime.hpp'),header);fs.copyFileSync(path.join(__dirname,'fixtures/input_poll_replay.cpp'),path.join(d,'test.cpp'));
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','test.cpp','-o','test',...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:d,stdio:'inherit'});
 cp.execFileSync(path.join(d,'test'),[],{cwd:d,stdio:'inherit',timeout:120000});console.log('PASS runtime',name);
 }finally{fs.rmSync(d,{recursive:true,force:true});}}
