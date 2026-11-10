'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rev140-main-'));
try{
 for(const [name,content]of Object.entries(files)){const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
 for(const flags of [[],['-DFORJA65_NATIVE_SPC_LINKED=1']])cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-fsyntax-only',...flags,'-I','src','src/main.cpp'],{cwd:dir,stdio:'inherit'});
 console.log('PROJECT_BUILD_REV140_PASS generated-main');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
