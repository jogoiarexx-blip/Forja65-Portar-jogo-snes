'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),F=require('../forja65-core.js');
const bytes=F.makeSyntheticRom();bytes.fill(0xEA,0,0x7fc0);
bytes.set([0x18,0xfb,0xc2,0x30,0xa9,0xff,0x8f,0x1a,0x85,0x10,0x6c,0x10,0],0);
bytes.set([0x20,0x00,0x91,0x4c,0x04,0x80],0x1000);
bytes.set([0xa9,0x34,0x12,0x85,0x20,0xe6,0x22,0x60],0x1100);
const rom=F.loadRom(bytes,'static-callee.sfc'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-callee-'));
try{
 const port=path.join(tmp,'port');
 for(const [rel,data] of Object.entries(F.generateProject(rom,F.analyze(rom,4096)))){const file=path.join(port,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
 const before=fs.readFileSync(path.join(port,'src/dispatch.cpp'),'utf8');assert(!/^\{0x009100u,/m.test(before));
 fs.writeFileSync(path.join(tmp,'rom.sfc'),bytes);fs.writeFileSync(path.join(tmp,'log.txt'),'FORJA65_CPU_INTERPRETER 1\nrom='+F.romFingerprint(rom)+'\n009000 M0X0 from=00800A count=3\n');
 cp.execFileSync(process.execPath,[path.join(root,'tools/learn-from-interpreter.js'),'--rom',path.join(tmp,'rom.sfc'),'--log',path.join(tmp,'log.txt'),'--out',path.join(tmp,'report'),'--port',port,'--budget','4096','--tag','callee_closure'],{stdio:'pipe'});
 const after=fs.readFileSync(path.join(port,'src/dispatch.cpp'),'utf8');assert(/^\{0x009000u,.*_callee_closure,/m.test(after));assert(/^\{0x009100u,.*_callee_closure,/m.test(after),'learned routine calls $9100, but its decoded callee was omitted');
 const report=JSON.parse(fs.readFileSync(path.join(tmp,'report/forja65-learned-report.json'),'utf8'));assert(report.analise.fecho_callees_estaticos.funcoes>=2);
 console.log('PASS CLI integrates learned entry and its static callee');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
