'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-iterative-return-'));
try{for(const native of [false,true])for(const mode of ['JSR','JSL','INDEXED']){
 const data=C.makeSyntheticRom(),prefix=native?[0x18,0xfb,0xc2,0x30]:[],call=mode==='JSL'?[0x22,0x00,0x82,0x00]:mode==='INDEXED'?[0xfc,0x00,0x90]:[0x20,0x00,0x82];
 data.set([...prefix,...call,0xdb],0);data.set([0x00,0x82],0x1000);
 const short=native?[0x68,0xa9,0x1f,0x80,0x48,0x60]:[0x68,0x68,0xa9,0x80,0x48,0xa9,0x1f,0x48,0x60];
 const long=native?[0x68,0xe2,0x20,0x68,0xa9,0x00,0x48,0xa9,0x80,0x48,0xa9,0x1f,0x48,0xc2,0x20,0x6b]:[0x68,0x68,0x68,0xa9,0x00,0x48,0xa9,0x80,0x48,0xa9,0x1f,0x48,0x6b];
 data.set(mode==='JSL'?long:short,0x200);
 const loop=native?[0xe6,0x10,0xa5,0x10,0xc9,0x60,0xea,0xd0,0xdb,0xdb]:[0xe6,0x10,0xa5,0x10,0xc9,0x60,0xd0,0xd8,0xdb];data.set(loop,0x20);
 const rom=C.loadRom(data),hints=`target=008020 kind=STACK-RTS e=${native?0:1} m=${native?0:1} x=${native?0:1} c=?\ntarget=008200 kind=STATE e=${native?0:1} m=${native?0:1} x=${native?0:1} c=?`,a=C.analyze(rom,384,hints);a.syntheticReturnTargets=[0x8020];
 const files=C.generateProject(rom,a),out=path.join(dir,(native?'native':'emulation')+'-'+mode);for(const [n,v]of Object.entries(files))if(n.startsWith('src/')||n==='assets/cart-data.bin'){const p=path.join(out,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 fs.writeFileSync(path.join(out,'test.cpp'),`#include "generated.hpp"
#include <memory>
#include <iostream>
int main(){auto h=std::make_unique<SnesRuntime>();h->loadCart("assets/cart-data.bin");h->ppu.forceBlank=true;CpuState c;c.enforceEmulation();forja65_dispatch(c,*h,0x8000,0);const unsigned count=h->ram[0x10]|(unsigned(h->ram[0x11])<<8);if(c.s!=0x1ff||count!=${native?60000:96}||!h->nativeReturns.empty()||h->nativeCallSerial!=${native?60000:96}||!h->stopped){std::cerr<<"FAIL count="<<count<<" stack="<<c.s<<" depth="<<h->nativeReturns.size()<<" calls="<<h->nativeCallSerial<<'\\n';return 1;}std::cout<<"ITERATIVE_RETURN_PASS mode=${mode} native=${+native} calls="<<h->nativeCallSerial<<" stack=1FF depth=0\\n";}
`);
 const sources=Object.keys(files).filter(n=>/^src\/generated_.*\.cpp$/.test(n)||n==='src/dispatch.cpp'||n==='src/native_hooks.cpp');
 const args=['-std=c++20','-O0','-DFORJA65_ENABLE_TRACE=0','-Isrc','test.cpp',...sources,'-o','test'];if(process.platform==='win32')args.push('-luser32','-lgdi32','-lxinput9_1_0','-lwinmm');
 cp.execFileSync(process.env.CXX||'g++',args,{cwd:out,stdio:'inherit'});const q=cp.spawnSync(path.join(out,'test'),[],{cwd:out,encoding:'utf8',timeout:90000,env:{...process.env,FORJA65_HEADLESS_FRAMES:'0'}});process.stdout.write(q.stdout||'');process.stderr.write(q.stderr||'');assert.equal(q.status,0,JSON.stringify({native,mode,signal:q.signal,error:q.error&&q.error.message}));
}console.log('ITERATIVE_RETURN_V043617_PASS cases=6 total_calls=180288');}finally{fs.rmSync(dir,{recursive:true,force:true});}
