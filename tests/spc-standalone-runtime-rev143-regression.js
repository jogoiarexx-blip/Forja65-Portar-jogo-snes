'use strict';
const F=require('../forja65-core'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const ram=new Uint8Array(65536);ram.set([0x2f,0xfe],0x200);const cap=F.loadSpcCapture(ram,'entry_candidate=512'),files=F.generateSpcProject(cap,F.spcAnalyze(cap,16)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'spc143-'));
for(const[n,v]of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
cp.execFileSync('g++',['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-fsyntax-only','spc700_native.cpp'],{cwd:dir,stdio:'inherit'});console.log('SPC_STANDALONE_RUNTIME_REV143_PASS unmodified-generated-headers');
